"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComposeEmail } from "@/components/messaging/compose-email";
import {
  getWhatsAppWindowStatus,
  sendWhatsAppFromInbox,
  markConversationAsRead,
  getApprovedTemplatesForInbox,
  sendWhatsAppTemplateFromInbox,
} from "../actions";
import { cn, formatRelative, formatDateTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Mail, MessageCircle, MessageSquare, Phone, Bot,
  Paperclip, Download, Clock, AlertTriangle, Loader2, Sparkles,
  ChevronRight, X, ExternalLink, FileText, Tag, Globe, Search,
  Maximize2, Minimize2,
} from "lucide-react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  score: number;
  stage: { id: string; name: string; color: string } | null;
  pipeline: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  program: { id: string; name: string } | null;
}

interface Attachment {
  id: string;
  filename: string;
  contentType: string | null;
  size: number;
}

interface Message {
  id: string;
  channel: string;
  direction: string;
  content: string;
  status: string;
  sentAt: Date;
  sentBy: { id: string; name: string } | null;
  attachments: Attachment[];
}

interface ConversationClientProps {
  lead: Lead;
  messages: Message[];
  /** Rendu dans un volet (vue scindée de l'inbox) plutôt qu'en pleine page */
  embedded?: boolean;
  /** Bouton retour en mode embedded (overlay mobile) */
  onBack?: () => void;
  /** Appelé après le marquage "lu" (pour rafraîchir le badge de la liste) */
  onRead?: () => void;
  /** Appelé après un envoi (embedded) pour recharger le fil du volet droit */
  onMessageSent?: () => void;
}

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  PHONE_CALL: "Téléphone",
  CHATBOT: "Chatbot",
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
  PHONE_CALL: Phone,
  CHATBOT: Bot,
};

const CHANNEL_BG: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-700 border-blue-200",
  WHATSAPP: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SMS: "bg-purple-50 text-purple-700 border-purple-200",
  PHONE_CALL: "bg-amber-50 text-amber-700 border-amber-200",
  CHATBOT: "bg-violet-50 text-violet-700 border-violet-200",
};

