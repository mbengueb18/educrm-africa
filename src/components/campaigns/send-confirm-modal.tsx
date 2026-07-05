"use client";

import { cn } from "@/lib/utils";
import { Send, Loader2, Target, XCircle, CheckCircle, AlertTriangle } from "lucide-react";

export type SendStats = {
  total: number;
  withEmail: number;
  withoutEmail: number;
  fromAudience: boolean;
  audienceName?: string;
} | null;

// Modal de confirmation d'envoi d'une campagne (destinataires + leads sans email).
// Partagé entre la liste des campagnes et l'éditeur → flow d'envoi identique.
export function SendConfirmModal({ campaign, stats, loading, isPending, onCancel, onConfirm }: {
  campaign: { name: string };
  stats: SendStats;
  loading: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  var hasNoRecipients = stats !== null && stats.withEmail === 0;
  var hasIgnoredLeads = stats !== null && stats.withoutEmail > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <Send size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900">Envoyer la campagne ?</h3>
              <p className="text-xs text-gray-500 truncate mt-0.5">"{campaign.name}"</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Calcul des destinataires...</span>
            </div>
          ) : stats ? (
            <>
              {stats.fromAudience && stats.audienceName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg mb-4">
                  <Target size={13} className="text-brand-600 shrink-0" />
                  <p className="text-xs text-brand-800">
                    Audience : <span className="font-semibold">{stats.audienceName}</span>
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  hasNoRecipients ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    hasNoRecipients ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {hasNoRecipients ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      <span className={hasNoRecipients ? "text-red-700" : "text-emerald-700"}>{stats.withEmail}</span>
                      <span className="text-gray-600 font-normal"> destinataire{stats.withEmail > 1 ? "s" : ""}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {hasNoRecipients ? "Aucun lead ne recevra cet email" : "recevront cet email"}
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
                        {stats.withoutEmail} lead{stats.withoutEmail > 1 ? "s" : ""} sans email
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Seront ignoré{stats.withoutEmail > 1 ? "s" : ""}. Renseignez leur email pour les inclure.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                Audience totale : <span className="font-semibold text-gray-700">{stats.total} lead{stats.total > 1 ? "s" : ""}</span>
              </div>

              {!hasNoRecipients && (
                <p className="text-[11px] text-gray-500 mt-4 text-center">
                  Cette action est irréversible. Les emails seront envoyés immédiatement.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={isPending} className="btn-secondary py-1.5 px-4 text-xs">Annuler</button>
          <button onClick={onConfirm} disabled={loading || isPending || hasNoRecipients} className="btn-primary py-1.5 px-4 text-xs">
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {stats && stats.withEmail > 0 ? `Envoyer (${stats.withEmail} email${stats.withEmail > 1 ? "s" : ""})` : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
