"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatPhone, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Search, Filter, Calendar, Clock, MapPin, Video, Phone,
  Users, X, Loader2, MoreHorizontal, Trash2, Pencil, CheckCircle2,
  XCircle, UserX, ChevronLeft, ChevronRight, Link as LinkIcon,
  CalendarDays, CalendarRange, List, Target, TrendingUp, Ban,
} from "lucide-react";
import { createAppointment, updateAppointment, deleteAppointment } from "./actions";
import { syncAppointmentToGoogle } from "./google-sync-actions";

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  meetingUrl: string | null;
  meetingProvider: string | null;
  leadId: string | null;
  assignedToId: string;
  reminderAt: Date | null;
  notes: string | null;
  createdAt: Date;
  lead: { id: string; firstName: string; lastName: string; phone: string; email: string | null } | null;
  assignedTo: { id: string; name: string; avatar: string | null };
  createdBy: { id: string; name: string } | null;
};

interface AppointmentsClientProps {
  appointments: Appointment[];
  stats: { total: number; today: number; thisWeek: number; scheduled: number; completed: number; cancelled: number; noShow: number; completionRate: number };
  users: { id: string; name: string; avatar: string | null }[];
  leads: { id: string; firstName: string; lastName: string; phone: string; email: string | null }[];
  currentUserId: string;
}

var TYPE_CONFIG: Record<string, { label: string; icon: typeof Calendar; color: string; bg: string }> = {
  IN_PERSON: { label: "Présentiel", icon: MapPin, color: "text-blue-600", bg: "bg-blue-50" },
  PHONE: { label: "Téléphone", icon: Phone, color: "text-emerald-600", bg: "bg-emerald-50" },
  VIDEO_CALL: { label: "Visio", icon: Video, color: "text-purple-600", bg: "bg-purple-50" },
};

var STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED: { label: "Planifié", color: "text-blue-600", bg: "bg-blue-50" },
  CONFIRMED: { label: "Confirmé", color: "text-emerald-600", bg: "bg-emerald-50" },
  IN_PROGRESS: { label: "En cours", color: "text-amber-600", bg: "bg-amber-50" },
  COMPLETED: { label: "Terminé", color: "text-gray-600", bg: "bg-gray-100" },
  CANCELLED: { label: "Annulé", color: "text-red-500", bg: "bg-red-50" },
  NO_SHOW: { label: "Absent", color: "text-red-600", bg: "bg-red-50" },
};

