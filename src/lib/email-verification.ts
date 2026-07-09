import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";

// Durée de validité d'un lien de vérification.
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.talibcrm.com";
}

/**
 * Génère (et persiste) un token de vérification à usage unique pour un user,
 * en invalidant les précédents. Retourne l'URL de vérification complète.
 */
export async function createVerificationToken(userId: string, email: string): Promise<string> {
  // Un seul token actif à la fois : on supprime les anciens.
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId,
      email: email.toLowerCase().trim(),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return `${appBaseUrl()}/verify?token=${token}`;
}

/**
 * Génère un token puis envoie l'email de vérification.
 * Ne throw pas si l'envoi échoue (le user pourra renvoyer le lien) — on log seulement.
 */
export async function sendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
  const verifyUrl = await createVerificationToken(userId, email);
  const firstName = (name || "").trim().split(/\s+/)[0] || "";

  const html = verificationEmailHtml(firstName, verifyUrl);
  const text =
    `Bonjour ${firstName},\n\n` +
    `Confirmez votre adresse email pour activer votre compte TalibCRM :\n${verifyUrl}\n\n` +
    `Ce lien expire dans 48 heures.\n\n` +
    `Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.\n\n— L'équipe TalibCRM`;

  const res = await sendTransactionalEmail({
    to: email,
    subject: "Confirmez votre adresse email — TalibCRM",
    html,
    text,
  });

  if (!res.success) {
    console.error("[email-verification] envoi échoué pour", email, ":", res.error);
  }
}

/**
 * Valide un token : marque l'email du user comme vérifié et consomme le token.
 * Retourne un statut lisible pour l'UI.
 */
export async function consumeVerificationToken(
  token: string
): Promise<{ status: "verified" | "already" | "expired" | "invalid"; email?: string }> {
  if (!token) return { status: "invalid" };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, emailVerified: true } } },
  });

  if (!record || !record.user) return { status: "invalid" };

  // Déjà vérifié entre-temps → on nettoie et on renvoie "already".
  if (record.user.emailVerified) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } });
    return { status: "already", email: record.user.email };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return { status: "expired", email: record.email };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { status: "verified", email: record.user.email };
}

// ─── Gabarit HTML de l'email de vérification ───
function verificationEmailHtml(firstName: string, verifyUrl: string): string {
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2C3E50;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:32px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e6eaee;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="background:linear-gradient(170deg,#0E7C6B,#0A5C50);padding:28px 32px;color:#fff;">' +
    '<span style="font-size:20px;font-weight:700;">TalibCRM</span></td></tr>' +
    '<tr><td style="padding:32px;">' +
    '<h1 style="font-size:20px;margin:0 0 12px;color:#0F1923;">Confirmez votre adresse email</h1>' +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">' + greeting + "</p>" +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#475569;">Il ne reste qu\'une étape pour activer votre compte : confirmez votre adresse email en cliquant sur le bouton ci-dessous.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0E7C6B;">' +
    '<a href="' + verifyUrl + '" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Confirmer mon email</a>' +
    "</td></tr></table>" +
    '<p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#94a3b8;">Ce lien expire dans 48 heures. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>' +
    '<a href="' + verifyUrl + '" style="color:#0E7C6B;word-break:break-all;">' + verifyUrl + "</a></p>" +
    '<p style="font-size:12px;line-height:1.6;margin:20px 0 0;color:#94a3b8;">Si vous n\'êtes pas à l\'origine de cette inscription, ignorez simplement cet email.</p>' +
    "</td></tr></table></td></tr></table></body></html>"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
