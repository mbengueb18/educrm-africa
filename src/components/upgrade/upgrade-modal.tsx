// src/components/upgrade/upgrade-modal.tsx
"use client";

import { X, Check, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureComparison {
  label: string;
  current: string | boolean;
  target: string | boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  // Contexte commercial
  feature: string; // ex: "WhatsApp Business API"
  description: string; // ex: "Envoyer des messages WhatsApp directement depuis TalibCRM"
  // Plan actuel et cible
  currentPlanName: string; // ex: "Croissance"
  targetPlanName: string; // ex: "Performance"
  targetPlanPrice?: string; // (non affiché — prix gérés sur la page tarifs)
  // Action immédiate disponible (optionnelle)
  immediateAction?: {
    label: string;
    description: string;
    onClick: () => void;
  };
  // Comparatif features
  comparison?: FeatureComparison[];
  // Liste des avantages du plan cible
  targetBenefits?: string[];
}

export function UpgradeModal({
  open,
  onClose,
  feature,
  description,
  currentPlanName,
  targetPlanName,
  targetPlanPrice,
  immediateAction,
  comparison,
  targetBenefits = [],
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{feature}</h2>
              <p className="text-xs text-gray-500">Disponible dans le plan {targetPlanName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-700 leading-relaxed">{description}</p>

          {/* Comparatif 2 colonnes */}
          {(immediateAction || comparison) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Colonne gauche : action immédiate */}
              {immediateAction && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center">
                      <span className="text-xs">🟢</span>
                    </div>
                    <p className="text-xs font-bold text-gray-700">
                      Votre plan {currentPlanName}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{immediateAction.description}</p>
                  <button
                    onClick={immediateAction.onClick}
                    className="w-full py-2 px-3 rounded-lg bg-white border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                  >
                    {immediateAction.label}
                    <ExternalLink size={11} />
                  </button>
                </div>
              )}

              {/* Colonne droite : plan cible */}
              <div className="border-2 border-blue-300 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    RECOMMANDÉ
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-200 flex items-center justify-center">
                    <Sparkles size={14} className="text-blue-700" />
                  </div>
                  <p className="text-xs font-bold text-blue-900">Plan {targetPlanName}</p>
                </div>
                <ul className="space-y-1 mb-3">
                  {targetBenefits.slice(0, 4).map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-blue-800">
                      <Check size={12} className="shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="https://talibcrm.com/tarifs"
                  target="_blank"
                  rel="noopener"
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"
                >
                  Passer en {targetPlanName}
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}

          {/* Comparatif détaillé (optionnel, sous le grid) */}
          {comparison && comparison.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Comparatif détaillé
                </p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-500"></th>
                    <th className="text-center px-4 py-2 font-medium text-gray-500">{currentPlanName}</th>
                    <th className="text-center px-4 py-2 font-medium text-blue-700">{targetPlanName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comparison.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-700">{item.label}</td>
                      <td className="text-center px-4 py-2 text-gray-500">
                        {typeof item.current === "boolean"
                          ? (item.current ? <Check size={14} className="inline text-emerald-600" /> : "—")
                          : item.current}
                      </td>
                      <td className="text-center px-4 py-2 text-blue-700 font-medium">
                        {typeof item.target === "boolean"
                          ? (item.target ? <Check size={14} className="inline text-emerald-600" /> : "—")
                          : item.target}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}