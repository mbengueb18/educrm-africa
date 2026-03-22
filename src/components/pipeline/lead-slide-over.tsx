"use client";

import { useEffect, useState, useTransition } from "react";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { moveLeadToStage, assignLead, updateLeadScore } from "@/app/(dashboard)/pipeline/actions";
import { cn, formatCFA, formatDate, formatDateTime, formatRelative, formatPhone, getInitials, getScoreBg } from "@/lib/utils";
import { toast } from "sonner";
import {
  X,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  GraduationCap,
  Calendar,
  User as UserIcon,
  Building2,
  Tag,
  Activity,
  FileText,
  Send,
  ChevronDown,
  Clock,
  ArrowRight,
  Loader2,
  MessageSquare,
  Megaphone,
} from "lucide-react";
import { getCustomFields, type CustomFieldConfig } from "@/lib/custom-fields";
import { ComposeEmail } from "@/components/messaging/compose-email";

type LeadDetail = Awaited<ReturnType<typeof getLeadDetail>>;

interface LeadSlideOverProps {
  leadId: string | null;
  onClose: () => void;
  stages: { id: string; name: string; color: string }[];
  users: { id: string; name: string }[];
}

const sourceLabels: Record<string, string> = {
  WEBSITE: "Site web",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  PHONE_CALL: "Appel",
  WALK_IN: "Visite",
  REFERRAL: "Parrainage",
  SALON: "Salon",
  RADIO: "Radio",
  TV: "TV",
  PARTNER: "Partenaire",
  IMPORT: "Import",
  OTHER: "Autre",
};

const activityIcons: Record<string, typeof Activity> = {
  LEAD_CREATED: Tag,
  LEAD_STAGE_CHANGED: ArrowRight,
  LEAD_ASSIGNED: UserIcon,
  MESSAGE_SENT: Send,
  MESSAGE_RECEIVED: MessageSquare,
  CALL_LOGGED: Phone,
  NOTE_ADDED: FileText,
  DOCUMENT_UPLOADED: FileText,
};

