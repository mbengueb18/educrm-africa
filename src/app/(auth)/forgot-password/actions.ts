"use server";

import { headers } from "next/headers";
import { requestPasswordReset } from "@/lib/password-reset";
import { checkResetThrottle } from "@/lib/signup-guard";

async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * Demande de réinitialisation. Renvoie TOUJOURS { success: true } (le message
 * affiché est générique) pour ne révéler ni l'existence de l'email ni l'état du
 * rate-limit. L'envoi réel n'a lieu que si l'email est valide et non throttlé.
 */
export async function requestPasswordResetAction(email: string): Promise<{ success: boolean }> {
  const clean = (email || "").trim();
  const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);

  const ip = await getClientIp();
  const throttle = await checkResetThrottle(ip);

  if (isValidFormat && throttle.allowed) {
    try {
      await requestPasswordReset(clean);
    } catch (err) {
      console.error("[forgot-password] échec de la demande:", err);
    }
  }

  return { success: true };
}
