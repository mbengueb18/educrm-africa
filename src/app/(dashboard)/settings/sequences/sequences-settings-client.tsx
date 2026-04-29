"use client";

import { useState, useTransition } from "react";
import { updateSequenceConfig, resetToDefaults } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft, Power, Mail, MessageCircle, Phone, AlertTriangle,
  XCircle, Check, Loader2, Pause, Calendar, Reply, RotateCcw,
  ChevronDown, ChevronUp, Edit3,
} from "lucide-react";
import type { SequenceStep } from "@/lib/sequence-defaults";

interface Config {
  enabled: boolean;
  pauseOnReply: boolean;
  pauseOnAppointment: boolean;
  steps: SequenceStep[];
}

const CHANNEL_ICONS: Record<string, any> = {
  EMAIL: Mail,
  WHATSAPP_TASK: MessageCircle,
  CALL_TASK: Phone,
  AUTO_LOST: XCircle,
};

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-50 text-blue-600",
  WHATSAPP_TASK: "bg-emerald-50 text-emerald-600",
  CALL_TASK: "bg-purple-50 text-purple-600",
  AUTO_LOST: "bg-red-50 text-red-600",
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email automatique",
  WHATSAPP_TASK: "Tâche WhatsApp (commercial)",
  CALL_TASK: "Tâche d'appel (commercial)",
  AUTO_LOST: "Marquage automatique",
};

export function SequencesSettingsClient({ config }: { config: Config }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [pauseOnReply, setPauseOnReply] = useState(config.pauseOnReply);
  const [pauseOnAppointment, setPauseOnAppointment] = useState(config.pauseOnAppointment);
  const [steps, setSteps] = useState<SequenceStep[]>(config.steps);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateSequenceConfig({ enabled, pauseOnReply, pauseOnAppointment, steps });
        toast.success("Configuration sauvegardée");
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  const handleReset = async () => {
    if (!confirm("Réinitialiser tous les messages et délais aux valeurs par défaut ? Vos personnalisations seront perdues.")) return;
    startTransition(async () => {
      try {
        await resetToDefaults();
        toast.success("Configuration réinitialisée");
        window.location.reload();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  const updateStep = (id: string, patch: Partial<SequenceStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Relances automatiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personnalisez les messages, délais et canaux de relance</p>
        </div>
        <button onClick={handleReset} className="btn-secondary py-1.5 px-3 text-xs text-gray-500" disabled={isPending}>
          <RotateCcw size={12} /> Réinitialiser
        </button>
      </div>

      <div className="space-y-5">
        {/* Activation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", enabled ? "bg-emerald-50" : "bg-gray-100")}>
                <Power size={20} className={enabled ? "text-emerald-600" : "text-gray-400"} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Activer les relances automatiques</p>
                <p className="text-xs text-gray-500">Le système enverra automatiquement les relances aux leads silencieux</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>
        </div>

        {/* Pause conditions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Pause size={16} className="text-brand-500" /> Conditions d'arrêt automatique
          </h3>
          <div className="space-y-3">
            <ToggleRow icon={Reply} title="Pause si le lead répond" desc="La séquence s'arrête dès qu'un email entrant est reçu" checked={pauseOnReply} onChange={setPauseOnReply} />
            <ToggleRow icon={Calendar} title="Pause si un RDV est prévu" desc="La séquence s'arrête si le lead a un rendez-vous planifié" checked={pauseOnAppointment} onChange={setPauseOnAppointment} />
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Séquence de relance personnalisée</h3>
            <span className="text-[10px] text-gray-400">Variables : {"{prenom}"} {"{nom}"} {"{email}"} {"{ecole}"}</span>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => {
              const Icon = CHANNEL_ICONS[step.channel] || Mail;
              const colorClass = CHANNEL_COLORS[step.channel] || "bg-gray-50 text-gray-600";
              const isExpanded = expandedStep === step.id;
              const isEditable = step.channel === "EMAIL" || step.channel === "WHATSAPP_TASK" || step.channel === "CALL_TASK";

              return (
                <div key={step.id} className={cn("border rounded-xl transition-colors", step.enabled ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50")}>
                  <div className="flex items-center gap-3 p-3">
                    {/* Toggle enabled */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input type="checkbox" checked={step.enabled} onChange={(e) => updateStep(step.id, { enabled: e.target.checked })} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                    </label>

                    {/* Day input */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-500">J+</span>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={step.daysAfter}
                        onChange={(e) => updateStep(step.id, { daysAfter: parseInt(e.target.value) || 0 })}
                        className="w-12 px-2 py-1 text-xs border border-gray-200 rounded text-center"
                        disabled={!step.enabled}
                      />
                    </div>

                    {/* Channel icon + label */}
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{step.label}</p>
                      <p className="text-[10px] text-gray-500">{CHANNEL_LABELS[step.channel]}</p>
                    </div>

                    {/* Expand button */}
                    {isEditable && (
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <Edit3 size={14} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded edit zone */}
                  {isExpanded && isEditable && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50/50 space-y-3">
                      <div>
                        <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Nom de l'étape</label>
                        <input
                          value={step.label}
                          onChange={(e) => updateStep(step.id, { label: e.target.value })}
                          className="input text-xs py-1.5 w-full"
                        />
                      </div>

                      {step.channel === "EMAIL" && (
                        <>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Objet de l'email</label>
                            <input
                              value={step.emailSubject || ""}
                              onChange={(e) => updateStep(step.id, { emailSubject: e.target.value })}
                              className="input text-xs py-1.5 w-full"
                              placeholder="Ex : {prenom}, votre projet de formation"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Corps du message</label>
                            <textarea
                              value={step.emailBody || ""}
                              onChange={(e) => updateStep(step.id, { emailBody: e.target.value })}
                              className="input text-xs py-1.5 w-full font-mono"
                              rows={8}
                              placeholder="Bonjour {prenom}, ..."
                            />
                          </div>
                        </>
                      )}

                      {(step.channel === "WHATSAPP_TASK" || step.channel === "CALL_TASK") && (
                        <>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Titre de la tâche créée</label>
                            <input
                              value={step.taskTitle || ""}
                              onChange={(e) => updateStep(step.id, { taskTitle: e.target.value })}
                              className="input text-xs py-1.5 w-full"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                            <textarea
                              value={step.taskDescription || ""}
                              onChange={(e) => updateStep(step.id, { taskDescription: e.target.value })}
                              className="input text-xs py-1.5 w-full"
                              rows={2}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Priorité</label>
                            <select
                              value={step.taskPriority || "HIGH"}
                              onChange={(e) => updateStep(step.id, { taskPriority: e.target.value as any })}
                              className="input text-xs py-1.5"
                            >
                              <option value="LOW">Basse</option>
                              <option value="MEDIUM">Moyenne</option>
                              <option value="HIGH">Haute</option>
                              <option value="URGENT">Urgente</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400 mt-3">
            💡 Utilisez les variables {"{prenom}"}, {"{nom}"}, {"{email}"}, {"{ecole}"} dans vos messages — elles seront remplacées automatiquement.
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <button onClick={handleSave} disabled={isPending} className="btn-primary py-2 px-4 text-sm">
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</> : <><Check size={14} /> Sauvegarder</>}
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700">
            <strong>💡 Comment ça marche :</strong> Chaque jour à 9h, le système vérifie tous vos leads. Pour chaque lead silencieux, il exécute la prochaine étape activée selon son délai. Vous pouvez désactiver une étape sans perdre sa configuration.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, desc, checked, onChange }: {
  icon: any; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <Icon size={16} className="text-gray-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
      </label>
    </div>
  );
}