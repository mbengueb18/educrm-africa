import { prisma } from "@/lib/prisma";

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  leadId?: string;
  organizationId: string;
  sentById?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  dbMessageId?: string;
  error?: string;
  demoMode?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const { to, toName, subject, body, leadId, organizationId, sentById, replyTo } = params;

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || "noreply@educrm.africa";
  const senderName = process.env.EMAIL_FROM_NAME || "EduCRM";

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
      error: "Mode demo: BREVO_API_KEY non configuree. Email enregistre mais pas envoye.",
    };
  }

  try {
    // Brevo Transactional Email API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: formatEmailHtml(body, subject, senderName),
        textContent: body,
        replyTo: replyTo ? { email: replyTo } : undefined,
        tags: ["educrm", "lead-communication"],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
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

      return { success: false, dbMessageId: msg.id, error: result.message || "Erreur Brevo" };
    }

    const msg = await prisma.message.create({
      data: {
        leadId: leadId || null,
        channel: "EMAIL",
        direction: "OUTBOUND",
        content: JSON.stringify({ subject, body }),
        status: "SENT",
        externalId: result.messageId,
        sentById: sentById || null,
        organizationId,
        deliveredAt: new Date(),
      },
    });

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

    return { success: true, messageId: result.messageId, dbMessageId: msg.id };
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
    // Replace variables in subject and body
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

    // Rate limit: 10 emails per second for Brevo free plan
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
    '<p style="margin:0;font-size:12px;color:#9CA3AF;">Envoye par ' + senderName + " via EduCRM Africa</p>" +
    "</div></div></body></html>";
}
