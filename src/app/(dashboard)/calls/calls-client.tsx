"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelative, formatPhone, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, Search, Filter, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  PhoneOff, Clock, X, Loader2, MoreHorizontal, Trash2, Pencil,
  Voicemail, UserX, ThumbsDown, RotateCcw, CheckCircle2, BarChart3,
  Timer, Target, TrendingUp,
} from "lucide-react";
import { logCall, updateCall, deleteCall } from "./actions";

type Call = {
  id: string;
  leadId: string | null;
  direction: string;
  outcome: string;
  duration: number | null;
  phoneNumber: string;
  notes: string | null;
  calledById: string;
  calledAt: Date;
  lead: { id: string; firstName: string; lastName: string; phone: string } | null;
  calledBy: { id: string; name: string; avatar: string | null };
};

interface CallsClientProps {
  calls: Call[];
  stats: { total: number; today: number; thisWeek: number; answered: number; noAnswer: number; reachRate: number; avgDuration: number };
  users: { id: string; name: string; avatar: string | null }[];
  leads: { id: string; firstName: string; lastName: string; phone: string }[];
  currentUserId: string;
}

var DIRECTION_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  OUTBOUND: { label: "Sortant", icon: PhoneOutgoing, color: "text-blue-500" },
  INBOUND: { label: "Entrant", icon: PhoneIncoming, color: "text-emerald-500" },
};

