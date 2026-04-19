"use client";

import { useState, useEffect, useMemo } from "react";
import { cn, formatDate, formatRelative, formatPhone, getInitials, getScoreBg } from "@/lib/utils";
import { getCustomFields, type CustomFieldConfig } from "@/lib/custom-fields";
import {
  Search, Filter, ChevronDown, ChevronUp, ChevronRight,
  Phone, MessageCircle, Mail, SlidersHorizontal, X,
  Download, Columns3, Check, Send, Trash2, Loader2, UserPlus,
} from "lucide-react";
import { BulkEmailModal } from "@/components/messaging/bulk-email-modal";
import { deleteLeads, assignLead } from "@/app/(dashboard)/pipeline/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";


interface Lead {
  id: string;
  lastContactAt?: Date | null;
  daysSinceContact?: number;
  firstName: string;
  lastName: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  score: number;
  source: any;
  city: string | null;
  stageId: string;
  createdAt: Date;
  updatedAt: Date;
  customFields?: any;
  assignedTo: { id: string; name: string; avatar: string | null } | null;
  program: { id: string; name: string; code: string | null } | null;
  _count: { messages: number; activities: number };
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface LeadListViewProps {
  leads: Lead[];
  stages: Stage[];
  users: { id: string; name: string }[];
  programs?: { id: string; name: string }[];
  campuses?: { id: string; name: string; city: string }[];
  onOpenLead?: (leadId: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Site web", FACEBOOK: "Facebook", INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp", PHONE_CALL: "Appel", WALK_IN: "Visite",
  REFERRAL: "Parrainage", SALON: "Salon", RADIO: "Radio", TV: "TV",
  PARTNER: "Partenaire", IMPORT: "Import", OTHER: "Autre",
};

const SOURCE_COLORS: Record<string, string> = {
  FACEBOOK: "bg-blue-50 text-blue-600", INSTAGRAM: "bg-pink-50 text-pink-600",
  WHATSAPP: "bg-emerald-50 text-emerald-600", WEBSITE: "bg-sky-50 text-sky-600",
  REFERRAL: "bg-purple-50 text-purple-600", SALON: "bg-amber-50 text-amber-600",
  WALK_IN: "bg-teal-50 text-teal-600", PHONE_CALL: "bg-indigo-50 text-indigo-600",
};

// Default visible columns
const DEFAULT_COLUMNS = ["name", "phone", "email", "stage", "source", "program", "score", "assignedTo", "lastContact", "createdAt"];

// All available system columns
const ALL_COLUMNS: { key: string; label: string; group: string }[] = [
  { key: "name", label: "Nom complet", group: "Contact" },
  { key: "phone", label: "Téléphone", group: "Contact" },
  { key: "email", label: "Email", group: "Contact" },
  { key: "city", label: "Ville", group: "Contact" },
  { key: "whatsapp", label: "WhatsApp", group: "Contact" },
  { key: "stage", label: "Étape", group: "Pipeline" },
  { key: "score", label: "Score", group: "Pipeline" },
  { key: "assignedTo", label: "Commercial", group: "Pipeline" },
  { key: "source", label: "Source", group: "Acquisition" },
  { key: "program", label: "Filière", group: "Formation" },
  { key: "createdAt", label: "Date création", group: "Dates" },
  { key: "updatedAt", label: "Dernière maj", group: "Dates" },
  { key: "lastContact", label: "Dernier contact", group: "Dates" },
];

export function LeadListView({ leads, stages, users, programs = [], campuses = [], onOpenLead }: LeadListViewProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterAssigned, setFilterAssigned] = useState<string>("");
  const [filterProgram, setFilterProgram] = useState<string>("");
  const [filterCampus, setFilterCampus] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [customFieldsConfig, setCustomFieldsConfig] = useState<CustomFieldConfig[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  var [deleting, setDeleting] = useState(false);
  var [assigning, setAssigning] = useState(false);
  var [showAssignMenu, setShowAssignMenu] = useState(false);
  var router = useRouter();

  useEffect(() => {
    getCustomFields().then(setCustomFieldsConfig).catch(() => {});
    // Load saved columns from localStorage
    try {
      var saved = localStorage.getItem("educrm-lead-columns");
      if (saved) setVisibleColumns(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Save columns preference
  const updateColumns = (cols: string[]) => {
    setVisibleColumns(cols);
    try { localStorage.setItem("educrm-lead-columns", JSON.stringify(cols)); } catch (e) {}
  };

  const toggleColumn = (key: string) => {
    if (visibleColumns.includes(key)) {
      updateColumns(visibleColumns.filter((c) => c !== key));
    } else {
      updateColumns([...visibleColumns, key]);
    }
  };

  // Custom field columns
  const customColumns = customFieldsConfig
    .filter((cf) => cf.showInList)
    .map((cf) => ({ key: "custom_" + cf.key, label: cf.label, group: "Personnalisés" }));

  const allAvailableColumns = [...ALL_COLUMNS, ...customColumns];

  // Filter leads
  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (search) {
        var q = search.toLowerCase();
        var match = (lead.firstName + " " + lead.lastName).toLowerCase().includes(q) ||
          lead.phone.includes(q) ||
          (lead.email || "").toLowerCase().includes(q) ||
          (lead.city || "").toLowerCase().includes(q) ||
          (lead.program?.name || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStage && lead.stageId !== filterStage) return false;
      if (filterSource && lead.source !== filterSource) return false;
      if (filterAssigned) {
        if (filterAssigned === "unassigned" && lead.assignedTo) return false;
        if (filterAssigned !== "unassigned" && lead.assignedTo?.id !== filterAssigned) return false;
      }
      if (filterProgram && lead.program?.id !== filterProgram) return false;
      if (filterCampus && (lead as any).campusId !== filterCampus) return false;
      return true;
    });
  }, [leads, search, filterStage, filterSource, filterAssigned, filterProgram, filterCampus]);

  // Sort leads
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      var valA: any, valB: any;
      switch (sortKey) {
        case "name": valA = a.firstName + a.lastName; valB = b.firstName + b.lastName; break;
        case "score": valA = a.score; valB = b.score; break;
        case "createdAt": valA = new Date(a.createdAt).getTime(); valB = new Date(b.createdAt).getTime(); break;
        case "updatedAt": valA = new Date(a.updatedAt).getTime(); valB = new Date(b.updatedAt).getTime(); break;
        case "lastContact":
          valA = (a as any).daysSinceContact ?? 9999;
          valB = (b as any).daysSinceContact ?? 9999;
          break;
        case "city": valA = a.city || ""; valB = b.city || ""; break;
        case "source": valA = a.source; valB = b.source; break;
        default: valA = ""; valB = "";
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === sorted.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(sorted.map((l) => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    var next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedLeads(next);
  };

  var handleBulkDelete = async function() {
    if (!confirm("Supprimer " + selectedLeads.size + " lead(s) ? Cette action est irreversible.")) return;
    setDeleting(true);
    try {
      var result = await deleteLeads(Array.from(selectedLeads));
      toast.success(result.count + " lead(s) supprimé(s)");
      setSelectedLeads(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
    setDeleting(false);
  };

  var handleBulkAssign = async function(userId: string | null) {
    setAssigning(true);
    setShowAssignMenu(false);
    try {
      var ids = Array.from(selectedLeads);
      for (var i = 0; i < ids.length; i++) {
        await assignLead(ids[i], userId);
      }
      var userName = userId ? users.find(function(u) { return u.id === userId; })?.name || "utilisateur" : "personne";
      toast.success(ids.length + " lead(s) assigné(s) a " + userName);
      setSelectedLeads(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'assignation");
    }
    setAssigning(false);
  };

  const activeFiltersCount = [filterStage, filterSource, filterAssigned, filterProgram, filterCampus].filter(Boolean).length;

  const getCustomFieldValue = (lead: Lead, cfKey: string): string => {
    var custom = (lead.customFields as Record<string, any>) || {};
    var cleanKey = cfKey.replace("custom_", "");
    if (custom[cleanKey]) return String(custom[cleanKey]);
    var config = customFieldsConfig.find((cf) => cf.key === cleanKey);
    if (config) {
      for (var mf of config.mappedFormFields) {
        if (custom[mf]) return String(custom[mf]);
      }
    }
    return "";
  };

  const renderCellValue = (lead: Lead, colKey: string) => {
    if (colKey.startsWith("custom_")) {
      var val = getCustomFieldValue(lead, colKey);
      return <span className="text-sm text-gray-600">{val || "—"}</span>;
    }

    switch (colKey) {
      case "name":
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {getInitials(lead.firstName + " " + lead.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{lead.firstName} {lead.lastName}</p>
            </div>
          </div>
        );
      case "phone":
        return <span className="text-sm text-gray-600">{formatPhone(lead.phone)}</span>;
      case "email":
        return <span className="text-sm text-gray-500 truncate block max-w-[180px]">{lead.email || "—"}</span>;
      case "city":
        return <span className="text-sm text-gray-600">{lead.city || "—"}</span>;
      case "whatsapp":
        return <span className="text-sm text-gray-600">{lead.whatsapp ? formatPhone(lead.whatsapp) : "—"}</span>;
      case "stage":
        var stage = stages.find((s) => s.id === lead.stageId);
        return stage ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="text-xs font-medium text-gray-700">{stage.name}</span>
          </div>
        ) : <span className="text-gray-400">—</span>;
      case "score":
        return (
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", getScoreBg(lead.score))}>
            {lead.score}
          </span>
        );
      case "source":
        return (
          <span className={cn("badge text-[10px]", SOURCE_COLORS[lead.source] || "badge-gray")}>
            {SOURCE_LABELS[lead.source] || lead.source}
          </span>
        );
      case "program":
        return <span className="text-xs text-brand-600 font-medium">{lead.program?.code || lead.program?.name || "—"}</span>;
      case "assignedTo":
        return lead.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-bold flex items-center justify-center">
              {getInitials(lead.assignedTo.name)}
            </div>
            <span className="text-xs text-gray-600">{lead.assignedTo.name}</span>
          </div>
        ) : <span className="text-xs text-gray-400">Non assigne</span>;
      case "createdAt":
        return <span className="text-xs text-gray-500">{formatRelative(lead.createdAt)}</span>;
      case "updatedAt":
        return <span className="text-xs text-gray-500">{formatRelative(lead.updatedAt)}</span>;
        case "lastContact":
        if (lead.daysSinceContact === undefined || lead.daysSinceContact === null) return <span className="text-gray-400">—</span>;
        return (
          <span className={cn("text-xs font-medium",
            lead.daysSinceContact >= 7 ? "text-red-600" :
            lead.daysSinceContact >= 3 ? "text-amber-600" :
            "text-emerald-600"
          )}>
            {lead.lastContactAt ? formatRelative(lead.lastContactAt) : "Jamais"}
          </span>
        );
      default:
        return <span className="text-gray-400">—</span>;
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, tel, email, ville..."
              className="input pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn("btn-secondary py-2 text-xs", activeFiltersCount > 0 && "border-brand-300 text-brand-700")}
          >
            <Filter size={14} />
            Filtres
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowColumns(!showColumns)}
            className="btn-secondary py-2 text-xs"
          >
            <Columns3 size={14} />
            Colonnes
          </button>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs text-brand-600 font-medium">
                {selectedLeads.size} sélectionné{selectedLeads.size > 1 ? "s" : ""}
              </span>
              {selectedLeads.size < sorted.length && (
                <button onClick={toggleSelectAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium underline">
                  Tout sélectionner ({sorted.length})
                </button>
              )}
              {selectedLeads.size > 0 && (
                <button onClick={function() { setSelectedLeads(new Set()); }} className="text-xs text-gray-500 hover:text-gray-700 font-medium underline">
                  Désélectionner
                </button>
              )}
              <button
                onClick={() => setBulkEmailOpen(true)}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                <Send size={13} />
                Envoyer un email
              </button>

              <div className="relative">
                <button
                  onClick={function() { setShowAssignMenu(!showAssignMenu); }}
                  disabled={assigning}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  {assigning ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Assigner
                </button>
                {showAssignMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={function() { setShowAssignMenu(false); }} />
                    <div className="absolute top-full right-0 mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-52 animate-scale-in">
                      <button
                        onClick={function() { handleBulkAssign(null); }}
                        className="w-full text-left px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Désassigner
                      </button>
                      <div className="h-px bg-gray-100 my-1" />
                      {users.map(function(u) {
                        return (
                          <button
                            key={u.id}
                            onClick={function() { handleBulkAssign(u.id); }}
                            className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-2"
                          >
                            <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-bold flex items-center justify-center">
                              {getInitials(u.name)}
                            </div>
                            {u.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="btn-secondary py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Supprimer
              </button>
            </>
          )}
          <span className="text-sm text-gray-500">{filtered.length} lead{filtered.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres</h4>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => { setFilterStage(""); setFilterSource(""); setFilterAssigned(""); setFilterProgram(""); setFilterCampus(""); }}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Effacer tout
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Étape</label>
              <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="input text-sm py-1.5">
                <option value="">Toutes</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source</label>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="input text-sm py-1.5">
                <option value="">Toutes</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Commercial</label>
              <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} className="input text-sm py-1.5">
                <option value="">Tous</option>
                <option value="unassigned">Non assigne</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Filière</label>
              <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} className="input text-sm py-1.5">
                <option value="">Toutes</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Campus</label>
              <select value={filterCampus} onChange={(e) => setFilterCampus(e.target.value)} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {campuses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Column picker */}
      {showColumns && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Colonnes visibles</h4>
            <button onClick={() => updateColumns(DEFAULT_COLUMNS)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Réinitialiser
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allAvailableColumns.map((col) => {
              var isActive = visibleColumns.includes(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    isActive
                      ? "bg-brand-50 text-brand-700 border-brand-200"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  )}
                >
                  {isActive && <Check size={12} />}
                  {col.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600"
                  />
                </th>
                {visibleColumns.map((colKey) => {
                  var col = allAvailableColumns.find((c) => c.key === colKey);
                  if (!col) return null;
                  var isSortable = ["name", "score", "createdAt", "updatedAt", "city", "source", "lastContact"].includes(colKey);
                  return (
                    <th
                      key={colKey}
                      className={cn(
                        "text-left px-3 py-2.5 font-medium text-gray-500 text-xs",
                        isSortable && "cursor-pointer hover:text-gray-700 select-none"
                      )}
                      onClick={() => isSortable && handleSort(colKey)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortKey === colKey && (
                          sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "hover:bg-gray-50/50 transition-colors cursor-pointer group",
                    selectedLeads.has(lead.id) && "bg-brand-50/30"
                  )}
                  onClick={() => onOpenLead?.(lead.id)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600"
                    />
                  </td>
                  {visibleColumns.map((colKey) => (
                    <td key={colKey} className="px-3 py-2.5">
                      {renderCellValue(lead, colKey)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">Aucun lead ne correspond aux filtres</p>
            </div>
          )}
        </div>
      </div>

      <BulkEmailModal
        open={bulkEmailOpen}
        onClose={() => { setBulkEmailOpen(false); setSelectedLeads(new Set()); }}
        selectedLeads={leads.filter((l) => selectedLeads.has(l.id)).map((l) => ({
          id: l.id,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
        }))}
      />
    </div>
  );
}
