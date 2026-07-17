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

import { ArrowLeft, Save, Play, Plus, Zap, GitBranch, Mail, Phone, ListTodo, Tag, Clock, StopCircle, X, Check, Settings2, Sparkles, Loader2, MessageCircle, UserPlus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateWorkflow, toggleWorkflow, testWorkflowOnLead, searchLeadsForWorkflowTest } from "../actions";
import { EmailEditor } from "@/components/messaging/email-editor";
import { type FilterGroup } from "./lead-filters-builder";
import { RuleBuilder } from "@/components/audiences/rule-builder";

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
    SEND_WHATSAPP: MessageCircle,
    CREATE_TASK: ListTodo,
    CHANGE_STAGE: Tag,
    INCREASE_SCORE: Sparkles,
    ADD_NOTE: Mail,
    ASSIGN_TO: UserPlus,
  };
  const COLORS: any = {
    SEND_EMAIL: "blue",
    SEND_WHATSAPP: "emerald",
    CREATE_TASK: "amber",
    CHANGE_STAGE: "violet",
    INCREASE_SCORE: "pink",
    ADD_NOTE: "gray",
    ASSIGN_TO: "indigo",
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
  whatsappTemplates: { id: string; metaName: string; language: string; bodyText: string; variableMapping: any }[];
  forms: { id: string; name: string; status: string }[];
  programs: { id: string; name: string }[];
  campuses: { id: string; name: string }[];
  fields: any[];
  users: { id: string; name: string | null }[];
}

