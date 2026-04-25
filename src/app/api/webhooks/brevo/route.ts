import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Brevo sends webhook events for email tracking
// Configure in Brevo: Settings > Webhooks > Add webhook
// URL: https://app.talibcrm.com/api/webhooks/brevo
// Events: delivered, opened, click, hard_bounce, soft_bounce, complaint, unique_opened

const EVENT_MAP: Record<string, "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "BLOCKED" | "SPAM" | "FAILED"> = {
  delivered: "DELIVERED",
  opened: "OPENED",
  unique_opened: "OPENED",
  click: "CLICKED",
  hard_bounce: "BOUNCED",
  soft_bounce: "BOUNCED",
  blocked: "BLOCKED",
  complaint: "SPAM",
  spam: "SPAM",
  invalid_email: "FAILED",
  deferred: "FAILED",
  unsubscribed: "BLOCKED",
};

export async function POST(request: NextRequest) {
  try {
    var body = await request.json();
    var event = body.event;
    var messageId = body["message-id"] || body.messageId;
    var email = body.email;
    var timestamp = body.ts_event ? new Date(body.ts_event * 1000) : new Date();

    if (!event || !messageId) {
      return NextResponse.json({ ok: true, skipped: "missing event or messageId" });
    }

    // 1. Try to find a CAMPAIGN recipient first
    var recipient = await prisma.emailCampaignRecipient.findFirst({
      where: { brevoMessageId: messageId },
    });

    if (recipient) {
      // Handle as campaign event (existing logic)
      switch (event) {
        case "delivered":
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "DELIVERED", deliveredAt: timestamp },
          });
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });
          break;

        case "opened":
        case "unique_opened":
          var isFirstOpen = !recipient.openedAt;
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "OPENED",
              openedAt: recipient.openedAt || timestamp,
              openCount: { increment: 1 },
            },
          });
          if (isFirstOpen) {
            await prisma.emailCampaign.update({
              where: { id: recipient.campaignId },
              data: { openedCount: { increment: 1 } },
            });
          }
          break;

        case "click":
          var isFirstClick = !recipient.clickedAt;
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "CLICKED",
              clickedAt: recipient.clickedAt || timestamp,
              clickCount: { increment: 1 },
            },
          });
          if (isFirstClick) {
            await prisma.emailCampaign.update({
              where: { id: recipient.campaignId },
              data: { clickedCount: { increment: 1 } },
            });
          }
          break;

        case "hard_bounce":
        case "soft_bounce":
        case "blocked":
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "BOUNCED",
              bouncedAt: timestamp,
              errorMessage: body.reason || event,
            },
          });
          await prisma.emailCampaign.update({
            where: { id: recipient.campaignId },
            data: { bouncedCount: { increment: 1 } },
          });
          break;

        case "complaint":
        case "unsubscribed":
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "BOUNCED", errorMessage: event },
          });
          break;
      }

      return NextResponse.json({ ok: true, type: "campaign", event: event, recipientId: recipient.id });
    }

    // 2. Try to find an INDIVIDUAL Message (sent from lead detail)
    var message = await prisma.message.findFirst({
      where: { externalId: messageId, channel: "EMAIL" },
    });

    if (message) {
      var eventType = EVENT_MAP[event];
      if (!eventType) {
        return NextResponse.json({ ok: true, skipped: "unknown event: " + event });
      }

      // Log the event
      await prisma.messageEvent.create({
        data: {
          messageId: message.id,
          email: email,
          event: eventType,
          metadata: body,
        },
      });

      // Update message status
      var newStatus = message.status;
      var updateData: any = {};

      if (event === "delivered") {
        newStatus = "DELIVERED";
        updateData.deliveredAt = timestamp;
      } else if (event === "opened" || event === "unique_opened") {
        newStatus = "READ";
        if (!message.readAt) updateData.readAt = timestamp;
      } else if (event === "hard_bounce" || event === "soft_bounce" || event === "blocked" || event === "invalid_email") {
        newStatus = "FAILED";
      }

      updateData.status = newStatus;

      await prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });

      // Log activity for opens (useful in lead history)
      if ((event === "opened" || event === "unique_opened") && !message.readAt && message.leadId) {
        try {
          var msgContent = JSON.parse(message.content);
          await prisma.activity.create({
            data: {
              type: "MESSAGE_RECEIVED" as any,
              description: "Email ouvert: " + (msgContent.subject || "Sans objet"),
              leadId: message.leadId,
              organizationId: message.organizationId,
            },
          });
        } catch {}
      }

      return NextResponse.json({ ok: true, type: "individual", event: event, messageId: message.id });
    }

    return NextResponse.json({ ok: true, skipped: "no matching message or recipient" });
  } catch (error: any) {
    console.error("[Brevo Webhook]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Brevo webhook endpoint active" });
}