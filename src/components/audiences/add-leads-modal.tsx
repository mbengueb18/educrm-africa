"use client";

import { useState, useEffect, useCallback } from "react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  searchLeadsForAudience,
  addLeadsToAudience,
  getAllMatchingLeadIds,
  getFilterOptions,
  searchLeadsForAudienceAdvanced,
  getAllMatchingLeadIdsAdvanced,
  getAudienceAdvancedFilterData,
} from "@/app/(dashboard)/audiences/actions";
import { FilterGroupBuilder, type FilterGroup } from "@/components/campaigns/filter-group-builder";
import type { CustomFieldConfig } from "@/lib/custom-fields";
import {
  X, Search, Loader2, Plus, UserPlus, Filter,
  Mail, Phone, ChevronDown, ChevronUp, SlidersHorizontal,
} from "lucide-react";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  score: number;
  source: string;
  stage: { name: string; color: string } | null;
  program: { name: string } | null;
  assignedTo: { id: string; name: string } | null;
}

interface FilterOptions {
  stages: Array<{ id: string; name: string; pipelineId: string | null }>;
  pipelines: Array<{ id: string; name: string; formationType: string | null }>;
  programs: Array<{ id: string; name: string; code: string | null; formationType: string | null }>;
  campuses: Array<{ id: string; name: string; city: string }>;
  users: Array<{ id: string; name: string }>;
}

interface AddLeadsModalProps {
  audienceId: string;
  audienceName: string;
  onClose: () => void;
  onAdded: (count: number) => void;
}

const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE_CALL", label: "Appel" },
  { value: "WALK_IN", label: "Visite" },
  { value: "REFERRAL", label: "Parrainage" },
  { value: "SALON", label: "Salon" },
  { value: "IMPORT", label: "Import" },
  { value: "OTHER", label: "Autre" },
];

