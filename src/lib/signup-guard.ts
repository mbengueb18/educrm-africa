import { prisma } from "@/lib/prisma";

// Domaines d'emails jetables les plus courants (bloqués à l'inscription publique).
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "yopmail.com", "yopmail.fr", "guerrillamail.com", "guerrillamail.info",
  "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net", "temp-mail.org",
  "tempmail.com", "tempmailo.com", "throwawaymail.com", "trashmail.com", "getnada.com",
  "nada.email", "maildrop.cc", "mohmal.com", "fakeinbox.com", "dispostable.com",
  "mailnesia.com", "spam4.me", "tempr.email", "emailondeck.com", "moakt.com",
  "mailsac.com", "inboxbear.com", "burnermail.io", "temp-mail.io", "tmail.ws",
  "discard.email", "mailcatch.com", "spambog.com", "mytemp.email", "1secmail.com",
]);

/**
 * Bloque les domaines d'emails jetables (anti-abus).
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().trim().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Limiteur de débit générique (fenêtre glissante simple en base), clé = `key`.
 * La table `SignupThrottle` sert de stockage : sa PK `ip` porte en fait une clé
 * arbitraire préfixée par scope (ex : `signup:1.2.3.4`, `pwreset:1.2.3.4`).
 * En cas d'erreur (ex : clé absente), laisse passer pour ne jamais bloquer un
 * utilisateur légitime à cause d'un souci d'infra.
 */
export async function checkRateLimit(
  key: string | null,
  max: number,
  windowMs: number = HOUR_MS
): Promise<{ allowed: boolean }> {
  if (!key) return { allowed: true };

  try {
    const now = new Date();
    const existing = await prisma.signupThrottle.findUnique({ where: { ip: key } });

    // Pas d'entrée ou fenêtre expirée → (ré)initialise le compteur à 1.
    if (!existing || now.getTime() - existing.windowStart.getTime() > windowMs) {
      await prisma.signupThrottle.upsert({
        where: { ip: key },
        create: { ip: key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { allowed: true };
    }

    if (existing.count >= max) {
      return { allowed: false };
    }

    await prisma.signupThrottle.update({
      where: { ip: key },
      data: { count: { increment: 1 } },
    });
    return { allowed: true };
  } catch (err) {
    console.error("[signup-guard] rate-limit indisponible, on laisse passer:", err);
    return { allowed: true };
  }
}

/** Limiteur d'inscriptions : max 5/heure/IP. */
export async function checkSignupThrottle(ip: string | null): Promise<{ allowed: boolean }> {
  return checkRateLimit(ip ? "signup:" + ip : null, 5, HOUR_MS);
}

/** Limiteur de demandes de reset : max 5/heure/IP. */
export async function checkResetThrottle(ip: string | null): Promise<{ allowed: boolean }> {
  return checkRateLimit(ip ? "pwreset:" + ip : null, 5, HOUR_MS);
}

// ─── Anti-bruteforce de connexion (comptage d'ÉCHECS par IP) ───
// Clé sur l'IP seule (pas l'email) : un lockout par email permettrait à un
// attaquant de bloquer volontairement la connexion d'une victime.
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min
// Seuil volontairement large : les écoles partagent souvent une IP (NAT bureau).
// Le reset au succès (clearLoginAttempts) efface le compteur dès qu'un utilisateur
// de l'IP se connecte → un vrai bruteforce (des milliers d'essais sans succès) est
// stoppé, sans bloquer un bureau où quelques personnes se trompent.
const MAX_LOGIN_FAILURES = 20; // au-delà : connexions refusées jusqu'à la fin de la fenêtre

/** Vrai si trop d'échecs de connexion récents pour cette IP. Fail-open en cas d'erreur. */
export async function isLoginThrottled(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  try {
    const existing = await prisma.signupThrottle.findUnique({ where: { ip: "login:" + ip } });
    if (!existing) return false;
    if (Date.now() - existing.windowStart.getTime() > LOGIN_WINDOW_MS) return false; // fenêtre expirée
    return existing.count >= MAX_LOGIN_FAILURES;
  } catch (err) {
    console.error("[signup-guard] vérif throttle login indisponible, on laisse passer:", err);
    return false;
  }
}

/** Incrémente le compteur d'échecs de connexion (fenêtre glissante de 15 min). */
export async function recordLoginFailure(ip: string | null): Promise<void> {
  if (!ip) return;
  const key = "login:" + ip;
  try {
    const now = new Date();
    const existing = await prisma.signupThrottle.findUnique({ where: { ip: key } });
    if (!existing || now.getTime() - existing.windowStart.getTime() > LOGIN_WINDOW_MS) {
      await prisma.signupThrottle.upsert({
        where: { ip: key },
        create: { ip: key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
    } else {
      await prisma.signupThrottle.update({ where: { ip: key }, data: { count: { increment: 1 } } });
    }
  } catch (err) {
    console.error("[signup-guard] enregistrement échec login impossible:", err);
  }
}

/** Réinitialise le compteur d'échecs après une connexion réussie. */
export async function clearLoginAttempts(ip: string | null): Promise<void> {
  if (!ip) return;
  try {
    await prisma.signupThrottle.deleteMany({ where: { ip: "login:" + ip } });
  } catch {
    // non bloquant
  }
}
