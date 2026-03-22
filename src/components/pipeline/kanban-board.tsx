"use client";

import { useState, useEffect, useTransition } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { LeadCard } from "./lead-card";
import { moveLeadToStage } from "@/app/(dashboard)/pipeline/actions";
import { cn } from "@/lib/utils";
import { Plus, Filter, SlidersHorizontal } from "lucide-react";
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
  _count: { messages: number; activities: number };
}

interface KanbanBoardProps {
  stages: Stage[];
  leads: Lead[];
  onAddLead?: () => void;
  onOpenLead?: (leadId: string) => void;
}

export function KanbanBoard({
  stages,
  leads: initialLeads,
  onAddLead,
  onOpenLead,
}: KanbanBoardProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const getLeadsForStage = (stageId: string) =>
    leads
      .filter((l) => l.stageId === stageId)
      .sort((a, b) => b.score - a.score);

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

  const totalValue = leads.length;

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button className="btn-secondary py-2 text-xs">
            <Filter size={14} />
            Filtrer
          </button>
          <button className="btn-secondary py-2 text-xs">
            <SlidersHorizontal size={14} />
            Trier
          </button>
          <span className="text-sm text-gray-500 ml-2">
            {totalValue} lead{totalValue > 1 ? "s" : ""} actif
            {totalValue > 1 ? "s" : ""}
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
                        "flex-1 space-y-2.5 min-h-[120px] rounded-lg p-1 transition-colors duration-200",
                        snapshot.isDraggingOver && "bg-brand-50/60 ring-2 ring-brand-200/50 ring-dashed"
                      )}
                    >
                      {stageLeads.map((lead, index) => (
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
