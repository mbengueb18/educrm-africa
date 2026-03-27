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
  Upload, Download,
} from "lucide-react";
import { toast } from "sonner";
import { ExportCSVModal } from "@/components/pipeline/export-csv-modal";

interface PipelineClientProps {
  stages: any[];
  leads: any[];
  users: any[];
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
  stats,
  programs,
  crmFields,
}: PipelineClientProps) {
  var [modalOpen, setModalOpen] = useState(false);
  var [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  var [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  var [importOpen, setImportOpen] = useState(false);
  var [exportOpen, setExportOpen] = useState(false);

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
          leads={leads}
          onAddLead={function() { setModalOpen(true); }}
          onOpenLead={function(id) { setSelectedLeadId(id); }}
        />
      ) : (
        <LeadListView
          leads={leads}
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
      <ExportCSVModal
        open={exportOpen}
        onClose={function() { setExportOpen(false); }}
        crmFields={crmFields}
      />
    </div>
  );
}