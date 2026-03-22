import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Brevo sends webhook events for email tracking
// Configure in Brevo: Settings > Webhooks > Add webhook
// URL: https://your-app.vercel.app/api/webhooks/brevo
// Events: delivered, opened, click, hard_bounce, soft_bounce, complaint

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

    // Find recipient by brevoMessageId
    var recipient = await prisma.emailCampaignRecipient.findFirst({
      where: { brevoMessageId: messageId },
    });

    if (!recipient) {
      // Try by email if no messageId match (for non-campaign emails)
      return NextResponse.json({ ok: true, skipped: "no matching recipient" });
    }

    // Update recipient based on event type
    switch (event) {
      case "delivered":
        await prisma.emailCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "DELIVERED", deliveredAt: timestamp },
        });
        // Update campaign counter
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
          data: {
            status: "BOUNCED",
            errorMessage: event,
          },
        });
        break;
    }

    return NextResponse.json({ ok: true, event: event, recipientId: recipient.id });
  } catch (error: any) {
    console.error("[Brevo Webhook]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Brevo webhook endpoint active" });
}
