"use client";

import { useEffect, useState, useTransition } from "react";
import { getLeadDetail, logWhatsAppMessage, updateLeadNotes } from "@/app/(dashboard)/pipeline/lead-actions";
import { moveLeadToStage, assignLead, updateLeadScore, updateLead, deleteLead } from "@/app/(dashboard)/pipeline/actions";
import { createTask } from "@/app/(dashboard)/tasks/actions";
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
  ChevronUp,
  Clock,
  ArrowRight,
  Loader2,
  MessageSquare,
  Megaphone,
  Pencil,
  Trash2,
  Check,
  XCircle,
 ListTodo, 
  Plus,
  StickyNote,
  Paperclip,
  Bot,
  CalendarDays,
  PhoneIncoming,
  PhoneOutgoing,
  Video,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getCustomFields, type CustomFieldConfig } from "@/lib/custom-fields";
import { ComposeEmail } from "@/components/messaging/compose-email";
import { ConvertLeadModal } from "@/components/pipeline/convert-lead-modal";

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
  var [activeTab, setActiveTab] = useState<"info" | "history" | "notes">("info");
  var [isPending, startTransition] = useTransition();
  var [deleting, setDeleting] = useState(false);
  var [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  var [showConvert, setShowConvert] = useState(false);
  var [showTaskForm, setShowTaskForm] = useState(false);
  var [showCompose, setShowCompose] = useState(false);
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
                    <WhatsAppButton lead={lead} />
                  )}
                  {lead.email && (
                    <button onClick={function() { setShowCompose(true); }} className="btn-secondary py-1.5 px-3 text-xs">
                      <Mail size={13} /> Email
                    </button>
                  )}
                  <button onClick={function() { setShowTaskForm(true); }} className="btn-secondary py-1.5 px-3 text-xs text-amber-600 border-amber-200 hover:bg-amber-50">
                    <ListTodo size={13} /> Tâche
                  </button>
                  {!lead.isConverted && (
                    <button onClick={function() { setShowConvert(true); }} className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <GraduationCap size={13} /> Convertir
                    </button>
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

            {/* Compose email */}
            {showCompose && lead && lead.email && (
              <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-200 animate-scale-in">
                <ComposeEmail
                  leadId={lead.id}
                  leadName={lead.firstName + " " + lead.lastName}
                  leadEmail={lead.email}
                  compact
                  onSent={function() { setShowCompose(false); toast.success("Email envoyé"); }}
                  onClose={function() { setShowCompose(false); }}
                />
              </div>
            )}

            {/* Quick task form */}
            {showTaskForm && lead && (
              <QuickTaskForm
                leadId={lead.id}
                leadName={lead.firstName + " " + lead.lastName}
                users={users}
                onClose={function(created?: boolean) {
                  setShowTaskForm(false);
                  if (created) router.refresh();
                }}
              />
            )}

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
                { key: "info" as const, label: "Infos" },
                { key: "history" as const, label: "Historique (" + ((lead._count.activities || 0) + (lead._count.calls || 0) + (lead._count.appointments || 0) + (lead._count.tasks || 0) + (lead._count.messages || 0)) + ")" },
                { key: "notes" as const, label: "Notes" },
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
              {activeTab === "history" && <HistoryTab lead={lead} />}
              {activeTab === "notes" && <NotesTab lead={lead} onUpdate={function(updated) { setLead(updated); }} />}
            </div>
          </>
        )}
      </div>

      {showConvert && lead && (
        <ConvertLeadModal
          open={showConvert}
          onClose={function(converted?: boolean) {
            setShowConvert(false);
            if (converted) {
              onClose();
              router.refresh();
            }
          }}
          lead={{
            id: lead.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            phone: lead.phone,
            email: lead.email,
            whatsapp: lead.whatsapp,
            city: lead.city,
            gender: lead.gender,
            dateOfBirth: lead.dateOfBirth,
            programId: lead.programId || null,
            campusId: lead.campusId || null,
          }}
        />
      )}

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

