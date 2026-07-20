import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { validatePassword } from "@/lib/password-policy";

// TTL court : un lien de reset est sensible.
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.talibcrm.com";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Demande de réinitialisation : si un compte actif existe pour cet email, crée
 * un token (haché en base) et envoie le lien. Ne révèle JAMAIS à l'appelant si
 * l'email existe (anti-énumération) — l'UI affiche toujours le même message.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true, isActive: true },
  });

  // Compte inexistant ou désactivé → on s'arrête silencieusement.
  if (!user || !user.isActive) return;

  // Un seul token actif à la fois.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${appBaseUrl()}/reset-password?token=${token}`;
  const firstName = (user.name || "").trim().split(/\s+/)[0] || "";

  const res = await sendTransactionalEmail({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe — TalibCRM",
    html: resetEmailHtml(firstName, resetUrl),
    text:
      `Bonjour ${firstName},\n\n` +
      `Vous avez demandé à réinitialiser votre mot de passe TalibCRM. Ouvrez ce lien pour choisir un nouveau mot de passe :\n${resetUrl}\n\n` +
      `Ce lien expire dans 1 heure et ne fonctionne qu'une seule fois.\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.\n\n— L'équipe TalibCRM`,
  });

  if (!res.success) {
    console.error("[password-reset] envoi échoué pour", user.email, ":", res.error);
  }
}

/**
 * Vérifie (sans le consommer) qu'un token de reset existe et n'est pas expiré.
 * Sert à afficher l'état du lien avant que l'utilisateur ne saisisse un mot de passe.
 */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true },
  });
  return record != null && record.expiresAt.getTime() >= Date.now();
}

/**
 * Consomme un token et applique le nouveau mot de passe.
 * Marque aussi l'email comme vérifié (la possession du lien le prouve).
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ status: "ok" } | { status: "invalid" | "expired" } | { status: "weak"; error: string }> {
  if (!token) return { status: "invalid" };
  var pwCheck = validatePassword(newPassword);
  if (!pwCheck.ok) return { status: "weak", error: pwCheck.error };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!record) return { status: "invalid" };

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    return { status: "expired" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, emailVerified: new Date() },
    }),
    // Invalide TOUS les tokens de reset de cet utilisateur (usage unique strict).
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return { status: "ok" };
}

// ─── Gabarit HTML de l'email de reset ───
function resetEmailHtml(firstName: string, resetUrl: string): string {
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2C3E50;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:32px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e6eaee;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="background:linear-gradient(170deg,#0E7C6B,#0A5C50);padding:28px 32px;color:#fff;">' +
    '<span style="font-size:20px;font-weight:700;">TalibCRM</span></td></tr>' +
    '<tr><td style="padding:32px;">' +
    '<h1 style="font-size:20px;margin:0 0 12px;color:#0F1923;">Réinitialisation du mot de passe</h1>' +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">' + greeting + "</p>" +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#475569;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#0E7C6B;">' +
    '<a href="' + resetUrl + '" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Choisir un nouveau mot de passe</a>' +
    "</td></tr></table>" +
    '<p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#94a3b8;">Ce lien expire dans 1 heure et ne fonctionne qu\'une fois. Si le bouton ne marche pas, copiez ce lien :<br>' +
    '<a href="' + resetUrl + '" style="color:#0E7C6B;word-break:break-all;">' + resetUrl + "</a></p>" +
    '<p style="font-size:12px;line-height:1.6;margin:20px 0 0;color:#94a3b8;">Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.</p>' +
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
