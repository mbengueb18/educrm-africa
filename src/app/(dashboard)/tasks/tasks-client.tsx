"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Search, Filter, CheckCircle2, Circle, Clock, AlertTriangle,
  Phone, Mail, Users, Calendar, FileText, ArrowRight, MoreHorizontal,
  Trash2, Loader2, X, ChevronDown, Flag, User as UserIcon,
  ListTodo, PlayCircle, CheckCheck, XCircle, Target, Pencil,
  Bell, BellOff, Bold, Italic, List as ListIcon, LinkIcon, ExternalLink,
  MessageCircle, Star, GraduationCap, History, StickyNote, Inbox,
  Check, MessageSquare, Bot,
} from "lucide-react";
import { createTask, updateTask, deleteTask } from "./actions";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";

type Task = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: Date | null;
  reminderAt: Date | null;
  completedAt: Date | null;
  leadId: string | null;
  assignedToId: string;
  createdAt: Date;
  lead: { id: string; firstName: string; lastName: string; phone: string } | null;
  assignedTo: { id: string; name: string; avatar: string | null };
  createdBy: { id: string; name: string } | null;
};

interface TasksClientProps {
  tasks: Task[];
  stats: { total: number; todo: number; inProgress: number; done: number; overdue: number; dueToday: number };
  users: { id: string; name: string; avatar: string | null }[];
  leads: { id: string; firstName: string; lastName: string }[];
  currentUserId: string;
}

var TYPE_CONFIG: Record<string, { label: string; icon: typeof ListTodo; color: string }> = {
  TODO: { label: "À faire", icon: ListTodo, color: "text-gray-500" },
  CALL: { label: "Appeler", icon: Phone, color: "text-blue-500" },
  EMAIL: { label: "Email", icon: Mail, color: "text-purple-500" },
  MEETING: { label: "Rendez-vous", icon: Users, color: "text-teal-500" },
  FOLLOW_UP: { label: "Relance", icon: ArrowRight, color: "text-amber-500" },
  DOCUMENT: { label: "Document", icon: FileText, color: "text-indigo-500" },
  OTHER: { label: "Autre", icon: Target, color: "text-gray-400" },
};

var PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: "Basse", color: "text-gray-500", bg: "bg-gray-100" },
  MEDIUM: { label: "Moyenne", color: "text-blue-600", bg: "bg-blue-50" },
  HIGH: { label: "Haute", color: "text-orange-600", bg: "bg-orange-50" },
  URGENT: { label: "Urgente", color: "text-red-600", bg: "bg-red-50" },
};

var STATUS_CONFIG: Record<string, { label: string; icon: typeof Circle; color: string }> = {
  TODO: { label: "À faire", icon: Circle, color: "text-gray-400" },
  IN_PROGRESS: { label: "En cours", icon: PlayCircle, color: "text-blue-500" },
  DONE: { label: "Terminé", icon: CheckCircle2, color: "text-emerald-500" },
  CANCELLED: { label: "Annulé", icon: XCircle, color: "text-red-400" },
};

var REMINDER_OPTIONS = [
  { value: "", label: "Pas de rappel" },
  { value: "5", label: "5 minutes avant" },
  { value: "15", label: "15 minutes avant" },
  { value: "30", label: "30 minutes avant" },
  { value: "60", label: "1 heure avant" },
  { value: "120", label: "2 heures avant" },
  { value: "1440", label: "1 jour avant" },
  { value: "2880", label: "2 jours avant" },
  { value: "10080", label: "1 semaine avant" },
];

