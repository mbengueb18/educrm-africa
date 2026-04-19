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
  Upload, Download, AlertTriangle, Bell, Filter, Copy, Check, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { ExportCSVModal } from "@/components/pipeline/export-csv-modal";
import { detectDuplicates, mergeDuplicateLeads } from "@/app/(dashboard)/pipeline/actions";

interface PipelineClientProps {
  stages: any[];
  leads: any[];
  users: any[];
  currentUserId: string;
  stats: {
    totalLeads: number;
    newLeadsWeek: number;
    convertedMonth: number;
    stageBreakdown: { name: string; count: number; color: string }[];
  };
  programs: { id: string; name: string }[];
  crmFields?: any[];
}

export function PipelineClient({
  stages,
  leads,
  users,
  currentUserId,
  stats,
  programs,
  crmFields,
}: PipelineClientProps) {
  var [modalOpen, setModalOpen] = useState(false);
  var [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  var [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  var [importOpen, setImportOpen] = useState(false);
  var [exportOpen, setExportOpen] = useState(false);
  var [filterRelance, setFilterRelance] = useState<"all" | "urgent" | "warning" | "mine">("all");
  var [duplicatesOpen, setDuplicatesOpen] = useState(false);
  var [duplicates, setDuplicates] = useState<any[]>([]);
  var [loadingDuplicates, setLoadingDuplicates] = useState(false);
  var [merging, setMerging] = useState(false);

  var handleDetectDuplicates = async function() {
    setLoadingDuplicates(true);
    try {
      var result = await detectDuplicates();
      setDuplicates(result);
      setDuplicatesOpen(true);
      if (result.length === 0) {
        toast.success("Aucun doublon détecté !");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setLoadingDuplicates(false);
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

  // Count leads needing follow-up
  var urgentCount = leads.filter(function(l: any) { return l.daysSinceContact >= 7; }).length;
  var warningCount = leads.filter(function(l: any) { return l.daysSinceContact >= 3 && l.daysSinceContact < 7; }).length;

  // Filter leads
  var filteredLeads = leads.filter(function(l: any) {
    if (filterRelance === "urgent") return l.daysSinceContact >= 7;
    if (filterRelance === "warning") return l.daysSinceContact >= 3;
    if (filterRelance === "mine") return l.assignedToId === currentUserId;
    return true;
  });

  var router = useRouter();

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
  setExportOpen(true);
};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Pipeline de recrutement
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos prospects de la prise de contact jusqu&apos;a l&apos;inscription
          </p>
        </div>

        <div className="flex items-center gap-2">

          {/* Follow-up filters */}
          {urgentCount > 0 && (
            <button onClick={function() { setFilterRelance(filterRelance === "urgent" ? "all" : "urgent"); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterRelance === "urgent" ? "bg-red-100 text-red-700 border border-red-200" : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
              )}>
              <AlertTriangle size={13} />
              {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
            </button>
          )}
          {warningCount > 0 && (
            <button onClick={function() { setFilterRelance(filterRelance === "warning" ? "all" : "warning"); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterRelance === "warning" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100"
              )}>
              <Bell size={13} />
              {warningCount} à relancer
            </button>
          )}
          {filterRelance !== "all" && (
            <button onClick={function() { setFilterRelance("all"); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
              ✕ Effacer
            </button>
          )}

          {/* Mes leads */}
          <button onClick={function() { setFilterRelance(filterRelance === "mine" ? "all" : "mine"); }}
            className={cn("btn-secondary py-1.5 text-xs",
              filterRelance === "mine" && "bg-brand-100 text-brand-700 border-brand-200"
            )}>
            <UserPlus size={13} />
            Mes leads
          </button>

          {/* Duplicates */}
          <button onClick={handleDetectDuplicates} disabled={loadingDuplicates}
            className="btn-secondary py-1.5 text-xs">
            {loadingDuplicates ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Doublons
          </button>

          {/* Import / Export */}
          <button
            onClick={function() { setImportOpen(true); }}
            className="btn-secondary py-1.5 text-xs"
          >
            <Upload size={13} /> Importer
          </button>
          <button onClick={handleExport} className="btn-secondary py-1.5 text-xs">
            <Download size={13} /> Exporter
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
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
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Leads actifs"
          value={stats.totalLeads}
          icon={Users}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="Nouveaux (7j)"
          value={stats.newLeadsWeek}
          change={12}
          changeLabel="vs semaine dern."
          icon={UserPlus}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Convertis (30j)"
          value={stats.convertedMonth}
          change={8}
          changeLabel="vs mois dern."
          icon={UserCheck}
          iconColor="text-accent-600"
          iconBg="bg-accent-50"
        />
        <StatCard
          label="Taux de conversion"
          value={conversionRate + "%"}
          change={conversionRate > 15 ? 5 : -2}
          changeLabel="vs mois dern."
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Pipeline view */}
      {viewMode === "kanban" ? (
        <KanbanBoard
          stages={stages}
          leads={filteredLeads}
          onAddLead={function() { setModalOpen(true); }}
          onOpenLead={function(id) { setSelectedLeadId(id); }}
        />
      ) : (
        <LeadListView
          leads={filteredLeads}
          stages={stages.map(function(s: any) { return { id: s.id, name: s.name, color: s.color }; })}
          users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
          onOpenLead={function(id) { setSelectedLeadId(id); }}
        />
      )}

      {/* Modals */}
      <NewLeadModal
        open={modalOpen}
        onClose={handleModalClose}
        programs={programs}
        users={users}
      />

      <LeadSlideOver
        leadId={selectedLeadId}
        onClose={function() { setSelectedLeadId(null); }}
        stages={stages.map(function(s: any) { return { id: s.id, name: s.name, color: s.color }; })}
        users={users.map(function(u: any) { return { id: u.id, name: u.name }; })}
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