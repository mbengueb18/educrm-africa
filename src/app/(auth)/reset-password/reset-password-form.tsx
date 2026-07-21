"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token, mode = "reset" }: { token: string; mode?: "reset" | "invite" }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const isInvite = mode === "invite";

  const canSubmit = password.length >= 8 && password === confirm && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await resetPasswordAction(token, password, confirm);
      if (res.ok) {
        setDone(true);
        // Redirige vers la connexion après un court instant.
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(res.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    }
    setSaving(false);
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle2 size={32} color="#10B981" />
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0F1923", marginBottom: 10 }}>{isInvite ? "Compte activé ✓" : "Mot de passe modifié ✓"}</h1>
        <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
          {isInvite
            ? "Votre compte est prêt. Redirection vers la connexion..."
            : "Votre mot de passe a bien été mis à jour. Redirection vers la connexion..."}
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F1923", marginBottom: 8 }}>{isInvite ? "Bienvenue sur TalibCRM 👋" : "Nouveau mot de passe"}</h1>
      <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>
        {isInvite
          ? "Créez votre mot de passe pour activer votre compte et vous connecter."
          : "Choisissez un nouveau mot de passe pour votre compte."}
      </p>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>
        </div>
      )}

      <form onSubmit={submit}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
          Nouveau mot de passe <span style={{ fontWeight: 400, color: "#94a3b8" }}>(min. 8 caractères)</span>
        </label>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="new-password" placeholder="••••••••"
            style={{ width: "100%", padding: "12px 40px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            onFocus={(e) => { e.target.style.borderColor = "#2E86C1"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e2e8f0"; }}
          />
          <button type="button" onClick={() => setShow(!show)}
            style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Confirmer le mot de passe</label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            required autoComplete="new-password" placeholder="••••••••"
            style={{
              width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10,
              border: confirm && confirm !== password ? "1.5px solid #EF4444" : "1.5px solid #e2e8f0",
              fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#2E86C1"; }}
            onBlur={(e) => { e.target.style.borderColor = confirm && confirm !== password ? "#EF4444" : "#e2e8f0"; }}
          />
        </div>
        {confirm && confirm !== password && (
          <p style={{ fontSize: 12, color: "#EF4444", marginBottom: 16 }}>Les mots de passe ne correspondent pas</p>
        )}

        <button type="submit" disabled={!canSubmit}
          style={{
            width: "100%", marginTop: 16, padding: "13px 24px", borderRadius: 12, border: "none",
            background: canSubmit ? "#2471A3" : "#e2e8f0", color: canSubmit ? "#fff" : "#94a3b8",
            fontSize: 15, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {saving ? "Enregistrement..." : isInvite ? "Activer mon compte" : "Réinitialiser le mot de passe"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20 }}>
        <Link href="/login" style={{ fontSize: 13, color: "#64748B", textDecoration: "none" }}>Retour à la connexion</Link>
      </p>
    </>
  );
}
