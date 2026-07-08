"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { LeadListView } from "@/components/pipeline/lead-list-view";
import { NewLeadModal } from "@/components/pipeline/new-lead-modal";
import { LeadSlideOver } from "@/components/pipeline/lead-slide-over";
import { ImportCSVModal } from "@/components/pipeline/import-csv-modal";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  Users, UserPlus, UserCheck, TrendingUp, Kanban, List,
  Upload, Download, Copy, Check, Loader2, X, AlertTriangle,
  MoreHorizontal,  GitBranch, ChevronDown, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { ExportCSVModal } from "@/components/pipeline/export-csv-modal";
import { detectDuplicates, mergeDuplicateLeads, recalculateOrgLeadScores } from "@/app/(dashboard)/pipeline/actions";
import { FilterGroupBuilder, type FilterGroup } from "@/components/campaigns/filter-group-builder";
import { evaluateLeadAgainstGroup } from "@/lib/lead-filters";

interface PipelineClientProps {
  stages: any[];
  leads: any[];
  users: any[];
  currentUserId: string;
  currentUserRole: string;
  stats: {
    totalLeads: number;
    newLeadsWeek: number;
    convertedMonth: number;
    stageBreakdown: { name: string; count: number; color: string }[];
  };
  programs: { id: string; name: string }[];
  campuses: { id: string; name: string; city: string }[];
  crmFields?: any[];
  customFields?: any[];
  pipelines: any[];                   
  currentPipelineId?: string;         
}

