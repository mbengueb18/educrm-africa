"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import {
  Search, Mail, MessageCircle, MessageSquare, Phone, Bot,
  Inbox as InboxIcon, User as UserIcon, MessagesSquare,
} from "lucide-react";
import { getConversation } from "./actions";
import { ConversationClient } from "./[leadId]/conversation-client";

interface Conversation {
  lead: {
    id: string; firstName: string; lastName: string; email: string | null; phone: string;
    whatsapp?: string | null; score?: number;
    assignedTo: { id: string; name: string } | null;
    stage?: { id: string; name: string; color: string } | null;
    pipeline?: { id: string; name: string } | null;
    program?: { id: string; name: string } | null;
  };
  messages: any[];
  lastMessage: {
    id: string;
    channel: string;
    direction: string;
    content: string;
    status: string;
    sentAt: Date;
  };
  unreadCount: number;
}

interface InboxClientProps {
  conversations: Conversation[];
  users: { id: string; name: string }[];
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
  PHONE_CALL: Phone,
  CHATBOT: Bot,
};

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "text-brand-500",
  WHATSAPP: "text-emerald-500",
  SMS: "text-blue-500",
  PHONE_CALL: "text-purple-500",
  CHATBOT: "text-violet-500",
};

// Helper pour stripper le HTML
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

function getMessagePreview(content: string): string {
  var body = content;
  try {
    var parsed = JSON.parse(content);
    body = parsed.subject || parsed.body || content;
  } catch {
    // pas du JSON
  }
  
  var trimmed = body.trim();
  if (trimmed.startsWith("<")) {
    body = stripHtmlSimple(body);
  }
  
  return body.slice(0, 80);
}

