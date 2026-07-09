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
