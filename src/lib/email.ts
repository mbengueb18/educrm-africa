import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { getAttachmentBuffer } from "@/lib/supabase-storage";

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

  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || "noreply@talibcrm.com";
  const senderName = process.env.EMAIL_FROM_NAME || "TalibCRM";
  const inboundDomain = process.env.INBOUND_REPLY_DOMAIN;

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

  // Build Reply-To: prefer custom replyTo, otherwise use inbound pattern with leadId
  let finalReplyTo: string | undefined = replyTo;
  if (!finalReplyTo && leadId && inboundDomain) {
    finalReplyTo = "reply+" + leadId + "@" + inboundDomain;
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

    const { data, error } = await resend.emails.send({
      from: senderName + " <" + senderEmail + ">",
      to: [to],
      subject,
      html: formatEmailHtml(body, subject, senderName),
      text: body,
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
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leads, subject, body, organizationId, sentById } = params;
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

function formatEmailHtml(body: string, subject: string, senderName: string): string {
  const paragraphs = body
    .split("\n")
    .map(function(line) {
      if (!line.trim()) return '<p style="margin:0 0 12px;">&nbsp;</p>';
      return '<p style="margin:0 0 12px;line-height:1.6;color:#2C3E50;">' + line + "</p>";
    })
    .join("");

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="background:#1B4F72;padding:24px 32px;">' +
    '<h1 style="margin:0;color:white;font-size:18px;font-weight:600;">' + subject + "</h1>" +
    "</div>" +
    '<div style="padding:32px;">' + paragraphs + "</div>" +
    '<div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #e5e7eb;">' +
    '<p style="margin:0;font-size:12px;color:#9CA3AF;">Envoye par ' + senderName + " via TalibCRM</p>" +
    "</div></div></body></html>";
}