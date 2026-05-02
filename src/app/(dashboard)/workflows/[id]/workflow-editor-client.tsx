"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ArrowLeft, Save, Play, Plus, Zap, GitBranch, Mail, Phone, ListTodo, Tag, Clock, StopCircle, X, Check, Settings2, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateWorkflow, toggleWorkflow } from "../actions";
import { EmailEditor } from "@/components/messaging/email-editor";
import { LeadFiltersBuilder, type FilterGroup } from "./lead-filters-builder";

// ─── Custom node components ───
function TriggerNode({ data, selected }: any) {
  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 bg-white shadow-sm min-w-[200px]",
      selected ? "border-emerald-500 shadow-lg" : "border-emerald-300"
    )}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
          <Zap size={14} />
        </div>
        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Déclencheur</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{data.label || "Quand..."}</p>
      {data.description && <p className="text-xs text-gray-500 mt-0.5">{data.description}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

function ActionNode({ data, selected }: any) {
  const ICONS: any = {
    SEND_EMAIL: Mail,
    CREATE_TASK: ListTodo,
    CHANGE_STAGE: Tag,
    INCREASE_SCORE: Sparkles,
    ADD_NOTE: Mail,
  };
  const COLORS: any = {
    SEND_EMAIL: "blue",
    CREATE_TASK: "amber",
    CHANGE_STAGE: "violet",
    INCREASE_SCORE: "pink",
    ADD_NOTE: "gray",
  };
  const Icon = ICONS[data.action] || Mail;
  const color = COLORS[data.action] || "blue";

  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 bg-white shadow-sm min-w-[200px]",
      selected ? "shadow-lg" : "",
      `border-${color}-300`,
      selected && `border-${color}-500`
    )}>
      <Handle type="target" position={Position.Top} className={`!bg-${color}-500 !w-3 !h-3`} />
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("w-7 h-7 rounded-lg text-white flex items-center justify-center", `bg-${color}-500`)}>
          <Icon size={14} />
        </div>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", `text-${color}-700`)}>Action</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{data.label || "Action"}</p>
      {data.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{data.description}</p>}
      <Handle type="source" position={Position.Bottom} className={`!bg-${color}-500 !w-3 !h-3`} />
    </div>
  );
}

function ConditionNode({ data, selected }: any) {
  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 bg-white shadow-sm min-w-[220px]",
      selected ? "border-orange-500 shadow-lg" : "border-orange-300"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center">
          <GitBranch size={14} />
        </div>
        <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Si</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{data.label || "Condition"}</p>
      {data.description && <p className="text-xs text-gray-500 mt-0.5">{data.description}</p>}

      <div className="flex justify-between mt-3 px-2">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-emerald-600 mb-0.5">OUI</span>
          <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-500 !w-3 !h-3 !relative !translate-x-0 !translate-y-0" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium text-red-600 mb-0.5">NON</span>
          <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3 !relative !translate-x-0 !translate-y-0" />
        </div>
      </div>
    </div>
  );
}

function WaitNode({ data, selected }: any) {
  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 bg-white shadow-sm min-w-[180px]",
      selected ? "border-amber-500 shadow-lg" : "border-amber-300"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
          <Clock size={14} />
        </div>
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Attendre</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{(data.days || 1) + " jour" + ((data.days || 1) > 1 ? "s" : "")}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}

