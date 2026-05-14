"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, GitBranch, Plus, Pencil, Trash2, Check, X, Loader2,
  Star, AlertCircle, ChevronDown, ChevronUp, Sparkles, Layers,
  GraduationCap, Users, GripVertical, ToggleLeft, ToggleRight,
} from "lucide-react";
import {
  createPipeline, updatePipeline, setDefaultPipeline, deletePipeline,
  createStage, updateStage, deleteStage, reorderStages, toggleActivePipeline,
} from "./actions";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";


const FORMATION_TYPE_LABELS = {
  INITIAL: "Formation Initiale (FI)",
  CONTINUE: "Formation Continue (FC)",
};

const FORMATION_TYPE_COLORS = {
  INITIAL: "text-blue-700 bg-blue-50",
  CONTINUE: "text-purple-700 bg-purple-50",
};

const PIPELINE_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899"];

interface Props {
  initialPipelines: any[];
  plan: string;
  limit: number;
}

export default function PipelinesClient({ initialPipelines, plan, limit }: Props) {
  const router = useRouter();
  //const [pipelines, setPipelines] = useState(initialPipelines);
  const [showAddPipeline, setShowAddPipeline] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialPipelines[0]?.id || null);
  const [pending, startTransition] = useTransition();

  const canCreateMore = initialPipelines.length < limit;
  const unlimited = limit === Number.MAX_SAFE_INTEGER;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Pipelines</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {initialPipelines.length} pipeline{initialPipelines.length > 1 ? "s" : ""} configuré{initialPipelines.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Banner plan */}
      <div className={cn(
        "rounded-xl border p-4 mb-6 flex items-start gap-3",
        canCreateMore ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"
      )}>
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          canCreateMore ? "bg-blue-100" : "bg-amber-100"
        )}>
          <Sparkles size={16} className={canCreateMore ? "text-blue-600" : "text-amber-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", canCreateMore ? "text-blue-900" : "text-amber-900")}>
            Plan {plan}
          </p>
          <p className={cn("text-xs mt-0.5", canCreateMore ? "text-blue-700" : "text-amber-700")}>
            {unlimited 
              ? "Pipelines illimités"
              : `${initialPipelines.length} / ${limit} pipeline${limit > 1 ? "s" : ""} utilisé${initialPipelines.length > 1 ? "s" : ""}.`
            }
            {!canCreateMore && !unlimited && (
              <span className="block mt-1">
                Limite atteinte. Passez à un plan supérieur pour créer plus de pipelines.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Bouton Ajouter */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          Cliquez sur un pipeline pour gérer ses étapes
        </p>
        <button
          onClick={() => setShowAddPipeline(true)}
          disabled={!canCreateMore || pending}
          className="btn-primary py-2 text-xs"
        >
          <Plus size={14} /> Ajouter un pipeline
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showAddPipeline && (
        <PipelineForm
          mode="create"
          onClose={(saved) => {
            setShowAddPipeline(false);
            if (saved) router.refresh();
          }}
        />
      )}

      {/* Liste des pipelines */}
      <div className="space-y-3">
        {initialPipelines.map((pipeline) => {
          if (editingPipelineId === pipeline.id) {
            return (
              <PipelineForm
                key={pipeline.id}
                mode="edit"
                pipeline={pipeline}
                onClose={(saved) => {
                  setEditingPipelineId(null);
                  if (saved) router.refresh();
                }}
              />
            );
          }

          const isExpanded = expandedId === pipeline.id;

          return (
            <div key={pipeline.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header de la carte pipeline */}
              <div
                className={cn(
                  "p-4 cursor-pointer hover:bg-gray-50/50 transition-colors",
                  !pipeline.isActive && "opacity-60 bg-gray-50/50"
                )}
                onClick={() => setExpandedId(isExpanded ? null : pipeline.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (pipeline.color || "#3B82F6") + "15", color: pipeline.color || "#3B82F6" }}
                  >
                    <GitBranch size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{pipeline.name}</p>
                      
                      {pipeline.isDefault && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                          <Star size={9} /> Défaut
                        </span>
                      )}

                      {pipeline.formationType && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          FORMATION_TYPE_COLORS[pipeline.formationType as keyof typeof FORMATION_TYPE_COLORS]
                        )}>
                          {pipeline.formationType === "INITIAL" ? "FI" : "FC"}
                        </span>
                      )}

                      {/* Badge inactif */}
                      {!pipeline.isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                          Inactif
                        </span>
                      )}
                    </div>

                    {pipeline.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{pipeline.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Layers size={11} /> {pipeline.stages.length} étape{pipeline.stages.length > 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {pipeline._count.leads} lead{pipeline._count.leads > 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap size={11} /> {pipeline._count.programs} filière{pipeline._count.programs > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">

                    {/* Toggle actif/inactif */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startTransition(async () => {
                          try {
                            await toggleActivePipeline(pipeline.id);
                            toast.success(pipeline.isActive ? "Pipeline désactivé" : "Pipeline activé");
                            router.refresh();
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                      title={pipeline.isActive ? "Désactiver" : "Activer"}
                    >
                      {pipeline.isActive ? (
                        <ToggleRight size={14} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={14} className="text-gray-400" />
                      )}
                    </button>

                    {!pipeline.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startTransition(async () => {
                            try {
                              await setDefaultPipeline(pipeline.id);
                              toast.success("Pipeline défini par défaut");
                              router.refresh();
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          });
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                        title="Définir comme défaut"
                      >
                        <Star size={14} />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPipelineId(pipeline.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                      <Pencil size={14} />
                    </button>

                    {initialPipelines.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`Supprimer le pipeline "${pipeline.name}" ?`)) return;
                          startTransition(async () => {
                            try {
                              await deletePipeline(pipeline.id);
                              toast.success("Pipeline supprimé");
                              router.refresh();
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          });
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Étapes du pipeline (collapsible) */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                  <PipelineStagesEditor
                    pipelineId={pipeline.id}
                    stages={pipeline.stages}
                    onChanged={() => router.refresh()}
                  />
                </div>
              )}
            </div>
          );
        })}

        {initialPipelines.length === 0 && !showAddPipeline && (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
            <GitBranch size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun pipeline</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORMULAIRE PIPELINE
// ═══════════════════════════════════════════════════════════════
function PipelineForm({
  mode,
  pipeline,
  onClose,
}: {
  mode: "create" | "edit";
  pipeline?: any;
  onClose: (saved?: boolean) => void;
}) {
  const [name, setName] = useState(pipeline?.name || "");
  const [description, setDescription] = useState(pipeline?.description || "");
  const [formationType, setFormationType] = useState<"" | "INITIAL" | "CONTINUE">(
    pipeline?.formationType || ""
  );
  const [color, setColor] = useState(pipeline?.color || PIPELINE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await createPipeline({
          name: name.trim(),
          description: description.trim() || undefined,
          formationType: formationType || null,
          color,
        });
        toast.success("Pipeline créé");
      } else if (pipeline) {
        await updatePipeline(pipeline.id, {
          name: name.trim(),
          description: description.trim(),
          formationType: formationType || null,
          color,
        });
        toast.success("Pipeline mis à jour");
      }
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-4 mb-3 animate-scale-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input text-sm"
            placeholder="Formation Initiale, Formation Continue, etc."
            autoFocus
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input text-sm"
            placeholder="Pipeline pour le recrutement FI par concours…"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Type de formation</label>
          <select
            value={formationType}
            onChange={(e) => setFormationType(e.target.value as "" | "INITIAL" | "CONTINUE")}
            className="input text-sm"
          >
            <option value="">Aucun (tous types)</option>
            <option value="INITIAL">Formation Initiale (FI)</option>
            <option value="CONTINUE">Formation Continue (FC)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Couleur</label>
          <div className="flex gap-1.5 flex-wrap">
            {PIPELINE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-7 h-7 rounded-lg border-2 transition-all",
                  color === c ? "border-gray-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => onClose()} className="btn-secondary py-1.5 px-3 text-xs">
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary py-1.5 px-3 text-xs"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {mode === "create" ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ÉDITEUR D'ÉTAPES (avec drag & drop)
// ═══════════════════════════════════════════════════════════════
function PipelineStagesEditor({
  pipelineId,
  stages: initialStages,
  onChanged,
}: {
  pipelineId: string;
  stages: any[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stages, setStages] = useState(initialStages);
  const [pending, startTransition] = useTransition();

  // Synchroniser avec les props quand elles changent (après refresh)
  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newStages = arrayMove(stages, oldIndex, newIndex);
    setStages(newStages);  // Optimistic update

    // Persistance serveur
    startTransition(async () => {
      try {
        await reorderStages(pipelineId, newStages.map((s) => s.id));
        toast.success("Ordre mis à jour");
        onChanged();
      } catch (err: any) {
        toast.error(err.message || "Erreur");
        setStages(initialStages); // Rollback
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-xs font-medium text-gray-700">Étapes du pipeline</p>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-secondary py-1 px-2 text-[11px]"
        >
          <Plus size={11} /> Étape
        </button>
      </div>

      {showAdd && (
        <StageForm
          mode="create"
          pipelineId={pipelineId}
          onClose={(saved) => {
            setShowAdd(false);
            if (saved) onChanged();
          }}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {stages.map((stage) => {
              if (editingStageId === stage.id) {
                return (
                  <StageForm
                    key={stage.id}
                    mode="edit"
                    pipelineId={pipelineId}
                    stage={stage}
                    onClose={(saved) => {
                      setEditingStageId(null);
                      if (saved) onChanged();
                    }}
                  />
                );
              }

              return (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  onEdit={() => setEditingStageId(stage.id)}
                  onDelete={() => {
                    if (!confirm(`Supprimer l'étape "${stage.name}" ?`)) return;
                    startTransition(async () => {
                      try {
                        await deleteStage(stage.id);
                        toast.success("Étape supprimée");
                        onChanged();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    });
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {stages.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400 text-center py-4">Aucune étape</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ITEM ÉTAPE SORTABLE
// ═══════════════════════════════════════════════════════════════
function SortableStageItem({
  stage,
  onEdit,
  onDelete,
}: {
  stage: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style as any}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 group hover:border-gray-300"
    >
      {/* Handle de drag */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500 p-1 -ml-1"
        title="Glisser pour réordonner"
      >
        <GripVertical size={14} />
      </button>

      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
      />
      <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">
        {stage.name}
      </span>
      {stage.isWon && (
        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
          Gagné
        </span>
      )}
      {stage.isLost && (
        <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">
          Perdu
        </span>
      )}
      <span className="text-[10px] text-gray-400">
        {stage._count?.leads || 0} lead{(stage._count?.leads || 0) > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORMULAIRE ÉTAPE
// ═══════════════════════════════════════════════════════════════
function StageForm({
  mode,
  pipelineId,
  stage,
  onClose,
}: {
  mode: "create" | "edit";
  pipelineId: string;
  stage?: any;
  onClose: (saved?: boolean) => void;
}) {
  const [name, setName] = useState(stage?.name || "");
  const [color, setColor] = useState(stage?.color || PIPELINE_COLORS[0]);
  const [isWon, setIsWon] = useState(stage?.isWon || false);
  const [isLost, setIsLost] = useState(stage?.isLost || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await createStage(pipelineId, { name: name.trim(), color, isWon, isLost });
        toast.success("Étape créée");
      } else if (stage) {
        await updateStage(stage.id, { name: name.trim(), color, isWon, isLost });
        toast.success("Étape mise à jour");
      }
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-lg border border-brand-200 p-3 mb-2 animate-scale-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <div className="sm:col-span-2">
          <label className="text-[11px] font-medium text-gray-600 mb-1 block">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input text-xs"
            placeholder="Nouveau, Contacté…"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-600 mb-1 block">Couleur</label>
          <div className="flex gap-1 flex-wrap">
            {PIPELINE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-5 h-5 rounded border-2",
                  color === c ? "border-gray-900" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-600 mb-1 block">Type</label>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isWon}
                onChange={(e) => {
                  setIsWon(e.target.checked);
                  if (e.target.checked) setIsLost(false);
                }}
                className="w-3 h-3 rounded"
              />
              Gagné
            </label>
            <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isLost}
                onChange={(e) => {
                  setIsLost(e.target.checked);
                  if (e.target.checked) setIsWon(false);
                }}
                className="w-3 h-3 rounded"
              />
              Perdu
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-1">
        <button onClick={() => onClose()} className="btn-secondary py-1 px-2 text-[11px]">
          Annuler
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="btn-primary py-1 px-2 text-[11px]"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          {mode === "create" ? "Créer" : "OK"}
        </button>
      </div>
    </div>
  );
}