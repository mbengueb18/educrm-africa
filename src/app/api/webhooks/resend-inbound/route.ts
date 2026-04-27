import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

// Resend webhook (inbound + tracking)
// Configure: https://resend.com/webhooks
// URL: https://app.talibcrm.com/api/webhooks/resend-inbound

const TRACKING_EVENTS: Record<string, "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "FAILED" | "BLOCKED"> = {
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "BLOCKED",
  "email.delivery_delayed": "FAILED",
  "email.failed": "FAILED",
};

export async function POST(request: NextRequest) {
  try {
    var body = await request.json();
    var eventType = body.type as string;
    var data = body.data || {};

    // ─── 1. INBOUND EMAIL (received) ───
    if (eventType === "email.received") {
      var fromEmail: string = "";
      if (typeof data.from === "string") {
        fromEmail = data.from;
      } else if (data.from?.email) {
        fromEmail = data.from.email;
      }
      // Extract email from "Name <email@example.com>" format
      var match = fromEmail.match(/<([^>]+)>/);
      if (match) fromEmail = match[1];
      fromEmail = fromEmail.trim().toLowerCase();

      var toEmails: string[] = [];
      if (Array.isArray(data.to)) {
        toEmails = data.to.map(function(t: any) {
          if (typeof t === "string") return t;
          return t.email || "";
        });
      } else if (typeof data.to === "string") {
        toEmails = [data.to];
      }

      var subject = data.subject || "";
      var receivedAt = data.created_at ? new Date(data.created_at) : new Date();
      var resendMessageId = data.email_id || data.id || null;

      // Webhooks don't include the body — fetch it via Resend SDK
      var textBody = "";
      var htmlBody = "";

      if (resendMessageId && process.env.RESEND_API_KEY) {
        try {
          var resend = new Resend(process.env.RESEND_API_KEY);
          var receivingResult = await (resend.emails as any).receiving.get(resendMessageId);
          var emailData = receivingResult?.data || receivingResult;
          if (emailData) {
            textBody = emailData.text || "";
            htmlBody = emailData.html || "";
          } else {
            console.error("[Resend Inbound] No data returned from receiving.get", receivingResult);
          }
        } catch (fetchErr: any) {
          console.error("[Resend Inbound] Error fetching email body", fetchErr?.message || fetchErr);
        }
      }

      // If only HTML, strip tags to get plain text
      if (!textBody && htmlBody) {
        textBody = htmlBody
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+\n/g, "\n")
          .replace(/\n\s+/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }

      console.log("[Resend Inbound] Received email", {
        from: fromEmail,
        to: toEmails,
        subject: subject,
        textBodyLength: textBody.length,
        htmlBodyLength: htmlBody.length,
        resendMessageId: resendMessageId,
      });

      if (!fromEmail) {
        return NextResponse.json({ ok: true, skipped: "no from email" });
      }

      // Try to extract leadId from "reply+{leadId}@..." pattern
      var leadId: string | null = null;
      for (var to of toEmails) {
        var leadMatch = to.match(/reply\+([a-z0-9-]+)@/i);
        if (leadMatch) {
          leadId = leadMatch[1];
          break;
        }
      }

      // Find lead by ID first, then by email
      var lead: { id: string; organizationId: string; firstName: string; lastName: string } | null = null;
      if (leadId) {
        lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { id: true, organizationId: true, firstName: true, lastName: true },
        });
      }
      if (!lead && fromEmail) {
        lead = await prisma.lead.findFirst({
          where: { email: { equals: fromEmail, mode: "insensitive" } },
          select: { id: true, organizationId: true, firstName: true, lastName: true },
        });
      }

      if (!lead) {
        return NextResponse.json({ ok: true, skipped: "no matching lead", from: fromEmail });
      }

      // Create inbound message
      var newMessage = await prisma.message.create({
        data: {
          channel: "EMAIL",
          direction: "INBOUND",
          content: JSON.stringify({
            subject: subject,
            body: textBody || htmlBody.replace(/<[^>]+>/g, "").trim(),
          }),
          status: "DELIVERED",
          externalId: resendMessageId,
          sentAt: receivedAt,
          deliveredAt: receivedAt,
          leadId: lead.id,
          organizationId: lead.organizationId,
        },
      });

      // Save inbound attachments (metadata + downloadable later via signed URL)
      var inboundAttachments = data.attachments || [];
      if (Array.isArray(inboundAttachments) && inboundAttachments.length > 0) {
        for (var att of inboundAttachments) {
          try {
            await prisma.messageAttachment.create({
              data: {
                messageId: newMessage.id,
                filename: att.filename || "fichier",
                contentType: att.content_type || att.contentType || null,
                size: att.size || 0,
                externalId: att.id || null,
              },
            });
          } catch (attErr: any) {
            console.error("[Resend Inbound] Failed to save attachment", attErr?.message);
          }
        }
        console.log("[Resend Inbound] Saved " + inboundAttachments.length + " attachment(s)");
      }

      // Log MessageEvent
      await prisma.messageEvent.create({
        data: {
          messageId: newMessage.id,
          email: fromEmail,
          event: "REPLIED",
          metadata: { subject: subject, fromEmail: fromEmail, resendMessageId: resendMessageId },
        },
      });

      // Activity
      await prisma.activity.create({
        data: {
          type: "MESSAGE_RECEIVED" as any,
          description: "Réponse reçue de " + lead.firstName + " " + lead.lastName + (subject ? ": " + subject : ""),
          leadId: lead.id,
          organizationId: lead.organizationId,
        },
      });

      return NextResponse.json({ ok: true, type: "inbound", leadId: lead.id, messageId: newMessage.id });
    }

    // ─── 2. TRACKING EVENTS (delivered, opened, clicked, bounced...) ───
    var trackingEvent = TRACKING_EVENTS[eventType];
    if (trackingEvent) {
      var emailId = data.email_id || data.id;
      if (!emailId) {
        return NextResponse.json({ ok: true, skipped: "no email_id" });
      }

      var message = await prisma.message.findFirst({
        where: { externalId: emailId, channel: "EMAIL" },
      });

      if (!message) {
        return NextResponse.json({ ok: true, skipped: "no matching outbound message" });
      }

      var timestamp = data.created_at ? new Date(data.created_at) : new Date();

      await prisma.messageEvent.create({
        data: {
          messageId: message.id,
          email: data.to?.[0] || null,
          event: trackingEvent,
          metadata: data,
        },
      });

      var updateData: any = {};
      if (eventType === "email.delivered") {
        updateData.status = "DELIVERED";
        updateData.deliveredAt = timestamp;
      } else if (eventType === "email.opened") {
        updateData.status = "READ";
        if (!message.readAt) updateData.readAt = timestamp;
      } else if (eventType === "email.bounced" || eventType === "email.failed") {
        updateData.status = "FAILED";
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.message.update({ where: { id: message.id }, data: updateData });
      }

      return NextResponse.json({ ok: true, type: "tracking", event: eventType, messageId: message.id });
    }

    return NextResponse.json({ ok: true, skipped: "unknown event type", eventType });
  } catch (error: any) {
    console.error("[Resend Webhook]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Resend webhook endpoint active" });
}