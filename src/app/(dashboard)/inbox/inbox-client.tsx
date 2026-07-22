"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import {
  Search, Mail, MessageCircle, MessageSquare, Phone, Bot,
  Inbox as InboxIcon, User as UserIcon, MessagesSquare,
  ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { getConversation, getInboxMessages, openConversation } from "./actions";
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
  total: number;
  users: { id: string; name: string }[];
}

const PAGE_SIZE = 50;

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

export function InboxClient({ conversations: initialConversations, total: initialTotal, users }: InboxClientProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  // "auto" = pré-sélection du volet droit (ne marque PAS lu) ; "user" = clic explicite
  const [selectionSource, setSelectionSource] = useState<"auto" | "user">("auto");
  const [mobileOpen, setMobileOpen] = useState(false);
  const firstRun = useRef(true);
  // Cache des fils déjà ouverts : ré-ouvrir une conversation est instantané
  // (affichage immédiat + rafraîchissement en arrière-plan)
  const threadCache = useRef<Record<string, { lead: any; messages: any[] }>>({});
  const router = useRouter();

  // Après un router.refresh() (envoi de message…), le serveur renvoie la page 1
  // sans filtre : on ne resynchronise que si l'utilisateur est bien dans cet état.
  useEffect(() => {
    if (page === 1 && !search && !channelFilter && !userFilter && !unreadOnly) {
      setConversations(initialConversations);
      setTotal(initialTotal);
    }
  }, [initialConversations, initialTotal]);

  // Debounce : la recherche interroge le serveur — inutile de relancer à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filtres et pagination côté serveur : la liste couvre TOUTES les conversations
  // de l'organisation (style Gmail), pas seulement les plus récentes.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    let canceled = false;
    setLoading(true);
    getInboxMessages({
      page,
      channel: channelFilter || undefined,
      search: search || undefined,
      userId: userFilter || undefined,
      unread: unreadOnly || undefined,
    })
      .then((res) => {
        if (canceled) return;
        setConversations(res.conversations as any);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [page, search, channelFilter, userFilter, unreadOnly]);

  // Tout changement de filtre ramène à la page 1
  function applyChannelFilter(key: string | null) {
    setChannelFilter(key);
    setPage(1);
  }
  function applyUserFilter(value: string) {
    setUserFilter(value);
    setPage(1);
  }
  function applySearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }
  function toggleUnreadOnly() {
    setUnreadOnly((v) => !v);
    setPage(1);
  }

  const filtered = conversations;

  const selectedConv = useMemo(
    () => filtered.find((c) => c.lead.id === selectedLeadId) || null,
    [filtered, selectedLeadId]
  );

  // Auto-sélection de la 1ère conversation (peuple le volet droit sur desktop) —
  // n'ouvre pas l'overlay mobile et ne marque PAS la conversation comme lue.
  useEffect(() => {
    if (filtered.length === 0) { if (selectedLeadId !== null) setSelectedLeadId(null); return; }
    if (!selectedLeadId || !filtered.some((c) => c.lead.id === selectedLeadId)) {
      setSelectedLeadId(filtered[0].lead.id);
      setSelectionSource("auto");
    }
  }, [filtered, selectedLeadId]);

  function markRead(leadId: string) {
    setConversations((prev) => prev.map((c) => c.lead.id === leadId ? { ...c, unreadCount: 0 } : c));
  }

  function markUnread(leadId: string) {
    setConversations((prev) => prev.map((c) => c.lead.id === leadId ? { ...c, unreadCount: Math.max(1, c.unreadCount) } : c));
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, (page - 1) * PAGE_SIZE + filtered.length, total);

  function handleSelect(leadId: string) {
    setSelectedLeadId(leadId);
    setSelectionSource("user");
    // Overlay plein écran UNIQUEMENT sur mobile : sur desktop il restait monté
    // (masqué en CSS) → deux volets = double chargement du fil à chaque clic
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileOpen(true);
    }
    markRead(leadId);
  }

  return (
    <div className="lg:h-[calc(100vh-var(--header-height)-3rem)] lg:flex lg:flex-col lg:overflow-hidden">
      {/* Header */}
      <div className="mb-3 sm:mb-4 lg:flex-none">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} conversation{total > 1 ? "s" : ""}
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
              placeholder="Rechercher (nom, email, mot-clé du message)..."
              className="input pl-9 text-sm py-2 w-full"
              value={searchInput}
              onChange={(e) => applySearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-56 shrink-0">
            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              className="input pl-9 text-sm py-2 w-full"
              value={userFilter}
              onChange={(e) => applyUserFilter(e.target.value)}
            >
              <option value="">Tous les conseillers</option>
              <option value="unassigned">Non assigné</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center border-b border-gray-100 shrink-0">
          {/* Onglets canaux : défilent si l'espace manque */}
          <div className="flex overflow-x-auto no-scrollbar max-w-full">
            {[
              { key: null, label: "Tous" },
              { key: "EMAIL", label: "Email" },
              { key: "WHATSAPP", label: "WhatsApp" },
              // SMS retiré : canal pas encore disponible dans le produit
              { key: "CHATBOT", label: "Chatbot" },
            ].map((tab) => (
              <button
                key={tab.key || "all"}
                data-tour={tab.key === "WHATSAPP" ? "inbox-whatsapp-tab" : undefined}
                onClick={() => applyChannelFilter(tab.key)}
                className={cn(
                  "px-2.5 sm:px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                  channelFilter === tab.key
                    ? "text-brand-600 border-b-2 border-brand-600"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Filtre « Non lus » — hors de la zone défilante ; passe à la ligne
              (flex-wrap) si la place manque, jamais tronqué ni ne tronque les onglets */}
          <button
            onClick={toggleUnreadOnly}
            className={cn(
              "ml-auto my-1 mr-2 pl-2.5 pr-2.5 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap shrink-0",
              unreadOnly
                ? "bg-brand-600 text-white border-brand-600"
                : "text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50"
            )}
            title="N'afficher que les conversations avec des messages non lus"
          >
            Non lus
          </button>
        </div>

        {/* Conversation list */}
        <div className={cn(
          "divide-y divide-gray-50 lg:flex-1 lg:min-h-0 lg:overflow-y-auto",
          loading && "opacity-50 pointer-events-none"
        )}>
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

        {/* Pagination style Gmail : « 1–50 sur 2341 » */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 shrink-0 bg-white">
          <span className="text-xs text-gray-500 flex items-center gap-2">
            {loading && <Loader2 size={12} className="animate-spin text-brand-500" />}
            {loading
              ? "Chargement des conversations…"
              : total === 0 ? "0 conversation" : `${rangeStart}–${rangeEnd} sur ${total}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-transparent"
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={rangeEnd >= total || loading}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-transparent"
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </div>

        {/* Volet droit — conversation (desktop) */}
        <div className="hidden lg:block lg:h-full lg:min-h-0">
          <div className="bg-white rounded-xl border border-gray-200 h-full overflow-hidden">
            {selectedConv && !mobileOpen ? (
              <InboxConversationPane
                key={selectedConv.lead.id}
                conv={selectedConv}
                cache={threadCache}
                markReadOnOpen={selectionSource === "user"}
                onRead={() => markRead(selectedConv.lead.id)}
                onUnread={() => markUnread(selectedConv.lead.id)}
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
            cache={threadCache}
            markReadOnOpen
            onBack={() => setMobileOpen(false)}
            onRead={() => markRead(selectedConv.lead.id)}
            onUnread={() => markUnread(selectedConv.lead.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Volet droit : le fil complet est chargé à la sélection (une seule
// conversation), pour que la LISTE reste légère — getInboxMessages ne
// transfère plus que le dernier message de chaque conversation.
// Si le fil est déjà en cache → affichage instantané + refresh en arrière-plan.
// Le marquage « lu » est fusionné dans le même aller-retour (openConversation).
function InboxConversationPane({ conv, cache, onBack, onRead, onUnread, markReadOnOpen }: {
  conv: Conversation;
  cache: { current: Record<string, { lead: any; messages: any[] }> };
  onBack?: () => void;
  onRead?: () => void;
  onUnread?: () => void;
  markReadOnOpen?: boolean;
}) {
  const leadId = conv.lead.id;
  const cached = cache.current[leadId];
  const [lead, setLead] = useState<any>(cached ? cached.lead : conv.lead);
  // null = fil en cours de chargement (jamais ouvert)
  const [messages, setMessages] = useState<any[] | null>(cached ? cached.messages : null);

  useEffect(() => {
    let canceled = false;
    // Un seul POST : fil + marquage lu si sélection explicite de l'utilisateur
    const fetcher = markReadOnOpen ? openConversation : getConversation;
    fetcher(leadId)
      .then((d) => {
        cache.current[leadId] = { lead: d.lead, messages: d.messages };
        if (!canceled) { setLead(d.lead); setMessages(d.messages); }
        // Même si le volet a été fermé entre-temps, le serveur a bien marqué lu
        if (markReadOnOpen && onRead) onRead();
      })
      .catch(() => { if (!canceled && !cache.current[leadId]) setMessages([]); });
    return () => { canceled = true; };
  }, [leadId, markReadOnOpen]);

  // Rechargement léger (une seule conversation) après un envoi → nouveau message
  const reload = () => {
    getConversation(leadId)
      .then((d) => {
        cache.current[leadId] = { lead: d.lead, messages: d.messages };
        setLead(d.lead);
        setMessages(d.messages);
      })
      .catch(() => {});
  };

  if (messages === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 size={22} className="animate-spin text-brand-400" />
        <p className="text-xs text-gray-400">Chargement des échanges…</p>
      </div>
    );
  }

  return (
    <ConversationClient
      lead={lead}
      messages={messages}
      embedded
      onBack={onBack}
      onRead={onRead}
      onUnread={onUnread}
      markReadOnOpen={false}
      onMessageSent={reload}
    />
  );
}