function formatDateTime(d: Date | null): string {
  if (!d) return "";
  var date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " à " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toDateTimeLocal(d: Date | null): string {
  if (!d) return "";
  var date = new Date(d);
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  var h = String(date.getHours()).padStart(2, "0");
  var min = String(date.getMinutes()).padStart(2, "0");
  return y + "-" + m + "-" + day + "T" + h + ":" + min;
}

function calcReminderMinutes(dueDate: string, reminderAt: Date | null): string {
  if (!dueDate || !reminderAt) return "";
  var due = new Date(dueDate).getTime();
  var rem = new Date(reminderAt).getTime();
  var diff = Math.round((due - rem) / 60000);
  var closest = REMINDER_OPTIONS.reduce(function(prev, curr) {
    if (!curr.value) return prev;
    return Math.abs(parseInt(curr.value) - diff) < Math.abs(parseInt(prev.value || "0") - diff) ? curr : prev;
  });
  return closest.value;
}

export function TasksClient({ tasks, stats, users, leads, currentUserId }: TasksClientProps) {
  var [search, setSearch] = useState("");
  var [filterStatus, setFilterStatus] = useState<string>("active");
  var [filterAssigned, setFilterAssigned] = useState<string>("");
  var [filterType, setFilterType] = useState<string>("");
  var [filterPriority, setFilterPriority] = useState<string>("");
  var [showFilters, setShowFilters] = useState(false);
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingTask, setEditingTask] = useState<Task | null>(null);
  var [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  var [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  var router = useRouter();

  var filtered = useMemo(function() {
    return tasks.filter(function(task) {
      if (search) {
        var q = search.toLowerCase();
        var match = task.title.toLowerCase().includes(q) ||
          (task.description || "").toLowerCase().includes(q) ||
          (task.lead ? (task.lead.firstName + " " + task.lead.lastName).toLowerCase().includes(q) : false);
        if (!match) return false;
      }
      if (filterStatus === "active" && (task.status === "DONE" || task.status === "CANCELLED")) return false;
      if (filterStatus === "overdue") {
        if (task.status === "DONE" || task.status === "CANCELLED") return false;
        if (!task.dueDate || new Date(task.dueDate) >= new Date()) return false;
        return true;
      }
      if (filterStatus && filterStatus !== "active" && task.status !== filterStatus) return false;
      if (filterAssigned === "me" && task.assignedToId !== currentUserId) return false;
      if (filterAssigned && filterAssigned !== "me" && filterAssigned !== "" && task.assignedToId !== filterAssigned) return false;
      if (filterType && task.type !== filterType) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, search, filterStatus, filterAssigned, filterType, filterPriority, currentUserId]);

  var activeFiltersCount = [
    filterStatus !== "active" ? filterStatus : "",
    filterAssigned, filterType, filterPriority,
  ].filter(Boolean).length;

  var selectedTask = useMemo(function() {
    return filtered.find(function(t) { return t.id === selectedTaskId; }) || null;
  }, [filtered, selectedTaskId]);

  // Auto-sélection de la 1ère tâche (pour peupler le volet droit sur desktop).
  // N'ouvre PAS l'overlay mobile (mobilePanelOpen reste false tant qu'on ne tape pas).
  useEffect(function() {
    if (filtered.length === 0) { if (selectedTaskId !== null) setSelectedTaskId(null); return; }
    if (!selectedTaskId || !filtered.some(function(t) { return t.id === selectedTaskId; })) {
      setSelectedTaskId(filtered[0].id);
    }
  }, [filtered, selectedTaskId]);

  function handleSelectTask(task: Task) {
    setSelectedTaskId(task.id);
    setMobilePanelOpen(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tâches</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez le suivi commercial de vos leads</p>
        </div>
        <button onClick={function() { setShowCreateModal(true); }} className="btn-primary py-2 text-sm">
          <Plus size={16} /> Nouvelle tâche
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MiniStat label="Total" value={stats.total} color="text-gray-700" />
        <MiniStat label="À faire" value={stats.todo} color="text-gray-500" />
        <MiniStat label="En cours" value={stats.inProgress} color="text-blue-600" />
        <MiniStat label="Terminées" value={stats.done} color="text-emerald-600" />
        <MiniStat label="En retard" value={stats.overdue} color="text-red-600" highlight={stats.overdue > 0} />
        <MiniStat label="Aujourd'hui" value={stats.dueToday} color="text-amber-600" highlight={stats.dueToday > 0} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher une tâche..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto max-w-full no-scrollbar">
          {[
            { key: "active", label: "Actives" },
            { key: "TODO", label: "À faire" },
            { key: "IN_PROGRESS", label: "En cours" },
            { key: "overdue", label: "En retard (" + stats.overdue + ")" },
            { key: "DONE", label: "Terminées" },
            { key: "", label: "Toutes" },
          ].map(function(f) {
            return (
              <button key={f.key} onClick={function() { setFilterStatus(f.key); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterStatus === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {f.label}
              </button>
            );
          })}
        </div>
        <button onClick={function() { setShowFilters(!showFilters); }}
          className={cn("btn-secondary py-2 text-xs", activeFiltersCount > 0 && "border-brand-300 text-brand-700")}>
          <Filter size={14} /> Filtres
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">{activeFiltersCount}</span>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres avancés</h4>
            <button onClick={function() { setFilterAssigned(""); setFilterType(""); setFilterPriority(""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assigné à</label>
              <select value={filterAssigned} onChange={function(e) { setFilterAssigned(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                <option value="me">Mes tâches</option>
                {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={filterType} onChange={function(e) { setFilterType(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {Object.entries(TYPE_CONFIG).map(function(entry) { return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priorité</label>
              <select value={filterPriority} onChange={function(e) { setFilterPriority(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Toutes</option>
                {Object.entries(PRIORITY_CONFIG).map(function(entry) { return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>; })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Vue scindée : liste des tâches (gauche) + revue du prospect (droite) */}
      <div className="lg:grid lg:grid-cols-[minmax(340px,38%)_1fr] lg:gap-4 lg:items-start">
        {/* Liste des tâches */}
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ListTodo size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucune tâche trouvée</p>
              <button onClick={function() { setShowCreateModal(true); }} className="btn-primary py-2 text-xs mt-4">
                <Plus size={14} /> Créer une tâche
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(function(task) {
                return <TaskRow key={task.id} task={task} users={users}
                  selected={task.id === selectedTaskId}
                  onSelect={function() { handleSelectTask(task); }}
                  onUpdate={function() { router.refresh(); }}
                  onEdit={function() { setEditingTask(task); }} />;
              })}
            </div>
          )}
        </div>

        {/* Volet droit — desktop (sticky) */}
        <div className="hidden lg:block lg:sticky lg:top-4">
          <TaskReviewPanel
            task={selectedTask}
            onEdit={function() { if (selectedTask) setEditingTask(selectedTask); }}
            onUpdate={function() { router.refresh(); }}
          />
        </div>
      </div>

      {/* Volet droit — overlay plein écran sur mobile */}
      {mobilePanelOpen && selectedTask && (
        <div className="lg:hidden fixed inset-0 z-50 bg-gray-50 overflow-y-auto animate-fade-in">
          <TaskReviewPanel
            task={selectedTask}
            mobile
            onClose={function() { setMobilePanelOpen(false); }}
            onEdit={function() { if (selectedTask) setEditingTask(selectedTask); }}
            onUpdate={function() { router.refresh(); }}
          />
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <TaskFormModal
          mode="create"
          onClose={function(saved) { setShowCreateModal(false); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}

      {/* Edit modal */}
      {editingTask && (
        <TaskFormModal
          mode="edit"
          task={editingTask}
          onClose={function(saved) { setEditingTask(null); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ─── Task Row ───
function TaskRow({ task, users, onUpdate, onEdit, selected, onSelect }: { task: Task; users: any[]; onUpdate: () => void; onEdit: () => void; selected?: boolean; onSelect?: () => void }) {
  var [updating, setUpdating] = useState(false);
  var [showMenu, setShowMenu] = useState(false);

  var typeConf = TYPE_CONFIG[task.type] || TYPE_CONFIG.TODO;
  var priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  var statusConf = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO;
  var TypeIcon = typeConf.icon;
  var StatusIcon = statusConf.icon;

  var isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE" && task.status !== "CANCELLED";

  var handleStatusToggle = async function() {
    setUpdating(true);
    try {
      var newStatus = task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "DONE" : "TODO";
      await updateTask(task.id, { status: newStatus });
      toast.success("Tâche " + (newStatus === "DONE" ? "terminée" : "mise à jour"));
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setUpdating(false);
  };

  var handleDelete = async function() {
    if (!confirm("Supprimer cette tâche ?")) return;
    setShowMenu(false);
    try {
      await deleteTask(task.id);
      toast.success("Tâche supprimée");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  var handleStatusChange = async function(newStatus: string) {
    setShowMenu(false);
    setUpdating(true);
    try {
      await updateTask(task.id, { status: newStatus });
      toast.success("Statut mis à jour");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setUpdating(false);
  };

  return (
    <div className={cn(
      "px-3 sm:px-5 py-3 sm:py-3.5 transition-colors group border-l-[3px]",
      selected ? "bg-brand-50/60 border-brand-500" : "border-transparent hover:bg-gray-50/50",
      task.status === "DONE" && "opacity-60",
      isOverdue && !selected && "bg-red-50/30"
    )}>
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Status toggle */}
        <button onClick={handleStatusToggle} disabled={updating} className="shrink-0 mt-1 sm:mt-0">
          {updating ? (
            <Loader2 size={20} className="animate-spin text-gray-400" />
          ) : (
            <StatusIcon size={20} className={cn(statusConf.color, "hover:scale-110 transition-transform")} />
          )}
        </button>

        {/* Type icon */}
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", priorityConf.bg)}>
          <TypeIcon size={16} className={typeConf.color} />
        </div>

        {/* Main content — clic = sélection (affiche le prospect dans le volet droit) */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
          {/* Title — own line, truncated */}
          <p className={cn(
            "text-sm font-medium text-gray-900 truncate",
            task.status === "DONE" && "line-through text-gray-500"
          )}>
            {task.title}
          </p>

          {/* Meta line — wraps cleanly */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
              priorityConf.bg,
              priorityConf.color
            )}>
              {priorityConf.label}
            </span>

            {task.reminderAt && (
              <span title={"Rappel : " + formatDateTime(task.reminderAt)} className="inline-flex">
                <Bell size={12} className="text-amber-500" />
              </span>
            )}

            {task.lead && (
              <span className="text-xs text-brand-600 font-medium truncate max-w-[140px] inline-flex items-center gap-1">
                <UserIcon size={11} className="shrink-0" />
                {task.lead.firstName} {task.lead.lastName}
              </span>
            )}

            {task.description && (
              <span className="text-xs text-gray-400 truncate max-w-[200px] hidden md:inline">
                {task.description.replace(/<[^>]*>/g, '')}
              </span>
            )}

            {/* Due date inline on mobile */}
            {task.dueDate && (
              <div className={cn(
                "sm:hidden flex items-center gap-1 text-[10px] whitespace-nowrap",
                isOverdue ? "text-red-600 font-semibold" : "text-gray-500"
              )}>
                {isOverdue && <AlertTriangle size={11} />}
                <Calendar size={11} />
                {formatDateTime(task.dueDate)}
              </div>
            )}
          </div>
        </div>

        {/* Due date — desktop column only */}
        <div className="hidden sm:block shrink-0 text-right">
          {task.dueDate ? (
            <div className={cn(
              "flex items-center gap-1 text-xs whitespace-nowrap",
              isOverdue ? "text-red-600 font-semibold" : "text-gray-500"
            )}>
              {isOverdue && <AlertTriangle size={12} />}
              <Calendar size={12} />
              {formatDateTime(task.dueDate)}
            </div>
          ) : (
            <span className="text-xs text-gray-300">Pas d'échéance</span>
          )}
        </div>

        {/* Assignee avatar */}
        <div className="shrink-0">
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center" title={task.assignedTo.name}>
            {getInitials(task.assignedTo.name)}
          </div>
        </div>

        {/* Actions menu */}
        <div className="shrink-0 relative">
          <button onClick={function(e) { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={function() { setShowMenu(false); }} />
              <div className="absolute top-full right-0 mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-48 animate-scale-in">
                <button onClick={function() { setShowMenu(false); onEdit(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                  <Pencil size={14} /> Modifier
                </button>
                <div className="h-px bg-gray-100 my-1" />
                {Object.entries(STATUS_CONFIG).map(function(entry) {
                  var Icon = entry[1].icon;
                  return (
                    <button key={entry[0]} onClick={function() { handleStatusChange(entry[0]); }}
                      className={cn("w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50",
                        task.status === entry[0] ? "text-brand-600 font-medium" : "text-gray-700"
                      )}>
                      <Icon size={14} className={entry[1].color} /> {entry[1].label}
                    </button>
                  );
                })}
                <div className="h-px bg-gray-100 my-1" />
                <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ Volet droit : revue du prospect ═══

var CHANNEL_META: Record<string, { icon: any; bg: string; color: string; label: string }> = {
  WHATSAPP: { icon: MessageCircle, bg: "bg-emerald-50", color: "text-emerald-600", label: "WhatsApp" },
  EMAIL: { icon: Mail, bg: "bg-blue-50", color: "text-blue-600", label: "Email" },
  SMS: { icon: MessageSquare, bg: "bg-sky-50", color: "text-sky-600", label: "SMS" },
  CHATBOT: { icon: Bot, bg: "bg-violet-50", color: "text-violet-600", label: "Chatbot" },
  PHONE_CALL: { icon: Phone, bg: "bg-brand-50", color: "text-brand-600", label: "Appel" },
  IN_APP: { icon: Bell, bg: "bg-gray-50", color: "text-gray-500", label: "Message" },
};

var CALL_OUTCOME: Record<string, string> = {
  ANSWERED: "Répondu", NO_ANSWER: "Sans réponse", BUSY: "Occupé", VOICEMAIL: "Messagerie",
  CALLBACK: "À rappeler", WRONG_NUMBER: "Mauvais numéro", NOT_INTERESTED: "Pas intéressé",
};

function stripTaskHtml(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
}

function messagePreview(content: string): string {
  var body = content;
  try { var p = JSON.parse(content); body = p.body || p.subject || content; } catch { /* pas du JSON */ }
  return stripTaskHtml(body).slice(0, 240);
}

function TaskReviewPanel({ task, mobile, onClose, onEdit, onUpdate }: {
  task: Task | null;
  mobile?: boolean;
  onClose?: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}) {
  var [lead, setLead] = useState<any>(null);
  var [loading, setLoading] = useState(false);
  var [completing, setCompleting] = useState(false);
  var leadId = task?.leadId || null;

  useEffect(function() {
    if (!leadId) { setLead(null); return; }
    var active = true;
    setLoading(true);
    getLeadDetail(leadId)
      .then(function(data) { if (active) setLead(data); })
      .catch(function() { if (active) setLead(null); })
      .finally(function() { if (active) setLoading(false); });
    return function() { active = false; };
  }, [leadId]);

  if (!task) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 min-h-[420px] flex flex-col items-center justify-center text-center p-10 gap-2">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-500"><Inbox size={26} /></div>
        <h3 className="text-sm font-semibold text-gray-600 mt-1">Sélectionnez une tâche</h3>
        <p className="text-xs text-gray-400 max-w-[240px]">Choisissez une tâche à gauche pour consulter le prospect et l'historique des échanges avant votre rappel.</p>
      </div>
    );
  }

  var priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  var isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE" && task.status !== "CANCELLED";
  var descText = task.description ? stripTaskHtml(task.description) : "";

  var handleComplete = async function() {
    setCompleting(true);
    try {
      await updateTask(task.id, { status: "DONE" });
      toast.success("Tâche terminée");
      onUpdate();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    setCompleting(false);
  };

  return (
    <div className={cn("bg-white lg:rounded-xl lg:border lg:border-gray-200", mobile && "min-h-screen")}>
      {mobile && (
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100">
          <button onClick={onClose} className="p-2 -ml-1 rounded-lg hover:bg-gray-100 text-gray-600"><ArrowRight size={18} className="rotate-180" /></button>
          <span className="text-sm font-semibold text-gray-900">Revue du prospect</span>
        </div>
      )}

      {/* Bandeau tâche en cours */}
      <div className="m-3 sm:m-4 rounded-xl border border-gray-200 bg-gradient-to-b from-brand-50/60 to-transparent p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-brand-600 shrink-0"><Target size={16} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Tâche en cours</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 break-words">{task.title}</p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", priorityConf.bg, priorityConf.color)}>{priorityConf.label}</span>
              {task.dueDate && (
                <span className={cn("text-[11px] inline-flex items-center gap-1", isOverdue ? "text-red-600 font-semibold" : "text-gray-500")}>
                  <Clock size={11} /> {formatDateTime(task.dueDate)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {task.status !== "DONE" && (
              <button onClick={handleComplete} disabled={completing} className="btn-primary py-1.5 px-3 text-xs">
                {completing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Terminer
              </button>
            )}
            <button onClick={onEdit} className="btn-secondary py-1.5 px-3 text-xs"><Pencil size={13} /> Modifier</button>
          </div>
        </div>
        {descText && (
          <div className="flex gap-2 border-t border-dashed border-gray-200 mt-3 pt-3">
            <StickyNote size={15} className="text-brand-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{descText}</p>
          </div>
        )}
      </div>

      {/* Prospect */}
      {!task.leadId ? (
        <div className="px-4 py-10 text-center text-gray-400">
          <UserIcon size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Cette tâche n'est pas liée à un prospect.</p>
        </div>
      ) : loading ? (
        <div className="px-4 py-16 text-center"><Loader2 size={26} className="animate-spin text-brand-500 mx-auto" /></div>
      ) : !lead ? (
        <div className="px-4 py-10 text-center text-gray-400"><p className="text-sm">Prospect introuvable.</p></div>
      ) : (
        <LeadReview lead={lead} />
      )}
    </div>
  );
}

function LeadReview({ lead }: { lead: any }) {
  var stageColor = lead.stage?.color || "#64748B";
  var waNumber = String(lead.whatsapp || lead.phone || "").replace(/\D/g, "");

  var events = useMemo(function() {
    var evs: any[] = [];
    (lead.messages || []).forEach(function(m: any) {
      evs.push({ kind: "message", channel: m.channel, direction: m.direction, date: new Date(m.sentAt), text: messagePreview(m.content) });
    });
    (lead.calls || []).forEach(function(c: any) {
      evs.push({ kind: "call", direction: c.direction, date: new Date(c.calledAt), outcome: c.outcome, duration: c.duration, text: c.notes || "" });
    });
    (lead.activities || []).forEach(function(a: any) {
      if (a.type === "NOTE_ADDED" || a.type === "LEAD_STAGE_CHANGED" || a.type === "LEAD_ASSIGNED" || a.type === "LEAD_CONVERTED") {
        evs.push({ kind: "activity", actType: a.type, date: new Date(a.createdAt), text: a.description });
      }
    });
    evs.sort(function(a, b) { return b.date.getTime() - a.date.getTime(); });
    return evs.slice(0, 20);
  }, [lead]);

  return (
    <div>
      {/* En-tête prospect */}
      <div className="px-4 flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-600 text-white text-base font-bold flex items-center justify-center shrink-0">{getInitials(lead.firstName + " " + lead.lastName)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900">{lead.firstName} {lead.lastName}</span>
            {lead.stage && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: stageColor + "20", color: stageColor }}>{lead.stage.name}</span>}
            <span className="text-[11px] text-gray-500 font-medium inline-flex items-center gap-1"><Star size={11} /> {lead.score}/100</span>
          </div>
          <div className="flex gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500 mt-1">
            {lead.program && <span className="inline-flex items-center gap-1 min-w-0"><GraduationCap size={12} className="shrink-0" /> <span className="truncate">{lead.program.name}</span></span>}
            {lead.assignedTo && <span className="inline-flex items-center gap-1"><UserIcon size={12} className="shrink-0" /> {lead.assignedTo.name}</span>}
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="px-4 mt-3 flex gap-2 flex-wrap">
        <a href={"tel:" + lead.phone} className="btn-secondary py-1.5 px-3 text-xs"><Phone size={13} /> Appeler</a>
        {waNumber && <a href={"https://wa.me/" + waNumber} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"><MessageCircle size={13} /> WhatsApp</a>}
        {lead.email && <a href={"mailto:" + lead.email} className="btn-secondary py-1.5 px-3 text-xs"><Mail size={13} /> Email</a>}
        <Link href={"/leads/" + lead.id} className="btn-secondary py-1.5 px-3 text-xs"><ExternalLink size={13} /> Fiche complète</Link>
      </div>

      {/* Historique des échanges */}
      <div className="border-t border-gray-100 mt-4 px-4 py-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><History size={12} /> Historique des échanges</p>
        {events.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">Aucun échange enregistré pour l'instant.</p>
        ) : (
          <div className="space-y-0">
            {events.map(function(e, i) { return <TimelineEvent key={i} ev={e} />; })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ ev }: { ev: any }) {
  var Icon: any, iconBg: string, iconColor: string, title: string, dirLabel = "";
  if (ev.kind === "message") {
    var meta = CHANNEL_META[ev.channel] || CHANNEL_META.EMAIL;
    Icon = meta.icon; iconBg = meta.bg; iconColor = meta.color; title = meta.label;
    dirLabel = ev.direction === "INBOUND" ? "Reçu" : "Envoyé";
  } else if (ev.kind === "call") {
    Icon = Phone; iconBg = "bg-brand-50"; iconColor = "text-brand-600";
    title = "Appel " + (ev.direction === "INBOUND" ? "entrant" : "sortant");
    dirLabel = CALL_OUTCOME[ev.outcome] || "";
  } else {
    Icon = ev.actType === "NOTE_ADDED" ? StickyNote : ev.actType === "LEAD_STAGE_CHANGED" ? ArrowRight : UserIcon;
    iconBg = "bg-amber-50"; iconColor = "text-amber-600";
    title = ev.actType === "NOTE_ADDED" ? "Note" : ev.actType === "LEAD_STAGE_CHANGED" ? "Changement d'étape" : ev.actType === "LEAD_CONVERTED" ? "Converti" : "Assignation";
  }
  return (
    <div className="flex gap-3">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBg, iconColor)}><Icon size={13} /></div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-gray-800">
            {title}
            {dirLabel && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{dirLabel}</span>}
            {ev.kind === "call" && ev.duration ? <span className="ml-1.5 text-[10px] text-gray-400">{Math.round(ev.duration / 60)} min</span> : null}
          </p>
          <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">{formatRelative(ev.date)}</span>
        </div>
        {ev.text && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-3">{ev.text}</p>}
      </div>
    </div>
  );
}

// ─── Mini Stat ───
function MiniStat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white px-4 py-3 text-center", highlight && "border-red-200 bg-red-50/50")}>
      <div className={cn("text-xl font-bold", color)}>{value}</div>
      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ─── Rich Description Editor ───
function RichDescriptionEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  var editorRef = useRef<HTMLDivElement>(null);

  useEffect(function() {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  var execCommand = function(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <button type="button" onClick={function() { execCommand("bold"); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Gras">
          <Bold size={14} />
        </button>
        <button type="button" onClick={function() { execCommand("italic"); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Italique">
          <Italic size={14} />
        </button>
        <button type="button" onClick={function() { execCommand("insertUnorderedList"); }} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Liste">
          <ListIcon size={14} />
        </button>
        <button type="button" onClick={function() {
          var url = prompt("URL du lien :");
          if (url) execCommand("createLink", url);
        }} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Lien">
          <LinkIcon size={14} />
        </button>
      </div>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="px-3 py-2 min-h-[80px] max-h-[160px] overflow-y-auto text-sm text-gray-700 focus:outline-none prose prose-sm max-w-none"
        onInput={function() {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        data-placeholder="Détails, notes, liens..."
      />
      <style jsx>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

// ─── Task Form Modal (Create + Edit) ───
function TaskFormModal({ mode, task, onClose, users, leads, currentUserId }: {
  mode: "create" | "edit";
  task?: Task;
  onClose: (saved?: boolean) => void;
  users: { id: string; name: string }[];
  leads: { id: string; firstName: string; lastName: string }[];
  currentUserId: string;
}) {
  var [title, setTitle] = useState(task?.title || "");
  var [description, setDescription] = useState(task?.description || "");
  var [type, setType] = useState(task?.type || "TODO");
  var [priority, setPriority] = useState(task?.priority || "MEDIUM");
  var [dueDate, setDueDate] = useState(task?.dueDate ? toDateTimeLocal(task.dueDate) : "");
  var [reminderMinutes, setReminderMinutes] = useState(
    task?.dueDate && task?.reminderAt ? calcReminderMinutes(toDateTimeLocal(task.dueDate), task.reminderAt) : ""
  );
  var [leadId, setLeadId] = useState(task?.leadId || "");
  var [assignedToId, setAssignedToId] = useState(task?.assignedToId || currentUserId);
  var [saving, setSaving] = useState(false);
  var [leadSearch, setLeadSearch] = useState("");

  var filteredLeads = useMemo(function() {
    if (!leadSearch) return leads.slice(0, 20);
    var q = leadSearch.toLowerCase();
    return leads.filter(function(l) {
      return (l.firstName + " " + l.lastName).toLowerCase().includes(q);
    }).slice(0, 20);
  }, [leads, leadSearch]);

  // Calculate reminderAt from dueDate and reminderMinutes
  var calcReminderAt = function(): string | undefined {
    if (!dueDate || !reminderMinutes) return undefined;
    var due = new Date(dueDate).getTime();
    var rem = due - parseInt(reminderMinutes) * 60000;
    return new Date(rem).toISOString();
  };

  var handleSubmit = async function() {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        await createTask({
          title: title.trim(),
          description: description || undefined,
          type,
          priority,
          dueDate: dueDate || undefined,
          reminderAt: calcReminderAt(),
          leadId: leadId || undefined,
          assignedToId,
        });
        toast.success("Tâche créée");
      } else if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description || "",
          type,
          priority,
          dueDate: dueDate || null,
          reminderAt: calcReminderAt() || null,
          leadId: leadId || null,
          assignedToId,
        });
        toast.success("Tâche mise à jour");
      }
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={function() { onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {mode === "create" ? "Nouvelle tâche" : "Modifier la tâche"}
          </h2>
          <button onClick={function() { onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
            <input type="text" value={title} onChange={function(e) { setTitle(e.target.value); }} className="input text-sm" placeholder="Ex: Rappeler Fatou Diallo" autoFocus />
          </div>

          {/* Description (Rich Text) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <RichDescriptionEditor value={description} onChange={setDescription} />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
              <select value={type} onChange={function(e) { setType(e.target.value); }} className="input text-sm">
                {Object.entries(TYPE_CONFIG).map(function(entry) {
                  return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Priorité</label>
              <select value={priority} onChange={function(e) { setPriority(e.target.value); }} className="input text-sm">
                {Object.entries(PRIORITY_CONFIG).map(function(entry) {
                  return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Due date + Assigned to */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Échéance</label>
              <input type="datetime-local" value={dueDate} onChange={function(e) { setDueDate(e.target.value); }} className="input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Assigné à</label>
              <select value={assignedToId} onChange={function(e) { setAssignedToId(e.target.value); }} className="input text-sm">
                {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
              <Bell size={12} className="text-amber-500" /> Rappel
            </label>
            <select
              value={reminderMinutes}
              onChange={function(e) { setReminderMinutes(e.target.value); }}
              className="input text-sm"
              disabled={!dueDate}
            >
              {REMINDER_OPTIONS.map(function(opt) {
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
            {!dueDate && reminderMinutes === "" && (
              <p className="text-[10px] text-gray-400 mt-1">Définissez une échéance pour activer le rappel</p>
            )}
          </div>

          {/* Lead */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Lead associé (optionnel)</label>
            <select value={leadId} onChange={function(e) { setLeadId(e.target.value); }} className="input text-sm">
              <option value="">Aucun lead</option>
              {filteredLeads.map(function(l) { return <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>; })}
            </select>
          </div>

          {/* Status (edit mode only) */}
          {mode === "edit" && task && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label>
              <div className="flex items-center gap-2">
                {Object.entries(STATUS_CONFIG).map(function(entry) {
                  var Icon = entry[1].icon;
                  var isActive = task.status === entry[0];
                  return (
                    <button key={entry[0]} type="button"
                      onClick={async function() {
                        await updateTask(task.id, { status: entry[0] });
                        toast.success("Statut mis à jour");
                        onClose(true);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        isActive ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      )}>
                      <Icon size={14} className={entry[1].color} /> {entry[1].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-2xl">
          <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Plus size={14} /> : <CheckCircle2 size={14} />}
            {mode === "create" ? "Créer la tâche" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}