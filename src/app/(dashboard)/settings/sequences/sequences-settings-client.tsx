"use client";

import { useState, useTransition } from "react";
import { updateSequenceConfig } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft, Power, Mail, MessageCircle, Phone, AlertTriangle,
  XCircle, Check, Loader2, Pause, Calendar, Reply,
} from "lucide-react";

interface Config {
  id: string;
  enabled: boolean;
  pauseOnReply: boolean;
  pauseOnAppointment: boolean;
}

export function SequencesSettingsClient({ config }: { config: Config }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [pauseOnReply, setPauseOnReply] = useState(config.pauseOnReply);
  const [pauseOnAppointment, setPauseOnAppointment] = useState(config.pauseOnAppointment);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateSequenceConfig({ enabled, pauseOnReply, pauseOnAppointment });
        toast.success("Configuration sauvegardée");
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  const STEPS = [
    { day: "J+1", icon: Mail, color: "bg-blue-50 text-blue-600", title: "Email de relance", desc: "Envoyé automatiquement 24h après la création du lead, si pas de réponse" },
    { day: "J+3", icon: MessageCircle, color: "bg-emerald-50 text-emerald-600", title: "Tâche WhatsApp", desc: "Une tâche est créée pour le commercial assigné, à effectuer dans les 24h" },
    { day: "J+7", icon: Phone, color: "bg-purple-50 text-purple-600", title: "Tâche d'appel URGENT", desc: "Tâche d'appel de priorité URGENTE pour le commercial — dernière chance avant fermeture" },
    { day: "J+14", icon: Mail, color: "bg-amber-50 text-amber-600", title: "Email \"Last Chance\"", desc: "Dernier email de relance, prévenant que le dossier sera clôturé sans réponse" },
    { day: "J+21", icon: XCircle, color: "bg-red-50 text-red-600", title: "Auto-marquage \"Perdu\"", desc: "Le lead est automatiquement déplacé dans l'étape \"Perdu\"" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Relances automatiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Séquences multi-canal pour ne jamais perdre un lead silencieux</p>
        </div>
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
            <ToggleRow
              icon={Reply}
              title="Pause si le lead répond"
              desc="La séquence s'arrête dès qu'un email entrant est reçu"
              checked={pauseOnReply}
              onChange={setPauseOnReply}
            />
            <ToggleRow
              icon={Calendar}
              title="Pause si un RDV est prévu"
              desc="La séquence s'arrête si le lead a un rendez-vous planifié à venir"
              checked={pauseOnAppointment}
              onChange={setPauseOnAppointment}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Séquence de relance</h3>
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-12 text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{step.day}</span>
                  </div>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", step.color)}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending} className="btn-primary py-2 px-4 text-sm">
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</> : <><Check size={14} /> Sauvegarder</>}
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700">
            <strong>💡 Comment ça marche :</strong> Chaque jour à 9h, le système vérifie tous vos leads et exécute l'étape suivante de leur séquence si nécessaire. Les emails sont envoyés depuis votre adresse, les tâches WhatsApp et appels sont attribuées au commercial du lead.
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