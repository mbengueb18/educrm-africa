"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadAttachment, getAttachmentSignedUrl } from "@/lib/supabase-storage";
import { Resend } from "resend";

interface CreateSupportTicketInput {
  type: "BUG" | "IMPROVEMENT" | "QUESTION";
  priority: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  description: string;
  pageUrl?: string;
  screenshot?: File | null;
}

var TYPE_LABELS: Record<string, string> = {
  BUG: "🐛 Bug",
  IMPROVEMENT: "✨ Amélioration",
  QUESTION: "❓ Question",
};

var PRIORITY_LABELS: Record<string, string> = {
  LOW: "Basse",
  MEDIUM: "Moyenne",
  HIGH: "Haute",
};

export async function createSupportTicket(
  input: CreateSupportTicketInput
): Promise<{ success: boolean; error?: string; ticketId?: string }> {
  var session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié" };

  if (!input.title?.trim()) return { success: false, error: "Le titre est requis" };
  if (!input.description?.trim()) return { success: false, error: "La description est requise" };

  var organizationId = session.user.organizationId;

  var org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  var orgName = org?.name || organizationId;

  try {
    // 1) Créer le ticket d'abord (pour avoir l'id, utilisé comme dossier de stockage)
    var ticket = await prisma.supportTicket.create({
      data: {
        type: input.type,
        priority: input.priority,
        title: input.title.trim(),
        description: input.description.trim(),
        pageUrl: input.pageUrl || null,
        organizationId: organizationId,
        submittedById: session.user.id,
      },
    });

    // 2) Upload de la capture éventuelle
    var screenshotPath: string | null = null;
    if (input.screenshot && input.screenshot.size > 0) {
      try {
        var uploaded = await uploadAttachment(
          input.screenshot,
          input.screenshot.name || "capture.png",
          organizationId,
          "support-" + ticket.id
        );
        screenshotPath = uploaded.path;
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { screenshotPath: screenshotPath },
        });
      } catch (e: any) {
        console.error("[Support] Upload capture échoué", e?.message);
        // On ne bloque pas le ticket si l'upload échoue
      }
    }

    // 3) Notification email vers l'équipe support
    try {
      await sendSupportNotification({
        ticketId: ticket.id,
        type: input.type,
        priority: input.priority,
        title: input.title.trim(),
        description: input.description.trim(),
        pageUrl: input.pageUrl || null,
        screenshotPath: screenshotPath,
        orgName: orgName,
        userName: session.user.name || "Utilisateur",
        userEmail: session.user.email || "",
      });
    } catch (e: any) {
      console.error("[Support] Notification email échouée", e?.message);
      // Le ticket est enregistré même si l'email échoue
    }

    return { success: true, ticketId: ticket.id };
  } catch (e: any) {
    console.error("[Support] Création ticket échouée", e?.message);
    return { success: false, error: "Erreur lors de l'envoi du ticket" };
  }
}

async function sendSupportNotification(data: {
  ticketId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  pageUrl: string | null;
  screenshotPath: string | null;
  orgName: string;
  userName: string;
  userEmail: string;
}) {
  var apiKey = process.env.RESEND_API_KEY;
  var to = process.env.SUPPORT_NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.warn("[Support] RESEND_API_KEY ou SUPPORT_NOTIFICATION_EMAIL manquant — notification non envoyée");
    return;
  }

  var senderEmail = process.env.EMAIL_FROM || "noreply@talibcrm.com";
  var senderName = process.env.EMAIL_FROM_NAME || "TalibCRM";

  // Lien signé vers la capture (valide 7 jours)
  var screenshotLink = "";
  if (data.screenshotPath) {
    try {
      var signed = await getAttachmentSignedUrl(data.screenshotPath, 604800);
      screenshotLink = '<p style="margin:8px 0;"><strong>Capture :</strong> <a href="' + signed + '">Voir la capture d\'écran</a></p>';
    } catch {}
  }

  var priorityColor = data.priority === "HIGH" ? "#DC2626" : data.priority === "MEDIUM" ? "#D97706" : "#6B7280";

  var html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;">' +
    '<div style="background:#1B4F72;padding:20px 24px;border-radius:12px 12px 0 0;">' +
    '<h2 style="margin:0;color:#fff;font-size:18px;">Nouveau ticket support — ' + TYPE_LABELS[data.type] + '</h2>' +
    '</div>' +
    '<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">' +
    '<p style="margin:0 0 12px;"><strong>Titre :</strong> ' + escapeHtml(data.title) + '</p>' +
    '<p style="margin:8px 0;"><strong>Type :</strong> ' + TYPE_LABELS[data.type] + '</p>' +
    '<p style="margin:8px 0;"><strong>Priorité :</strong> <span style="color:' + priorityColor + ';font-weight:600;">' + PRIORITY_LABELS[data.priority] + '</span></p>' +
    '<p style="margin:8px 0;"><strong>Organisation :</strong> ' + escapeHtml(data.orgName) + '</p>' +
    '<p style="margin:8px 0;"><strong>Envoyé par :</strong> ' + escapeHtml(data.userName) + ' (' + escapeHtml(data.userEmail) + ')</p>' +
    (data.pageUrl ? '<p style="margin:8px 0;"><strong>Page :</strong> ' + escapeHtml(data.pageUrl) + '</p>' : '') +
    screenshotLink +
    '<div style="margin:16px 0;padding:16px;background:#f8f9fa;border-radius:8px;">' +
    '<strong>Description :</strong><br/>' +
    '<div style="white-space:pre-wrap;margin-top:8px;color:#374151;">' + escapeHtml(data.description) + '</div>' +
    '</div>' +
    '<p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;">Ticket #' + data.ticketId + '</p>' +
    '</div></div>';

  var resend = new Resend(apiKey);
  await resend.emails.send({
    from: senderName + " <" + senderEmail + ">",
    to: [to],
    subject: "[Support " + data.priority + "] " + TYPE_LABELS[data.type] + " — " + data.title,
    html: html,
    replyTo: data.userEmail || undefined,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}