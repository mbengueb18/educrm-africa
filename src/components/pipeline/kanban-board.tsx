"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { LeadCard } from "./lead-card";
import { moveLeadToStage } from "@/app/(dashboard)/pipeline/actions";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
  isDefault: boolean;
  isWon: boolean;
  isLost: boolean;
}

interface Lead {
  id: string;
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
  campusId?: string | null;
  _count: { messages: number; activities: number };
}

interface KanbanBoardProps {
  stages: Stage[];
  leads: Lead[];
  users?: { id: string; name: string }[];
  programs?: { id: string; name: string }[];
  campuses?: { id: string; name: string; city: string }[];
  onAddLead?: () => void;
  onOpenLead?: (leadId: string) => void;
}

export function KanbanBoard({
  stages,
  leads: initialLeads,
  users = [],
  programs = [],
  campuses = [],
  onAddLead,
  onOpenLead,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"score" | "createdAt" | "updatedAt">("score");
  const COLUMN_PAGE_SIZE = 50;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const getVisibleCount = (stageId: string) => visibleCounts[stageId] || COLUMN_PAGE_SIZE;
  const showMore = (stageId: string) => {
    setVisibleCounts(function(prev) {
      var current = prev[stageId] || COLUMN_PAGE_SIZE;
      var next: Record<string, number> = {};
      for (var k in prev) next[k] = prev[k];
      next[stageId] = current + COLUMN_PAGE_SIZE;
      return next;
    });
  };

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    setVisibleCounts({});
  }, [search, sortKey]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (search) {
        var q = search.toLowerCase();
        var match = (lead.firstName + " " + lead.lastName).toLowerCase().includes(q) ||
          lead.phone.includes(q) ||
          (lead.email || "").toLowerCase().includes(q) ||
          (lead.city || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [leads, search]);

  const getLeadsForStage = (stageId: string) => {
    var stageLeads = filteredLeads.filter((l) => l.stageId === stageId);
    return [...stageLeads].sort((a, b) => {
      if (sortKey === "score") return b.score - a.score;
      if (sortKey === "createdAt") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === draggableId ? { ...l, stageId: destination.droppableId } : l
      )
    );

    startTransition(async () => {
      try {
        await moveLeadToStage(draggableId, destination.droppableId);
        const stage = stages.find((s) => s.id === destination.droppableId);
        toast.success(`Lead déplacé vers "${stage?.name}"`);
      } catch (error) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === draggableId
              ? { ...l, stageId: source.droppableId }
              : l
          )
        );
        toast.error("Erreur lors du déplacement");
      }
    });
  };

  return (
    <div className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, tel, email..."
              className="input pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <span className="text-[10px] text-gray-500 px-2 hidden sm:inline">Tri:</span>
            {[
              { key: "score" as const, label: "Score" },
              { key: "createdAt" as const, label: "Date" },
              { key: "updatedAt" as const, label: "MAJ" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  sortKey === s.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {filteredLeads.length} lead{filteredLeads.length > 1 ? "s" : ""}
          </span>
        </div>
        <button className="btn-primary py-2 text-xs" onClick={onAddLead}>
          <Plus size={16} />
          Nouveau lead
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-2.5 overflow-x-auto pb-3 -mx-2 px-2"
             style={{ scrollbarWidth: 'auto' }}>
          {stages.map((stage) => {
            const stageLeads = getLeadsForStage(stage.id);
            const totalInStage = stageLeads.length;
            const visibleCount = getVisibleCount(stage.id);
            const displayedLeads = stageLeads.slice(0, visibleCount);
            const hasMore = totalInStage > visibleCount;

            return (
              <div key={stage.id} className="kanban-column snap-start shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="text-sm font-semibold text-gray-700">
                      {stage.name}
                    </h3>
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[11px] font-bold text-gray-500 shadow-sm">
                      {stageLeads.length}
                    </span>
                  </div>
                  <button
                    className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={onAddLead}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "space-y-2.5 rounded-lg p-1 transition-colors duration-200 overflow-y-auto",
                        snapshot.isDraggingOver && "bg-brand-50/60 ring-2 ring-brand-200/50 ring-dashed"
                      )}
                      style={{ maxHeight: "600px", minHeight: "120px" }}
                    >
                      {displayedLeads.map((lead, index) => (
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "transition-transform",
                                snapshot.isDragging && "rotate-2 scale-105"
                              )}
                            >
                              <LeadCard
                                lead={lead}
                                onOpen={onOpenLead}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {hasMore && (
                        <button
                          onClick={function() { showMore(stage.id); }}
                          className="w-full py-2 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          Voir plus ({totalInStage - visibleCount})
                        </button>
                      )}

                      {stageLeads.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="text-xs text-gray-400">
                            Glissez un lead ici
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}