export function InboxClient({ conversations: initialConversations, users }: InboxClientProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const filtered = useMemo(() => conversations.filter((c) => {
    if (search) {
      var q = search.toLowerCase();
      var name = (c.lead.firstName + " " + c.lead.lastName).toLowerCase();
      if (!name.includes(q) && !(c.lead.email || "").toLowerCase().includes(q)) return false;
    }
    if (channelFilter) {
      if (!c.messages.some((m: any) => m.channel === channelFilter)) return false;
    }
    if (userFilter) {
      if (userFilter === "unassigned") {
        if (c.lead.assignedTo) return false;
      } else if (c.lead.assignedTo?.id !== userFilter) {
        return false;
      }
    }
    return true;
  }), [conversations, search, channelFilter, userFilter]);

  const selectedConv = useMemo(
    () => filtered.find((c) => c.lead.id === selectedLeadId) || null,
    [filtered, selectedLeadId]
  );

  // Auto-sélection de la 1ère conversation (peuple le volet droit sur desktop) —
  // n'ouvre pas l'overlay mobile.
  useEffect(() => {
    if (filtered.length === 0) { if (selectedLeadId !== null) setSelectedLeadId(null); return; }
    if (!selectedLeadId || !filtered.some((c) => c.lead.id === selectedLeadId)) {
      setSelectedLeadId(filtered[0].lead.id);
    }
  }, [filtered, selectedLeadId]);

  function markRead(leadId: string) {
    setConversations((prev) => prev.map((c) => c.lead.id === leadId ? { ...c, unreadCount: 0 } : c));
  }

  function handleSelect(leadId: string) {
    setSelectedLeadId(leadId);
    setMobileOpen(true);
    markRead(leadId);
  }

  return (
    <div className="lg:h-[calc(100vh-var(--header-height)-3rem)] lg:flex lg:flex-col lg:overflow-hidden">
      {/* Header */}
      <div className="mb-3 sm:mb-4 lg:flex-none">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">
          {conversations.length} conversation{conversations.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Vue scindée : liste (gauche 30%) + conversation (droite 70%) */}
      <div className="lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[30%_1fr] lg:gap-4">
        {/* Volet gauche : recherche + filtres + liste */}
        <div className="bg-white rounded-xl border border-gray-200 lg:flex lg:flex-col lg:min-h-0 lg:h-full lg:overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              className="input pl-9 text-sm py-2 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-56 shrink-0">
            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-9 text-sm py-2 w-full"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="">Tous les commerciaux</option>
              <option value="unassigned">Non assigné</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0">
          {[
            { key: null, label: "Tous" },
            { key: "EMAIL", label: "Email" },
            { key: "WHATSAPP", label: "WhatsApp" },
            { key: "SMS", label: "SMS" },
            { key: "CHATBOT", label: "Chatbot" },
          ].map((tab) => (
            <button
              key={tab.key || "all"}
              onClick={() => setChannelFilter(tab.key)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                channelFilter === tab.key
                  ? "text-brand-600 border-b-2 border-brand-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="divide-y divide-gray-50 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((conv) => {
              var ChannelIcon = CHANNEL_ICONS[conv.lastMessage.channel] || Mail;
              var isSel = conv.lead.id === selectedLeadId;
              return (
                <button
                  key={conv.lead.id}
                  onClick={() => handleSelect(conv.lead.id)}
                  className={cn(
                    "w-full text-left px-4 sm:px-5 py-3.5 transition-colors border-l-[3px]",
                    isSel ? "bg-brand-50/60 border-brand-500" : "border-transparent hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center shrink-0">
                      {getInitials(conv.lead.firstName + " " + conv.lead.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className={cn(
                          "text-sm truncate",
                          conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"
                        )}>
                          {conv.lead.firstName} {conv.lead.lastName}
                        </p>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2 whitespace-nowrap">
                          {formatRelative(conv.lastMessage.sentAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon size={12} className={cn("shrink-0", CHANNEL_COLORS[conv.lastMessage.channel] || "text-gray-400")} />
                        <p className={cn(
                          "text-xs truncate",
                          conv.unreadCount > 0 ? "text-gray-800 font-medium" : "text-gray-500"
                        )}>
                          {conv.lastMessage.direction === "OUTBOUND" ? "Vous: " : ""}
                          {getMessagePreview(conv.lastMessage.content)}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <UserIcon size={9} className="shrink-0" />
                        {conv.lead.assignedTo ? conv.lead.assignedTo.name : "Non assigné"}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <InboxIcon size={32} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">
                {search ? "Aucun résultat" : "Aucune conversation"}
              </p>
            </div>
          )}
        </div>
        </div>

        {/* Volet droit — conversation (desktop) */}
        <div className="hidden lg:block lg:h-full lg:min-h-0">
          <div className="bg-white rounded-xl border border-gray-200 h-full overflow-hidden">
            {selectedConv ? (
              <InboxConversationPane
                key={selectedConv.lead.id}
                conv={selectedConv}
                onRead={() => markRead(selectedConv.lead.id)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 gap-2">
                <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-500"><MessagesSquare size={26} /></div>
                <h3 className="text-sm font-semibold text-gray-600">Sélectionnez une conversation</h3>
                <p className="text-xs text-gray-400 max-w-[240px]">Choisissez une conversation à gauche pour lire les échanges et répondre.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay mobile — conversation plein écran */}
      {mobileOpen && selectedConv && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white">
          <InboxConversationPane
            key={selectedConv.lead.id}
            conv={selectedConv}
            onBack={() => setMobileOpen(false)}
            onRead={() => markRead(selectedConv.lead.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Volet droit : rendu INSTANTANÉ depuis les données déjà chargées (cache) ───
// Les messages de chaque conversation sont déjà présents dans getInboxMessages,
// donc pas de re-fetch à la sélection. Un rechargement léger n'a lieu qu'après un envoi.
function sortAsc(messages: any[]): any[] {
  return [...messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

function InboxConversationPane({ conv, onBack, onRead }: {
  conv: Conversation;
  onBack?: () => void;
  onRead?: () => void;
}) {
  const leadId = conv.lead.id;
  const [lead, setLead] = useState<any>(conv.lead);
  const [messages, setMessages] = useState<any[]>(() => sortAsc(conv.messages));

  // Changement de conversation → réinitialiser depuis le cache (instantané)
  useEffect(() => {
    setLead(conv.lead);
    setMessages(sortAsc(conv.messages));
  }, [leadId, conv.messages]);

  // Rechargement léger (une seule conversation) après un envoi → nouveau message
  const reload = () => {
    getConversation(leadId)
      .then((d) => { setLead(d.lead); setMessages(d.messages); })
      .catch(() => {});
  };

  return (
    <ConversationClient
      lead={lead}
      messages={messages}
      embedded
      onBack={onBack}
      onRead={onRead}
      onMessageSent={reload}
    />
  );
}