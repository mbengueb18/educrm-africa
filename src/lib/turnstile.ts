// Vérification serveur d'un token Cloudflare Turnstile (CAPTCHA anti-abus au signup).
// Clés : NEXT_PUBLIC_TURNSTILE_SITE_KEY (client) + TURNSTILE_SECRET_KEY (serveur).

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Retourne true si le token est valide (ou si le CAPTCHA n'est pas configuré → dégradé).
 * - Pas de secret configuré → true (ne bloque pas tant que les clés ne sont pas posées).
 * - Token absent alors que le secret EST configuré → false (bot qui contourne le widget).
 * - Erreur réseau vers Cloudflare → true (fail-open : le throttle par IP reste en garde-fou).
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dégradé : CAPTCHA non activé
  if (!token) return false; // widget attendu mais aucun token → refus

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] vérification indisponible (fail-open):", err);
    return true; // incident réseau côté Cloudflare → on ne bloque pas l'inscription
  }
}
