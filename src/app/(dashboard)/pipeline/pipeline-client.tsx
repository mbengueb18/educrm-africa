"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { LeadListView } from "@/components/pipeline/lead-list-view";
import { NewLeadModal } from "@/components/pipeline/new-lead-modal";
import { LeadSlideOver } from "@/components/pipeline/lead-slide-over";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { Users, UserPlus, UserCheck, TrendingUp, Kanban, List } from "lucide-react";

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
}

export function PipelineClient({
  stages,
  leads,
  users,
  stats,
  programs,
}: PipelineClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const router = useRouter();

  const handleModalClose = useCallback((created?: boolean) => {
    setModalOpen(false);
    if (created) {
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const handler = () => setModalOpen(true);
    window.addEventListener("open-new-lead", handler);
    return () => window.removeEventListener("open-new-lead", handler);
  }, []);

  const conversionRate =
    stats.totalLeads > 0
      ? Math.round((stats.convertedMonth / (stats.totalLeads + stats.convertedMonth)) * 100)
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Pipeline de recrutement
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos prospects de la prise de contact jusqu&apos;à l&apos;inscription
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("kanban")}
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
            onClick={() => setViewMode("list")}
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
          value={`${conversionRate}%`}
          change={conversionRate > 15 ? 5 : -2}
          changeLabel="vs mois dern."
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
      </div>

      {viewMode === "kanban" ? (
        <KanbanBoard
          stages={stages}
          leads={leads}
          onAddLead={() => setModalOpen(true)}
          onOpenLead={(id) => setSelectedLeadId(id)}
        />
      ) : (
        <LeadListView
          leads={leads}
          stages={stages.map((s: any) => ({ id: s.id, name: s.name, color: s.color }))}
          users={users.map((u: any) => ({ id: u.id, name: u.name }))}
          onOpenLead={(id) => setSelectedLeadId(id)}
        />
      )}

      <NewLeadModal
        open={modalOpen}
        onClose={handleModalClose}
        programs={programs}
        users={users}
      />

      <LeadSlideOver
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        stages={stages.map((s: any) => ({ id: s.id, name: s.name, color: s.color }))}
        users={users.map((u: any) => ({ id: u.id, name: u.name }))}
      />
    </div>
  );
}