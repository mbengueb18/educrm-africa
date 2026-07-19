"use client";

// Modale de confirmation d'envoi d'une campagne WhatsApp — partagée entre la liste
// et l'éditeur (même flow que les campagnes email : modal + stats destinataires).
import { cn } from "@/lib/utils";
import {
  MessageCircle, Send, Loader2, CheckCircle, XCircle, AlertTriangle, Target,
} from "lucide-react";

export function WhatsAppSendConfirmModal({
  campaign,
  stats,
  loading,
  isPending,
  onCancel,
  onConfirm,
}: {
  campaign: { name: string };
  stats: {
    total: number;
    withWhatsApp: number;
    withoutWhatsApp: number;
    fromAudience: boolean;
    audienceName?: string;
  } | null;
  loading: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasNoRecipients = stats !== null && stats.withWhatsApp === 0;
  const hasIgnoredLeads = stats !== null && stats.withoutWhatsApp > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageCircle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900">Envoyer la campagne WhatsApp ?</h3>
              <p className="text-xs text-gray-500 truncate mt-0.5">&quot;{campaign.name}&quot;</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Calcul des destinataires...</span>
            </div>
          ) : stats ? (
            <>
              {stats.fromAudience && stats.audienceName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                  <Target size={13} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800">
                    Audience : <span className="font-semibold">{stats.audienceName}</span>
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    hasNoRecipients ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      hasNoRecipients ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                    )}
                  >
                    {hasNoRecipients ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      <span className={hasNoRecipients ? "text-red-700" : "text-emerald-700"}>
                        {stats.withWhatsApp}
                      </span>
                      <span className="text-gray-600 font-normal">
                        {" "}
                        destinataire{stats.withWhatsApp > 1 ? "s" : ""}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {hasNoRecipients
                        ? "Aucun lead n'a de numéro WhatsApp"
                        : "recevront le message WhatsApp"}
                    </p>
                  </div>
                </div>

                {hasIgnoredLeads && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-900">
                        {stats.withoutWhatsApp} lead{stats.withoutWhatsApp > 1 ? "s" : ""} sans WhatsApp
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Seront ignoré{stats.withoutWhatsApp > 1 ? "s" : ""}. Renseignez leur numéro pour les inclure.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                Audience totale :{" "}
                <span className="font-semibold text-gray-700">
                  {stats.total} lead{stats.total > 1 ? "s" : ""}
                </span>
              </div>

              {!hasNoRecipients && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[11px] text-blue-800">
                    💡 <strong>Important</strong> : chaque message WhatsApp utilise un template Meta-approuvé. Coûts à votre charge selon votre compte WhatsApp Business.
                  </p>
                </div>
              )}

              {!hasNoRecipients && (
                <p className="text-[11px] text-gray-500 mt-3 text-center">
                  Cette action est irréversible. Les messages seront envoyés progressivement en arrière-plan.
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={isPending} className="btn-secondary py-1.5 px-4 text-xs">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || isPending || hasNoRecipients}
            className="btn-primary py-1.5 px-4 text-xs"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {stats && stats.withWhatsApp > 0
              ? `Envoyer (${stats.withWhatsApp} message${stats.withWhatsApp > 1 ? "s" : ""})`
              : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
