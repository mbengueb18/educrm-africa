import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { createPasswordResetTokenFor } from "@/lib/password-reset";

// Un lien d'invitation vit plus longtemps qu'un reset : un nouvel utilisateur peut
// mettre plusieurs jours avant d'ouvrir son email.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.talibcrm.com";
}

/**
 * (Re)envoie à un utilisateur son email d'invitation : un lien pour créer son mot de
 * passe et activer son compte. Réutilise le mécanisme de token du reset (le même
 * `resetPasswordWithToken` définit le mot de passe ET marque l'email vérifié).
 *
 * Ne throw pas si l'envoi échoue — on log et on retourne le statut (l'admin peut renvoyer).
 */
export async function sendUserInvitation(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      organization: { select: { name: true } },
    },
  });

  if (!user) return { success: false, error: "Utilisateur introuvable" };
  if (!user.isActive) return { success: false, error: "Compte désactivé" };

  const token = await createPasswordResetTokenFor(user.id, INVITE_TTL_MS);
  const activateUrl = `${appBaseUrl()}/activate?token=${token}`;
  const firstName = (user.name || "").trim().split(/\s+/)[0] || "";
  const schoolName = user.organization?.name || "votre établissement";

  const res = await sendTransactionalEmail({
    to: user.email,
    subject: `Votre accès à TalibCRM — ${schoolName}`,
    html: invitationEmailHtml(firstName, schoolName, activateUrl),
    text:
      `Bonjour ${firstName},\n\n` +
      `Un compte TalibCRM vient d'être créé pour vous par ${schoolName}.\n` +
      `Créez votre mot de passe pour activer votre accès :\n${activateUrl}\n\n` +
      `Ce lien expire dans 7 jours.\n\n` +
      `Si vous ne vous attendiez pas à cet email, ignorez-le.\n\n— L'équipe TalibCRM`,
  });

  if (!res.success) {
    console.error("[user-invitation] envoi échoué pour", user.email, ":", res.error);
    return { success: false, error: res.error };
  }
  return { success: true };
}

// ─── Gabarit HTML de l'email d'invitation ───
function invitationEmailHtml(firstName: string, schoolName: string, activateUrl: string): string {
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  const school = escapeHtml(schoolName);
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2C3E50;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:32px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border:1px solid #e6eaee;border-radius:14px;overflow:hidden;">' +
    '<tr><td style="background:linear-gradient(170deg,#1B4F72,#0E2F44);padding:28px 32px;color:#fff;">' +
    '<span style="font-size:20px;font-weight:700;">TalibCRM</span></td></tr>' +
    '<tr><td style="padding:32px;">' +
    '<h1 style="font-size:20px;margin:0 0 12px;color:#0F1923;">Vous avez été ajouté à ' + school + "</h1>" +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">' + greeting + "</p>" +
    '<p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#475569;">Un compte TalibCRM vient d\'être créé pour vous par <strong>' + school + '</strong>. Créez votre mot de passe pour activer votre accès et vous connecter.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#2E86C1;">' +
    '<a href="' + activateUrl + '" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Créer mon mot de passe</a>' +
    "</td></tr></table>" +
    '<p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#94a3b8;">Ce lien expire dans 7 jours. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>' +
    '<a href="' + activateUrl + '" style="color:#2471A3;word-break:break-all;">' + activateUrl + "</a></p>" +
    '<p style="font-size:12px;line-height:1.6;margin:20px 0 0;color:#94a3b8;">Si vous ne vous attendiez pas à cet email, ignorez-le simplement.</p>' +
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