// ─── History Tab (unified timeline) ───
function HistoryTab({ lead }: { lead: LeadDetail }) {
  var callOutcomeLabels: Record<string, string> = {
    ANSWERED: "Décroché", NO_ANSWER: "Pas de réponse", BUSY: "Occupé",
    VOICEMAIL: "Messagerie", WRONG_NUMBER: "Faux numéro", CALLBACK_REQUESTED: "Rappel demandé",
    NOT_INTERESTED: "Pas intéressé",
  };

  var apptStatusLabels: Record<string, string> = {
    SCHEDULED: "Planifié", CONFIRMED: "Confirmé", COMPLETED: "Effectué",
    CANCELLED: "Annulé", NO_SHOW: "Absent", RESCHEDULED: "Reporté",
  };

  var taskStatusLabels: Record<string, string> = {
    TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée", CANCELLED: "Annulée",
  };

  var priorityLabels: Record<string, string> = {
    LOW: "Basse", MEDIUM: "Moyenne", HIGH: "Haute", URGENT: "Urgente",
  };

  // Build unified timeline
  var timeline: {
    id: string;
    type: "activity" | "call" | "appointment" | "task" | "message";
    date: Date;
    data: any;
  }[] = [];

  if (lead.activities) {
    lead.activities.forEach(function(a) {
      timeline.push({ id: "a-" + a.id, type: "activity", date: new Date(a.createdAt), data: a });
    });
  }
  if (lead.calls) {
    lead.calls.forEach(function(c) {
      timeline.push({ id: "c-" + c.id, type: "call", date: new Date(c.calledAt), data: c });
    });
  }
  if (lead.appointments) {
    lead.appointments.forEach(function(ap) {
      timeline.push({ id: "ap-" + ap.id, type: "appointment", date: new Date(ap.startAt), data: ap });
    });
  }
  if (lead.tasks) {
    lead.tasks.forEach(function(t) {
      timeline.push({ id: "t-" + t.id, type: "task", date: new Date(t.createdAt), data: t });
    });
  }

  if (lead.messages) {
    lead.messages.forEach(function(m) {
      timeline.push({ id: "m-" + m.id, type: "message", date: new Date(m.sentAt), data: m });
    });
  }

  timeline.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <Activity size={32} className="text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Aucune interaction enregistrée</p>
        <p className="text-xs text-gray-400 mt-1">Les appels, rendez-vous, tâches et emails apparaîtront ici</p>
      </div>
    );
  }

  // Filter
  var [filter, setFilter] = useState<"all" | "call" | "appointment" | "task" | "activity" | "message">("all");

  var filtered = filter === "all" ? timeline : timeline.filter(function(t) { return t.type === filter; });

  return (
    <div className="p-4">
      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { key: "all" as const, label: "Tout", count: timeline.length },
          { key: "call" as const, label: "Appels", count: lead.calls?.length || 0 },
          { key: "appointment" as const, label: "RDV", count: lead.appointments?.length || 0 },
          { key: "task" as const, label: "Tâches", count: lead.tasks?.length || 0 },
          { key: "activity" as const, label: "Activité", count: lead.activities?.length || 0 },
          { key: "message" as const, label: "Messages", count: lead.messages?.length || 0 },
        ].map(function(f) {
          if (f.count === 0 && f.key !== "all") return null;
          return (
            <button key={f.key} onClick={function() { setFilter(f.key); }}
              className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-colors font-medium",
                filter === f.key ? "bg-brand-100 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}>
              {f.label} ({f.count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
        <div className="space-y-3">
          {filtered.map(function(item) {
            if (item.type === "call") {
              var call = item.data;
              var isAnswered = call.outcome === "ANSWERED";
              var CallIcon = call.direction === "OUTBOUND" ? PhoneOutgoing : PhoneIncoming;
              return (
                <div key={item.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2",
                    isAnswered ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                  )}>
                    <CallIcon size={14} className={isAnswered ? "text-emerald-600" : "text-red-500"} />
                  </div>
                  <div className="flex-1 min-w-0 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {call.direction === "OUTBOUND" ? "Appel sortant" : "Appel entrant"}
                      </p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                      )}>
                        {callOutcomeLabels[call.outcome] || call.outcome}
                      </span>
                    </div>
                    {call.duration && call.duration > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Durée : {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, "0")}</p>
                    )}
                    {call.notes && <p className="text-xs text-gray-500 mt-1 italic">"{call.notes}"</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {call.calledBy && <span className="text-[10px] text-gray-500">{call.calledBy.name}</span>}
                      <span className="text-[10px] text-gray-400">{formatRelative(call.calledAt)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === "appointment") {
              var appt = item.data;
              var apptColors: Record<string, string> = {
                SCHEDULED: "bg-blue-50 border-blue-200", CONFIRMED: "bg-blue-50 border-blue-200",
                COMPLETED: "bg-emerald-50 border-emerald-200", CANCELLED: "bg-gray-50 border-gray-200",
                NO_SHOW: "bg-red-50 border-red-200", RESCHEDULED: "bg-amber-50 border-amber-200",
              };
              var ApptIcon = appt.type === "VIDEO_CALL" ? Video : appt.type === "PHONE" ? Phone : CalendarDays;
              return (
                <div key={item.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2",
                    apptColors[appt.status] || "bg-blue-50 border-blue-200"
                  )}>
                    <ApptIcon size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">{appt.title}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        appt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                        appt.status === "NO_SHOW" ? "bg-red-100 text-red-600" :
                        appt.status === "CANCELLED" ? "bg-gray-100 text-gray-500" :
                        "bg-blue-100 text-blue-700"
                      )}>
                        {apptStatusLabels[appt.status] || appt.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateTime(appt.startAt)} — {new Date(appt.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {appt.location && <p className="text-xs text-gray-500 mt-0.5"><MapPin size={10} className="inline mr-1" />{appt.location}</p>}
                    {appt.meetingUrl && <a href={appt.meetingUrl} target="_blank" className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">Lien visio</a>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {appt.assignedTo && <span className="text-[10px] text-gray-500">{appt.assignedTo.name}</span>}
                      <span className="text-[10px] text-gray-400">{formatRelative(appt.startAt)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === "task") {
              var task = item.data;
              var isDone = task.status === "DONE";
              var isOverdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date();
              var TaskIcon = isDone ? CheckCircle2 : isOverdue ? AlertTriangle : ListTodo;
              return (
                <div key={item.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2",
                    isDone ? "bg-emerald-50 border-emerald-200" :
                    isOverdue ? "bg-red-50 border-red-200" :
                    "bg-amber-50 border-amber-200"
                  )}>
                    <TaskIcon size={14} className={isDone ? "text-emerald-600" : isOverdue ? "text-red-500" : "text-amber-600"} />
                  </div>
                  <div className="flex-1 min-w-0 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className={cn("text-sm font-medium", isDone ? "text-gray-400 line-through" : "text-gray-700")}>{task.title}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        isDone ? "bg-emerald-100 text-emerald-700" :
                        isOverdue ? "bg-red-100 text-red-600" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {taskStatusLabels[task.status] || task.status}
                      </span>
                    </div>
                    {task.dueDate && (
                      <p className={cn("text-xs mt-1", isOverdue ? "text-red-500 font-medium" : "text-gray-500")}>
                        <Clock size={10} className="inline mr-1" />
                        Échéance : {formatDateTime(task.dueDate)}
                        {isOverdue && " — En retard !"}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-500">{priorityLabels[task.priority] || task.priority}</span>
                      {task.assignedTo && <span className="text-[10px] text-gray-500">• {task.assignedTo.name}</span>}
                      <span className="text-[10px] text-gray-400">{formatRelative(task.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === "message") {
              var msg = item.data;
              var isWhatsApp = msg.channel === "WHATSAPP";
              var isSMS = msg.channel === "SMS";
              var isEmail = msg.channel === "EMAIL";
              var isChatbot = msg.channel === "CHATBOT";
              var MsgIcon = isWhatsApp ? MessageCircle : isSMS ? MessageSquare : isChatbot ? Bot : Mail;
              var msgColor = isWhatsApp ? "bg-emerald-50 border-emerald-200" : isEmail ? "bg-blue-50 border-blue-200" : isChatbot ? "bg-violet-50 border-violet-200" : "bg-purple-50 border-purple-200";
              var msgIconColor = isWhatsApp ? "text-emerald-600" : isEmail ? "text-blue-600" : isChatbot ? "text-violet-600" : "text-purple-600";
              var channelLabel = isWhatsApp ? "WhatsApp" : isSMS ? "SMS" : isEmail ? "Email" : isChatbot ? "Chatbot" : msg.channel;
              var dirLabel = msg.direction === "OUTBOUND" ? "envoyé" : "reçu";

              var parsedContent = { subject: null as string | null, body: "" };
              try {
                var parsed = JSON.parse(msg.content);
                parsedContent = { subject: parsed.subject || null, body: parsed.body || "" };
              } catch {
                parsedContent = { subject: null, body: msg.content };
              }

              // Clean inbound replies: remove quoted text and signatures
              var displayBody = parsedContent.body || "";
              if (msg.direction === "INBOUND") {
                // Remove quoted thread (everything from "On ... wrote:" or "Le ... a écrit :")
                displayBody = displayBody
                  .replace(/^(>+\s*.*\n?)+/gm, "")
                  .replace(/On .{1,200} wrote:[\s\S]*$/i, "")
                  .replace(/Le .{1,200} a [eé]crit\s*:[\s\S]*$/i, "")
                  .replace(/-{2,}.*Original Message.*-{2,}[\s\S]*$/i, "")
                  .replace(/_{3,}[\s\S]*$/m, "")
                  .trim();
              }
              if (!displayBody.trim()) {
                displayBody = "(Message vide)";
              }

              return (
                <div key={item.id} className="flex gap-3 relative">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2", msgColor)}>
                    <MsgIcon size={14} className={msgIconColor} />
                  </div>
                  <div className="flex-1 min-w-0 bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-700">{channelLabel} {dirLabel}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        msg.status === "DELIVERED" || msg.status === "READ" ? "bg-emerald-100 text-emerald-700" :
                        msg.status === "FAILED" ? "bg-red-100 text-red-600" :
                        "bg-gray-100 text-gray-500"
                      )}>
                        {msg.status === "READ" ? "Lu" : msg.status === "DELIVERED" ? "Reçu" : msg.status === "SENT" ? "Envoyé" : msg.status === "FAILED" ? "Échoué" : msg.status}
                      </span>
                    </div>
                    {parsedContent.subject && <p className="text-xs font-semibold text-gray-800 mb-1.5">{parsedContent.subject}</p>}
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{displayBody}</p>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map(function(att: any) {
                          return (
                            <a
                              key={att.id}
                              href={"/api/attachments/" + att.id}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-2 py-1.5 bg-white hover:bg-brand-50 border border-gray-200 rounded text-xs text-gray-700 hover:text-brand-600 transition-colors"
                            >
                              <Paperclip size={11} className="text-gray-400 shrink-0" />
                              <span className="truncate flex-1">{att.filename}</span>
                              {att.size > 0 && (
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {att.size < 1024 * 1024 ? Math.round(att.size / 1024) + " Ko" : (att.size / (1024 * 1024)).toFixed(1) + " Mo"}
                                </span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 mt-2 block">{formatRelative(msg.sentAt)}</span>
                  </div>
                </div>
              );
            }

            // Default: activity
            var activity = item.data;
            var Icon = activityIcons[activity.type] || Activity;
            return (
              <div key={item.id} className="flex gap-3 relative">
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

// ─── WhatsApp Button with Templates ───
function WhatsAppButton({ lead }: { lead: LeadDetail }) {
  var [open, setOpen] = useState(false);

  var prenom = lead.firstName;
  var nom = lead.lastName;
  var filiere = lead.program?.name || "votre filière";
  var campus = lead.campus?.name || "notre campus";
  var phone = lead.whatsapp?.replace(/\D/g, '') || "";

  var templates = [
    {
      label: "Premier contact",
      icon: "👋",
      text: "Bonjour " + prenom + " " + nom + ",\n\nMerci de votre intérêt pour " + filiere + " à " + campus + ". Je suis votre conseiller(ère) d'orientation et je serais ravi(e) de répondre à toutes vos questions.\n\nQuand seriez-vous disponible pour en discuter ?\n\nCordialement",
    },
    {
      label: "Relance",
      icon: "🔄",
      text: "Bonjour " + prenom + ",\n\nJe me permets de revenir vers vous concernant votre intérêt pour " + filiere + ". Avez-vous eu le temps de réfléchir à votre projet de formation ?\n\nJe reste disponible pour toute question.\n\nBien cordialement",
    },
    {
      label: "Envoi brochure",
      icon: "📄",
      text: "Bonjour " + prenom + ",\n\nComme convenu, je vous envoie la brochure de notre programme " + filiere + ". N'hésitez pas à la consulter et à me poser vos questions.\n\nBonne lecture !",
    },
    {
      label: "Confirmation RDV",
      icon: "📅",
      text: "Bonjour " + prenom + ",\n\nJe vous confirme notre rendez-vous prévu prochainement. Merci de me prévenir en cas d'empêchement.\n\nÀ bientôt !",
    },
    {
      label: "Demande de documents",
      icon: "📋",
      text: "Bonjour " + prenom + ",\n\nPour finaliser votre dossier de candidature en " + filiere + ", pourriez-vous nous transmettre les documents suivants :\n\n- Copie de la pièce d'identité\n- Relevés de notes\n- CV\n- Photo d'identité\n\nMerci d'avance !",
    },
    {
      label: "Félicitations admission",
      icon: "🎉",
      text: "Bonjour " + prenom + ",\n\nFélicitations ! Nous avons le plaisir de vous informer que votre candidature en " + filiere + " a été retenue.\n\nPour confirmer votre inscription, merci de nous contacter dans les plus brefs délais.\n\nBienvenue parmi nous !",
    },
    {
      label: "Message libre",
      icon: "✏️",
      text: "",
    },
  ];

  var sendTemplate = async function(text: string) {
    var url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
    setOpen(false);

    // Log in CRM
    if (text) {
      try {
        await logWhatsAppMessage(lead.id, text);
        toast.success("Message WhatsApp tracké");
      } catch {
        // Silent fail - message was still sent via WhatsApp
      }
    }
  };

  return (
    <div className="relative">
      <button onClick={function() { setOpen(!open); }}
        className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1">
        <MessageCircle size={13} /> WhatsApp
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={function() { setOpen(false); }} />
          <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-scale-in">
            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700">Envoyer un message WhatsApp</p>
              <p className="text-[10px] text-emerald-600">{lead.whatsapp}</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {templates.map(function(tpl) {
                return (
                  <button key={tpl.label} onClick={function() { sendTemplate(tpl.text); }}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-emerald-50/50 transition-colors text-left border-b border-gray-50 last:border-0">
                    <span className="text-base mt-0.5">{tpl.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800">{tpl.label}</p>
                      {tpl.text && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{tpl.text.substring(0, 80)}...</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Notes Tab ───
function NotesTab({ lead, onUpdate }: { lead: LeadDetail; onUpdate: (lead: LeadDetail) => void }) {
  var currentNotes = ((lead.customFields as any)?._notes as string) || "";
  var [notes, setNotes] = useState(currentNotes);
  var [saving, setSaving] = useState(false);
  var [editing, setEditing] = useState(!currentNotes);

  useEffect(function() {
    setNotes(((lead.customFields as any)?._notes as string) || "");
    setEditing(!((lead.customFields as any)?._notes));
  }, [lead.id]);

  var handleSave = async function() {
    setSaving(true);
    try {
      await updateLeadNotes(lead.id, notes);
      var updatedCustomFields = { ...((lead.customFields as any) || {}), _notes: notes };
      onUpdate({ ...lead, customFields: updatedCustomFields } as any);
      toast.success("Notes enregistrées");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-700">Notes internes</h3>
        </div>
        {!editing && currentNotes && (
          <button onClick={function() { setEditing(true); }} className="btn-secondary py-1 px-2.5 text-xs">
            <Pencil size={12} /> Modifier
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={notes}
            onChange={function(e) { setNotes(e.target.value); }}
            placeholder="Ajoutez des notes internes sur ce lead (visibles uniquement par votre équipe)...&#10;&#10;Exemples :&#10;• Parents divorcés, contact préférentiel : mère&#10;• Intéressé par la filière Marketing, budget limité&#10;• Doit rappeler après les examens du bac"
            className="input text-sm w-full min-h-[300px] resize-y font-normal"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            {currentNotes && (
              <button onClick={function() { setNotes(currentNotes); setEditing(false); }} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}>
                <XCircle size={13} /> Annuler
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="btn-primary py-1.5 px-3 text-xs">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </button>
          </div>
        </>
      ) : (
        <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentNotes || "Aucune note"}</p>
        </div>
      )}
    </div>
  );
}

  function QuickTaskForm({ leadId, leadName, users, onClose }: {
  leadId: string;
  leadName: string;
  users: { id: string; name: string }[];
  onClose: (created?: boolean) => void;
}) {
  var [title, setTitle] = useState("");
  var [type, setType] = useState("FOLLOW_UP");
  var [priority, setPriority] = useState("MEDIUM");
  var [dueDate, setDueDate] = useState("");
  var [assignedToId, setAssignedToId] = useState(users[0]?.id || "");
  var [saving, setSaving] = useState(false);
  var [reminderMinutes, setReminderMinutes] = useState("");

  var quickTitles = [
    { label: "Appeler", value: "Appeler " + leadName, type: "CALL" },
    { label: "Rappeler", value: "Rappeler " + leadName, type: "CALL" },
    { label: "Relancer", value: "Relancer " + leadName, type: "FOLLOW_UP" },
    { label: "Envoyer doc", value: "Envoyer documents à " + leadName, type: "DOCUMENT" },
    { label: "RDV", value: "Rendez-vous avec " + leadName, type: "MEETING" },
  ];

  var handleSubmit = async function() {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      var reminderAt: string | undefined = undefined;
      if (dueDate && reminderMinutes) {
        var due = new Date(dueDate).getTime();
        reminderAt = new Date(due - parseInt(reminderMinutes) * 60000).toISOString();
      }
      await createTask({
        title: title.trim(),
        type,
        priority,
        dueDate: dueDate || undefined,
        reminderAt,
        leadId,
        assignedToId,
      });
      toast.success("Tâche créée");
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="px-5 py-3 bg-amber-50/50 border-b border-amber-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
          <ListTodo size={13} /> Nouvelle tâche pour {leadName}
        </span>
        <button onClick={function() { onClose(); }} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      {/* Quick titles */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {quickTitles.map(function(qt) {
          return (
            <button key={qt.label} onClick={function() { setTitle(qt.value); setType(qt.type); }}
              className={cn("text-[10px] px-2 py-1 rounded-full border transition-colors",
                title === qt.value ? "bg-amber-200 text-amber-800 border-amber-300" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
              )}>
              {qt.label}
            </button>
          );
        })}
      </div>

      <input type="text" value={title} onChange={function(e) { setTitle(e.target.value); }} className="input text-sm mb-2 w-full" placeholder="Titre de la tâche..." />

      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={priority} onChange={function(e) { setPriority(e.target.value); }} className="input text-xs py-1.5">
          <option value="LOW">Basse</option>
          <option value="MEDIUM">Moyenne</option>
          <option value="HIGH">Haute</option>
          <option value="URGENT">Urgente</option>
        </select>
        <select value={assignedToId} onChange={function(e) { setAssignedToId(e.target.value); }} className="input text-xs py-1.5">
          {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="datetime-local" value={dueDate} onChange={function(e) { setDueDate(e.target.value); }} className="input text-xs py-1.5" placeholder="Échéance" />
        <select value={reminderMinutes} onChange={function(e) { setReminderMinutes(e.target.value); }} className="input text-xs py-1.5" disabled={!dueDate}>
          <option value="">Pas de rappel</option>
          <option value="15">15 min avant</option>
          <option value="30">30 min avant</option>
          <option value="60">1h avant</option>
          <option value="120">2h avant</option>
          <option value="1440">1 jour avant</option>
          <option value="2880">2 jours avant</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={function() { onClose(); }} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
        <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Créer
        </button>
      </div>
    </div>
  );
}