"use server";

import { resetPasswordWithToken } from "@/lib/password-reset";

export async function resetPasswordAction(
  token: string,
  password: string,
  confirm: string
): Promise<{ ok: boolean; error?: string }> {
  if (password !== confirm) {
    return { ok: false, error: "Les mots de passe ne correspondent pas" };
  }

  const res = await resetPasswordWithToken(token, password);
  if (res.status === "ok") return { ok: true };

  // Le cas "weak" porte son propre message (longueur / mot de passe trop courant).
  if (res.status === "weak") return { ok: false, error: res.error };

  const messages: Record<string, string> = {
    invalid: "Ce lien est invalide ou a déjà été utilisé. Refaites une demande de réinitialisation.",
    expired: "Ce lien a expiré. Refaites une demande de réinitialisation.",
  };
  return { ok: false, error: messages[res.status] || "Une erreur est survenue." };
}
