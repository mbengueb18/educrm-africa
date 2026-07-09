"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await requestPasswordResetAction(email.trim());
    } catch {
      // On affiche le message générique quoi qu'il arrive.
    }
    setSending(false);
    setDone(true);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFBFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, border: "1px solid #e6eaee", padding: "36px 32px" }}>
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748B", textDecoration: "none", marginBottom: 20 }}>
          <ArrowLeft size={15} /> Retour à la connexion
        </Link>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 size={32} color="#10B981" />
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0F1923", marginBottom: 10 }}>Vérifiez votre boîte mail</h1>
            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
              Si un compte est associé à <strong>{email.trim()}</strong>, un email contenant un lien de
              réinitialisation vient d'être envoyé. Pensez à vérifier vos spams. Le lien expire dans 1 heure.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F1923", marginBottom: 8 }}>Mot de passe oublié ?</h1>
            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
              Saisissez votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe.
            </p>

            <form onSubmit={submit}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Adresse email</label>
              <div style={{ position: "relative", marginBottom: 20 }}>
                <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  placeholder="vous@votre-ecole.com"
                  style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => { e.target.style.borderColor = "#0E7C6B"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; }}
                />
              </div>

              <button type="submit" disabled={sending || !email.trim()}
                style={{
                  width: "100%", padding: "13px 24px", borderRadius: 12, border: "none",
                  background: !sending && email.trim() ? "#0E7C6B" : "#e2e8f0",
                  color: !sending && email.trim() ? "#fff" : "#94a3b8",
                  fontSize: 15, fontWeight: 600, cursor: !sending && email.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {sending ? "Envoi..." : "Envoyer le lien"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