function StopNode({ data, selected }: any) {
  return (
    <div className={cn(
      "px-4 py-3 rounded-xl border-2 bg-white shadow-sm min-w-[140px]",
      selected ? "border-gray-700 shadow-lg" : "border-gray-400"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gray-600 text-white flex items-center justify-center">
          <StopCircle size={14} />
        </div>
        <span className="text-sm font-semibold text-gray-900">Fin</span>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  stop: StopNode,
};

// ─── Main editor ───
interface WorkflowEditorClientProps {
  workflow: any;
  stages: { id: string; name: string; color: string }[];
  templates: { id: string; name: string; subject: string; body: string }[];
  programs: { id: string; name: string }[];
  campuses: { id: string; name: string }[];
}

export function WorkflowEditorClient({ workflow, stages, templates, programs, campuses }: WorkflowEditorClientProps) {
  const router = useRouter();
  const initialGraph = workflow.graph || { nodes: [], edges: [] };

  // Build initial nodes (add trigger node if empty)
  const initialNodes: Node[] = initialGraph.nodes?.length
    ? initialGraph.nodes
    : [{
        id: "trigger-" + Date.now(),
        type: "trigger",
        position: { x: 250, y: 50 },
        data: { label: getTriggerLabel(workflow.triggerType), triggerType: workflow.triggerType },
      }];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges || []);
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || "");
  const [enabled, setEnabled] = useState(workflow.enabled);
  const [triggerType, setTriggerType] = useState(workflow.triggerType);
  const [triggerConfig, setTriggerConfig] = useState<any>(workflow.triggerConfig || {});
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
    } as any, eds)),
    [setEdges]
  );

  const addNode = (type: string, action?: string) => {
    const id = type + "-" + Date.now();
    const lastNode = nodes[nodes.length - 1];
    const newPos = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 150 }
      : { x: 250, y: 50 };

    let data: any = { label: getDefaultLabel(type, action) };
    if (type === "action") {
      data.action = action;
      data.label = getDefaultLabel(type, action);
    }
    if (type === "wait") data.days = 1;
    if (type === "condition") {
      data.field = "score";
      data.operator = "greater_than";
      data.value = "50";
    }

    setNodes((nds) => nds.concat({
      id,
      type,
      position: newPos,
      data,
    }));
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    if (selectedNode.type === "trigger") {
      toast.error("Impossible de supprimer le déclencheur");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const updateSelectedNodeData = (newData: any) => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNode.id) return n;
      const updated = { ...n, data: { ...n.data, ...newData } };
      // Update label/description for display
      if (n.type === "action") {
        updated.data.label = getActionLabel(updated.data, templates, stages);
        updated.data.description = getActionDescription(updated.data, templates, stages);
      } else if (n.type === "condition") {
        updated.data.label = getConditionLabel(updated.data);
      } else if (n.type === "trigger") {
        updated.data.label = getTriggerLabel(updated.data.triggerType || triggerType);
      }
      setSelectedNode(updated);
      return updated;
    }));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }

    setSaving(true);
    try {
      await updateWorkflow(workflow.id, {
        name,
        description,
        triggerType,
        triggerConfig,
        graph: { nodes, edges },
      });
      toast.success("Workflow enregistré");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
  };

  const handleToggleEnabled = async () => {
    if (!enabled && nodes.length < 2) {
      toast.error("Ajoutez au moins une action avant d'activer");
      return;
    }
    try {
      await toggleWorkflow(workflow.id, !enabled);
      setEnabled(!enabled);
      toast.success(!enabled ? "Workflow activé" : "Workflow désactivé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  // Update trigger node label when trigger type changes
  useEffect(() => {
    setNodes((nds) => nds.map((n) => {
      if (n.type !== "trigger") return n;
      return { ...n, data: { ...n.data, label: getTriggerLabel(triggerType), triggerType } };
    }));
  }, [triggerType, setNodes]);

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col z-30">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href="/workflows" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-base font-semibold text-gray-900 bg-transparent border-0 focus:ring-0 px-0 w-full"
            placeholder="Nom du workflow"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-xs text-gray-500 bg-transparent border-0 focus:ring-0 px-0 w-full"
            placeholder="Description (optionnel)"
          />
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="btn-secondary py-2 px-3 text-xs">
          <Settings2 size={14} /> Déclencheur
        </button>
        <button
          onClick={handleToggleEnabled}
          className={cn(
            "py-2 px-3 text-xs font-medium rounded-lg flex items-center gap-1.5",
            enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
          )}
        >
          <div className={cn("w-1.5 h-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-gray-400")} />
          {enabled ? "Actif" : "Inactif"}
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-3 text-xs">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left palette */}
        <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto p-3 shrink-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Glisser pour ajouter</p>

          <PaletteSection title="Actions">
            <PaletteItem icon={Mail} label="Envoyer email" color="blue" onClick={() => addNode("action", "SEND_EMAIL")} />
            <PaletteItem icon={ListTodo} label="Créer tâche" color="amber" onClick={() => addNode("action", "CREATE_TASK")} />
            <PaletteItem icon={Tag} label="Changer étape" color="violet" onClick={() => addNode("action", "CHANGE_STAGE")} />
            <PaletteItem icon={Sparkles} label="Augmenter score" color="pink" onClick={() => addNode("action", "INCREASE_SCORE")} />
            <PaletteItem icon={Mail} label="Ajouter note" color="gray" onClick={() => addNode("action", "ADD_NOTE")} />
          </PaletteSection>

          <PaletteSection title="Logique">
            <PaletteItem icon={GitBranch} label="Si / Sinon" color="orange" onClick={() => addNode("condition")} />
            <PaletteItem icon={Clock} label="Attendre" color="amber" onClick={() => addNode("wait")} />
            <PaletteItem icon={StopCircle} label="Fin" color="gray" onClick={() => addNode("stop")} />
          </PaletteSection>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedNode(n)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={NODE_TYPES}
            fitView
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#94a3b8", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
            }}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap pannable zoomable nodeColor={(n: any) => {
              if (n.type === "trigger") return "#10b981";
              if (n.type === "action") return "#3b82f6";
              if (n.type === "condition") return "#f97316";
              if (n.type === "wait") return "#f59e0b";
              return "#6b7280";
            }} />
          </ReactFlow>

          {nodes.length === 1 && (
            <Panel position="top-center">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-2 mt-4">
                <p className="text-xs text-gray-600">👆 Ajoutez des actions depuis la palette à gauche</p>
              </div>
            </Panel>
          )}
        </div>

        {/* Right config panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            stages={stages}
            templates={templates}
            onUpdate={updateSelectedNodeData}
            onDelete={deleteSelected}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Trigger settings panel */}
        {showSettings && (
          <TriggerSettingsPanel
            triggerType={triggerType}
            triggerConfig={triggerConfig}
            stages={stages}
            programs={programs}
            campuses={campuses}
            onChange={(type: string, config: any) => { setTriggerType(type); setTriggerConfig(config); }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Palette ───
function PaletteSection({ title, children }: any) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold text-gray-500 mb-1 px-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function PaletteItem({ icon: Icon, label, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors group"
    >
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0", `bg-${color}-500`)}>
        <Icon size={13} />
      </div>
      <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
      <Plus size={12} className="text-gray-300 group-hover:text-gray-500 ml-auto" />
    </button>
  );
}

// ─── Node config panel (right) ───
function NodeConfigPanel({ node, stages, templates, onUpdate, onDelete, onClose }: any) {
  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Configuration</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {node.type === "trigger" && (
          <p className="text-xs text-gray-500">Configuration du déclencheur dans le panneau "Déclencheur" en haut.</p>
        )}

        {node.type === "action" && node.data.action === "SEND_EMAIL" && (
          <SendEmailConfig data={node.data} templates={templates} onUpdate={onUpdate} />
        )}
        {node.type === "action" && node.data.action === "CREATE_TASK" && (
          <CreateTaskConfig data={node.data} onUpdate={onUpdate} />
        )}
        {node.type === "action" && node.data.action === "CHANGE_STAGE" && (
          <ChangeStageConfig data={node.data} stages={stages} onUpdate={onUpdate} />
        )}
        {node.type === "action" && node.data.action === "INCREASE_SCORE" && (
          <IncreaseScoreConfig data={node.data} onUpdate={onUpdate} />
        )}
        {node.type === "action" && node.data.action === "ADD_NOTE" && (
          <AddNoteConfig data={node.data} onUpdate={onUpdate} />
        )}
        {node.type === "condition" && (
          <ConditionConfig data={node.data} onUpdate={onUpdate} />
        )}
        {node.type === "wait" && (
          <WaitConfig data={node.data} onUpdate={onUpdate} />
        )}
        {node.type === "stop" && (
          <p className="text-xs text-gray-500">Le workflow s'arrêtera ici pour ce lead.</p>
        )}

        {node.type !== "trigger" && (
          <button onClick={onDelete} className="w-full mt-4 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200">
            Supprimer ce noeud
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Action configs ───
function SendEmailConfig({ data, templates, onUpdate }: any) {
  const [showEditor, setShowEditor] = useState(false);
  const selectedTemplate = templates.find((t: any) => t.id === data.templateId);
  const hasVisualBlocks = data.blocks && data.blocks.length > 0;

  return (
    <>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Template</label>
        <select
          value={data.templateId || ""}
          onChange={(e) => {
            const template = templates.find((t: any) => t.id === e.target.value);
            if (template) {
              onUpdate({
                templateId: template.id,
                subject: template.subject || "",
                body: template.body || "",
                blocks: template.blocks || null,
                brandColor: template.brandColor || "#1B4F72",
                isHtml: !!(template.blocks && template.blocks.length > 0),
              });
            } else {
              onUpdate({
                templateId: null,
                subject: data.subject || "",
                body: data.body || "",
                blocks: null,
                isHtml: false,
              });
            }
          }}
          className="input text-xs py-1.5"
        >
          <option value="">— Personnalisé (texte) —</option>
          {templates.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.blocks && t.blocks.length > 0 ? "(visuel)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Objet</label>
        <input
          value={data.subject || ""}
          onChange={(e) => onUpdate({ subject: e.target.value })}
          placeholder="Bienvenue {{prenom}}"
          className="input text-xs py-1.5"
        />
      </div>

      {/* Visual mode preview */}
      {hasVisualBlocks ? (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Message (visuel)</label>
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={14} className="text-violet-500" />
              <span className="text-xs text-gray-700">{data.blocks.length} bloc{data.blocks.length > 1 ? "s" : ""} visuels</span>
            </div>
            <button
              onClick={() => setShowEditor(true)}
              className="btn-secondary py-1.5 text-xs w-full"
            >
              <Settings2 size={12} /> Modifier dans l'éditeur visuel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Message (texte)</label>
          <textarea
            value={data.body || ""}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder="Bonjour {{prenom}}, ..."
            className="input text-xs py-1.5"
            rows={6}
          />
          <button
            onClick={() => setShowEditor(true)}
            className="btn-secondary py-1.5 text-xs w-full mt-2"
          >
            <Settings2 size={12} /> Passer en mode visuel
          </button>
        </div>
      )}

      <p className="text-[10px] text-gray-400">Variables : {"{{prenom}}"} {"{{nom}}"} {"{{email}}"}</p>

      {/* Visual editor modal */}
      {showEditor && (
        <EmailEditorModal
          subject={data.subject || ""}
          blocks={data.blocks || []}
          brandColor={data.brandColor || "#1B4F72"}
          onSave={(newBlocks: any, newHtml: string, newColor: string) => {
            onUpdate({
              blocks: newBlocks,
              body: newHtml,
              brandColor: newColor,
              isHtml: true,
            });
            setShowEditor(false);
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
}

// ─── Email editor modal (réutilise EmailEditor) ───
function EmailEditorModal({ subject, blocks, brandColor, onSave, onClose }: any) {
  const [currentBlocks, setCurrentBlocks] = useState(blocks);
  const [currentHtml, setCurrentHtml] = useState("");
  const [currentColor, setCurrentColor] = useState(brandColor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Éditeur visuel</h2>
            <p className="text-xs text-gray-500">Construisez votre email avec des blocs</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-9 h-9 rounded border border-gray-200 cursor-pointer"
              title="Couleur principale"
            />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <EmailEditor
            initialBlocks={currentBlocks.length > 0 ? currentBlocks : undefined}
            brandColor={currentColor}
            onChange={(newBlocks: any, newHtml: string) => {
              setCurrentBlocks(newBlocks);
              setCurrentHtml(newHtml);
            }}
          />
        </div>

        <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary py-2 px-4 text-sm">Annuler</button>
          <button
            onClick={() => onSave(currentBlocks, currentHtml, currentColor)}
            disabled={currentBlocks.length === 0}
            className="btn-primary py-2 px-4 text-sm"
          >
            <Check size={14} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTaskConfig({ data, onUpdate }: any) {
  return (
    <>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Titre</label>
        <input
          value={data.title || ""}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Appeler {{prenom}}"
          className="input text-xs py-1.5"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
        <textarea
          value={data.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="input text-xs py-1.5"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Type</label>
          <select value={data.taskType || "TODO"} onChange={(e) => onUpdate({ taskType: e.target.value })} className="input text-xs py-1.5">
            <option value="TODO">À faire</option>
            <option value="CALL">Appel</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">RDV</option>
            <option value="FOLLOW_UP">Relance</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Priorité</label>
          <select value={data.priority || "MEDIUM"} onChange={(e) => onUpdate({ priority: e.target.value })} className="input text-xs py-1.5">
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
      </div>
    </>
  );
}

function ChangeStageConfig({ data, stages, onUpdate }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nouvelle étape</label>
      <select value={data.stageId || ""} onChange={(e) => onUpdate({ stageId: e.target.value })} className="input text-xs py-1.5">
        <option value="">— Sélectionner —</option>
        {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

function IncreaseScoreConfig({ data, onUpdate }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Points à ajouter</label>
      <input
        type="number"
        value={data.delta || 10}
        onChange={(e) => onUpdate({ delta: parseInt(e.target.value) || 0 })}
        className="input text-xs py-1.5"
      />
    </div>
  );
}

function AddNoteConfig({ data, onUpdate }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Note à ajouter</label>
      <textarea
        value={data.note || ""}
        onChange={(e) => onUpdate({ note: e.target.value })}
        placeholder="Ex: Lead VIP — à recontacter rapidement"
        className="input text-xs py-1.5"
        rows={4}
      />
    </div>
  );
}

function ConditionConfig({ data, onUpdate }: any) {
  return (
    <>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Champ</label>
        <select value={data.field || "score"} onChange={(e) => onUpdate({ field: e.target.value })} className="input text-xs py-1.5">
          <option value="score">Score</option>
          <option value="source">Source</option>
          <option value="city">Ville</option>
          <option value="email">Email</option>
          <option value="firstName">Prénom</option>
          <option value="lastName">Nom</option>
          <option value="isConverted">Converti</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Opérateur</label>
        <select value={data.operator || "equals"} onChange={(e) => onUpdate({ operator: e.target.value })} className="input text-xs py-1.5">
          <option value="equals">Est égal à</option>
          <option value="not_equals">N'est pas égal à</option>
          <option value="contains">Contient</option>
          <option value="greater_than">Supérieur à</option>
          <option value="less_than">Inférieur à</option>
          <option value="exists">Existe</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Valeur</label>
        <input
          value={data.value || ""}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="input text-xs py-1.5"
        />
      </div>
    </>
  );
}

function WaitConfig({ data, onUpdate }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nombre de jours</label>
      <input
        type="number"
        min="1"
        value={data.days || 1}
        onChange={(e) => onUpdate({ days: parseInt(e.target.value) || 1 })}
        className="input text-xs py-1.5"
      />
    </div>
  );
}

// ─── Trigger settings panel ───
function TriggerSettingsPanel({ triggerType, triggerConfig, onChange, onClose, stages, programs, campuses }: any) {
  const filters: FilterGroup = triggerConfig.filters || { operator: "AND", rules: [] };

  const updateFilters = (newFilters: FilterGroup) => {
    onChange(triggerType, { ...triggerConfig, filters: newFilters });
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Déclencheur</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Quand le workflow se déclenche-t-il ?</label>
          <select value={triggerType} onChange={(e) => onChange(e.target.value, {})} className="input text-xs py-1.5">
            <option value="LEAD_CREATED">Quand un lead est créé</option>
            <option value="NO_RESPONSE_DAYS">Quand un lead n'a pas répondu depuis X jours</option>
            <option value="STAGE_CHANGED">Quand le lead change d'étape</option>
          </select>
        </div>

        {triggerType === "NO_RESPONSE_DAYS" && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Jours sans réponse</label>
            <input
              type="number"
              min="1"
              value={triggerConfig.days || 7}
              onChange={(e) => onChange(triggerType, { ...triggerConfig, days: parseInt(e.target.value) || 7 })}
              className="input text-xs py-1.5"
            />
          </div>
        )}

        {triggerType === "STAGE_CHANGED" && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Étape cible</label>
            <select
              value={triggerConfig.stageId || ""}
              onChange={(e) => onChange(triggerType, { ...triggerConfig, stageId: e.target.value || undefined })}
              className="input text-xs py-1.5"
            >
              <option value="">Toute étape</option>
              {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Le workflow se déclenchera quand un lead passe à cette étape</p>
          </div>
        )}

        {/* Filters builder */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Filtres avancés (optionnel)</label>
            {filters.rules.length > 0 && (
              <button
                onClick={() => updateFilters({ operator: "AND", rules: [] })}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Tout effacer
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mb-2">Le workflow ne se déclenchera que si le lead correspond aux conditions ci-dessous</p>

          {filters.rules.length === 0 ? (
            <button
              onClick={() => updateFilters({ operator: "AND", rules: [{ field: "source", operator: "equals", value: "" }] })}
              className="w-full text-[11px] text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg border border-dashed border-brand-300 transition-colors"
            >
              + Ajouter un filtre
            </button>
          ) : (
            <LeadFiltersBuilder
              filters={filters}
              onChange={updateFilters}
              programs={programs}
              campuses={campuses}
              stages={stages}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───
function getTriggerLabel(type: string): string {
  const labels: any = {
    LEAD_CREATED: "Quand un lead est créé",
    NO_RESPONSE_DAYS: "Lead silencieux X jours",
    STAGE_CHANGED: "Quand l'étape change",
    EMAIL_OPENED: "Quand un email est ouvert",
  };
  return labels[type] || "Déclencheur";
}

function getDefaultLabel(type: string, action?: string): string {
  if (type === "trigger") return "Déclencheur";
  if (type === "wait") return "Attendre";
  if (type === "stop") return "Fin";
  if (type === "condition") return "Si...";
  if (type === "action") {
    const labels: any = {
      SEND_EMAIL: "Envoyer un email",
      CREATE_TASK: "Créer une tâche",
      CHANGE_STAGE: "Changer l'étape",
      INCREASE_SCORE: "Augmenter le score",
      ADD_NOTE: "Ajouter une note",
    };
    return labels[action || ""] || "Action";
  }
  return "Noeud";
}

function getActionLabel(data: any, templates: any[], stages: any[]): string {
  if (data.action === "SEND_EMAIL") return "📧 " + (data.subject || "Envoyer email");
  if (data.action === "CREATE_TASK") return "📝 " + (data.title || "Créer tâche");
  if (data.action === "CHANGE_STAGE") {
    const s = stages.find((s) => s.id === data.stageId);
    return "🏷️ " + (s ? "Passer en " + s.name : "Changer étape");
  }
  if (data.action === "INCREASE_SCORE") return "⭐ +" + (data.delta || 10) + " points";
  if (data.action === "ADD_NOTE") return "📝 Ajouter note";
  return data.label || "Action";
}

function getActionDescription(data: any, templates: any[], stages: any[]): string {
  if (data.action === "SEND_EMAIL" && data.body) return data.body.substring(0, 60) + (data.body.length > 60 ? "..." : "");
  if (data.action === "ADD_NOTE" && data.note) return data.note.substring(0, 60);
  return "";
}

function getConditionLabel(data: any): string {
  const fieldLabels: any = { score: "Score", source: "Source", city: "Ville", email: "Email" };
  const opLabels: any = { equals: "=", not_equals: "≠", contains: "contient", greater_than: ">", less_than: "<", exists: "existe" };
  return (fieldLabels[data.field] || data.field) + " " + (opLabels[data.operator] || "?") + " " + (data.value || "");
}