export function WorkflowEditorClient({ workflow, stages, templates, whatsappTemplates, forms, programs, campuses, fields, users }: WorkflowEditorClientProps) {
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
  const [showTest, setShowTest] = useState(false);

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
      if (action === "ASSIGN_TO") data.assignMode = "round_robin";
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
        updated.data.label = getActionLabel(updated.data, templates, stages, whatsappTemplates);
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

  // Persiste le graphe courant (sans toast) — utilisé avant un test manuel
  const persistGraph = async () => {
    await updateWorkflow(workflow.id, {
      name,
      description,
      triggerType,
      triggerConfig,
      graph: { nodes, edges },
    });
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
    <>
      {/* Mobile/tablet blocker — visual workflow editor is desktop-only */}
      <div className="lg:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-violet-50 flex items-center justify-center mb-5">
          <GitBranch size={40} className="text-violet-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Éditeur réservé au desktop</h1>
        <p className="text-sm text-gray-600 max-w-xs mb-1">
          L'éditeur de workflow visuel nécessite un grand écran pour manipuler le graphe et configurer les actions.
        </p>
        <p className="text-xs text-gray-400 max-w-xs mb-6">
          Connectez-vous depuis un ordinateur (1024px minimum) pour créer et modifier vos automatisations.
        </p>
        <Link href="/workflows" className="btn-primary text-sm">
          <ArrowLeft size={14} /> Retour aux workflows
        </Link>
      </div>

      {/* Desktop editor — z-50 pour passer au-dessus du header global (sticky z-40) et occuper tout l'écran */}
      {/* Ancre safelist : force Tailwind à générer les classes indigo utilisées dynamiquement par le noeud ASSIGN_TO */}
      <span className="hidden bg-indigo-500 !bg-indigo-500 border-indigo-300 border-indigo-500 text-indigo-700" aria-hidden />
      <div className="hidden lg:flex fixed inset-0 bg-gray-50 flex-col z-50">
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
        <button onClick={() => setShowTest(true)} className="btn-secondary py-2 px-3 text-xs">
          <Play size={14} /> Tester
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
            <PaletteItem icon={MessageCircle} label="Envoyer WhatsApp" color="emerald" onClick={() => addNode("action", "SEND_WHATSAPP")} />
            <PaletteItem icon={UserPlus} label="Assigner conseiller" color="indigo" onClick={() => addNode("action", "ASSIGN_TO")} />
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
            whatsappTemplates={whatsappTemplates}
            users={users}
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
            fields={fields}
            users={users}
            forms={forms}
            onChange={(type: string, config: any) => { setTriggerType(type); setTriggerConfig(config); }}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Test modal */}
        {showTest && (
          <TestWorkflowModal
            workflowId={workflow.id}
            nodeCount={nodes.length}
            onBeforeTest={persistGraph}
            onClose={() => setShowTest(false)}
          />
        )}
      </div>
    </div>
    </>
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
function NodeConfigPanel({ node, stages, templates, whatsappTemplates, users, onUpdate, onDelete, onClose }: any) {
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
        {node.type === "action" && node.data.action === "SEND_WHATSAPP" && (
          <SendWhatsAppConfig data={node.data} whatsappTemplates={whatsappTemplates} onUpdate={onUpdate} />
        )}
        {node.type === "action" && node.data.action === "CREATE_TASK" && (
          <CreateTaskConfig data={node.data} users={users} onUpdate={onUpdate} />
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
        {node.type === "action" && node.data.action === "ASSIGN_TO" && (
          <AssignToConfig data={node.data} users={users} onUpdate={onUpdate} />
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

// ─── WhatsApp action config ───
function SendWhatsAppConfig({ data, whatsappTemplates, onUpdate }: any) {
  const list = whatsappTemplates || [];
  const selected = list.find((t: any) => t.id === data.whatsappTemplateId);
  const varCount = selected?.variableMapping ? Object.keys(selected.variableMapping).length : 0;

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs text-amber-800">
          Aucun template WhatsApp approuvé. Créez et faites approuver un template dans{" "}
          <span className="font-semibold">Paramètres → Templates WhatsApp</span> (plan Performance).
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Template WhatsApp</label>
        <select
          value={data.whatsappTemplateId || ""}
          onChange={(e) => onUpdate({ whatsappTemplateId: e.target.value || null })}
          className="input text-xs py-1.5"
        >
          <option value="">— Choisir un template —</option>
          {list.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.metaName} ({t.language})
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Aperçu du message</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{selected.bodyText}</p>
          {varCount > 0 && (
            <p className="text-[11px] text-gray-500 mt-2">
              {varCount} variable{varCount > 1 ? "s" : ""} remplie{varCount > 1 ? "s" : ""} automatiquement depuis la fiche du lead.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Envoyé au numéro WhatsApp du lead (ou son téléphone à défaut). Nécessite l'intégration WhatsApp active.
      </p>
    </>
  );
}

// ─── Test modal (exécute le workflow sur un lead réel) ───
function TestWorkflowModal({ workflowId, nodeCount, onBeforeTest, onClose }: any) {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<any[] | null>(null);

  // Recherche débouncée
  useEffect(() => {
    if (selectedLead) return;
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchLeadsForWorkflowTest(query);
        if (active) setLeads(res as any[]);
      } finally {
        if (active) setSearching(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [query, selectedLead]);

  const leadName = (l: any) => ((l.firstName || "") + " " + (l.lastName || "")).trim() || l.email || l.phone || "Lead";

  const runTest = async () => {
    if (!selectedLead) return;
    setRunning(true);
    setSteps(null);
    try {
      await onBeforeTest(); // sauvegarde le graphe courant avant de tester
      const res = await testWorkflowOnLead(workflowId, selectedLead.id);
      if (!res.ok) {
        toast.error(res.error || "Échec du test");
      } else {
        setSteps(res.steps || []);
        toast.success("Test exécuté");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
    setRunning(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Play size={16} className="text-emerald-600" /> Tester le workflow
            </h2>
            <p className="text-xs text-gray-500">Exécute réellement les actions sur le lead choisi.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {nodeCount < 2 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Ce workflow n'a pas encore d'action connectée : le test s'arrêtera au déclencheur.
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            ⚠️ Le test <b>envoie réellement</b> les emails / WhatsApp et crée les tâches ou change l'étape du lead. Les nœuds « Attendre » sont ignorés.
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Lead de test</label>
            {selectedLead ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{leadName(selectedLead)}</p>
                  <p className="text-[11px] text-gray-500">{selectedLead.email || selectedLead.whatsapp || selectedLead.phone || "—"}</p>
                </div>
                <button onClick={() => { setSelectedLead(null); setSteps(null); }} className="text-xs text-gray-500 hover:text-gray-700">Changer</button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un lead (nom, email, téléphone)…"
                  className="input text-xs py-2"
                  autoFocus
                />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                  {searching && <p className="text-xs text-gray-400 px-3 py-2">Recherche…</p>}
                  {!searching && leads.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Aucun lead trouvé.</p>}
                  {leads.map((l) => (
                    <button key={l.id} onClick={() => setSelectedLead(l)} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      <p className="text-sm text-gray-900">{leadName(l)}</p>
                      <p className="text-[11px] text-gray-500">{l.email || l.whatsapp || l.phone || "—"}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {steps && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Déroulé</p>
              <ol className="space-y-1">
                {steps.length === 0 && <li className="text-xs text-gray-400">Aucune étape exécutée.</li>}
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[9px] shrink-0">{i + 1}</span>
                    <span className="text-gray-700"><b>{s.label}</b> — {s.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary py-2 px-4 text-sm">Fermer</button>
          <button onClick={runTest} disabled={!selectedLead || running} className="btn-primary py-2 px-4 text-sm">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Lancer le test
          </button>
        </div>
      </div>
    </div>
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

function CreateTaskConfig({ data, users, onUpdate }: any) {
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Échéance</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              value={data.dueOffsetDays ?? ""}
              onChange={(e) => onUpdate({ dueOffsetDays: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0) })}
              placeholder="—"
              className="input text-xs py-1.5 w-16"
            />
            <span className="text-[11px] text-gray-500">jour(s) après</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Assigné à</label>
          <select
            value={data.assigneeUserId || ""}
            onChange={(e) => onUpdate({ assigneeUserId: e.target.value || null })}
            className="input text-xs py-1.5"
          >
            <option value="">Conseiller du lead</option>
            {(users || []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.name || "Sans nom"}</option>
            ))}
          </select>
        </div>
      </div>

      {data.dueOffsetDays != null && data.dueOffsetDays !== "" && (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!!data.reminderAtDue}
            onChange={(e) => onUpdate({ reminderAtDue: e.target.checked })}
          />
          Créer un rappel à l'échéance
        </label>
      )}

      <p className="text-[11px] text-gray-400">
        Échéance vide = tâche sans date. « Conseiller du lead » = le commercial assigné, sinon un membre actif par défaut.
      </p>
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

function AssignToConfig({ data, users, onUpdate }: any) {
  const mode = data.assignMode || "round_robin";
  return (
    <>
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Mode d'assignation</label>
        <select
          value={mode}
          onChange={(e) => onUpdate({ assignMode: e.target.value })}
          className="input text-xs py-1.5"
        >
          <option value="round_robin">Répartition automatique (moins chargé)</option>
          <option value="specific">Conseiller précis</option>
        </select>
      </div>

      {mode === "specific" ? (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Conseiller</label>
          <select
            value={data.userId || ""}
            onChange={(e) => onUpdate({ userId: e.target.value || null })}
            className="input text-xs py-1.5"
          >
            <option value="">— Choisir —</option>
            {(users || []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.name || "Sans nom"}</option>
            ))}
          </select>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!!data.sameCampusAsLead}
            onChange={(e) => onUpdate({ sameCampusAsLead: e.target.checked })}
          />
          Limiter aux conseillers du campus du lead
        </label>
      )}

      <p className="text-[11px] text-gray-400">
        Répartit parmi les conseillers actifs (Admin / Commercial). En mode automatique, le lead va au conseiller ayant le moins de leads en cours.
      </p>
    </>
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
function TriggerSettingsPanel({ triggerType, triggerConfig, onChange, onClose, stages, forms }: any) {
  const filters: FilterGroup = triggerConfig.filters || { operator: "AND", rules: [] };
  const [showFilters, setShowFilters] = useState(false);
  const ruleCount = countRules(filters);

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
            <option value="FORM_SUBMITTED">Quand un formulaire est soumis</option>
            <option value="NO_RESPONSE_DAYS">Quand un lead n'a pas répondu depuis X jours</option>
            <option value="STAGE_CHANGED">Quand le lead change d'étape</option>
          </select>
        </div>

        {triggerType === "FORM_SUBMITTED" && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Formulaire</label>
            <select
              value={triggerConfig.formId || ""}
              onChange={(e) => onChange(triggerType, { ...triggerConfig, formId: e.target.value || undefined })}
              className="input text-xs py-1.5"
            >
              <option value="">Tous les formulaires</option>
              {(forms || []).map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}{f.status !== "PUBLISHED" ? " (brouillon)" : ""}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Le workflow se déclenchera à chaque soumission de ce formulaire</p>
          </div>
        )}

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

        {/* Filters builder — mêmes règles que les campagnes emailing / audiences */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Filtres avancés (optionnel)</label>
            {ruleCount > 0 && (
              <button
                onClick={() => updateFilters({ operator: "AND", rules: [] })}
                className="text-[10px] text-red-500 hover:text-red-700"
              >
                Tout effacer
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mb-2">Le workflow ne se déclenchera que si le lead correspond aux conditions</p>

          <button
            onClick={() => setShowFilters(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg border border-dashed border-brand-300 transition-colors"
          >
            <Filter size={12} />
            {ruleCount > 0 ? `Modifier les filtres (${ruleCount})` : "Ajouter des filtres"}
          </button>
        </div>
      </div>

      {/* Modale de règles (réutilise le builder des audiences/campagnes) */}
      {showFilters && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><Filter size={16} className="text-brand-600" /> Filtres du déclencheur</h2>
                <p className="text-xs text-gray-500">Le workflow ne démarrera que pour les leads correspondant à ces règles.</p>
              </div>
              <button onClick={() => setShowFilters(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto">
              <RuleBuilder
                initialRules={filters as any}
                onSave={(rules: any) => { updateFilters(rules); setShowFilters(false); }}
                onCancel={() => setShowFilters(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compte le nombre de règles simples dans un groupe (récursif)
function countRules(group: any): number {
  if (!group || !Array.isArray(group.rules)) return 0;
  return group.rules.reduce((acc: number, r: any) => {
    if (r && Array.isArray(r.rules)) return acc + countRules(r);
    if (r && r.operator_group) return acc + countRules({ rules: r.rules });
    return acc + 1;
  }, 0);
}

// ─── Helpers ───
function getTriggerLabel(type: string): string {
  const labels: any = {
    LEAD_CREATED: "Quand un lead est créé",
    FORM_SUBMITTED: "Quand un formulaire est soumis",
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
      SEND_WHATSAPP: "Envoyer un WhatsApp",
      CREATE_TASK: "Créer une tâche",
      CHANGE_STAGE: "Changer l'étape",
      INCREASE_SCORE: "Augmenter le score",
      ADD_NOTE: "Ajouter une note",
      ASSIGN_TO: "Assigner un conseiller",
    };
    return labels[action || ""] || "Action";
  }
  return "Noeud";
}

function getActionLabel(data: any, templates: any[], stages: any[], whatsappTemplates: any[] = []): string {
  if (data.action === "SEND_EMAIL") return "📧 " + (data.subject || "Envoyer email");
  if (data.action === "SEND_WHATSAPP") {
    const t = whatsappTemplates.find((t) => t.id === data.whatsappTemplateId);
    return "💬 " + (t ? t.metaName : "Envoyer WhatsApp");
  }
  if (data.action === "CREATE_TASK") return "📝 " + (data.title || "Créer tâche");
  if (data.action === "CHANGE_STAGE") {
    const s = stages.find((s) => s.id === data.stageId);
    return "🏷️ " + (s ? "Passer en " + s.name : "Changer étape");
  }
  if (data.action === "INCREASE_SCORE") return "⭐ +" + (data.delta || 10) + " points";
  if (data.action === "ADD_NOTE") return "📝 Ajouter note";
  if (data.action === "ASSIGN_TO") return "👤 " + (data.assignMode === "specific" ? "Assigner (conseiller précis)" : "Assigner (auto)");
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