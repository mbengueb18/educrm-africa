import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { getAttachmentBuffer } from "@/lib/supabase-storage";
import { sendViaGmail, getGmailIntegration } from "@/lib/gmail-send";
import { isOrgEmailVerified, EMAIL_VERIFICATION_REQUIRED_MESSAGE } from "@/lib/plans/checks";

interface AttachmentInput {
  path: string;          // Supabase Storage path
  filename: string;
  contentType?: string;
  size?: number;
}

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  leadId?: string;
  organizationId: string;
  sentById?: string;
  replyTo?: string;
  attachments?: AttachmentInput[];
  isHtml?: boolean;
  preferUserMailbox?: boolean;
  fromName?: string;
  fromEmail?: string;
  isCampaign?: boolean;
  includeSignature?: boolean; // ajoute la signature de l'expéditeur (défaut: oui)
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  dbMessageId?: string;
  error?: string;
  demoMode?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const { to, toName, subject: rawSubject, body: rawBody, leadId, organizationId, sentById, replyTo } = params;

  // Blocage souple : tant que l'org n'a aucun email vérifié, on n'envoie rien.
  // Choke point unique : tous les envois (1-to-1, bulk, campagnes, séquences,
  // workflows) transitent par cette fonction. Les emails système (vérification)
  // passent par sendTransactionalEmail et ne sont donc pas concernés.
  if (!(await isOrgEmailVerified(organizationId))) {
    return { success: false, error: EMAIL_VERIFICATION_REQUIRED_MESSAGE };
  }

  // Replace variables ({{prenom}}, {{nom}}, {{email}}) using the lead's data
  let subject = rawSubject;
  let body = rawBody;
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (lead) {
      const leadData = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || to,
      };
      subject = replaceVariables(rawSubject, leadData);
      body = replaceVariables(rawBody, leadData);
    }
  }

  // Variable organisation ({{ecole}} / {{organisation}}) — indépendante du lead.
  // On n'interroge la base que si le texte contient réellement la variable.
  if (/\{\{(ecole|organisation)\}\}/i.test(subject) || /\{\{(ecole|organisation)\}\}/i.test(body)) {
    const orgForVars = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const orgNameVar = orgForVars?.name || "";
    subject = subject.replace(/\{\{ecole\}\}/gi, orgNameVar).replace(/\{\{organisation\}\}/gi, orgNameVar);
    body = body.replace(/\{\{ecole\}\}/gi, orgNameVar).replace(/\{\{organisation\}\}/gi, orgNameVar);
  }

  const apiKey = process.env.RESEND_API_KEY;

  // ─── Expéditeur pour l'envoi Resend (repli quand pas d'envoi via Gmail) ───
  // Priorité : domaine vérifié de l'organisation → params → env → noreply.
  let senderEmail = params.fromEmail || process.env.EMAIL_FROM || "noreply@talibcrm.com";
  let senderName = params.fromName || process.env.EMAIL_FROM_NAME || "TalibCRM";
  // Domaine de réception per-org (si réception vérifiée) → sinon repli global plus bas.
  let orgReplyDomain: string | null = null;
  try {
    const orgDomain = await prisma.orgEmailDomain.findUnique({
      where: { organizationId },
      select: { domain: true, fromLocalPart: true, fromName: true, status: true, inboundStatus: true, inboundSubdomain: true },
    });
    if (orgDomain && orgDomain.status === "VERIFIED") {
      senderEmail = orgDomain.fromLocalPart + "@" + orgDomain.domain;
      if (orgDomain.fromName) {
        senderName = orgDomain.fromName;
      } else {
        const orgN = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });
        senderName = orgN?.name || senderName;
      }
    }
    // Réception per-org : les réponses reviennent sur reply.<domaine> uniquement si VÉRIFIÉE.
    if (orgDomain && orgDomain.inboundStatus === "VERIFIED") {
      orgReplyDomain = (orgDomain.inboundSubdomain || "reply") + "." + orgDomain.domain;
    }
  } catch {
    // repli silencieux sur les valeurs par défaut
  }

  // Domaine de réponse : celui de l'org si réception vérifiée, sinon le repli global.
  const inboundDomain = orgReplyDomain || process.env.INBOUND_REPLY_DOMAIN;

  // Build Reply-To: prefer custom replyTo, otherwise use inbound pattern with leadId
  let finalReplyTo: string | undefined = replyTo;
  if (!finalReplyTo && leadId && inboundDomain) {
    finalReplyTo = "reply+" + leadId + "@" + inboundDomain;
  }

  // ─── Signature de l'expéditeur (auto, retirable via includeSignature=false) ───
  // Calculée ici, puis injectée dans les versions HTML **et** texte de chaque canal
  // (Gmail / Resend) → l'image/mise en forme reste visible même en mode "texte".
  let signatureHtml = "";
  let signatureText = "";
  if (params.includeSignature !== false && sentById) {
    try {
      const signer = await prisma.user.findUnique({
        where: { id: sentById },
        select: { emailSignature: true, emailSignatureEnabled: true },
      });
      if (signer?.emailSignatureEnabled && signer.emailSignature && signer.emailSignature.trim()) {
        signatureHtml = '<br><br><div style="color:#555555;font-size:13px;line-height:1.5">' + signer.emailSignature + "</div>";
        signatureText = stripHtmlForText(signer.emailSignature);
      }
    } catch {
      // pas de signature en cas d'erreur
    }
  }

  // ─── Envoi 1-to-1 via la boîte Gmail de l'utilisateur (si connectée) ───
  // Placé AVANT le mode démo : Gmail est un vrai canal d'envoi, indépendant de Resend.
  if (params.preferUserMailbox && sentById) {
    var gmailIntegration = await getGmailIntegration(sentById);
    if (gmailIntegration && gmailIntegration.isActive) {
      var sender = await prisma.user.findUnique({
        where: { id: sentById },
        select: { name: true },
      });

      var gHtml = params.isHtml ? (body + signatureHtml) : formatEmailHtml(body, subject, sender?.name || "TalibCRM", signatureHtml);
      var gText = (params.isHtml ? stripHtmlForText(body) : body) + (signatureText ? "\n\n" + signatureText : "");

      var gmailResult = await sendViaGmail({
        userId: sentById,
        to,
        subject,
        htmlBody: gHtml,
        textBody: gText,
        fromName: sender?.name || undefined,
        replyTo: finalReplyTo,
        attachments: params.attachments?.map(function(a) {
          return { path: a.path, filename: a.filename, contentType: a.contentType };
        }),
      });

      if (gmailResult.success) {
        var gMsg = await prisma.message.create({
          data: {
            leadId: leadId || null,
            channel: "EMAIL",
            direction: "OUTBOUND",
            content: JSON.stringify({ subject, body }),
            status: "SENT",
            externalId: gmailResult.messageId,
            sentById: sentById || null,
            organizationId,
            deliveredAt: new Date(),
            isCampaign: params.isCampaign || false,
          },
        });

        if (params.attachments && params.attachments.length > 0) {
          await prisma.messageAttachment.createMany({
            data: params.attachments.map(function(att) {
              return {
                messageId: gMsg.id,
                filename: att.filename,
                contentType: att.contentType || null,
                storagePath: att.path,
                size: att.size || 0,
              };
            }),
          });
        }

        if (leadId) {
          await prisma.activity.create({
            data: {
              type: "MESSAGE_SENT",
              description: "Email envoyé via Gmail (" + (gmailResult.fromEmail || "") + "): " + subject,
              userId: sentById || null,
              leadId,
              organizationId,
            },
          });
        }

        return { success: true, messageId: gmailResult.messageId, dbMessageId: gMsg.id };
      } else {
        var gFailMsg = await prisma.message.create({
          data: {
            leadId: leadId || null,
            channel: "EMAIL",
            direction: "OUTBOUND",
            content: JSON.stringify({ subject, body }),
            status: "FAILED",
            sentById: sentById || null,
            organizationId,
            isCampaign: params.isCampaign || false,
          },
        });
        return {
          success: false,
          dbMessageId: gFailMsg.id,
          error: gmailResult.error || "Échec de l'envoi via votre boîte Gmail. Reconnectez-la dans les réglages.",
        };
      }
    }
    // Pas d'intégration Gmail active → on continue (démo ou Resend)
  }

  // Demo mode if no API key
  if (!apiKey) {
    const msg = await prisma.message.create({
      data: {
        leadId: leadId || null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: JSON.stringify({ subject, body }),
        status: "QUEUED",
        sentById: sentById || null,
        organizationId,
        isCampaign: params.isCampaign || false,
      },
    });

    if (leadId) {
      await prisma.activity.create({
        data: {
          type: "MESSAGE_SENT",
          description: "Email envoye (mode demo): " + subject,
          userId: sentById || null,
          leadId,
          organizationId,
        },
      });
    }

    return {
      success: true,
      dbMessageId: msg.id,
      demoMode: true,
      error: "Mode demo: RESEND_API_KEY non configuree. Email enregistre mais pas envoye.",
    };
  }

  try {
    const resend = new Resend(apiKey);

    // Build attachments list (download from Supabase + base64 encode)
    let resendAttachments: { filename: string; content: Buffer; contentType?: string }[] | undefined;
    if (params.attachments && params.attachments.length > 0) {
      resendAttachments = [];
      for (const att of params.attachments) {
        try {
          const buffer = await getAttachmentBuffer(att.path);
          resendAttachments.push({
            filename: att.filename,
            content: buffer,
            contentType: att.contentType,
          });
        } catch (attErr: any) {
          console.error("[Email] Failed to load attachment", att.filename, attErr.message);
        }
      }
    }

    const finalHtml = params.isHtml ? (body + signatureHtml) : formatEmailHtml(body, subject, senderName, signatureHtml);
    const finalText = (params.isHtml ? stripHtmlForText(body) : body) + (signatureText ? "\n\n" + signatureText : "");

    const { data, error } = await resend.emails.send({
      from: senderName + " <" + senderEmail + ">",
      to: [to],
      subject,
      html: finalHtml,
      text: finalText,
      replyTo: finalReplyTo,
      attachments: resendAttachments,
      tags: [
        { name: "category", value: "lead-communication" },
        { name: "source", value: "educrm" },
      ],
    });

    if (error || !data) {
      const msg = await prisma.message.create({
        data: {
          leadId: leadId || null,
          channel: "EMAIL",
          direction: "OUTBOUND",
          content: JSON.stringify({ subject, body }),
          status: "FAILED",
          sentById: sentById || null,
          organizationId,
          isCampaign: params.isCampaign || false,
        },
      });

      return { success: false, dbMessageId: msg.id, error: error?.message || "Erreur Resend" };
    }

    const msg = await prisma.message.create({
      data: {
        leadId: leadId || null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: JSON.stringify({ subject, body }),
        status: "SENT",
        externalId: data.id,
        sentById: sentById || null,
        organizationId,
        isCampaign: params.isCampaign || false,
        deliveredAt: new Date(),
      },
    });

    // Save outgoing attachments (link them to the message)
    if (params.attachments && params.attachments.length > 0) {
      await prisma.messageAttachment.createMany({
        data: params.attachments.map(function(att) {
          return {
            messageId: msg.id,
            filename: att.filename,
            contentType: att.contentType || null,
            storagePath: att.path,
            size: att.size || 0,
          };
        }),
      });
    }

    if (leadId) {
      await prisma.activity.create({
        data: {
          type: "MESSAGE_SENT",
          description: "Email envoye: " + subject,
          userId: sentById || null,
          leadId,
          organizationId,
        },
      });
    }

    return { success: true, messageId: data.id, dbMessageId: msg.id };
  } catch (error: any) {
    const msg = await prisma.message.create({
      data: {
        leadId: leadId || null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: JSON.stringify({ subject, body }),
        status: "FAILED",
        sentById: sentById || null,
        organizationId,
        isCampaign: params.isCampaign || false,
      },
    });

    return { success: false, dbMessageId: msg.id, error: error.message || "Erreur réseau" };
  }
}

