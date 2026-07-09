import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { isResetTokenValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — TalibCRM",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = await isResetTokenValid(token || "");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFBFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, border: "1px solid #e6eaee", padding: "36px 32px" }}>
        {valid ? (
          <ResetPasswordForm token={token as string} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <XCircle size={32} color="#DC2626" />
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0F1923", marginBottom: 10 }}>Lien invalide ou expiré</h1>
            <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 24 }}>
              Ce lien de réinitialisation n'est plus valide (déjà utilisé ou expiré). Vous pouvez en demander un nouveau.
            </p>
            <Link href="/forgot-password"
              style={{ display: "inline-flex", alignItems: "center", padding: "12px 24px", borderRadius: 12, background: "#0E7C6B", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Demander un nouveau lien
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