var OUTCOME_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  ANSWERED: { label: "Décroché", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  NO_ANSWER: { label: "Pas de réponse", icon: PhoneMissed, color: "text-red-500", bg: "bg-red-50" },
  BUSY: { label: "Occupé", icon: PhoneOff, color: "text-orange-500", bg: "bg-orange-50" },
  VOICEMAIL: { label: "Messagerie", icon: Voicemail, color: "text-purple-500", bg: "bg-purple-50" },
  CALLBACK: { label: "Rappeler", icon: RotateCcw, color: "text-amber-500", bg: "bg-amber-50" },
  WRONG_NUMBER: { label: "Mauvais numéro", icon: UserX, color: "text-gray-500", bg: "bg-gray-100" },
  NOT_INTERESTED: { label: "Pas intéressé", icon: ThumbsDown, color: "text-red-400", bg: "bg-red-50" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  if (m === 0) return s + "s";
  return m + "min " + (s > 0 ? String(s).padStart(2, "0") + "s" : "");
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return seconds + "s";
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return m + ":" + String(s).padStart(2, "0");
}

export function CallsClient({ calls, stats, users, leads, currentUserId }: CallsClientProps) {
  var [search, setSearch] = useState("");
  var [filterDirection, setFilterDirection] = useState<string>("");
  var [filterOutcome, setFilterOutcome] = useState<string>("");
  var [filterUser, setFilterUser] = useState<string>("");
  var [showFilters, setShowFilters] = useState(false);
  var [showLogModal, setShowLogModal] = useState(false);
  var [editingCall, setEditingCall] = useState<Call | null>(null);
  var router = useRouter();

  var filtered = useMemo(function() {
    return calls.filter(function(call) {
      if (search) {
        var q = search.toLowerCase();
        var match = call.phoneNumber.includes(q) ||
          (call.lead ? (call.lead.firstName + " " + call.lead.lastName).toLowerCase().includes(q) : false) ||
          (call.notes || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterDirection && call.direction !== filterDirection) return false;
      if (filterOutcome && call.outcome !== filterOutcome) return false;
      if (filterUser === "me" && call.calledById !== currentUserId) return false;
      if (filterUser && filterUser !== "me" && filterUser !== "" && call.calledById !== filterUser) return false;
      return true;
    });
  }, [calls, search, filterDirection, filterOutcome, filterUser, currentUserId]);

  var activeFiltersCount = [filterDirection, filterOutcome, filterUser].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Journal d'appels</h1>
          <p className="text-sm text-gray-500 mt-1">Suivi des appels commerciaux</p>
        </div>
        <button onClick={function() { setShowLogModal(true); }} className="btn-primary py-2 text-sm">
          <Plus size={16} /> Enregistrer un appel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
        <MiniStat label="Total" value={String(stats.total)} icon={Phone} color="text-gray-700" />
        <MiniStat label="Aujourd'hui" value={String(stats.today)} icon={Clock} color="text-blue-600" highlight={stats.today > 0} />
        <MiniStat label="Cette semaine" value={String(stats.thisWeek)} icon={BarChart3} color="text-indigo-600" />
        <MiniStat label="Décroché" value={String(stats.answered)} icon={CheckCircle2} color="text-emerald-600" />
        <MiniStat label="Sans réponse" value={String(stats.noAnswer)} icon={PhoneMissed} color="text-red-500" />
        <MiniStat label="Joignabilité" value={stats.reachRate + "%"} icon={Target} color="text-brand-600" highlight={stats.reachRate >= 50} />
        <MiniStat label="Durée moy." value={formatDurationShort(stats.avgDuration)} icon={Timer} color="text-purple-600" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher par nom, numéro, notes..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: "", label: "Tous" },
            { key: "OUTBOUND", label: "Sortants" },
            { key: "INBOUND", label: "Entrants" },
          ].map(function(f) {
            return (
              <button key={f.key} onClick={function() { setFilterDirection(f.key); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterDirection === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
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

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres avancés</h4>
            <button onClick={function() { setFilterOutcome(""); setFilterUser(""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Résultat</label>
              <select value={filterOutcome} onChange={function(e) { setFilterOutcome(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {Object.entries(OUTCOME_CONFIG).map(function(entry) { return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Commercial</label>
              <select value={filterUser} onChange={function(e) { setFilterUser(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                <option value="me">Mes appels</option>
                {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Call list */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Phone size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun appel enregistré</p>
            <button onClick={function() { setShowLogModal(true); }} className="btn-primary py-2 text-xs mt-4">
              <Plus size={14} /> Enregistrer un appel
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(function(call) {
              return <CallRow key={call.id} call={call} onUpdate={function() { router.refresh(); }} onEdit={function() { setEditingCall(call); }} />;
            })}
          </div>
        )}
      </div>

      {/* Log call modal */}
      {showLogModal && (
        <CallFormModal
          mode="create"
          onClose={function(saved) { setShowLogModal(false); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}

      {/* Edit call modal */}
      {editingCall && (
        <CallFormModal
          mode="edit"
          call={editingCall}
          onClose={function(saved) { setEditingCall(null); if (saved) router.refresh(); }}
          users={users}
          leads={leads}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ─── Call Row ───
function CallRow({ call, onUpdate, onEdit }: { call: Call; onUpdate: () => void; onEdit: () => void }) {
  var [showMenu, setShowMenu] = useState(false);
  var dirConf = DIRECTION_CONFIG[call.direction] || DIRECTION_CONFIG.OUTBOUND;
  var outcomeConf = OUTCOME_CONFIG[call.outcome] || OUTCOME_CONFIG.ANSWERED;
  var DirIcon = dirConf.icon;
  var OutcomeIcon = outcomeConf.icon;

  var handleDelete = async function() {
    if (!confirm("Supprimer cet appel ?")) return;
    setShowMenu(false);
    try {
      await deleteCall(call.id);
      toast.success("Appel supprimé");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group">
      {/* Direction icon */}
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", outcomeConf.bg)}>
        <DirIcon size={18} className={dirConf.color} />
      </div>

      {/* Lead / Phone */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          {call.lead ? (
            <p className="text-sm font-medium text-gray-900 truncate">{call.lead.firstName} {call.lead.lastName}</p>
          ) : (
            <p className="text-sm font-medium text-gray-700">{formatPhone(call.phoneNumber)}</p>
          )}
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", outcomeConf.bg, outcomeConf.color)}>
            {outcomeConf.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {call.lead && <span className="text-xs text-gray-400">{formatPhone(call.phoneNumber)}</span>}
          {call.notes && <span className="text-xs text-gray-400 truncate max-w-[250px]">{call.notes}</span>}
        </div>
      </div>

      {/* Duration */}
      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Timer size={12} />
          {formatDuration(call.duration)}
        </div>
      </div>

      {/* Date */}
      <div className="shrink-0 text-right min-w-[80px]">
        <span className="text-xs text-gray-500">{formatRelative(call.calledAt)}</span>
      </div>

      {/* Called by */}
      <div className="shrink-0">
        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center" title={call.calledBy.name}>
          {getInitials(call.calledBy.name)}
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
            <div className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-40 animate-scale-in" style={{ right: "2rem" }}>
              <button onClick={function() { setShowMenu(false); onEdit(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                <Pencil size={14} /> Modifier
              </button>
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
function MiniStat({ label, value, icon: Icon, color, highlight }: { label: string; value: string; icon: typeof Phone; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white px-3 py-3 text-center", highlight && "border-brand-200 bg-brand-50/30")}>
      <Icon size={16} className={cn("mx-auto mb-1", color)} />
      <div className={cn("text-lg font-bold", color)}>{value}</div>
      <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// ─── Call Form Modal (Create + Edit) ───
function CallFormModal({ mode, call, onClose, users, leads, currentUserId }: {
  mode: "create" | "edit";
  call?: Call;
  onClose: (saved?: boolean) => void;
  users: { id: string; name: string }[];
  leads: { id: string; firstName: string; lastName: string; phone: string }[];
  currentUserId: string;
}) {
  var [direction, setDirection] = useState(call?.direction || "OUTBOUND");
  var [outcome, setOutcome] = useState(call?.outcome || "ANSWERED");
  var [phoneNumber, setPhoneNumber] = useState(call?.phoneNumber || "");
  var [leadId, setLeadId] = useState(call?.leadId || "");
  var [durationMin, setDurationMin] = useState(call?.duration ? String(Math.floor(call.duration / 60)) : "");
  var [durationSec, setDurationSec] = useState(call?.duration ? String(call.duration % 60) : "");
  var [notes, setNotes] = useState(call?.notes || "");
  var [calledAt, setCalledAt] = useState(
    call?.calledAt ? new Date(call.calledAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  var [saving, setSaving] = useState(false);

  // Auto-fill phone when lead is selected
  var handleLeadChange = function(newLeadId: string) {
    setLeadId(newLeadId);
    if (newLeadId) {
      var lead = leads.find(function(l) { return l.id === newLeadId; });
      if (lead && !phoneNumber) setPhoneNumber(lead.phone);
    }
  };

  var handleSubmit = async function() {
    if (!phoneNumber.trim()) { toast.error("Le numéro de téléphone est requis"); return; }
    setSaving(true);
    var duration = (parseInt(durationMin || "0") * 60) + parseInt(durationSec || "0");

    try {
      if (mode === "create") {
        await logCall({
          leadId: leadId || undefined,
          direction,
          outcome,
          duration: duration > 0 ? duration : undefined,
          phoneNumber: phoneNumber.trim(),
          notes: notes.trim() || undefined,
          calledAt,
        });
        toast.success("Appel enregistré");
      } else if (call) {
        await updateCall(call.id, {
          outcome,
          duration: duration > 0 ? duration : undefined,
          notes: notes.trim() || undefined,
          leadId: leadId || null,
        });
        toast.success("Appel mis à jour");
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
            {mode === "create" ? "Enregistrer un appel" : "Modifier l'appel"}
          </h2>
          <button onClick={function() { onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Direction */}
          {mode === "create" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Direction</label>
              <div className="flex gap-2">
                {Object.entries(DIRECTION_CONFIG).map(function(entry) {
                  var Icon = entry[1].icon;
                  return (
                    <button key={entry[0]} type="button" onClick={function() { setDirection(entry[0]); }}
                      className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                        direction === entry[0] ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      )}>
                      <Icon size={16} className={entry[1].color} /> {entry[1].label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lead + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Lead (optionnel)</label>
              <select value={leadId} onChange={function(e) { handleLeadChange(e.target.value); }} className="input text-sm">
                <option value="">Aucun lead</option>
                {leads.map(function(l) { return <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Numéro *</label>
              <input type="tel" value={phoneNumber} onChange={function(e) { setPhoneNumber(e.target.value); }} className="input text-sm" placeholder="+221 7X XXX XX XX" />
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Résultat</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(OUTCOME_CONFIG).map(function(entry) {
                var Icon = entry[1].icon;
                return (
                  <button key={entry[0]} type="button" onClick={function() { setOutcome(entry[0]); }}
                    className={cn("flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-medium border transition-colors",
                      outcome === entry[0] ? entry[1].bg + " " + entry[1].color + " border-current" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                    )}>
                    <Icon size={14} />
                    {entry[1].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Durée</label>
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="999" value={durationMin} onChange={function(e) { setDurationMin(e.target.value); }} className="input text-sm w-20 text-center" placeholder="0" />
                <span className="text-xs text-gray-400">min</span>
                <input type="number" min="0" max="59" value={durationSec} onChange={function(e) { setDurationSec(e.target.value); }} className="input text-sm w-20 text-center" placeholder="0" />
                <span className="text-xs text-gray-400">sec</span>
              </div>
            </div>
            {mode === "create" && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Date & heure</label>
                <input type="datetime-local" value={calledAt} onChange={function(e) { setCalledAt(e.target.value); }} className="input text-sm" />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
            <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} className="input text-sm" rows={3} placeholder="Résumé de l'appel, prochaines étapes..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-2xl">
          <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !phoneNumber.trim()} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Phone size={14} /> : <CheckCircle2 size={14} />}
            {mode === "create" ? "Enregistrer" : "Mettre à jour"}
          </button>
        </div>
      </div>
    </div>
  );
}