// ─── Send bulk emails ───
export async function sendBulkEmail(params: {
  leads: { id: string; email: string; firstName: string; lastName: string }[];
  subject: string;
  body: string;
  organizationId: string;
  sentById: string;
  isHtml?: boolean;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leads, subject, body, organizationId, sentById, isHtml } = params;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    const personalizedSubject = replaceVariables(subject, lead);
    const personalizedBody = replaceVariables(body, lead);

    const result = await sendEmail({
      to: lead.email,
      toName: lead.firstName + " " + lead.lastName,
      subject: personalizedSubject,
      body: personalizedBody,
      leadId: lead.id,
      organizationId,
      sentById,
      isHtml,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(lead.email + ": " + (result.error || "Erreur inconnue"));
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  return { sent, failed, errors };
}

function replaceVariables(text: string, lead: { firstName: string; lastName: string; email: string }): string {
  return text
    .replace(/\{\{prenom\}\}/gi, lead.firstName)
    .replace(/\{\{firstName\}\}/gi, lead.firstName)
    .replace(/\{\{nom\}\}/gi, lead.lastName)
    .replace(/\{\{lastName\}\}/gi, lead.lastName)
    .replace(/\{\{email\}\}/gi, lead.email);
}

// Template des emails envoyés (mode texte) — conteneur centré 600px, pas de débordement.
function formatEmailHtml(body: string, subject: string, senderName: string, signatureHtml: string = ""): string {
  const paragraphs = body
    .split("\n")
    .map(function(line) {
      if (!line.trim()) return '<p style="margin:0 0 12px;">&nbsp;</p>';
      return '<p style="margin:0 0 12px;line-height:1.6;color:#2C3E50;word-break:break-word;overflow-wrap:break-word;">' + line + "</p>";
    })
    .join("");

  const sig = signatureHtml ? '<div style="max-width:100%;overflow:hidden;">' + signatureHtml + "</div>" : "";

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>img{max-width:100%;height:auto;}</style></head>" +
    '<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#2C3E50;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e6eaee;border-radius:12px;">' +
    '<tr><td style="padding:28px 32px;font-size:14px;line-height:1.6;color:#2C3E50;">' + paragraphs + sig + "</td></tr>" +
    "</table></td></tr></table></body></html>";
}

function stripHtmlForText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}