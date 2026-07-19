import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

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

// Vérification de signature Svix (Resend signe ses webhooks via Svix).
// Signature = HMAC-SHA256(base64) de "<svix-id>.<svix-timestamp>.<rawBody>"
// avec le secret (préfixe "whsec_" retiré, décodé base64).
function verifySvixSignature(rawBody: string, headers: Headers, secret: string): boolean {
  try {
    var svixId = headers.get("svix-id");
    var svixTimestamp = headers.get("svix-timestamp");
    var svixSignature = headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) return false;

    // Anti-rejeu : tolérance de 5 minutes
    var ts = parseInt(svixTimestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

    var secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    var signedContent = svixId + "." + svixTimestamp + "." + rawBody;
    var expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    // Le header contient une liste "v1,<sig> v1,<sig2>..."
    return svixSignature.split(" ").some(function(part) {
      var sig = part.split(",")[1];
      if (!sig) return false;
      var a = Buffer.from(sig);
      var b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    var rawBody = await request.text();

    // Sécurité : vérifier la signature Svix si le secret est configuré.
    // (Sans secret configuré, on accepte en loguant — configurer RESEND_WEBHOOK_SECRET au plus vite.)
    var webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!verifySvixSignature(rawBody, request.headers, webhookSecret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[Resend Webhook] RESEND_WEBHOOK_SECRET non configuré — signature NON vérifiée");
    }

    var body = JSON.parse(rawBody);
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

      // Anti-doublon : Resend retente en cas de réponse lente — ne pas recréer le message
      if (resendMessageId) {
        var existingInbound = await prisma.message.findFirst({
          where: { externalId: resendMessageId, direction: "INBOUND", channel: "EMAIL" },
          select: { id: true },
        });
        if (existingInbound) {
          return NextResponse.json({ ok: true, skipped: "duplicate", messageId: existingInbound.id });
        }
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
        // Sécurité multi-tenant : plusieurs orgs peuvent avoir un lead avec ce même email
        // (le domaine reply.talibcrm.com est partagé, il n'identifie pas l'org).
        var candidates = await prisma.lead.findMany({
          where: { email: { equals: fromEmail, mode: "insensitive" } },
          select: { id: true, organizationId: true, firstName: true, lastName: true },
          take: 10,
        });
        if (candidates.length === 1) {
          lead = candidates[0];
        } else if (candidates.length > 1) {
          // Ambigu : rattacher au lead qui a reçu le dernier email SORTANT
          // (une réponse suit un envoi) — sinon skip plutôt que risquer la mauvaise org.
          var lastOutbound = await prisma.message.findFirst({
            where: {
              leadId: { in: candidates.map(function(c) { return c.id; }) },
              direction: "OUTBOUND",
              channel: "EMAIL",
            },
            orderBy: { sentAt: "desc" },
            select: { leadId: true },
          });
          lead = candidates.find(function(c) { return c.id === lastOutbound?.leadId; }) || null;
          if (!lead) {
            console.warn("[Resend Inbound] Email ambigu entre plusieurs organisations, skip:", fromEmail);
            return NextResponse.json({ ok: true, skipped: "ambiguous lead email" });
          }
        }
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

      // Fetch and store inbound attachments to Supabase
      if (resendMessageId && process.env.RESEND_API_KEY) {
        try {
          var resendForAttach = new Resend(process.env.RESEND_API_KEY);
          var attachmentsResult = await (resendForAttach.emails as any).receiving.attachments.list({
            emailId: resendMessageId,
          });

          // Extract array from various possible response shapes
          var fullAttachments: any[] = [];
          if (Array.isArray(attachmentsResult)) {
            fullAttachments = attachmentsResult;
          } else if (Array.isArray(attachmentsResult?.data)) {
            fullAttachments = attachmentsResult.data;
          } else if (Array.isArray(attachmentsResult?.data?.data)) {
            fullAttachments = attachmentsResult.data.data;
          }

          console.log("[Resend Inbound] Found " + fullAttachments.length + " attachment(s) for email " + resendMessageId);

          for (var att of fullAttachments) {
            try {
              // Download the attachment from Resend
              var downloadResponse = await fetch(att.download_url);
              if (!downloadResponse.ok) {
                console.error("[Resend Inbound] Failed to download", att.filename);
                continue;
              }
              var arrayBuffer = await downloadResponse.arrayBuffer();
              var buffer = Buffer.from(arrayBuffer);

              // Upload to Supabase
              var { uploadAttachment } = await import("@/lib/supabase-storage");
              var blob = new Blob([buffer], { type: att.content_type || "application/octet-stream" });
              var { path } = await uploadAttachment(
                blob,
                att.filename || "fichier",
                lead.organizationId,
                lead.id
              );

              await prisma.messageAttachment.create({
                data: {
                  messageId: newMessage.id,
                  filename: att.filename || "fichier",
                  contentType: att.content_type || null,
                  size: buffer.length,
                  storagePath: path,
                  externalId: att.id || null,
                },
              });
              console.log("[Resend Inbound] Saved attachment to Supabase:", att.filename);
            } catch (attErr: any) {
              console.error("[Resend Inbound] Failed to process attachment", attErr?.message);
            }
          }
        } catch (listErr: any) {
          console.error("[Resend Inbound] Failed to list attachments", listErr?.message);
        }
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

      // ─── Mise à jour des stats de CAMPAGNE (si ce message appartient à une campagne) ───
      var campTimestamp = data.created_at ? new Date(data.created_at) : new Date();
      var campRecipient = await prisma.emailCampaignRecipient.findFirst({
        where: { brevoMessageId: emailId },
      });
      if (campRecipient) {
        if (eventType === "email.delivered") {
          await prisma.emailCampaignRecipient.update({
            where: { id: campRecipient.id },
            data: { status: "DELIVERED", deliveredAt: campTimestamp },
          });
          await prisma.emailCampaign.update({
            where: { id: campRecipient.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });
        } else if (eventType === "email.opened") {
          var firstOpen = !campRecipient.openedAt;
          await prisma.emailCampaignRecipient.update({
            where: { id: campRecipient.id },
            data: { status: "OPENED", openedAt: campRecipient.openedAt || campTimestamp, openCount: { increment: 1 } },
          });
          if (firstOpen) {
            await prisma.emailCampaign.update({
              where: { id: campRecipient.campaignId },
              data: { openedCount: { increment: 1 } },
            });
          }
        } else if (eventType === "email.clicked") {
          var firstClick = !campRecipient.clickedAt;
          await prisma.emailCampaignRecipient.update({
            where: { id: campRecipient.id },
            data: { status: "CLICKED", clickedAt: campRecipient.clickedAt || campTimestamp, clickCount: { increment: 1 } },
          });
          if (firstClick) {
            await prisma.emailCampaign.update({
              where: { id: campRecipient.campaignId },
              data: { clickedCount: { increment: 1 } },
            });
          }
        } else if (eventType === "email.bounced" || eventType === "email.failed") {
          await prisma.emailCampaignRecipient.update({
            where: { id: campRecipient.id },
            data: { status: "BOUNCED", bouncedAt: campTimestamp, errorMessage: "bounce" },
          });
          await prisma.emailCampaign.update({
            where: { id: campRecipient.campaignId },
            data: { bouncedCount: { increment: 1 } },
          });
        }
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