"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatPhone, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, MessageCircle, Calendar, FileText, ListTodo,
  Activity as ActivityIcon, History, GraduationCap, MapPin, Building2,
  User as UserIcon, Edit3, Star, Tag, Clock, Briefcase, Globe,
  ExternalLink, ChevronRight, Plus, Loader2, Check, Trash2, X,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { ComposeEmail } from "@/components/messaging/compose-email";
import { createTask, updateTask, deleteTask } from "@/app/(dashboard)/tasks/actions";

interface LeadDetailClientProps {
  lead: any;
  initialTab: string;
}

const TABS = [
  { id: "overview", label: "Aperçu", icon: UserIcon },
  { id: "email", label: "Email", icon: Mail },
  { id: "history", label: "Historique", icon: History },
  { id: "tasks", label: "Tâches", icon: ListTodo },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "appointments", label: "Rendez-vous", icon: Calendar },
];

export function LeadDetailClient({ lead, initialTab }: LeadDetailClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  const fullName = lead.firstName + " " + lead.lastName;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-lg">
            {getInitials(fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (lead.stage?.color || "#888") + "20", color: lead.stage?.color || "#888" }}>
                {lead.stage?.name}
              </span>
              {lead.isConverted && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Converti ✓</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              {lead.program && <span className="flex items-center gap-1"><GraduationCap size={11} /> {lead.program.name}</span>}
              {lead.campus && <span className="flex items-center gap-1"><Building2 size={11} /> {lead.campus.name}</span>}
              {lead.assignedTo && <span className="flex items-center gap-1"><UserIcon size={11} /> {lead.assignedTo.name}</span>}
            </div>
          </div>
          <Link href="/pipeline" className="btn-secondary py-2 px-3 text-xs">
            Retour au pipeline
          </Link>
        </div>
      </div>

      {/* Quick actions bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <a href={"tel:" + lead.phone} className="btn-secondary py-1.5 px-3 text-xs">
          <Phone size={13} /> Appeler
        </a>
        {lead.whatsapp && (
          <a
            href={"https://wa.me/" + lead.whatsapp.replace(/\D/g, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <MessageCircle size={13} /> WhatsApp
          </a>
        )}
        {lead.email && (
          <button onClick={() => handleTabChange("email")} className="btn-secondary py-1.5 px-3 text-xs">
            <Mail size={13} /> Composer email
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab lead={lead} />}
      {activeTab === "email" && <EmailTab lead={lead} onSent={() => router.refresh()} />}
      {activeTab === "history" && <HistoryTab lead={lead} />}
      {activeTab === "tasks" && <TasksTab lead={lead} />}
      {activeTab === "documents" && <DocumentsTab lead={lead} />}
      {activeTab === "appointments" && <AppointmentsTab lead={lead} />}
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ lead }: { lead: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Contact info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact</h3>
        <div className="space-y-3">
          <InfoRow icon={Phone} label="Téléphone" value={lead.phone ? formatPhone(lead.phone) : "—"} />
          <InfoRow icon={MessageCircle} label="WhatsApp" value={lead.whatsapp ? formatPhone(lead.whatsapp) : "—"} />
          <InfoRow icon={Mail} label="Email" value={lead.email || "—"} />
          <InfoRow icon={MapPin} label="Ville" value={lead.city || "—"} />
        </div>
      </div>

      {/* Pipeline info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h3>
        <div className="space-y-3">
          <InfoRow icon={Tag} label="Étape" value={lead.stage?.name || "—"} />
          <InfoRow icon={Star} label="Score" value={lead.score + "/100"} />
          <InfoRow icon={Globe} label="Source" value={lead.source} />
          {lead.sourceDetail && <InfoRow icon={Briefcase} label="Détail source" value={lead.sourceDetail} />}
          <InfoRow icon={Clock} label="Créé le" value={new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Activité</h3>
        <div className="space-y-3">
          <StatRow icon={Mail} label="Messages" value={lead._count?.messages || 0} />
          <StatRow icon={Phone} label="Appels" value={lead._count?.calls || 0} />
          <StatRow icon={Calendar} label="Rendez-vous" value={lead._count?.appointments || 0} />
          <StatRow icon={ListTodo} label="Tâches" value={lead._count?.tasks || 0} />
          <StatRow icon={FileText} label="Documents" value={lead._count?.documents || 0} />
          <StatRow icon={ActivityIcon} label="Activités" value={lead._count?.activities || 0} />
        </div>
      </div>
    </div>
  );
}

// ─── Email Tab (avec éditeur visuel pleine page) ───
function EmailTab({ lead, onSent }: { lead: any; onSent: () => void }) {
  if (!lead.email) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
        <Mail size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Ce lead n'a pas d'adresse email</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <ComposeEmail
        leadId={lead.id}
        leadName={lead.firstName + " " + lead.lastName}
        leadEmail={lead.email}
        onSent={onSent}
      />
    </div>
  );
}

// ─── History Tab ───
function HistoryTab({ lead }: { lead: any }) {
  const activities = lead.activities || [];
  const messages = lead.messages || [];

  // Merge & sort all events
  const events: any[] = [
    ...activities.map((a: any) => ({ type: "activity", ...a, sortDate: new Date(a.createdAt) })),
    ...messages.map((m: any) => ({ type: "message", ...m, sortDate: new Date(m.sentAt) })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
        <History size={36} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucun historique</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="space-y-4">
        {events.map((event, idx) => {
          const date = new Date(event.sortDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

          if (event.type === "message") {
            let parsed: any = { subject: "", body: event.content };
            try { parsed = JSON.parse(event.content); } catch {}
            const isInbound = event.direction === "INBOUND";
            return (
              <div key={idx} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isInbound ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600")}>
                  <Mail size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{isInbound ? "Email reçu" : "Email envoyé"} : {parsed.subject || "Sans objet"}</p>
                    <span className="text-xs text-gray-400">{date}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{(parsed.body || "").replace(/<[^>]+>/g, "").substring(0, 200)}</p>
                </div>
              </div>
            );
          }

          // Activity
          return (
            <div key={idx} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
              <div className="w-9 h-9 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center shrink-0">
                <ActivityIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-gray-700">{event.description}</p>
                  <span className="text-xs text-gray-400">{date}</span>
                </div>
                {event.user && <p className="text-xs text-gray-400">Par {event.user.name}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tasks Tab ───
function TasksTab({ lead }: { lead: any }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const tasks = lead.tasks || [];

  const handleStatusToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await updateTask(taskId, { status: newStatus });
      toast.success(newStatus === "DONE" ? "Tâche marquée terminée" : "Tâche réouverte");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await deleteTask(taskId);
      toast.success("Tâche supprimée");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    // TODO/IN_PROGRESS first, then DONE
    if (a.status !== "DONE" && b.status === "DONE") return -1;
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    // Then by due date
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary py-1.5 px-3 text-xs">
          <Plus size={13} /> Nouvelle tâche
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateTaskInline
          leadId={lead.id}
          assignedToId={lead.assignedToId || lead.assignedTo?.id}
          onClose={(created) => { setShowCreate(false); if (created) router.refresh(); }}
        />
      )}

      {/* Tasks list */}
      {sortedTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <ListTodo size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune tâche</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {sortedTasks.map((task: any) => {
            const isDone = task.status === "DONE";
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;
            const priorityConfig: Record<string, { color: string; bg: string }> = {
              URGENT: { color: "text-red-700", bg: "bg-red-100" },
              HIGH: { color: "text-amber-700", bg: "bg-amber-100" },
              MEDIUM: { color: "text-gray-600", bg: "bg-gray-100" },
              LOW: { color: "text-gray-500", bg: "bg-gray-50" },
            };
            const pc = priorityConfig[task.priority] || priorityConfig.MEDIUM;

            return (
              <div key={task.id} className={cn("flex items-center gap-3 px-4 py-3 group hover:bg-gray-50/50", isOverdue && !isDone && "bg-red-50/30")}>
                {/* Checkbox */}
                <button
                  onClick={() => handleStatusToggle(task.id, task.status)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                    isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-emerald-500"
                  )}
                >
                  {isDone && <Check size={12} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", isDone && "line-through text-gray-400")}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {task.dueDate && (
                      <span className={cn("text-[10px] flex items-center gap-1",
                        isOverdue && !isDone ? "text-red-600 font-medium" : "text-gray-400"
                      )}>
                        <Clock size={10} />
                        {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {isOverdue && !isDone && " (en retard)"}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="text-[10px] text-gray-400">• {task.assignedTo.name}</span>
                    )}
                  </div>
                </div>

                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", pc.bg, pc.color)}>
                  {task.priority}
                </span>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Task Inline ───
function CreateTaskInline({ leadId, assignedToId, onClose }: {
  leadId: string;
  assignedToId: string;
  onClose: (created?: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [type, setType] = useState("TODO");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        dueDate: dueDate || undefined,
        leadId,
        assignedToId,
      });
      toast.success("Tâche créée");
      onClose(true);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3 animate-scale-in">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la tâche..."
        className="input text-sm font-medium"
        onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSubmit(); }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (facultatif)"
        className="input text-sm"
        rows={2}
      />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input text-xs py-1.5">
            <option value="TODO">À faire</option>
            <option value="CALL">Appel</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">RDV</option>
            <option value="FOLLOW_UP">Relance</option>
            <option value="DOCUMENT">Document</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Priorité</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input text-xs py-1.5">
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Échéance</label>
          <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input text-xs py-1.5" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => onClose()} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
        <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Créer
        </button>
      </div>
    </div>
  );
}

// ─── Documents Tab ───
function DocumentsTab({ lead }: { lead: any }) {
  const documents = lead.documents || [];

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
        <FileText size={36} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucun document</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {documents.map((doc: any) => (
        <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
            <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString("fr-FR")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Appointments Tab ───
function AppointmentsTab({ lead }: { lead: any }) {
  const appointments = lead.appointments || [];

  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
        <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucun rendez-vous</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {appointments.map((appt: any) => (
        <div key={appt.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{appt.title}</p>
            <p className="text-xs text-gray-500">
              {new Date(appt.startAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
            appt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
            appt.status === "CANCELLED" ? "bg-red-100 text-red-700" :
            "bg-blue-100 text-blue-700"
          )}>
            {appt.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}