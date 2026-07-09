import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, XCircle, Clock, Mail } from "lucide-react";
import { consumeVerificationToken } from "@/lib/email-verification";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Vérification de l'email — TalibCRM",
};

// Toujours dynamique : consomme le token à chaque visite du lien.
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await consumeVerificationToken(token || "");
  const session = await auth();
  const loggedIn = !!session?.user;

  const views = {
    verified: {
      icon: <CheckCircle2 size={40} color="#10B981" />,
      bg: "#ECFDF5",
      title: "Email confirmé ! 🎉",
      body: "Votre adresse a bien été vérifiée. Vous pouvez maintenant envoyer des emails et des campagnes depuis TalibCRM.",
    },
    already: {
      icon: <CheckCircle2 size={40} color="#10B981" />,
      bg: "#ECFDF5",
      title: "Déjà confirmé",
      body: "Cette adresse email a déjà été vérifiée. Vous pouvez utiliser TalibCRM normalement.",
    },
    expired: {
      icon: <Clock size={40} color="#B45309" />,
      bg: "#FFFBEB",
      title: "Lien expiré",
      body: "Ce lien de vérification a expiré. Connectez-vous, puis cliquez sur « Renvoyer l'email » depuis la bannière en haut de votre tableau de bord.",
    },
    invalid: {
      icon: <XCircle size={40} color="#DC2626" />,
      bg: "#FEF2F2",
      title: "Lien invalide",
      body: "Ce lien de vérification n'est pas valide ou a déjà été utilisé. Connectez-vous pour en demander un nouveau.",
    },
  } as const;

  const v = views[result.status];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFBFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, border: "1px solid #e6eaee", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: v.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          {v.icon}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F1923", marginBottom: 12 }}>{v.title}</h1>
        <p style={{ fontSize: 14.5, color: "#64748B", lineHeight: 1.7, marginBottom: 28 }}>{v.body}</p>

        <Link
          href={loggedIn ? "/pipeline" : "/login"}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 12, background: "#0E7C6B", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none" }}
        >
          <Mail size={16} />
          {loggedIn ? "Aller à mon tableau de bord" : "Se connecter"}
        </Link>
      </div>
    </div>
  );
}
