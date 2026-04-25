import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Brevo Inbound Parsing webhook
// Configure in Brevo: Transactional > Settings > Inbound Parsing
// URL: https://app.talibcrm.com/api/webhooks/brevo-inbound
//
// Reply-To strategy: emails sent via the CRM use a Reply-To like
//   reply+{leadId}@inbox.yourdomain.com
// When the prospect replies, Brevo Inbound Parsing forwards it here.

export async function POST(request: NextRequest) {
  try {
    var body = await request.json();

    // Brevo sends an array of items
    var items = Array.isArray(body.items) ? body.items : [body];

    var processed = 0;

    for (var item of items) {
      var fromEmail = item.From?.Address || item.from?.email || item.from || "";
      var toEmails: string[] = [];
      if (item.To) {
        if (Array.isArray(item.To)) {
          toEmails = item.To.map(function(t: any) { return t.Address || t.email || t; });
        } else {
          toEmails = [item.To.Address || item.To.email || item.To];
        }
      }
      var subject = item.Subject || item.subject || "";
      var textBody = item.RawTextBody || item.text || item.TextBody || "";
      var htmlBody = item.RawHtmlBody || item.html || item.HtmlBody || "";
      var receivedAt = item.SentAtDate ? new Date(item.SentAtDate) : new Date();
      var brevoMessageId = item.MessageId || item.messageId || null;

      if (!fromEmail) continue;

      // 1. Try to extract leadId from "reply+{leadId}@..." pattern
      var leadId: string | null = null;
      for (var to of toEmails) {
        var match = to.match(/reply\+([a-z0-9-]+)@/i);
        if (match) {
          leadId = match[1];
          break;
        }
      }

      // 2. If no Reply-To match, find lead by sender email
      var lead: { id: string; organizationId: string; firstName: string; lastName: string } | null = null;
      if (leadId) {
        lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { id: true, organizationId: true, firstName: true, lastName: true },
        });
      }
      if (!lead) {
        lead = await prisma.lead.findFirst({
          where: { email: fromEmail },
          select: { id: true, organizationId: true, firstName: true, lastName: true },
        });
      }

      if (!lead) {
        // Optionally create a lead for unknown senders, or just skip
        continue;
      }

      // 3. Create the inbound message
      var newMessage = await prisma.message.create({
        data: {
          channel: "EMAIL",
          direction: "INBOUND",
          content: JSON.stringify({ subject: subject, body: textBody || htmlBody.replace(/<[^>]+>/g, "") }),
          status: "DELIVERED",
          externalId: brevoMessageId,
          sentAt: receivedAt,
          deliveredAt: receivedAt,
          leadId: lead.id,
          organizationId: lead.organizationId,
        },
      });

      // 4. Log MessageEvent
      await prisma.messageEvent.create({
        data: {
          messageId: newMessage.id,
          email: fromEmail,
          event: "REPLIED",
          metadata: { subject: subject, fromEmail: fromEmail, brevoMessageId: brevoMessageId },
        },
      });

      // 5. Log activity
      await prisma.activity.create({
        data: {
          type: "MESSAGE_RECEIVED" as any,
          description: "Réponse email reçue de " + lead.firstName + " " + lead.lastName + (subject ? ": " + subject : ""),
          leadId: lead.id,
          organizationId: lead.organizationId,
        },
      });

      processed++;
    }

    return NextResponse.json({ ok: true, processed: processed });
  } catch (error: any) {
    console.error("[Brevo Inbound]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Brevo inbound parsing endpoint active" });
}