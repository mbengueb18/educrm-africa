"use client";

import { useEffect, useState, useTransition } from "react";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { moveLeadToStage, assignLead, updateLeadScore, updateLead, deleteLead } from "@/app/(dashboard)/pipeline/actions";
import { cn, formatCFA, formatDate, formatDateTime, formatRelative, formatPhone, getInitials, getScoreBg } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
  Pencil,
  Trash2,
  Check,
  XCircle,
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

var sourceLabels: Record<string, string> = {
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

var activityIcons: Record<string, typeof Activity> = {
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
  var [lead, setLead] = useState<LeadDetail | null>(null);
  var [loading, setLoading] = useState(false);
  var [activeTab, setActiveTab] = useState<"info" | "activity" | "messages">("info");
  var [isPending, startTransition] = useTransition();
  var [deleting, setDeleting] = useState(false);
  var [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  var router = useRouter();

  useEffect(function() {
    if (!leadId) {
      setLead(null);
      return;
    }
    setLoading(true);
    getLeadDetail(leadId)
      .then(setLead)
      .catch(function() { toast.error("Erreur lors du chargement"); })
      .finally(function() { setLoading(false); });
  }, [leadId]);

  var [customFieldsConfig, setCustomFieldsConfig] = useState<CustomFieldConfig[]>([]);
  useEffect(function() {
    getCustomFields().then(setCustomFieldsConfig).catch(function() {});
  }, []);

  useEffect(function() {
    var handler = function(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return function() { document.removeEventListener("keydown", handler); };
  }, [onClose]);

  var handleStageChange = function(stageId: string) {
    if (!lead) return;
    var leadId = lead.id;
    startTransition(async function() {
      try {
        await moveLeadToStage(leadId, stageId);
        setLead(function(prev) { return prev ? { ...prev, stageId, stage: stages.find(function(s) { return s.id === stageId; }) || prev.stage } as any : null; });
        toast.success("Étape mise à jour");
      } catch {
        toast.error("Erreur lors du changement d'étape");
      }
    });
  };

  var handleAssign = function(userId: string) {
    if (!lead) return;
    var leadId = lead.id;
    startTransition(async function() {
      try {
        await assignLead(leadId, userId || null);
        var user = users.find(function(u) { return u.id === userId; });
        setLead(function(prev) { return prev ? { ...prev, assignedToId: userId || null, assignedTo: user ? { ...user, avatar: null, email: "" } : null } as any : null; });
        toast.success(userId ? "Lead assigné" : "Lead désassigné");
      } catch {
        toast.error("Erreur");
      }
    });
  };

  var handleDelete = async function() {
    if (!lead) return;
    var leadId = lead.id;
    setDeleting(true);
    try {
      await deleteLead(leadId);
      toast.success("Lead supprimé");
      onClose();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  if (!leadId) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in" style={{ animationName: 'slideInRight' }}>

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
                    {getInitials(lead.firstName + " " + lead.lastName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.city && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={11} /> {lead.city}
                        </span>
                      )}
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", getScoreBg(lead.score))}>
                        Score: {lead.score}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <a href={"tel:" + lead.phone} className="btn-secondary py-1.5 px-3 text-xs">
                    <Phone size={13} /> Appeler
                  </a>
                  {lead.whatsapp && (
                    <a href={"https://wa.me/" + lead.whatsapp.replace(/\D/g, '')} target="_blank"
                       className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {lead.email && (
                    <a href={"mailto:" + lead.email} className="btn-secondary py-1.5 px-3 text-xs">
                      <Mail size={13} /> Email
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={function() { setShowDeleteConfirm(true); }}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Supprimer ce lead"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 size={14} className="text-red-600" />
                  <span className="text-sm text-red-700 font-medium">Supprimer ce lead et toutes ses données ?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={function() { setShowDeleteConfirm(false); }} className="px-3 py-1.5 text-xs text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50" disabled={deleting}>
                    Annuler
                  </button>
                  <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-1">
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Supprimer
                  </button>
                </div>
              </div>
            )}

            {/* Stage & Assignment */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Étape</label>
                <select value={lead.stageId} onChange={function(e) { handleStageChange(e.target.value); }} disabled={isPending} className="input py-1.5 text-xs mt-0.5">
                  {stages.map(function(s) { return <option key={s.id} value={s.id}>{s.name}</option>; })}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigne a</label>
                <select value={lead.assignedToId || ""} onChange={function(e) { handleAssign(e.target.value); }} disabled={isPending} className="input py-1.5 text-xs mt-0.5">
                  <option value="">Non assigne</option>
                  {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: "info" as const, label: "Informations" },
                { key: "activity" as const, label: "Activite (" + lead._count.activities + ")" },
                { key: "messages" as const, label: "Messages (" + lead._count.messages + ")" },
              ].map(function(tab) {
                return (
                  <button key={tab.key} onClick={function() { setActiveTab(tab.key); }}
                    className={cn("flex-1 py-3 text-xs font-medium transition-colors relative",
                      activeTab === tab.key ? "text-brand-600" : "text-gray-500 hover:text-gray-700"
                    )}>
                    {tab.label}
                    {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "info" && <InfoTab lead={lead} customFieldsConfig={customFieldsConfig} stages={stages} users={users} onLeadUpdate={function(updated) { setLead(updated); }} />}
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

// ─── Info Tab with Edit Mode ───
function InfoTab({ lead, customFieldsConfig, stages, users, onLeadUpdate }: {
  lead: LeadDetail;
  customFieldsConfig: CustomFieldConfig[];
  stages: { id: string; name: string; color: string }[];
  users: { id: string; name: string }[];
  onLeadUpdate: (lead: LeadDetail) => void;
}) {
  var [editMode, setEditMode] = useState(false);
  var [saving, setSaving] = useState(false);
  var [editData, setEditData] = useState({
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    email: lead.email || "",
    whatsapp: lead.whatsapp || "",
    city: lead.city || "",
    source: lead.source as string,
    sourceDetail: lead.sourceDetail || "",
  });

  useEffect(function() {
    setEditData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email || "",
      whatsapp: lead.whatsapp || "",
      city: lead.city || "",
      source: lead.source as string,
      sourceDetail: lead.sourceDetail || "",
    });
    setEditMode(false);
  }, [lead.id]);

  var handleSave = async function() {
    setSaving(true);
    try {
      await updateLead(lead.id, editData);
      onLeadUpdate({ ...lead, ...editData, email: editData.email || null, whatsapp: editData.whatsapp || null, city: editData.city || null, sourceDetail: editData.sourceDetail || null } as any);
      toast.success("Lead mis à jour");
      setEditMode(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    }
    setSaving(false);
  };

  var handleCancel = function() {
    setEditData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email || "",
      whatsapp: lead.whatsapp || "",
      city: lead.city || "",
      source: lead.source as string,
      sourceDetail: lead.sourceDetail || "",
    });
    setEditMode(false);
  };

  var customFields = (lead.customFields as Record<string, any>) || {};
  var mappedEntries: { label: string; value: string }[] = [];
  var unmappedEntries: { label: string; value: string }[] = [];

  for (var key in customFields) {
    var value = customFields[key];
    if (key.startsWith("_") || !value) continue;
    var config = customFieldsConfig.find(function(cf) {
      return cf.key === key || cf.mappedFormFields.some(function(mf) { return mf.toLowerCase() === key.toLowerCase(); });
    });
    if (config) {
      mappedEntries.push({ label: config.label, value: String(value) });
    } else {
      var niceLabel = key.replace(/[_-]/g, " ").replace(/^\w/, function(c) { return c.toUpperCase(); });
      unmappedEntries.push({ label: niceLabel, value: String(value) });
    }
  }
  var allCustom = mappedEntries.concat(unmappedEntries);

  return (
    <div className="p-5 space-y-5">
      {/* Edit/Save toggle */}
      <div className="flex items-center justify-end gap-2">
        {editMode ? (
          <>
            <button onClick={handleCancel} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}>
              <XCircle size={13} /> Annuler
            </button>
            <button onClick={handleSave} className="btn-primary py-1.5 px-3 text-xs" disabled={saving}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Sauvegarder
            </button>
          </>
        ) : (
          <button onClick={function() { setEditMode(true); }} className="btn-secondary py-1.5 px-3 text-xs">
            <Pencil size={13} /> Modifier
          </button>
        )}
      </div>

      <Section title="Contact">
        {editMode ? (
          <div className="space-y-3">
            <EditRow label="Prenom" value={editData.firstName} onChange={function(v) { setEditData({ ...editData, firstName: v }); }} />
            <EditRow label="Nom" value={editData.lastName} onChange={function(v) { setEditData({ ...editData, lastName: v }); }} />
            <EditRow label="Téléphone" value={editData.phone} onChange={function(v) { setEditData({ ...editData, phone: v }); }} />
            <EditRow label="Email" value={editData.email} onChange={function(v) { setEditData({ ...editData, email: v }); }} type="email" />
            <EditRow label="WhatsApp" value={editData.whatsapp} onChange={function(v) { setEditData({ ...editData, whatsapp: v }); }} />
            <EditRow label="Ville" value={editData.city} onChange={function(v) { setEditData({ ...editData, city: v }); }} />
          </div>
        ) : (
          <>
            <InfoRow icon={Phone} label="Téléphone" value={formatPhone(lead.phone)} />
            {lead.whatsapp && lead.whatsapp !== lead.phone && (
              <InfoRow icon={MessageCircle} label="WhatsApp" value={formatPhone(lead.whatsapp)} />
            )}
            {lead.email && <InfoRow icon={Mail} label="Email" value={lead.email} />}
            {lead.city && <InfoRow icon={MapPin} label="Ville" value={lead.city} />}
            {lead.gender && <InfoRow icon={UserIcon} label="Genre" value={lead.gender === "MALE" ? "Homme" : lead.gender === "FEMALE" ? "Femme" : "Autre"} />}
            {lead.dateOfBirth && <InfoRow icon={Calendar} label="Date de naissance" value={formatDate(lead.dateOfBirth)} />}
          </>
        )}
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
          {allCustom.map(function(cf, i) {
            return <InfoRow key={i} icon={Tag} label={cf.label} value={cf.value} />;
          })}
        </Section>
      )}

      <Section title="Acquisition">
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source</label>
              <select value={editData.source} onChange={function(e) { setEditData({ ...editData, source: e.target.value }); }} className="input text-sm py-1.5 w-full">
                {Object.entries(sourceLabels).map(function(entry) {
                  return <option key={entry[0]} value={entry[0]}>{entry[1]}</option>;
                })}
              </select>
            </div>
            <EditRow label="Detail source" value={editData.sourceDetail} onChange={function(v) { setEditData({ ...editData, sourceDetail: v }); }} />
          </div>
        ) : (
          <>
            <InfoRow icon={Megaphone} label="Source" value={sourceLabels[lead.source] || lead.source} />
            {lead.sourceDetail && <InfoRow icon={Tag} label="Detail" value={lead.sourceDetail} />}
            {customFields._trafficChannel && (
              <InfoRow icon={Tag} label="Canal" value={customFields._trafficChannel} />
            )}
            {customFields._trafficSource && customFields._trafficSource !== (sourceLabels[lead.source] || lead.source) && (
              <InfoRow icon={Tag} label="Source origine" value={customFields._trafficSource} />
            )}
            {customFields._trafficMedium && customFields._trafficMedium !== "none" && (
              <InfoRow icon={Tag} label="Medium" value={customFields._trafficMedium} />
            )}
            {customFields._utmCampaign && (
              <InfoRow icon={Tag} label="Campagne UTM" value={customFields._utmCampaign} />
            )}
            {customFields._referrer && (
              <InfoRow icon={Tag} label="Referrer" value={customFields._referrer} />
            )}
            {lead.campaign && <InfoRow icon={Megaphone} label="Campagne" value={lead.campaign.name} />}
            <InfoRow icon={Calendar} label="Créé le" value={formatDateTime(lead.createdAt)} />
          </>
        )}
      </Section>

      {!editMode && lead.assignedTo && (
        <Section title="Commercial assigne">
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
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
        <div className="space-y-4">
          {activities.map(function(activity) {
            var Icon = activityIcons[activity.type] || Activity;
            return (
              <div key={activity.id} className="flex gap-3 relative">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shrink-0 z-10">
                  <Icon size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-gray-700">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.user && <span className="text-xs text-gray-500">{activity.user.name}</span>}
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

// ─── Messages Tab ───
function MessagesTab({ messages, count, lead }: { messages: LeadDetail["messages"]; count: number; lead: LeadDetail }) {
  var [composing, setComposing] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2">
        {!composing ? (
          <button onClick={function() { setComposing(true); }} className="btn-primary w-full py-2 text-xs justify-center" disabled={!lead.email}>
            <Send size={14} /> {lead.email ? "Envoyer un email" : "Pas d'email pour ce lead"}
          </button>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 animate-scale-in">
            <ComposeEmail
              leadId={lead.id}
              leadName={lead.firstName + " " + lead.lastName}
              leadEmail={lead.email}
              compact
              onSent={function() { setComposing(false); }}
              onClose={function() { setComposing(false); }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 && !composing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">Aucun message echange</p>
            <p className="text-xs text-gray-400 mt-1">Envoyez le premier email a ce lead</p>
          </div>
        ) : (
          messages.map(function(msg) {
            var channelIcons: Record<string, typeof Phone> = { WHATSAPP: MessageCircle, SMS: MessageSquare, EMAIL: Mail, PHONE_CALL: Phone };
            var channelColors: Record<string, string> = { WHATSAPP: "text-emerald-500", SMS: "text-blue-500", EMAIL: "text-brand-500", PHONE_CALL: "text-purple-500" };
            var Icon = channelIcons[msg.channel] || MessageSquare;
            var isOutbound = msg.direction === "OUTBOUND";
            var parsedContent = { subject: null as string | null, body: msg.content };
            try { var parsed = JSON.parse(msg.content); parsedContent = { subject: parsed.subject, body: parsed.body }; } catch {}

            return (
              <div key={msg.id} className={cn("flex gap-3", isOutbound && "flex-row-reverse")}>
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", isOutbound ? "bg-brand-100" : "bg-gray-100")}>
                  <Icon size={14} className={channelColors[msg.channel] || "text-gray-500"} />
                </div>
                <div className={cn("max-w-[80%] rounded-xl px-3.5 py-2.5", isOutbound ? "bg-brand-50 text-brand-900" : "bg-gray-100 text-gray-800")}>
                  {parsedContent.subject && <p className="text-xs font-semibold mb-1">{parsedContent.subject}</p>}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{parsedContent.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-400">{formatRelative(msg.sentAt)}</span>
                    <span className={cn("text-[10px] font-medium",
                      msg.status === "DELIVERED" || msg.status === "READ" ? "text-emerald-500" :
                      msg.status === "FAILED" ? "text-red-500" : "text-gray-400"
                    )}>
                      {msg.status === "READ" ? "Lu" : msg.status === "DELIVERED" ? "Reçu" : msg.status === "SENT" ? "Envoyé" : msg.status === "FAILED" ? "Échoué" : msg.status}
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
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
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

function EditRow({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type || "text"}
        value={value}
        onChange={function(e) { onChange(e.target.value); }}
        className="input text-sm py-1.5 w-full"
        placeholder={label}
      />
    </div>
  );
}