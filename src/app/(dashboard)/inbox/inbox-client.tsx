"use client";

import { useState } from "react";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import { ComposeEmail } from "@/components/messaging/compose-email";
import {
  Search, Send, Mail, MessageCircle, MessageSquare, Phone,
  Plus, ChevronRight, Inbox as InboxIcon,
} from "lucide-react";

interface Conversation {
  lead: { id: string; firstName: string; lastName: string; email: string | null; phone: string };
  messages: {
    id: string;
    channel: string;
    direction: string;
    content: string;
    status: string;
    sentAt: Date;
    sentBy: { id: string; name: string } | null;
  }[];
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
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  SMS: MessageSquare,
  PHONE_CALL: Phone,
};

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "text-brand-500",
  WHATSAPP: "text-emerald-500",
  SMS: "text-blue-500",
  PHONE_CALL: "text-purple-500",
};

export function InboxClient({ conversations: initialConversations }: InboxClientProps) {
  const [conversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const selected = conversations.find((c) => c.lead.id === selectedId);

  const filtered = conversations.filter((c) => {
    if (search) {
      var q = search.toLowerCase();
      var name = (c.lead.firstName + " " + c.lead.lastName).toLowerCase();
      if (!name.includes(q) && !(c.lead.email || "").toLowerCase().includes(q)) return false;
    }
    if (channelFilter) {
      if (!c.messages.some((m) => m.channel === channelFilter)) return false;
    }
    return true;
  });

  const getMessagePreview = (msg: { content: string; channel: string }) => {
    try {
      var parsed = JSON.parse(msg.content);
      return parsed.subject || parsed.body?.slice(0, 60) || msg.content.slice(0, 60);
    } catch {
      return msg.content.slice(0, 60);
    }
  };

  const formatMessageContent = (content: string) => {
    try {
      var parsed = JSON.parse(content);
      return { subject: parsed.subject, body: parsed.body };
    } catch {
      return { subject: null, body: content };
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length} conversation{conversations.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <div className="grid grid-cols-[340px_1fr] h-full">
          {/* Conversation list */}
          <div className="border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="input pl-9 text-sm py-2"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Channel tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: null, label: "Tous" },
                { key: "EMAIL", label: "Email" },
                { key: "WHATSAPP", label: "WhatsApp" },
                { key: "SMS", label: "SMS" },
              ].map((tab) => (
                <button
                  key={tab.key || "all"}
                  onClick={() => setChannelFilter(tab.key)}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-medium transition-colors",
                    channelFilter === tab.key
                      ? "text-brand-600 border-b-2 border-brand-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Conversation items */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((conv) => {
                  var ChannelIcon = CHANNEL_ICONS[conv.lastMessage.channel] || Mail;
                  var isSelected = conv.lead.id === selectedId;
                  return (
                    <button
                      key={conv.lead.id}
                      onClick={() => { setSelectedId(conv.lead.id); setComposing(false); }}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors",
                        isSelected && "bg-brand-50/50 border-l-2 border-l-brand-500"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {getInitials(conv.lead.firstName + " " + conv.lead.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {conv.lead.firstName} {conv.lead.lastName}
                            </p>
                            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                              {formatRelative(conv.lastMessage.sentAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ChannelIcon size={12} className={CHANNEL_COLORS[conv.lastMessage.channel] || "text-gray-400"} />
                            <p className="text-xs text-gray-500 truncate">
                              {conv.lastMessage.direction === "OUTBOUND" ? "Vous: " : ""}
                              {getMessagePreview(conv.lastMessage)}
                            </p>
                          </div>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                            {conv.unreadCount}
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
                    {search ? "Aucun resultat" : "Aucune conversation"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Message thread */}
          {selected ? (
            <div className="flex flex-col h-full">
              {/* Thread header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">
                    {getInitials(selected.lead.firstName + " " + selected.lead.lastName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selected.lead.firstName} {selected.lead.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selected.lead.email || selected.lead.phone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setComposing(true)}
                  className="btn-primary py-1.5 text-xs"
                >
                  <Send size={13} /> Envoyer un email
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {composing && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4 animate-scale-in">
                    <ComposeEmail
                      leadId={selected.lead.id}
                      leadName={selected.lead.firstName + " " + selected.lead.lastName}
                      leadEmail={selected.lead.email}
                      compact
                      onSent={() => setComposing(false)}
                      onClose={() => setComposing(false)}
                    />
                  </div>
                )}

                {[...selected.messages].reverse().map((msg) => {
                  var isOutbound = msg.direction === "OUTBOUND";
                  var ChannelIcon = CHANNEL_ICONS[msg.channel] || Mail;
                  var parsed = formatMessageContent(msg.content);

                  return (
                    <div key={msg.id} className={cn("flex gap-3", isOutbound && "flex-row-reverse")}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isOutbound ? "bg-brand-100" : "bg-gray-100"
                      )}>
                        {isOutbound && msg.sentBy ? (
                          <span className="text-[10px] font-bold text-brand-700">
                            {getInitials(msg.sentBy.name)}
                          </span>
                        ) : (
                          <ChannelIcon size={14} className={CHANNEL_COLORS[msg.channel] || "text-gray-500"} />
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[70%] rounded-xl px-4 py-3",
                        isOutbound ? "bg-brand-50" : "bg-gray-100"
                      )}>
                        {parsed.subject && (
                          <p className="text-xs font-semibold text-gray-700 mb-1">{parsed.subject}</p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{parsed.body}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <ChannelIcon size={11} className={CHANNEL_COLORS[msg.channel] || "text-gray-400"} />
                          <span className="text-[10px] text-gray-400">{formatRelative(msg.sentAt)}</span>
                          {isOutbound && msg.sentBy && (
                            <span className="text-[10px] text-gray-400">par {msg.sentBy.name}</span>
                          )}
                          <span className={cn("text-[10px] font-medium",
                            msg.status === "SENT" || msg.status === "DELIVERED" ? "text-emerald-500" :
                            msg.status === "FAILED" ? "text-red-500" : "text-gray-400"
                          )}>
                            {msg.status === "SENT" ? "Envoyé" : msg.status === "DELIVERED" ? "Reçu" :
                             msg.status === "FAILED" ? "Échoué" : msg.status === "QUEUED" ? "En attente" : msg.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 h-full">
              <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
                <Send size={36} className="text-brand-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Inbox</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Sélectionnez une conversation ou envoyez un email depuis la fiche d'un lead.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
