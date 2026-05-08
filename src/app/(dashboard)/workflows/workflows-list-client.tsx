"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createWorkflow, deleteWorkflow, toggleWorkflow } from "./actions";
import {
  ArrowLeft, Plus, Zap, GitBranch, Settings2, Trash2, Loader2, X,
  Mail, Clock, Activity, Power, MoreHorizontal, Check,
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  graph: any;
  createdAt: Date;
  updatedAt: Date;
  _count: { executions: number };
}

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CREATED: "Lead créé",
  NO_RESPONSE_DAYS: "Lead silencieux",
  STAGE_CHANGED: "Étape modifiée",
  EMAIL_OPENED: "Email ouvert",
};

const TRIGGER_COLORS: Record<string, { bg: string; color: string }> = {
  LEAD_CREATED: { bg: "bg-emerald-100", color: "text-emerald-700" },
  NO_RESPONSE_DAYS: { bg: "bg-amber-100", color: "text-amber-700" },
  STAGE_CHANGED: { bg: "bg-violet-100", color: "text-violet-700" },
  EMAIL_OPENED: { bg: "bg-blue-100", color: "text-blue-700" },
};

const STARTER_WORKFLOWS = [
  {
    name: "Nurturing nouveau lead",
    description: "Email de bienvenue + relance 3 jours après si pas de réponse",
    triggerType: "LEAD_CREATED",
    icon: Mail,
    color: "blue",
  },
  {
    name: "Réactivation lead froid",
    description: "Relancer les leads silencieux depuis 30 jours",
    triggerType: "NO_RESPONSE_DAYS",
    icon: Clock,
    color: "amber",
  },
  {
    name: "Onboarding admis",
    description: "Email + tâche dès qu'un lead passe en 'Admis'",
    triggerType: "STAGE_CHANGED",
    icon: Activity,
    color: "violet",
  },
  {
    name: "Workflow vide",
    description: "Partir de zéro pour créer votre propre automatisation",
    triggerType: "LEAD_CREATED",
    icon: Plus,
    color: "gray",
  },
];

export function WorkflowsListClient({ workflows }: { workflows: Workflow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (template: typeof STARTER_WORKFLOWS[0]) => {
    try {
      const wf = await createWorkflow({
        name: template.name,
        description: template.description,
        triggerType: template.triggerType,
      });
      toast.success("Workflow créé");
      router.push("/workflows/" + wf.id);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleWorkflow(id, enabled);
      toast.success(enabled ? "Workflow activé" : "Workflow désactivé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm("Supprimer le workflow \"" + name + "\" ?")) return;
    try {
      await deleteWorkflow(id);
      toast.success("Workflow supprimé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const enabledCount = workflows.filter((w) => w.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 mb-4 sm:mb-6">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
            Workflows
            <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">Bêta</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Automatisez vos actions commerciales avec des workflows visuels
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary py-2 px-3 text-xs shrink-0">
          <Plus size={13} /> <span className="hidden sm:inline">Nouveau workflow</span><span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard label="Workflows actifs" value={enabledCount} icon={Power} color="emerald" />
        <StatCard label="Total workflows" value={workflows.length} icon={Zap} color="blue" />
        <StatCard
          label="Exécutions totales"
          value={workflows.reduce((sum, w) => sum + w._count.executions, 0)}
          icon={Activity}
          color="violet"
        />
      </div>

      {/* Empty state */}
      {workflows.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <GitBranch size={32} className="text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun workflow</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Créez votre premier workflow pour automatiser l'envoi d'emails, la création de tâches ou la gestion de votre pipeline.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary py-2 px-4 text-sm">
            <Plus size={14} /> Créer mon premier workflow
          </button>
        </div>
      )}

      {/* List */}
      {workflows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {workflows.map((wf) => {
            const tc = TRIGGER_COLORS[wf.triggerType] || TRIGGER_COLORS.LEAD_CREATED;
            const nodeCount = wf.graph?.nodes?.length || 0;
            return (
              <div key={wf.id} className="flex items-start sm:items-center gap-3 px-3 sm:px-4 py-3 hover:bg-gray-50/50 transition-colors group">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(wf.id, !wf.enabled)}
                  className={cn(
                    "w-10 h-6 rounded-full relative transition-colors shrink-0 mt-1 sm:mt-0",
                    wf.enabled ? "bg-emerald-500" : "bg-gray-300"
                  )}
                  title={wf.enabled ? "Désactiver" : "Activer"}
                >
                  <div className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                    wf.enabled && "translate-x-4"
                  )} />
                </button>

                {/* Info */}
                <Link href={"/workflows/" + wf.id} className="flex-1 min-w-0 cursor-pointer">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate min-w-0">{wf.name}</p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap", tc.bg, tc.color)}>
                      {TRIGGER_LABELS[wf.triggerType] || wf.triggerType}
                    </span>
                  </div>
                  {wf.description && <p className="text-xs text-gray-500 truncate">{wf.description}</p>}
                  <div className="flex items-center gap-x-2 gap-y-0.5 mt-1 flex-wrap">
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{nodeCount} étape{nodeCount > 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-gray-400">•</span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{wf._count.executions} exécution{wf._count.executions > 1 ? "s" : ""}</span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">•</span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap hidden sm:inline">
                      Modifié le {new Date(wf.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </Link>

                <Link href={"/workflows/" + wf.id} className="btn-secondary py-1.5 px-3 text-xs hidden sm:inline-flex shrink-0">
                  <Settings2 size={12} /> Modifier
                </Link>

                <button
                  onClick={() => handleDelete(wf.id, wf.name)}
                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateWorkflowModal
          onSelect={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Stat card ───
function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", `bg-${color}-50 text-${color}-600`)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── Create modal ───
function CreateWorkflowModal({ onSelect, onClose }: {
  onSelect: (template: typeof STARTER_WORKFLOWS[0]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Créer un workflow</h2>
            <p className="text-xs text-gray-500">Choisissez un modèle ou partez de zéro</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STARTER_WORKFLOWS.map((tpl, i) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={i}
                  onClick={() => onSelect(tpl)}
                  className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-card-hover transition-all"
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", `bg-${tpl.color}-50 text-${tpl.color}-600`)}>
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{tpl.name}</p>
                  <p className="text-xs text-gray-500">{tpl.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}