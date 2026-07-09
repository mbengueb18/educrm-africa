"use client";

import { useState } from "react";
import { MailWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/app/(auth)/signup/actions";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    try {
      const res = await resendVerificationEmail();
      if (res.success) {
        setSent(true);
        toast.success("Email de vérification renvoyé", {
          description: `Vérifiez la boîte de réception de ${email} (et vos spams).`,
        });
      } else {
        toast.error(res.error || "Échec de l'envoi. Réessayez dans un instant.");
      }
    } catch {
      toast.error("Échec de l'envoi. Réessayez dans un instant.");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
      <MailWarning size={16} className="shrink-0 text-amber-600" />
      <p className="text-[13px] leading-snug flex-1 min-w-[220px]">
        Confirmez votre adresse <strong>{email}</strong> pour activer l'envoi d'emails et de campagnes.
        Vérifiez votre boîte de réception (et vos spams).
      </p>
      <button
        onClick={resend}
        disabled={sending || sent}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {sending && <Loader2 size={13} className="animate-spin" />}
        {sent ? "Email renvoyé ✓" : sending ? "Envoi…" : "Renvoyer l'email"}
      </button>
    </div>
  );
}