function stripHtmlSimple(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

function parseMessageContent(msg: Message): { subject: string | null; body: string } {
  let subject: string | null = null;
  let body = msg.content;

  try {
    const parsed = JSON.parse(msg.content);
    subject = parsed.subject || null;
    body = parsed.body || "";
  } catch {
    // pas du JSON
  }

  const trimmed = body.trim();
  const isHtml = trimmed.startsWith("<") && (
    trimmed.includes("<html") ||
    trimmed.includes("<!DOCTYPE") ||
    trimmed.includes("<div") ||
    trimmed.includes("<table") ||
    trimmed.includes("<body") ||
    trimmed.includes("<p")
  );

  if (isHtml) {
    body = stripHtmlSimple(body);
  }

  if (msg.direction === "INBOUND" && msg.channel === "EMAIL") {
    body = body
      .replace(/^(>+\s*.*\n?)+/gm, "")
      .replace(/On .{1,200} wrote:[\s\S]*$/i, "")
      .replace(/Le .{1,200} a [eé]crit\s*:[\s\S]*$/i, "")
      .replace(/-{2,}.*Original Message.*-{2,}[\s\S]*$/i, "")
      .replace(/_{3,}[\s\S]*$/m, "")
      .trim();
  }

  if (!body.trim()) {
    body = "(Message vide)";
  }

  return { subject, body };
}

type ComposeChannel = "EMAIL" | "WHATSAPP";

export function ConversationClient({ lead, messages, embedded, onBack, onRead, onMessageSent }: ConversationClientProps) {
  const router = useRouter();
  const [composing, setComposing] = useState(!!embedded);
  const [expanded, setExpanded] = useState(false); // éditeur agrandi (remplit le volet droit)
  const messagesRef = useRef<HTMLDivElement>(null);
  const [composeChannel, setComposeChannel] = useState<ComposeChannel>("EMAIL");
  const [replySubject, setReplySubject] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState<{
    isOpen: boolean;
    hoursRemaining: number;
    hoursElapsed: number;
    lastInboundAt: Date | null;
  } | null>(null);
  const [whatsappText, setWhatsappText] = useState("");
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    if (!composing || composeChannel !== "WHATSAPP") {
      setWhatsappStatus(null);
      return;
    }
    let canceled = false;
    getWhatsAppWindowStatus(lead.id)
      .then((status) => {
        if (!canceled) setWhatsappStatus(status);
      })
      .catch(() => {
        if (!canceled) setWhatsappStatus({ isOpen: false, hoursRemaining: 0, hoursElapsed: 0, lastInboundAt: null });
      });
    return () => { canceled = true; };
  }, [composing, composeChannel, lead.id]);

  // ─── Marquer la conversation comme lue à l'ouverture ───
  useEffect(() => {
    markConversationAsRead(lead.id)
      .then(() => { if (onRead) onRead(); })
      .catch(() => { /* Silent fail - pas critique */ });
  }, [lead.id]);

  // ─── Auto-scroll en bas du fil (mode embedded = chat) ───
  useEffect(() => {
    if (embedded && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [embedded, messages.length]);

  const handleSendWhatsApp = async (text: string) => {
    if (!text.trim()) return;
    setSendingWhatsApp(true);
    try {
      await sendWhatsAppFromInbox(lead.id, text);
      toast.success("Message envoyé à " + lead.firstName);
      setWhatsappText("");
      if (embedded) {
        if (onMessageSent) onMessageSent(); // recharge le fil du volet droit
      } else {
        setComposing(false);
      }
      router.refresh();
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("24") || msg.toLowerCase().includes("template") || msg.toLowerCase().includes("re-engagement")) {
        toast.error("Fenêtre 24h fermée — veuillez utiliser un template");
        getWhatsAppWindowStatus(lead.id).then(setWhatsappStatus).catch(() => {});
      } else {
        toast.error("Erreur lors de l'envoi : " + (err.message || "inconnu"));
      }
    }
    setSendingWhatsApp(false);
  };

  return (
    <div className={cn(embedded ? "relative flex flex-col h-full min-h-0 bg-white" : "pb-32")}>
      {/* Header */}
      <div className={cn(
        "z-30 bg-white border-b border-gray-200",
        embedded ? "shrink-0 px-4 py-3" : "sticky top-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4"
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {embedded ? (
              onBack ? (
                <button
                  onClick={onBack}
                  className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0 lg:hidden"
                  aria-label="Retour à l'inbox"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : null
            ) : (
              <Link
                href="/inbox"
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
                aria-label="Retour à l'inbox"
              >
                <ArrowLeft size={18} />
              </Link>
            )}
            <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center shrink-0">
              {getInitials(lead.firstName + " " + lead.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {lead.firstName} {lead.lastName}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                {lead.email && <span className="truncate">{lead.email}</span>}
                {lead.phone && lead.phone !== "N/A" && <span>· {lead.phone}</span>}
                {lead.stage && <span className="text-brand-600 font-medium">· {lead.stage.name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={"/leads/" + lead.id}
              className="btn-secondary py-1.5 text-xs"
              title="Voir la fiche complète"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Fiche</span>
            </Link>
            <button
              onClick={() => { setComposing(true); setComposeChannel("EMAIL"); setReplySubject(""); }}
              className="btn-primary py-1.5 text-xs"
            >
              <Send size={13} />
              <span className="hidden sm:inline">Répondre</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={embedded ? messagesRef : undefined}
        className={cn(
          embedded ? "flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50" : "space-y-4 max-w-4xl mx-auto"
        )}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Mail size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">Aucun message dans cette conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const parsed = parseMessageContent(msg);
            return (
              <MessageCard
                key={msg.id}
                msg={msg}
                parsed={parsed}
                lead={lead}
                onReply={(subject) => {
                  setReplySubject(subject);
                  setComposeChannel("EMAIL");
                  setComposing(true);
                  setTimeout(() => {
                    if (embedded) {
                      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
                    } else {
                      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                    }
                  }, 100);
                }}
              />
            );
          })
        )}
      </div>

      {/* Composer — bas du volet (embedded) ou barre fixe (pleine page) */}
      {composing && (
        <div className={cn(
          "bg-white border-gray-200",
          embedded
            ? (expanded ? "absolute inset-0 z-40 flex flex-col" : "shrink-0 border-t lg:max-h-[48%] overflow-y-auto")
            : "fixed bottom-0 left-0 right-0 z-40 border-t shadow-2xl"
        )}>
          <div className={cn("p-3 sm:p-4", expanded && "flex flex-col h-full min-h-0", !embedded && "max-w-4xl mx-auto")}>
            <div className={cn("flex items-center justify-between mb-3 pb-3 border-b border-gray-100", expanded && "shrink-0")}>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                <button
                  onClick={() => setComposeChannel("EMAIL")}
                  disabled={!lead.email}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    composeChannel === "EMAIL"
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-gray-600 hover:bg-white"
                  )}
                >
                  <Mail size={12} />
                  Email
                </button>
                <button
                  onClick={() => setComposeChannel("WHATSAPP")}
                  disabled={!lead.phone || lead.phone === "N/A"}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                    composeChannel === "WHATSAPP"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-gray-600 hover:bg-white"
                  )}
                >
                  <MessageCircle size={12} />
                  WhatsApp
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {embedded && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg text-xs font-semibold px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                    title={expanded ? "Réduire la rédaction" : "Agrandir la rédaction"}
                  >
                    {expanded ? <><Minimize2 size={14} /> Réduire</> : <><Maximize2 size={14} /> Agrandir</>}
                  </button>
                )}
                <button
                  onClick={() => { setComposing(false); setExpanded(false); setReplySubject(""); setWhatsappText(""); }}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Fermer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className={cn(expanded && "flex-1 min-h-0 flex flex-col")}>
            {composeChannel === "EMAIL" && (
              <ComposeEmail
                leadId={lead.id}
                leadName={lead.firstName + " " + lead.lastName}
                leadEmail={lead.email}
                initialSubject={replySubject}
                compact
                fill={expanded}
                onSent={() => {
                  setReplySubject("");
                  if (embedded) {
                    if (onMessageSent) onMessageSent(); // recharge le fil du volet droit (le compositeur reste ouvert)
                  } else {
                    setComposing(false);
                  }
                  router.refresh();
                }}
                onClose={() => { setComposing(false); setExpanded(false); setReplySubject(""); }}
              />
            )}

            {composeChannel === "WHATSAPP" && (
              <WhatsAppComposerInline
                lead={lead}
                status={whatsappStatus}
                text={whatsappText}
                setText={setWhatsappText}
                sending={sendingWhatsApp}
                onSend={handleSendWhatsApp}
              />
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Carte d'un message ───
function MessageCard({ msg, parsed, lead, onReply }: {
  msg: Message;
  parsed: { subject: string | null; body: string };
  lead: Lead;
  onReply: (subject: string) => void;
}) {
  const Icon = CHANNEL_ICONS[msg.channel] || Mail;
  const isOutbound = msg.direction === "OUTBOUND";
  const channelLabel = CHANNEL_LABEL[msg.channel] || msg.channel;
  const channelBg = CHANNEL_BG[msg.channel] || "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", channelBg)}>
            <Icon size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", channelBg)}>
                {channelLabel}
              </span>
              <span className="text-xs font-medium text-gray-700">
                {isOutbound ? "Vous → " + lead.firstName : lead.firstName + " → Vous"}
              </span>
              {isOutbound && msg.sentBy && (
                <span className="text-[10px] text-gray-400">par {msg.sentBy.name}</span>
              )}
            </div>
            {parsed.subject && (
              <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
                {parsed.subject}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn(
            "text-[10px] font-medium",
            msg.status === "DELIVERED" || msg.status === "READ" ? "text-emerald-600" :
            msg.status === "FAILED" ? "text-red-600" : "text-gray-400"
          )}>
            {msg.status === "READ" ? "Lu" :
             msg.status === "DELIVERED" ? "Reçu" :
             msg.status === "SENT" ? "Envoyé" :
             msg.status === "FAILED" ? "Échoué" :
             msg.status === "QUEUED" ? "En attente" : msg.status}
          </span>
          <span className="text-[10px] text-gray-400 whitespace-nowrap" title={formatDateTime(msg.sentAt)}>
            {formatRelative(msg.sentAt)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
          {parsed.body}
        </p>

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {msg.attachments.map((att) => (
              <a
                key={att.id}
                href={"/api/attachments/" + att.id}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-200 rounded-lg text-xs text-gray-700 hover:text-brand-600 transition-colors"
              >
                <Paperclip size={12} className="text-gray-400 shrink-0" />
                <span className="truncate flex-1">{att.filename}</span>
                {att.size > 0 && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {att.size < 1024 * 1024 ? Math.round(att.size / 1024) + " Ko" : (att.size / (1024 * 1024)).toFixed(1) + " Mo"}
                  </span>
                )}
                <Download size={11} className="text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {!isOutbound && msg.channel === "EMAIL" && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => {
              let subj = parsed.subject || "";
              if (!subj.toLowerCase().startsWith("re:")) subj = "Re: " + subj;
              onReply(subj);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Send size={11} /> Répondre à cet email
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Composer WhatsApp ───
function WhatsAppComposerInline({ lead, status, text, setText, sending, onSend }: {
  lead: Lead;
  status: { isOpen: boolean; hoursRemaining: number; hoursElapsed: number; lastInboundAt: Date | null } | null;
  text: string;
  setText: (v: string) => void;
  sending: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  const phone = (lead.phone || "").replace(/\D/g, "");
  const prenom = lead.firstName;

  // Charger les templates approuvés
  useEffect(() => {
    if (!showTemplates) return;
    setLoadingTemplates(true);
    getApprovedTemplatesForInbox()
      .then((data) => setTemplates(data))
      .catch(() => toast.error("Impossible de charger les templates"))
      .finally(() => setLoadingTemplates(false));
  }, [showTemplates]);

  // Filtrage des templates par recherche
  const filteredTemplates = templates.filter((tpl: any) => {
    if (!templateSearch.trim()) return true;
    const q = templateSearch.toLowerCase();
    return tpl.metaName.toLowerCase().includes(q) || tpl.bodyText.toLowerCase().includes(q);
  });

  // Aperçu du template avec valeurs du lead
  const renderTemplatePreview = (template: any) => {
    let body = template.bodyText;
    const mapping = template.variableMapping || {};
    const sortedKeys = Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b));

    sortedKeys.forEach((key) => {
      const path = mapping[key];
      let value = "";
      if (path.startsWith("lead.")) {
        const field = path.substring(5);
        value = (lead as any)[field] || `[${field}]`;
      }
      body = body.replace(`{{${key}}}`, value);
    });
    return body;
  };

  // Envoi d'un template Meta
  const handleSendTemplate = async (template: any) => {
    setSendingTemplate(template.id);
    try {
      await sendWhatsAppTemplateFromInbox(lead.id, template.id);
      toast.success(`Template "${template.metaName}" envoyé à ${prenom}`);
      setShowTemplates(false);
      setPreviewTemplate(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    }
    setSendingTemplate(null);
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-xs">Vérification de la fenêtre WhatsApp...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Statut fenêtre 24h */}
      {status.isOpen ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Clock size={12} className="text-emerald-600 shrink-0" />
          <p className="text-[11px] text-emerald-700 flex-1">
            <span className="font-semibold">Fenêtre 24h ouverte</span> · {status.hoursRemaining}h restantes
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-800 font-semibold">Fenêtre 24h fermée</p>
            <p className="text-[10px] text-amber-700">
              {status.lastInboundAt
                ? `Dernier message du lead il y a ${Math.round(status.hoursElapsed)}h. Utilisez un template Meta-approuvé.`
                : "Le lead ne vous a jamais écrit. Utilisez un template Meta-approuvé."}
            </p>
          </div>
        </div>
      )}

      {/* Texte libre — UNIQUEMENT si fenêtre ouverte */}
      {status.isOpen && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Écrivez votre message à ${prenom}...`}
          className="input text-sm w-full min-h-[80px] max-h-[200px] resize-y"
          rows={3}
        />
      )}

      {/* Bouton sélecteur de templates */}
      <button
        type="button"
        onClick={() => setShowTemplates(!showTemplates)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
          !status.isOpen
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
        )}
      >
        <span className="flex items-center gap-2">
          <FileText size={12} />
          {!status.isOpen ? "Choisir un template Meta (obligatoire)" : "Envoyer un template Meta"}
        </span>
        <ChevronRight size={11} className={cn("transition-transform", showTemplates && "rotate-90")} />
      </button>

      {/* Panneau templates */}
      {showTemplates && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Recherche */}
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un template..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="input text-xs pl-7 py-1.5 w-full"
              />
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-64 overflow-y-auto">
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <Loader2 size={14} className="animate-spin mr-2" />
                <span className="text-xs">Chargement des templates...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-6 text-center px-4">
                <FileText size={20} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-3">
                  {templates.length === 0
                    ? "Aucun template approuvé"
                    : "Aucun template ne correspond"}
                </p>
                {templates.length === 0 && (
                  <Link
                    href="/settings/whatsapp-templates"
                    className="btn-primary py-1 px-2 text-[10px] inline-flex"
                  >
                    Créer un template
                  </Link>
                )}
              </div>
            ) : (
              filteredTemplates.map((tpl: any) => (
                <div
                  key={tpl.id}
                  className="px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-emerald-50/30 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                    <p className="text-xs font-semibold text-gray-900 font-mono truncate flex-1">
                      {tpl.metaName}
                    </p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {tpl.category}
                    </span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                      {tpl.language.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">
                    {renderTemplatePreview(tpl)}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setPreviewTemplate(tpl)}
                      className="text-[10px] text-gray-500 hover:text-gray-700 underline"
                    >
                      Aperçu
                    </button>
                    <button
                      onClick={() => handleSendTemplate(tpl)}
                      disabled={sendingTemplate === tpl.id}
                      className="btn-primary py-1 px-2 text-[10px] bg-emerald-500 hover:bg-emerald-600 border-emerald-500"
                    >
                      {sendingTemplate === tpl.id ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <Send size={9} />
                      )}
                      Envoyer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal preview */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          renderedBody={renderTemplatePreview(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
          onSend={() => {
            const tpl = previewTemplate;
            setPreviewTemplate(null);
            handleSendTemplate(tpl);
          }}
          sending={sendingTemplate === previewTemplate.id}
        />
      )}

      {/* Bouton envoyer le texte libre */}
      {status.isOpen && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] text-gray-500 truncate flex-1">
            Destinataire : <span className="text-gray-700">{phone}</span>
          </div>
          <button
            onClick={() => onSend(text)}
            disabled={!text.trim() || sending}
            className="btn-primary py-1.5 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 border-emerald-500"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Envoyer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Modal preview template ───
function TemplatePreviewModal({
  template,
  renderedBody,
  onClose,
  onSend,
  sending,
}: {
  template: any;
  renderedBody: string;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{template.metaName}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {template.category}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                {template.language.toUpperCase()}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-gray-500 mb-3">Aperçu avec les données du lead :</p>

          {/* WhatsApp bubble */}
          <div className="bg-gradient-to-br from-[#e5ddd5] to-[#e5ddd5]/70 rounded-xl p-4">
            <div className="max-w-[280px] ml-auto bg-[#dcf8c6] rounded-lg shadow-sm overflow-hidden">
              {template.headerText && (
                <div className="px-3 pt-2 font-bold text-sm text-gray-900">
                  {template.headerText}
                </div>
              )}
              <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                {renderedBody}
              </div>
              {template.footerText && (
                <div className="px-3 pb-2 text-xs text-gray-500">{template.footerText}</div>
              )}
              <div className="px-3 pb-1 text-right">
                <span className="text-[10px] text-gray-500">10:30 ✓✓</span>
              </div>
            </div>

            {template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0 && (
              <div className="max-w-[280px] ml-auto mt-1 space-y-1">
                {template.buttons.map((btn: any, i: number) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg px-3 py-2 text-center text-sm text-blue-600 font-medium shadow-sm"
                  >
                    {btn.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary py-1.5 px-3 text-xs">
            Annuler
          </button>
          <button
            onClick={onSend}
            disabled={sending}
            className="btn-primary py-1.5 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 border-emerald-500"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Envoyer ce template
          </button>
        </div>
      </div>
    </div>
  );
}