export function AddLeadsModal({ audienceId, audienceName, onClose, onAdded }: AddLeadsModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  // ─── Mode filtres avancés (règles récursives ET/OU, comme les campagnes) ───
  const [advancedMode, setAdvancedMode] = useState(false);
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({ operator: "AND", rules: [] });
  const [advancedData, setAdvancedData] = useState<{
    stages: { id: string; name: string; color: string }[];
    programs: { id: string; name: string; code: string | null }[];
    audiences: { id: string; name: string; type: string }[];
    users: { id: string; name: string }[];
    customFields: CustomFieldConfig[];
  } | null>(null);

  // ─── Filtres ───
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  // Compteur de filtres actifs (hors search/scope)
  const activeFiltersCount = [
    sourceFilter, stageFilter, pipelineFilter, programFilter, campusFilter,
    minScore, maxScore,
  ].filter(Boolean).length;

  // Charger les options de filtre au montage
  useEffect(() => {
    getFilterOptions()
      .then(setFilterOptions)
      .catch(() => toast.error("Erreur lors du chargement des filtres"));
  }, []);

  // Charger les données du builder avancé à la première activation
  useEffect(() => {
    if (advancedMode && !advancedData) {
      getAudienceAdvancedFilterData()
        .then(setAdvancedData as any)
        .catch(() => toast.error("Erreur lors du chargement des filtres avancés"));
    }
  }, [advancedMode, advancedData]);

  const getCurrentFilters = useCallback(() => ({
    search: search.trim() || undefined,
    onlyMine: scope === "mine",
    unassignedOnly: scope === "unassigned",
    source: sourceFilter || undefined,
    stageId: stageFilter || undefined,
    pipelineId: pipelineFilter || undefined,
    programId: programFilter || undefined,
    campusId: campusFilter || undefined,
    minScore: minScore ? parseInt(minScore, 10) : undefined,
    maxScore: maxScore ? parseInt(maxScore, 10) : undefined,
  }), [search, scope, sourceFilter, stageFilter, pipelineFilter, programFilter, campusFilter, minScore, maxScore]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      if (advancedMode) {
        // En mode avancé : sans règle, on n'affiche rien (évite de charger toute la base)
        if (filterGroup.rules.length === 0) {
          setLeads([]);
          setTotalAvailable(0);
        } else {
          const result = await searchLeadsForAudienceAdvanced(audienceId, filterGroup, 100);
          setLeads(result.leads as any);
          setTotalAvailable(result.totalAvailable);
        }
      } else {
        const result = await searchLeadsForAudience(audienceId, {
          ...getCurrentFilters(),
          limit: 100,
        });
        setLeads(result.leads as any);
        setTotalAvailable(result.totalAvailable);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setLoading(false);
  }, [audienceId, getCurrentFilters, advancedMode, filterGroup]);

  // Debounced reload quand les filtres changent
  useEffect(() => {
    const t = setTimeout(loadLeads, advancedMode ? 500 : 300);
    return () => clearTimeout(t);
  }, [loadLeads, advancedMode]);

  const toggleSelect = (leadId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  // ─── Tout sélectionner (TOUS les filtrés, pas juste les 100 affichés) ───
  const handleSelectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const allIds = advancedMode
        ? await getAllMatchingLeadIdsAdvanced(audienceId, filterGroup)
        : await getAllMatchingLeadIds(audienceId, getCurrentFilters());
      setSelectedIds(new Set(allIds));
      toast.success(`${allIds.length} lead${allIds.length > 1 ? "s" : ""} sélectionné${allIds.length > 1 ? "s" : ""}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSelectingAll(false);
  };

  // Désélectionner tout
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Toggle sélection des leads visibles uniquement
  const toggleSelectVisible = () => {
    const visibleIds = leads.map(l => l.id);
    const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSearch("");
    setScope("all");
    setSourceFilter("");
    setStageFilter("");
    setPipelineFilter("");
    setProgramFilter("");
    setCampusFilter("");
    setMinScore("");
    setMaxScore("");
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      const result = await addLeadsToAudience(audienceId, Array.from(selectedIds));
      toast.success(`${result.added} lead${result.added > 1 ? "s" : ""} ajouté${result.added > 1 ? "s" : ""} à l'audience`);
      onAdded(result.added);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setAdding(false);
  };

  // Visible = tous les leads de la liste actuelle (≤100)
  const allVisibleSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const hasMoreThanVisible = totalAvailable > leads.length;
  const hasActiveFilters = search || scope !== "all" || activeFiltersCount > 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-scale-in flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 truncate">Ajouter des leads</h2>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                à l'audience <span className="font-medium text-gray-700">"{audienceName}"</span>
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Filtres */}
          <div className="p-4 border-b border-gray-100 shrink-0 space-y-3">
            {/* Toggle mode simple / avancé */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setAdvancedMode(false)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  !advancedMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Filter size={12} /> Filtres simples
              </button>
              <button
                onClick={() => setAdvancedMode(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  advancedMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <SlidersHorizontal size={12} /> Filtres avancés
              </button>
            </div>

            {!advancedMode && (
            <>
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, téléphone..."
                className="input pl-9 text-sm py-2 w-full"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Scope + Toggle filtres avancés */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {[
                  { value: "all", label: "Tous" },
                  { value: "mine", label: "Mes leads" },
                  { value: "unassigned", label: "Non assignés" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setScope(opt.value as any)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      scope === opt.value
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                  activeFiltersCount > 0
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
              >
                <Filter size={12} />
                Filtres
                {activeFiltersCount > 0 && (
                  <span className="bg-brand-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                {showAdvancedFilters ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-brand-600 hover:underline ml-auto"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Filtres avancés */}
            {showAdvancedFilters && filterOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <FilterSelect
                  label="Étape"
                  value={stageFilter}
                  onChange={setStageFilter}
                  options={filterOptions.stages.map(s => ({ value: s.id, label: s.name }))}
                />
                <FilterSelect
                  label="Pipeline"
                  value={pipelineFilter}
                  onChange={setPipelineFilter}
                  options={filterOptions.pipelines.map(p => ({
                    value: p.id,
                    label: p.name + (p.formationType ? ` (${p.formationType === "INITIAL" ? "FI" : "FC"})` : "")
                  }))}
                />
                <FilterSelect
                  label="Filière"
                  value={programFilter}
                  onChange={setProgramFilter}
                  options={filterOptions.programs.map(p => ({
                    value: p.id,
                    label: p.name + (p.formationType ? ` (${p.formationType === "INITIAL" ? "FI" : "FC"})` : "")
                  }))}
                />
                <FilterSelect
                  label="Campus"
                  value={campusFilter}
                  onChange={setCampusFilter}
                  options={filterOptions.campuses.map(c => ({ value: c.id, label: `${c.name} — ${c.city}` }))}
                />
                <FilterSelect
                  label="Source"
                  value={sourceFilter}
                  onChange={setSourceFilter}
                  options={SOURCE_OPTIONS}
                />
                <div>
                  <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Score</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="min"
                      value={minScore}
                      onChange={e => setMinScore(e.target.value)}
                      className="input py-1 px-2 text-xs w-full"
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-gray-400">–</span>
                    <input
                      type="number"
                      placeholder="max"
                      value={maxScore}
                      onChange={e => setMaxScore(e.target.value)}
                      className="input py-1 px-2 text-xs w-full"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              </div>
            )}
            </>
            )}

            {/* Mode avancé : builder de règles récursif (mêmes capacités que les campagnes) */}
            {advancedMode && (
              advancedData ? (
                <div className="max-h-[280px] overflow-y-auto pr-1">
                  <p className="text-xs text-gray-500 mb-2">
                    Combinez des critères (étape, source, filière, champs personnalisés, activité, audience) avec des groupes ET/OU.
                  </p>
                  <FilterGroupBuilder
                    group={filterGroup}
                    onChange={setFilterGroup}
                    stages={advancedData.stages}
                    programs={advancedData.programs}
                    audiences={advancedData.audiences}
                    users={advancedData.users}
                    customFields={advancedData.customFields}
                    emptyHint="Aucun critère — ajoutez-en un pour rechercher des leads à ajouter"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  <span className="text-xs">Chargement des filtres avancés...</span>
                </div>
              )
            )}
          </div>

          {/* Barre de sélection */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0 bg-gray-50/50 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectVisible}
                  className="rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}`
                    : "Sélectionner les visibles"}
                </span>
              </label>

              {/* Bouton "Sélectionner les X correspondants" - apparait si filtres + plus de résultats que visible */}
              {hasMoreThanVisible && (
                <button
                  onClick={handleSelectAllMatching}
                  disabled={selectingAll}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline disabled:opacity-50"
                >
                  {selectingAll ? (
                    <>
                      <Loader2 size={11} className="animate-spin inline mr-1" />
                      Sélection...
                    </>
                  ) : (
                    <>Sélectionner les {totalAvailable} correspondants</>
                  )}
                </button>
              )}

              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Tout désélectionner
                </button>
              )}
            </div>

            <span className="text-xs text-gray-500">
              {leads.length === totalAvailable
                ? `${leads.length} disponible${leads.length > 1 ? "s" : ""}`
                : `${leads.length} affichés sur ${totalAvailable}`}
            </span>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto min-h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-xs">Chargement...</span>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <UserPlus size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">
                  {advancedMode && filterGroup.rules.length === 0 ? "Aucun critère défini" : "Aucun lead disponible"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {advancedMode && filterGroup.rules.length === 0
                    ? "Ajoutez au moins un critère pour rechercher des leads."
                    : (advancedMode || hasActiveFilters)
                      ? "Modifiez vos filtres pour élargir la recherche."
                      : "Tous les leads existants sont déjà dans cette audience."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {leads.map(lead => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <label
                      key={lead.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                        isSelected ? "bg-brand-50/50" : "hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-gray-300"
                      />
                      <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {getInitials(lead.firstName + " " + lead.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                          {lead.email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <Mail size={9} /> {lead.email}
                            </span>
                          )}
                          {lead.phone && lead.phone !== "N/A" && (
                            <span className="flex items-center gap-1">
                              <Phone size={9} /> {lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lead.stage && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: (lead.stage.color || "#888") + "20",
                              color: lead.stage.color || "#888",
                              borderColor: (lead.stage.color || "#888") + "40",
                            }}
                          >
                            {lead.stage.name}
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          lead.score >= 60 ? "bg-emerald-100 text-emerald-700" :
                          lead.score >= 30 ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        )}>
                          {lead.score}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 p-4 border-t border-gray-100 shrink-0 bg-gray-50/30">
            <p className="text-xs text-gray-500">
              {selectedIds.size > 0 ? (
                <span className="font-semibold text-brand-600">
                  {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} à ajouter
                </span>
              ) : (
                "Sélectionnez les leads à ajouter"
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={adding}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={selectedIds.size === 0 || adding}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Ajouter {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helper component : select de filtre ───
function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input py-1 px-2 text-xs w-full"
      >
        <option value="">Tous</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}