"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPendingCall, clearPendingCall, type PendingCall } from "@/lib/call-tracking";
import { logCall } from "@/app/(dashboard)/calls/actions";
import { cn, formatPhone } from "@/lib/utils";
import { toast } from "sonner";
import {
  X, Phone, Loader2, CheckCircle2, PhoneMissed, PhoneOff,
  Voicemail, RotateCcw, UserX, ThumbsDown,
} from "lucide-react";

var OUTCOME_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  ANSWERED: { label: "Décroché", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  NO_ANSWER: { label: "Pas de réponse", icon: PhoneMissed, color: "text-red-500", bg: "bg-red-50" },
  BUSY: { label: "Occupé", icon: PhoneOff, color: "text-orange-500", bg: "bg-orange-50" },
  VOICEMAIL: { label: "Messagerie", icon: Voicemail, color: "text-purple-500", bg: "bg-purple-50" },
  CALLBACK: { label: "Rappeler", icon: RotateCcw, color: "text-amber-500", bg: "bg-amber-50" },
  WRONG_NUMBER: { label: "Mauvais numéro", icon: UserX, color: "text-gray-500", bg: "bg-gray-100" },
  NOT_INTERESTED: { label: "Pas intéressé", icon: ThumbsDown, color: "text-red-400", bg: "bg-red-50" },
};

export function CallReturnPrompt() {
  var [pending, setPending] = useState<PendingCall | null>(null);
  var [outcome, setOutcome] = useState("ANSWERED");
  var [durationMin, setDurationMin] = useState("0");
  var [durationSec, setDurationSec] = useState("0");
  var [notes, setNotes] = useState("");
  var [saving, setSaving] = useState(false);
  var router = useRouter();

  // Vérifie s'il y a un appel en attente (au montage ET au retour dans l'app)
  useEffect(function() {
    var check = function() {
      // On ne déclenche qu'au retour (page visible)
      if (document.visibilityState !== "visible") return;
      var call = getPendingCall();
      if (call && !pending) {
        // Pré-remplir la durée estimée (temps écoulé depuis le clic)
        var elapsedSec = Math.max(0, Math.round((Date.now() - call.startedAt) / 1000));
        setDurationMin(String(Math.floor(elapsedSec / 60)));
        setDurationSec(String(elapsedSec % 60));
        setOutcome("ANSWERED");
        setNotes("");
        setPending(call);
      }
    };

    // Au montage (cas du rechargement Safari : sessionStorage encore là)
    check();

    // Au retour dans l'app
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return function() {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [pending]);

  var handleClose = function() {
    clearPendingCall();
    setPending(null);
  };

  var handleSave = async function() {
    if (!pending) return;
    setSaving(true);
    var duration = (parseInt(durationMin || "0") * 60) + parseInt(durationSec || "0");
    try {
      await logCall({
        leadId: pending.leadId,
        direction: "OUTBOUND",
        outcome,
        duration: duration > 0 ? duration : undefined,
        phoneNumber: pending.phone,
        notes: notes.trim() || undefined,
        calledAt: new Date(pending.startedAt).toISOString(),
      });
      toast.success("Appel enregistré");
      clearPendingCall();
      setPending(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
    setSaving(false);
  };

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <Phone size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">Enregistrer l'appel</h2>
              <p className="text-xs text-gray-500 truncate">{pending.leadName} — {formatPhone(pending.phone)}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Outcome */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Résultat de l'appel</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(OUTCOME_CONFIG).map(function(entry) {
                var Icon = entry[1].icon;
                return (
                  <button key={entry[0]} type="button" onClick={function() { setOutcome(entry[0]); }}
                    className={cn("flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-medium border transition-colors",
                      outcome === entry[0] ? entry[1].bg + " " + entry[1].color + " border-current" : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                    )}>
                    <Icon size={14} />
                    {entry[1].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Durée (pré-remplie, modifiable) */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Durée <span className="text-gray-400 font-normal">(estimée, à vérifier)</span>
            </label>
            <div className="flex items-center gap-1">
              <input type="number" min="0" max="999" value={durationMin} onChange={function(e) { setDurationMin(e.target.value); }} className="input text-sm w-20 text-center" placeholder="0" />
              <span className="text-xs text-gray-400">min</span>
              <input type="number" min="0" max="59" value={durationSec} onChange={function(e) { setDurationSec(e.target.value); }} className="input text-sm w-20 text-center" placeholder="0" />
              <span className="text-xs text-gray-400">sec</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
            <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} className="input text-sm" rows={3} placeholder="Résumé de l'appel, prochaines étapes..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={handleClose} className="btn-secondary py-2 text-sm">Pas d'appel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}