export function LeadSlideOver({ leadId, onClose, stages, users }: LeadSlideOverProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "activity" | "messages">("info");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    setLoading(true);
    getLeadDetail(leadId)
      .then(setLead)
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [leadId]);
  
  const [customFieldsConfig, setCustomFieldsConfig] = useState<CustomFieldConfig[]>([]);
  useEffect(() => {
    getCustomFields().then(setCustomFieldsConfig).catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleStageChange = (stageId: string) => {
    if (!lead) return;
    startTransition(async () => {
      try {
        await moveLeadToStage(lead.id, stageId);
        setLead((prev) => prev ? { ...prev, stageId, stage: stages.find((s) => s.id === stageId) || prev.stage } as any : null);
        toast.success("Étape mise à jour");
      } catch {
        toast.error("Erreur lors du changement d'étape");
      }
    });
  };

  const handleAssign = (userId: string) => {
    if (!lead) return;
    startTransition(async () => {
      try {
        await assignLead(lead.id, userId || null);
        const user = users.find((u) => u.id === userId);
        setLead((prev) => prev ? { ...prev, assignedToId: userId || null, assignedTo: user ? { ...user, avatar: null, email: "" } : null } as any : null);
        toast.success(userId ? "Lead assigné" : "Lead désassigné");
      } catch {
        toast.error("Erreur");
      }
    });
  };

  if (!leadId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in"
           style={{ animationName: 'slideInRight' }}>
        
        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-brand-500" />
          </div>
        )}

        {lead && !loading && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 text-lg font-bold flex items-center justify-center shrink-0">
                    {getInitials(`${lead.firstName} ${lead.lastName}`)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.city && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} />
                          {lead.city}
                        </span>
                      )}
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", getScoreBg(lead.score))}>
                        Score: {lead.score}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 mt-3">
                  <a href={`tel:${lead.phone}`} className="btn-secondary py-1.5 px-3 text-xs">
                    <Phone size={13} /> Appeler
                  </a>
                  {lead.whatsapp && (
                    <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank"
                       className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="btn-secondary py-1.5 px-3 text-xs">
                      <Mail size={13} /> Email
                    </a>
                  )}
                </div>
              </div>

              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Stage & Assignment selectors */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Étape</label>
                <select
                  value={lead.stageId}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={isPending}
                  className="input py-1.5 text-xs mt-0.5"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigné à</label>
                <select
                  value={lead.assignedToId || ""}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={isPending}
                  className="input py-1.5 text-xs mt-0.5"
                >
                  <option value="">Non assigné</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: "info" as const, label: "Informations" },
                { key: "activity" as const, label: `Activité (${lead._count.activities})` },
                { key: "messages" as const, label: `Messages (${lead._count.messages})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex-1 py-3 text-xs font-medium transition-colors relative",
                    activeTab === tab.key
                      ? "text-brand-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "info" && <InfoTab lead={lead} customFieldsConfig={customFieldsConfig} />}
              {activeTab === "activity" && <ActivityTab activities={lead.activities} />}
              {activeTab === "messages" && <MessagesTab messages={lead.messages} count={lead._count.messages} lead={lead} />}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function InfoTab({ lead, customFieldsConfig }: { lead: LeadDetail; customFieldsConfig: CustomFieldConfig[] }) {
  // Parse custom fields from lead
  const customFields = (lead.customFields as Record<string, any>) || {};

  // Build display list: configured fields with labels, plus raw unmapped
  const configuredKeys = new Set(customFieldsConfig.map((cf) => cf.key));
  const mappedEntries: { label: string; value: string }[] = [];
  const unmappedEntries: { label: string; value: string }[] = [];

  for (const [key, value] of Object.entries(customFields)) {
    if (key.startsWith("_") || !value) continue;
    const config = customFieldsConfig.find(
      (cf) => cf.key === key || cf.mappedFormFields.some((mf) => mf.toLowerCase() === key.toLowerCase())
    );
    if (config) {
      mappedEntries.push({ label: config.label, value: String(value) });
    } else {
      // Display raw key nicely
      const niceLabel = key.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      unmappedEntries.push({ label: niceLabel, value: String(value) });
    }
  }

  const allCustom = [...mappedEntries, ...unmappedEntries];

  return (
    <div className="p-5 space-y-5">
      <Section title="Contact">
        <InfoRow icon={Phone} label="Téléphone" value={formatPhone(lead.phone)} />
        {lead.whatsapp && lead.whatsapp !== lead.phone && (
          <InfoRow icon={MessageCircle} label="WhatsApp" value={formatPhone(lead.whatsapp)} />
        )}
        {lead.email && <InfoRow icon={Mail} label="Email" value={lead.email} />}
        {lead.city && <InfoRow icon={MapPin} label="Ville" value={`${lead.city}, ${lead.country}`} />}
        {lead.gender && <InfoRow icon={UserIcon} label="Genre" value={lead.gender === "MALE" ? "Homme" : lead.gender === "FEMALE" ? "Femme" : "Autre"} />}
        {lead.dateOfBirth && <InfoRow icon={Calendar} label="Date de naissance" value={formatDate(lead.dateOfBirth)} />}
      </Section>

      {lead.program && (
        <Section title="Formation souhaitée">
          <InfoRow icon={GraduationCap} label="Filière" value={lead.program.name} />
          {lead.program.code && <InfoRow icon={Tag} label="Code" value={lead.program.code} />}
          <InfoRow icon={Tag} label="Niveau" value={lead.program.level} />
          <InfoRow icon={Tag} label="Frais de scolarité" value={formatCFA(lead.program.tuitionAmount)} />
        </Section>
      )}

      {lead.campus && (
        <Section title="Campus">
          <InfoRow icon={Building2} label="Campus" value={lead.campus.name} />
          <InfoRow icon={MapPin} label="Ville" value={lead.campus.city} />
        </Section>
      )}

      {allCustom.length > 0 && (
        <Section title="Informations complémentaires">
          {allCustom.map((cf, i) => (
            <InfoRow key={i} icon={Tag} label={cf.label} value={cf.value} />
          ))}
        </Section>
      )}

      <Section title="Acquisition">
        <InfoRow icon={Megaphone} label="Source" value={sourceLabels[lead.source] || lead.source} />
        {lead.sourceDetail && <InfoRow icon={Tag} label="Détail" value={lead.sourceDetail} />}
        {lead.campaign && <InfoRow icon={Megaphone} label="Campagne" value={lead.campaign.name} />}
        <InfoRow icon={Calendar} label="Créé le" value={formatDateTime(lead.createdAt)} />
      </Section>

      {lead.assignedTo && (
        <Section title="Commercial assigné">
          <div className="flex items-center gap-3 py-1">
            <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
              {getInitials(lead.assignedTo.name)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{lead.assignedTo.name}</p>
              {lead.assignedTo.email && <p className="text-xs text-gray-500">{lead.assignedTo.email}</p>}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Activity Tab ───
function ActivityTab({ activities }: { activities: LeadDetail["activities"] }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <Activity size={32} className="text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Aucune activité enregistrée</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />

        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type] || Activity;
            return (
              <div key={activity.id} className="flex gap-3 relative">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shrink-0 z-10">
                  <Icon size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-gray-700">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.user && (
                      <span className="text-xs text-gray-500">{activity.user.name}</span>
                    )}
                    <span className="text-xs text-gray-400">{formatRelative(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// MessagesTab 

function MessagesTab({ messages, count, lead }: { messages: LeadDetail["messages"]; count: number; lead: LeadDetail }) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Compose button */}
      <div className="px-5 pt-4 pb-2">
        {!composing ? (
          <button
            onClick={() => setComposing(true)}
            className="btn-primary w-full py-2 text-xs justify-center"
            disabled={!lead.email}
          >
            <Send size={14} />
            {lead.email ? "Envoyer un email" : "Pas d'email pour ce lead"}
          </button>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 animate-scale-in">
            <ComposeEmail
              leadId={lead.id}
              leadName={lead.firstName + " " + lead.lastName}
              leadEmail={lead.email}
              compact
              onSent={() => setComposing(false)}
              onClose={() => setComposing(false)}
            />
          </div>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 && !composing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">Aucun message echange</p>
            <p className="text-xs text-gray-400 mt-1">Envoyez le premier email a ce lead</p>
          </div>
        ) : (
          messages.map(function(msg) {
            var channelIcons: Record<string, typeof Phone> = {
              WHATSAPP: MessageCircle,
              SMS: MessageSquare,
              EMAIL: Mail,
              PHONE_CALL: Phone,
            };
            var channelColors: Record<string, string> = {
              WHATSAPP: "text-emerald-500",
              SMS: "text-blue-500",
              EMAIL: "text-brand-500",
              PHONE_CALL: "text-purple-500",
            };
            var Icon = channelIcons[msg.channel] || MessageSquare;
            var isOutbound = msg.direction === "OUTBOUND";

            var parsedContent = { subject: null as string | null, body: msg.content };
            try {
              var parsed = JSON.parse(msg.content);
              parsedContent = { subject: parsed.subject, body: parsed.body };
            } catch {}

            return (
              <div key={msg.id} className={cn("flex gap-3", isOutbound && "flex-row-reverse")}>
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  isOutbound ? "bg-brand-100" : "bg-gray-100"
                )}>
                  <Icon size={14} className={channelColors[msg.channel] || "text-gray-500"} />
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3.5 py-2.5",
                  isOutbound ? "bg-brand-50 text-brand-900" : "bg-gray-100 text-gray-800"
                )}>
                  {parsedContent.subject && (
                    <p className="text-xs font-semibold mb-1">{parsedContent.subject}</p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{parsedContent.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-400">{formatRelative(msg.sentAt)}</span>
                    <span className={cn("text-[10px] font-medium",
                      msg.status === "DELIVERED" || msg.status === "READ" ? "text-emerald-500" :
                      msg.status === "FAILED" ? "text-red-500" : "text-gray-400"
                    )}>
                      {msg.status === "READ" ? "Lu" : msg.status === "DELIVERED" ? "Recu" :
                       msg.status === "SENT" ? "Envoye" : msg.status === "FAILED" ? "Echoue" : msg.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


// ─── Reusable components ───
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 truncate">{value}</span>
    </div>
  );
}