export function PipelineClient({
  stages,
  leads,
  users,
  currentUserId,
  currentUserRole,
  stats,
  programs,
  campuses,
  crmFields,
  customFields,
  pipelines,
  currentPipelineId,
}: PipelineClientProps) {
  var [modalOpen, setModalOpen] = useState(false);
  var [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  var [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  var [importOpen, setImportOpen] = useState(false);
  var [exportOpen, setExportOpen] = useState(false);
  var [filterMine, setFilterMine] = useState(false);
  var [filterToQualify, setFilterToQualify] = useState(false);
  var [showFilters, setShowFilters] = useState(false);
  var [duplicatesOpen, setDuplicatesOpen] = useState(false);
  var [duplicates, setDuplicates] = useState<any[]>([]);
  var [loadingDuplicates, setLoadingDuplicates] = useState(false);
  var [merging, setMerging] = useState(false);
  var [showMoreMenu, setShowMoreMenu] = useState(false);
  var [recalculating, setRecalculating] = useState(false);
  var [advancedFilter, setAdvancedFilter] = useState<FilterGroup>({ operator: "AND", rules: [] });
  var [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  var handleDetectDuplicates = async function() {
  setShowMoreMenu(false);
  setLoadingDuplicates(true);
  var toastId = toast.loading("Détection des doublons en cours...");
  try {
    var result = await detectDuplicates();
    toast.dismiss(toastId);
    setDuplicates(result);
    setDuplicatesOpen(true);
    if (result.length === 0) {
      toast.success("Aucun doublon détecté !");
    } else {
      toast.success(result.length + " groupe(s) de doublons trouvé(s)");
    }
  } catch (err: any) {
    toast.dismiss(toastId);
    toast.error(err.message || "Erreur");
  }
  setLoadingDuplicates(false);
};

  var isOrgAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN";

  var handleRecalcScores = async function() {
    setShowMoreMenu(false);
    setRecalculating(true);
    var toastId = toast.loading("Recalcul des scores en cours…");
    try {
      var r = await recalculateOrgLeadScores();
      toast.dismiss(toastId);
      toast.success((r.updated || 0) + " lead(s) recalculé(s)");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Erreur");
    }
    setRecalculating(false);
  };

  var handleMerge = async function(keepId: string, removeIds: string[]) {
    setMerging(true);
    try {
      await mergeDuplicateLeads(keepId, removeIds);
      toast.success("Doublons fusionnés !");
      setDuplicates(function(prev) { return prev.filter(function(g) { return g.key !== keepId; }); });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la fusion");
    }
    setMerging(false);
  };

   // Filter leads
  var filteredLeads = leads.filter(function(l: any) {
    if (filterMine && l.assignedToId !== currentUserId) return false;
    if (filterToQualify && l.programId) return false;
    if (advancedFilter.rules.length > 0 && !evaluateLeadAgainstGroup(l, advancedFilter)) return false;
    return true;
  });

  // Compteur leads à qualifier (sans filière)
  var leadsToQualifyCount = leads.filter(function(l: any) { 
    return !l.programId; 
  }).length;

  var router = useRouter();

  // Persistance du pipeline sélectionné
  useEffect(function() {
    if (!currentPipelineId) return;
    try {
      localStorage.setItem("talibcrm:lastPipelineId", currentPipelineId);
    } catch {}
  }, [currentPipelineId]);

  // Au montage, si l'URL n'a pas de pipeline et qu'on a un pipeline mémorisé
  // qui est différent du courant, on redirige
  useEffect(function() {
    if (typeof window === "undefined") return;
    try {
      var saved = localStorage.getItem("talibcrm:lastPipelineId");
      if (saved && saved !== currentPipelineId && !window.location.search.includes("pipeline=")) {
        // Vérifier que le pipeline saved existe encore
        var stillExists = pipelines.find(function(p: any) { return p.id === saved; });
        if (stillExists) {
          router.replace("/pipeline?pipeline=" + saved);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var handlePipelineChange = function(newPipelineId: string) {
    router.push("/pipeline?pipeline=" + newPipelineId);
  };

  var handleModalClose = useCallback(function(created?: boolean) {
    setModalOpen(false);
    if (created) {
      router.refresh();
    }
  }, [router]);

  var handleImportClose = useCallback(function(imported?: boolean) {
    setImportOpen(false);
    if (imported) {
      router.refresh();
    }
  }, [router]);

  useEffect(function() {
    var handler = function() { setModalOpen(true); };
    window.addEventListener("open-new-lead", handler);
    return function() { window.removeEventListener("open-new-lead", handler); };
  }, []);

  var conversionRate =
    stats.totalLeads > 0
      ? Math.round((stats.convertedMonth / (stats.totalLeads + stats.convertedMonth)) * 100)
      : 0;

  var handleExport = function() {
    setShowMoreMenu(false);
    setExportOpen(true);
  };

  var handleOpenImport = function() {
    setShowMoreMenu(false);
    setImportOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
  <div className="flex items-center gap-2 flex-wrap">
    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
      Pipeline de recrutement
    </h1>
    
      {/* Dropdown pipelines - visible uniquement si plusieurs */}
      {pipelines.length > 1 && (
        <div className="relative inline-block">
          <select
            value={currentPipelineId || ""}
            onChange={function(e) { handlePipelineChange(e.target.value); }}
            className="appearance-none pl-3 pr-8 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:border-gray-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          >
            {pipelines.map(function(p: any) {
              var typeLabel = p.formationType === "INITIAL" ? " (FI)" : p.formationType === "CONTINUE" ? " (FC)" : "";
              var defaultLabel = p.isDefault ? " ★" : "";
              return (
                <option key={p.id} value={p.id}>
                  {p.name}{typeLabel}{defaultLabel}
                </option>
              );
            })}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      )}
      
      {/* Indicateur pipeline si UN SEUL (pour rappel visuel) */}
      {pipelines.length === 1 && pipelines[0]?.name && (
        <span className="text-[11px] text-gray-400 font-medium">
          <GitBranch size={11} className="inline mr-1" />
          {pipelines[0].name}
        </span>
      )}
    </div>
    <p className="text-sm text-gray-500 mt-1">
      Gérez vos prospects de la prise de contact jusqu&apos;a l&apos;inscription
    </p>
  </div>

        <div className="flex items-center gap-2 flex-wrap">

          {/* Mes leads — always visible */}
          <button onClick={function() { setFilterMine(!filterMine); }}
            className={cn("btn-secondary py-1.5 text-xs",
              filterMine && "bg-brand-100 text-brand-700 border-brand-200"
            )}>
            <UserPlus size={13} />
            Mes leads
          </button>

          {/* À qualifier — toujours visible */}
          <button onClick={function() { setFilterToQualify(!filterToQualify); }}
            className={cn("btn-secondary py-1.5 text-xs",
              filterToQualify && "bg-amber-100 text-amber-700 border-amber-200"
            )}>
            <AlertTriangle size={13} />
            À qualifier
            {leadsToQualifyCount > 0 && (
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                filterToQualify 
                  ? "bg-amber-200 text-amber-800" 
                  : "bg-amber-100 text-amber-700"
              )}>
                {leadsToQualifyCount}
              </span>
            )}
          </button>
          {/* Filtre avancé */}
          <button onClick={function() { setShowAdvancedFilter(!showAdvancedFilter); }}
            className={cn("btn-secondary py-1.5 text-xs",
              advancedFilter.rules.length > 0 && "bg-brand-100 text-brand-700 border-brand-200"
            )}>
            <SlidersHorizontal size={13} />
            Filtres avancés
            {advancedFilter.rules.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-200 text-brand-800">
                {advancedFilter.rules.length}
              </span>
            )}
          </button>

          {/* Doublons — desktop only */}
          <button onClick={handleDetectDuplicates} disabled={loadingDuplicates}
            className="btn-secondary py-1.5 text-xs hidden sm:inline-flex">
            {loadingDuplicates ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Doublons
          </button>

          {/* Recalcul des scores — admin, desktop only */}
          {isOrgAdmin && (
            <button onClick={handleRecalcScores} disabled={recalculating}
              className="btn-secondary py-1.5 text-xs hidden sm:inline-flex"
              title="Recalculer le score de tous les leads de l'organisation">
              {recalculating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Scores
            </button>
          )}

          {/* Import / Export — desktop only */}
          <button
            onClick={function() { setImportOpen(true); }}
            className="btn-secondary py-1.5 text-xs hidden sm:inline-flex"
          >
            <Upload size={13} /> Importer
          </button>
          <button onClick={handleExport} className="btn-secondary py-1.5 text-xs hidden sm:inline-flex">
            <Download size={13} /> Exporter
          </button>

          {/* "Plus" dropdown — mobile only */}
          <div className="relative sm:hidden">
            <button
              onClick={function() { setShowMoreMenu(!showMoreMenu); }}
              className="btn-secondary py-1.5 px-2.5 text-xs"
              aria-label="Plus d'actions"
            >
              <MoreHorizontal size={14} />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={function() { setShowMoreMenu(false); }} />
                <div className="absolute top-full right-0 mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44 animate-scale-in">
                  <button
                    onClick={handleDetectDuplicates}
                    disabled={loadingDuplicates}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingDuplicates ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    Détecter les doublons
                  </button>
                  {isOrgAdmin && (
                    <button
                      onClick={handleRecalcScores}
                      disabled={recalculating}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {recalculating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      Recalculer les scores
                    </button>
                  )}
                  <div className="h-px bg-gray-100 my-1" />
                  <button
                    onClick={handleOpenImport}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Upload size={13} />
                    Importer (CSV)
                  </button>
                  <button
                    onClick={handleExport}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download size={13} />
                    Exporter (CSV)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={function() { setViewMode("list"); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <List size={14} />
              Liste
            </button>
            <button
              onClick={function() { setViewMode("kanban"); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Kanban size={14} />
              Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Personal stats */}
      {filterMine && (
        <div className="bg-gradient-to-r from-brand-50 to-emerald-50 rounded-xl border border-brand-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">📊 Mes performances</h3>
            <span className="text-[10px] text-gray-400">Période en cours</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {(function() {
              var myLeads = leads.filter(function(l: any) { return l.assignedToId === currentUserId; });
              var totalMine = myLeads.length;
              var urgentMine = myLeads.filter(function(l: any) { return l.daysSinceContact >= 7; }).length;
              var warningMine = myLeads.filter(function(l: any) { return l.daysSinceContact >= 3 && l.daysSinceContact < 7; }).length;
              var recentMine = myLeads.filter(function(l: any) { return l.daysSinceContact < 3; }).length;
              var avgScore = totalMine > 0 ? Math.round(myLeads.reduce(function(sum: number, l: any) { return sum + l.score; }, 0) / totalMine) : 0;
              var highScoreMine = myLeads.filter(function(l: any) { return l.score >= 60; }).length;

              return [
                { label: "Mes leads", value: String(totalMine), color: "text-brand-700" },
                { label: "À jour (< 3j)", value: String(recentMine), color: "text-emerald-600" },
                { label: "À relancer (3-7j)", value: String(warningMine), color: "text-amber-600" },
                { label: "Urgents (> 7j)", value: String(urgentMine), color: "text-red-600" },
                { label: "Score moyen", value: String(avgScore), color: "text-purple-600" },
                { label: "Score élevé (60+)", value: String(highScoreMine), color: "text-blue-600" },
              ].map(function(stat) {
                return (
                  <div key={stat.label} className="bg-white rounded-lg p-2.5 text-center border border-gray-100">
                    <div className={cn("text-lg font-bold", stat.color)}>{stat.value}</div>
                    <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{stat.label}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Bandeau d'aide quand filtre "À qualifier" actif */}
      {filterToQualify && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {leadsToQualifyCount === 0 
                  ? "Aucun lead à qualifier" 
                  : leadsToQualifyCount + " lead" + (leadsToQualifyCount > 1 ? "s" : "") + " à qualifier"}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Ces leads proviennent de WhatsApp ou de formulaires sans filière sélectionnée.
                Assignez-leur une filière pour les router automatiquement vers le bon pipeline.
              </p>
            </div>
            <button 
              onClick={function() { setFilterToQualify(false); }}
              className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 shrink-0"
              title="Fermer le filtre"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {/* Bandeau d'aide quand filtre avancé actif */}
      {showAdvancedFilter && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filtres avancés</h3>
            <div className="flex items-center gap-2">
              {advancedFilter.rules.length > 0 && (
                <button onClick={function() { setAdvancedFilter({ operator: "AND", rules: [] }); }}
                  className="text-xs text-gray-400 hover:text-red-500">
                  Réinitialiser
                </button>
              )}
              <button onClick={function() { setShowAdvancedFilter(false); }} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={14} />
              </button>
            </div>
          </div>
          <FilterGroupBuilder
            group={advancedFilter}
            onChange={setAdvancedFilter}
            stages={stages.map(function(s: any) { return { id: s.id, name: s.name, color: s.color }; })}
            programs={programs.map(function(p: any) { return { id: p.id, name: p.name, code: null }; })}
            audiences={[]}
            users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
            customFields={customFields || []}
            hiddenCategories={["Activité", "Audience"]}
          />
          <p className="text-[11px] text-gray-400 mt-3">
            {filteredLeads.length} lead{filteredLeads.length > 1 ? "s" : ""} correspondent aux filtres
          </p>
        </div>
      )}

      {/* Pipeline view */}
      {viewMode === "kanban" ? (
        <KanbanBoard
          stages={stages}
          leads={filteredLeads}
          users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
          programs={programs}
          campuses={campuses}
          onAddLead={function() { setModalOpen(true); }}
          onOpenLead={function(id) { setSelectedLeadId(id); }}
        />
      ) : (
        <LeadListView
          leads={filteredLeads}
          stages={stages.map(function(s: any) { return { id: s.id, name: s.name, color: s.color }; })}
          users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
          programs={programs}
          campuses={campuses}
          onOpenLead={function(id) { setSelectedLeadId(id); }}
          onAddLead={function() { setModalOpen(true); }}
          currentUserRole={currentUserRole}
        />
      )}

      {/* Modals */}
      <NewLeadModal
        open={modalOpen}
        onClose={handleModalClose}
        programs={programs}
        users={users}
        canAssign={currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN"}
      />

      <LeadSlideOver
        leadId={selectedLeadId}
        onClose={function() { setSelectedLeadId(null); }}
        stages={stages.map(function(s: any) { return { id: s.id, name: s.name, color: s.color }; })}
        users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
        programs={programs}
        campuses={campuses}
        currentUserRole={currentUserRole}
      />

      <ImportCSVModal
        open={importOpen}
        onClose={handleImportClose}
        programs={programs}
        crmFields={crmFields}
      />

      {/* Duplicates modal */}
      {duplicatesOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={function() { setDuplicatesOpen(false); }} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Détection de doublons</h2>
                <p className="text-xs text-gray-500 mt-0.5">{duplicates.length} groupe{duplicates.length > 1 ? "s" : ""} de doublons trouvé{duplicates.length > 1 ? "s" : ""}</p>
              </div>
              <button onClick={function() { setDuplicatesOpen(false); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {duplicates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Check size={40} className="text-emerald-400 mb-3" />
                  <p className="text-sm text-gray-600 font-medium">Aucun doublon détecté</p>
                  <p className="text-xs text-gray-400 mt-1">Tous vos leads sont uniques</p>
                </div>
              )}

              {duplicates.map(function(group) {
                return (
                  <div key={group.key} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span className="text-xs font-semibold text-amber-700">{group.reason}</span>
                      <span className="text-[10px] text-amber-500 ml-auto">{group.leads.length} leads</span>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {group.leads.map(function(lead: any, idx: number) {
                        var totalInteractions = (lead._count?.calls || 0) + (lead._count?.messages || 0) + (lead._count?.appointments || 0);
                        var otherIds = group.leads.filter(function(l: any) { return l.id !== lead.id; }).map(function(l: any) { return l.id; });
                        return (
                          <div key={lead.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                <span>{lead.phone}</span>
                                {lead.email && <span>{lead.email}</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400">Score: {lead.score}</span>
                                <span className="text-[10px] text-gray-400">•</span>
                                <span className="text-[10px] text-gray-400">{totalInteractions} interaction{totalInteractions > 1 ? "s" : ""}</span>
                                <span className="text-[10px] text-gray-400">•</span>
                                <span className="text-[10px] text-gray-400">{new Date(lead.createdAt).toLocaleDateString("fr-FR")}</span>
                                {lead.assignedTo && <span className="text-[10px] text-brand-600">• {lead.assignedTo.name}</span>}
                                {lead.program && <span className="text-[10px] text-emerald-600">• {lead.program.name}</span>}
                              </div>
                            </div>
                            <button onClick={function() { handleMerge(lead.id, otherIds); }} disabled={merging}
                              className="btn-primary py-1.5 px-3 text-[10px] whitespace-nowrap">
                              {merging ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Garder
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      
      <ExportCSVModal
        open={exportOpen}
        onClose={function() { setExportOpen(false); }}
        crmFields={crmFields}
      />
    </div>
  );
}