var PROVIDER_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateFull(d: Date): string {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function isSameDay(a: Date, b: Date): boolean {
  var da = new Date(a);
  var db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
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

export function AppointmentsClient({ appointments, stats, users, leads, currentUserId }: AppointmentsClientProps) {
  var [search, setSearch] = useState("");
  var [viewMode, setViewMode] = useState<"agenda" | "week" | "list">("agenda");
  var [filterStatus, setFilterStatus] = useState<string>("");
  var [filterType, setFilterType] = useState<string>("");
  var [filterUser, setFilterUser] = useState<string>("");
  var [showFilters, setShowFilters] = useState(false);
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  var [currentDate, setCurrentDate] = useState(new Date());
  var router = useRouter();

  // Google Calendar success toast
  useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("google") === "success") {
      setTimeout(function() {
        toast.success("Google Calendar connecté avec succès ! Vous pouvez maintenant créer un rendez-vous synchronisé.");
      }, 500);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Filter
  var filtered = useMemo(function() {
    return appointments.filter(function(appt) {
      if (search) {
        var q = search.toLowerCase();
        var match = appt.title.toLowerCase().includes(q) ||
          (appt.lead ? (appt.lead.firstName + " " + appt.lead.lastName).toLowerCase().includes(q) : false) ||
          (appt.location || "").toLowerCase().includes(q) ||
          (appt.notes || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStatus && appt.status !== filterStatus) return false;
      if (filterType && appt.type !== filterType) return false;
      if (filterUser === "me" && appt.assignedToId !== currentUserId) return false;
      if (filterUser && filterUser !== "me" && filterUser !== "" && appt.assignedToId !== filterUser) return false;
      return true;
    });
  }, [appointments, search, filterStatus, filterType, filterUser, currentUserId]);

  // Group by date for agenda view
  var groupedByDate = useMemo(function() {
    var groups: { date: Date; appointments: Appointment[] }[] = [];
    var dateMap = new Map<string, Appointment[]>();

    filtered.forEach(function(appt) {
      var key = new Date(appt.startAt).toISOString().split("T")[0];
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(appt);
    });

    dateMap.forEach(function(appts, key) {
      groups.push({ date: new Date(key), appointments: appts });
    });

    groups.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
    return groups;
  }, [filtered]);

  // Week view data
  var weekDays = useMemo(function() {
    var start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    var days: { date: Date; appointments: Appointment[] }[] = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        appointments: filtered.filter(function(appt) { return isSameDay(new Date(appt.startAt), d); }),
      });
    }
    return days;
  }, [filtered, currentDate]);

  var navigateWeek = function(dir: number) {
    var next = new Date(currentDate);
    next.setDate(next.getDate() + dir * 7);
    setCurrentDate(next);
  };

  var activeFiltersCount = [filterStatus, filterType, filterUser].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Rendez-vous</h1>
          <p className="text-sm text-gray-500 mt-1">Planifiez et suivez vos rendez-vous</p>
        </div>
        <button onClick={function() { setShowCreateModal(true); }} className="btn-primary py-2 text-sm">
          <Plus size={16} /> Nouveau rendez-vous
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <MiniStat label="Total" value={String(stats.total)} color="text-gray-700" />
        <MiniStat label="Aujourd'hui" value={String(stats.today)} color="text-blue-600" highlight={stats.today > 0} />
        <MiniStat label="Cette semaine" value={String(stats.thisWeek)} color="text-indigo-600" />
        <MiniStat label="Planifiés" value={String(stats.scheduled)} color="text-blue-500" />
        <MiniStat label="Terminés" value={String(stats.completed)} color="text-emerald-600" />
        <MiniStat label="Annulés" value={String(stats.cancelled)} color="text-red-500" />
        <MiniStat label="Absents" value={String(stats.noShow)} color="text-red-600" />
        <MiniStat label="Taux présence" value={stats.completionRate + "%"} color="text-brand-600" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: "agenda" as const, label: "Agenda", icon: CalendarDays },
            { key: "week" as const, label: "Semaine", icon: CalendarRange },
            { key: "list" as const, label: "Liste", icon: List },
          ].map(function(v) {
            var Icon = v.icon;
            return (
              <button key={v.key} onClick={function() { setViewMode(v.key); }}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  viewMode === v.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                <Icon size={13} /> {v.label}
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

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres</h4>
            <button onClick={function() { setFilterStatus(""); setFilterType(""); setFilterUser(""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Statut</label>
              <select value={filterStatus} onChange={function(e) { setFilterStatus(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {Object.entries(STATUS_CONFIG).map(function(entry) { return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>; })}
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
              <label className="text-xs text-gray-500 mb-1 block">Commercial</label>
              <select value={filterUser} onChange={function(e) { setFilterUser(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                <option value="me">Mes RDV</option>
                {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Views */}
      {viewMode === "agenda" && <AgendaView groups={groupedByDate} onEdit={setEditingAppt} onRefresh={function() { router.refresh(); }} />}
      {viewMode === "week" && <WeekView days={weekDays} currentDate={currentDate} onNavigate={navigateWeek} onEdit={setEditingAppt} onRefresh={function() { router.refresh(); }} />}
      {viewMode === "list" && <ListView appointments={filtered} onEdit={setEditingAppt} onRefresh={function() { router.refresh(); }} />}

      {/* Create modal */}
      {showCreateModal && (
        <AppointmentFormModal
          mode="create"
          onClose={function(saved) { setShowCreateModal(false); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}

      {/* Edit modal */}
      {editingAppt && (
        <AppointmentFormModal
          mode="edit"
          appointment={editingAppt}
          onClose={function(saved) { setEditingAppt(null); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ─── Agenda View (grouped by date) ───
function AgendaView({ groups, onEdit, onRefresh }: { groups: { date: Date; appointments: Appointment[] }[]; onEdit: (a: Appointment) => void; onRefresh: () => void }) {
  var today = new Date();

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
        <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Aucun rendez-vous</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(function(group) {
        var isToday = isSameDay(group.date, today);
        var isPast = group.date < today && !isToday;
        return (
          <div key={group.date.toISOString()} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className={cn("px-5 py-2.5 border-b", isToday ? "bg-brand-50 border-brand-200" : isPast ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100")}>
              <span className={cn("text-sm font-semibold", isToday ? "text-brand-700" : isPast ? "text-gray-400" : "text-gray-700")}>
                {isToday ? "Aujourd'hui — " : ""}{formatDateFull(group.date)}
              </span>
              <span className="text-xs text-gray-400 ml-2">{group.appointments.length} RDV</span>
            </div>
            <div className="divide-y divide-gray-50">
              {group.appointments.map(function(appt) {
                return <AppointmentCard key={appt.id} appointment={appt} onEdit={onEdit} onRefresh={onRefresh} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Week View ───
function WeekView({ days, currentDate, onNavigate, onEdit, onRefresh }: {
  days: { date: Date; appointments: Appointment[] }[];
  currentDate: Date;
  onNavigate: (dir: number) => void;
  onEdit: (a: Appointment) => void;
  onRefresh: () => void;
}) {
  var today = new Date();
  var dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={function() { onNavigate(-1); }} className="btn-secondary py-1.5 px-2"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-gray-700">
          {formatDateShort(days[0].date)} — {formatDateShort(days[6].date)}
        </span>
        <button onClick={function() { onNavigate(1); }} className="btn-secondary py-1.5 px-2"><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(function(day, i) {
          var isToday = isSameDay(day.date, today);
          return (
            <div key={i} className={cn("bg-white rounded-xl border min-h-[200px]", isToday ? "border-brand-300 bg-brand-50/20" : "border-gray-200")}>
              <div className={cn("text-center py-2 border-b", isToday ? "border-brand-200" : "border-gray-100")}>
                <div className="text-[10px] text-gray-400 uppercase">{dayNames[i]}</div>
                <div className={cn("text-lg font-bold", isToday ? "text-brand-600" : "text-gray-700")}>
                  {day.date.getDate()}
                </div>
              </div>
              <div className="p-1.5 space-y-1">
                {day.appointments.map(function(appt) {
                  var typeConf = TYPE_CONFIG[appt.type] || TYPE_CONFIG.IN_PERSON;
                  var statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.SCHEDULED;
                  return (
                    <div key={appt.id} onClick={function() { onEdit(appt); }}
                      className={cn("px-2 py-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity", typeConf.bg)}>
                      <div className={cn("font-semibold truncate", typeConf.color)}>{formatTime(appt.startAt)}</div>
                      <div className="text-gray-700 truncate font-medium">{appt.title}</div>
                      {appt.lead && <div className="text-gray-500 truncate">{appt.lead.firstName} {appt.lead.lastName}</div>}
                    </div>
                  );
                })}
                {day.appointments.length === 0 && (
                  <div className="text-[10px] text-gray-300 text-center py-4">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── List View ───
function ListView({ appointments, onEdit, onRefresh }: { appointments: Appointment[]; onEdit: (a: Appointment) => void; onRefresh: () => void }) {
  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
        <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Aucun rendez-vous</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="divide-y divide-gray-50">
        {appointments.map(function(appt) {
          return <AppointmentCard key={appt.id} appointment={appt} onEdit={onEdit} onRefresh={onRefresh} />;
        })}
      </div>
    </div>
  );
}

// ─── Appointment Card ───
function AppointmentCard({ appointment, onEdit, onRefresh }: { appointment: Appointment; onEdit: (a: Appointment) => void; onRefresh: () => void }) {
  var [showMenu, setShowMenu] = useState(false);
  var typeConf = TYPE_CONFIG[appointment.type] || TYPE_CONFIG.IN_PERSON;
  var statusConf = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.SCHEDULED;
  var TypeIcon = typeConf.icon;

  var isPast = new Date(appointment.endAt) < new Date() && appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW";

  var handleStatusChange = async function(newStatus: string) {
    setShowMenu(false);
    try {
      await updateAppointment(appointment.id, { status: newStatus });
      toast.success("Statut mis à jour");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  var handleDelete = async function() {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    setShowMenu(false);
    try {
      await deleteAppointment(appointment.id);
      toast.success("Rendez-vous supprimé");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <div className={cn("flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group", isPast && "bg-amber-50/20")}>
      {/* Time */}
      <div className="shrink-0 text-center w-16">
        <div className="text-sm font-bold text-gray-900">{formatTime(appointment.startAt)}</div>
        <div className="text-[10px] text-gray-400">{formatTime(appointment.endAt)}</div>
      </div>

      {/* Type icon */}
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", typeConf.bg)}>
        <TypeIcon size={18} className={typeConf.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={function() { onEdit(appointment); }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{appointment.title}</p>
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", statusConf.bg, statusConf.color)}>{statusConf.label}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {appointment.lead && <span className="text-xs text-brand-600 font-medium">{appointment.lead.firstName} {appointment.lead.lastName}</span>}
          {appointment.location && <span className="text-xs text-gray-400 flex items-center gap-0.5"><MapPin size={10} /> {appointment.location}</span>}
          {appointment.meetingUrl && (
            <a href={appointment.meetingUrl} target="_blank" onClick={function(e) { e.stopPropagation(); }}
              className="text-xs text-purple-600 flex items-center gap-0.5 hover:underline">
              <Video size={10} /> {PROVIDER_LABELS[appointment.meetingProvider || ""] || "Rejoindre"}
            </a>
          )}
        </div>
      </div>

      {/* Assigned to */}
      <div className="shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center" title={appointment.assignedTo.name}>
          {getInitials(appointment.assignedTo.name)}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0">
        <button onClick={function(e) { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <MoreHorizontal size={16} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={function() { setShowMenu(false); }} />
            <div className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-48 animate-scale-in" style={{ right: "2rem" }}>
              <button onClick={function() { setShowMenu(false); onEdit(appointment); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                <Pencil size={14} /> Modifier
              </button>
              <div className="h-px bg-gray-100 my-1" />
              {Object.entries(STATUS_CONFIG).map(function(entry) {
                return (
                  <button key={entry[0]} onClick={function() { handleStatusChange(entry[0]); }}
                    className={cn("w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50",
                      appointment.status === entry[0] ? "text-brand-600 font-medium" : "text-gray-700"
                    )}>
                    {entry[1].label}
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
  );
}

// ─── Mini Stat ───
function MiniStat({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white px-3 py-3 text-center", highlight && "border-brand-200 bg-brand-50/30")}>
      <div className={cn("text-lg font-bold", color)}>{value}</div>
      <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ─── Appointment Form Modal ───
function AppointmentFormModal({ mode, appointment, onClose, users, leads, currentUserId }: {
  mode: "create" | "edit";
  appointment?: Appointment;
  onClose: (saved?: boolean) => void;
  users: { id: string; name: string }[];
  leads: { id: string; firstName: string; lastName: string; phone: string; email: string | null }[];
  currentUserId: string;
}) {
  var now = new Date();
  var defaultStart = new Date(now.getTime() + 3600000); // +1h
  defaultStart.setMinutes(0, 0, 0);
  var defaultEnd = new Date(defaultStart.getTime() + 3600000); // +1h

  var [title, setTitle] = useState(appointment?.title || "");
  var [description, setDescription] = useState(appointment?.description || "");
  var [type, setType] = useState(appointment?.type || "IN_PERSON");
  var [startAt, setStartAt] = useState(appointment ? toDateTimeLocal(appointment.startAt) : toDateTimeLocal(defaultStart));
  var [endAt, setEndAt] = useState(appointment ? toDateTimeLocal(appointment.endAt) : toDateTimeLocal(defaultEnd));
  var [location, setLocation] = useState(appointment?.location || "");
  var [meetingUrl, setMeetingUrl] = useState(appointment?.meetingUrl || "");
  var [meetingProvider, setMeetingProvider] = useState(appointment?.meetingProvider || "");
  var [leadId, setLeadId] = useState(appointment?.leadId || "");
  var [assignedToId, setAssignedToId] = useState(appointment?.assignedToId || currentUserId);
  var [notes, setNotes] = useState(appointment?.notes || "");
  var [saving, setSaving] = useState(false);

  // Google Calendar
  var [googleConnected, setGoogleConnected] = useState(false);
  var [syncToGoogle, setSyncToGoogle] = useState(false);
  var [syncing, setSyncing] = useState(false);

  useEffect(function() {
    fetch("/api/integrations/google/status").then(function(r) { return r.json(); }).then(function(data) {
      setGoogleConnected(data.connected);
      if (data.connected) setSyncToGoogle(true);
    }).catch(function() {});

    // Show success toast if redirected from Google OAuth
    if (typeof window !== "undefined" && window.location.search.includes("google=success")) {
      toast.success("Google Calendar connecté avec succès !");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Auto-adjust endAt when startAt changes
  var handleStartChange = function(val: string) {
    setStartAt(val);
    if (val) {
      var s = new Date(val);
      var e = new Date(s.getTime() + 3600000);
      setEndAt(toDateTimeLocal(e));
    }
  };

  // Auto-fill title when lead selected
  var handleLeadChange = function(newLeadId: string) {
    setLeadId(newLeadId);
    if (newLeadId && !title) {
      var lead = leads.find(function(l) { return l.id === newLeadId; });
      if (lead) setTitle("Rendez-vous avec " + lead.firstName + " " + lead.lastName);
    }
  };

  var handleSubmit = async function() {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    if (!startAt || !endAt) { toast.error("Les dates sont requises"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        var result = await createAppointment({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startAt,
          endAt,
          location: location.trim() || undefined,
          meetingUrl: meetingUrl.trim() || undefined,
          meetingProvider: meetingProvider || undefined,
          leadId: leadId || undefined,
          assignedToId,
          notes: notes.trim() || undefined,
        });
        toast.success("Rendez-vous créé");
        // Sync to Google Calendar
        if (syncToGoogle && googleConnected) {
          setSyncing(true);
          try {
            var syncResult = await syncAppointmentToGoogle(result.appointment.id);
            if (syncResult.meetingUrl) {
              toast.success("Lien Google Meet généré !");
            } else {
              toast.success("Synchronisé avec Google Calendar");
            }
          } catch (err: any) {
            toast.error("Sync Google : " + (err.message || "Erreur"));
          }
          setSyncing(false);
        }
      } else if (appointment) {
        await updateAppointment(appointment.id, {
          title: title.trim(),
          description: description.trim(),
          type,
          startAt,
          endAt,
          location: location.trim(),
          meetingUrl: meetingUrl.trim(),
          meetingProvider,
          leadId: leadId || null,
          assignedToId,
          notes: notes.trim(),
        });
        toast.success("Rendez-vous mis à jour");
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">{mode === "create" ? "Nouveau rendez-vous" : "Modifier le rendez-vous"}</h2>
          <button onClick={function() { onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
            <input type="text" value={title} onChange={function(e) { setTitle(e.target.value); }} className="input text-sm" placeholder="Ex: Entretien avec Fatou Diallo" autoFocus />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Type</label>
            <div className="flex gap-2">
              {Object.entries(TYPE_CONFIG).map(function(entry) {
                var Icon = entry[1].icon;
                return (
                  <button key={entry[0]} type="button" onClick={function() { setType(entry[0]); }}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                      type === entry[0] ? entry[1].bg + " " + entry[1].color + " border-current" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    )}>
                    <Icon size={16} /> {entry[1].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Début *</label>
              <input type="datetime-local" value={startAt} onChange={function(e) { handleStartChange(e.target.value); }} className="input text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fin *</label>
              <input type="datetime-local" value={endAt} onChange={function(e) { setEndAt(e.target.value); }} className="input text-sm" />
            </div>
          </div>

          {/* Location / Meeting URL */}
          {type === "IN_PERSON" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Lieu</label>
              <input type="text" value={location} onChange={function(e) { setLocation(e.target.value); }} className="input text-sm" placeholder="Ex: Campus Dakar, Bureau 201" />
            </div>
          )}
          {type === "VIDEO_CALL" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Plateforme</label>
                <select value={meetingProvider} onChange={function(e) { setMeetingProvider(e.target.value); }} className="input text-sm">
                  <option value="">Sélectionner</option>
                  <option value="google_meet">Google Meet</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Lien de la réunion</label>
                <input type="url" value={meetingUrl} onChange={function(e) { setMeetingUrl(e.target.value); }} className="input text-sm" placeholder="https://meet.google.com/xxx-xxxx-xxx" />
              </div>
            </div>
          )}

          {/* Lead + Assigned to */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Lead (optionnel)</label>
              <select value={leadId} onChange={function(e) { handleLeadChange(e.target.value); }} className="input text-sm">
                <option value="">Aucun lead</option>
                {leads.map(function(l) { return <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Assigné à</label>
              <select value={assignedToId} onChange={function(e) { setAssignedToId(e.target.value); }} className="input text-sm">
                {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
          </div>

          {/* Google Calendar sync */}
          {googleConnected && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2">
                <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" alt="Google Calendar" className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Google Calendar</p>
                  <p className="text-[10px] text-blue-600">Synchroniser ce rendez-vous</p>
                </div>
              </div>
              <button type="button" onClick={function() { setSyncToGoogle(!syncToGoogle); }}
                className={cn("w-11 h-6 rounded-full transition-colors relative", syncToGoogle ? "bg-blue-500" : "bg-gray-300")}>
                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform", syncToGoogle ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
          )}

          {googleConnected && syncToGoogle && type === "VIDEO_CALL" && !meetingUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <Video size={14} className="text-emerald-600" />
              <p className="text-xs text-emerald-700">Un lien Google Meet sera généré automatiquement</p>
            </div>
          )}

          {!googleConnected && (
            <a href="/api/integrations/google/connect?returnTo=/appointments" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-2">
                <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" alt="Google Calendar" className="w-5 h-5 opacity-50" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Connecter Google Calendar</p>
                  <p className="text-[10px] text-gray-400">Synchronisez vos rendez-vous et générez des liens Meet</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400" />
            </a>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
            <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} className="input text-sm" rows={2} placeholder="Ordre du jour, documents à apporter..." />
          </div>

          {/* Status (edit only) */}
          {mode === "edit" && appointment && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Statut</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(STATUS_CONFIG).map(function(entry) {
                  return (
                    <button key={entry[0]} type="button"
                      onClick={async function() {
                        await updateAppointment(appointment.id, { status: entry[0] });
                        toast.success("Statut mis à jour");
                        onClose(true);
                      }}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        appointment.status === entry[0] ? entry[1].bg + " " + entry[1].color + " border-current" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      )}>
                      {entry[1].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-2xl">
          <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Calendar size={14} /> : <CheckCircle2 size={14} />}
            {mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}