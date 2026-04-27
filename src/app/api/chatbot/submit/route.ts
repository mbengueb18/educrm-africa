import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, firstName, lastName, phone, email, message, programLevel, traffic, history } = body;

    if (!slug) {
      return NextResponse.json({ error: "slug requis" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

    if (!firstName?.trim() || (!phone?.trim() && !email?.trim())) {
      return NextResponse.json({ error: "Informations insuffisantes" }, { status: 400 });
    }

    const defaultStage = await prisma.pipelineStage.findFirst({
      where: { organizationId: org.id, isDefault: true },
    });
    if (!defaultStage) return NextResponse.json({ error: "Configuration incomplète" }, { status: 500 });

    // Check duplicate
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          ...(phone ? [{ phone: phone.trim() }] : []),
          ...(email ? [{ email: { equals: email.trim().toLowerCase(), mode: "insensitive" as const } }] : []),
        ],
      },
    });

    var customFields: any = {};
    if (programLevel) customFields.education_level = programLevel;
    if (message) customFields._chatbot_message = message;
    if (traffic) {
      if (traffic.utm_source) customFields._utmSource = traffic.utm_source;
      if (traffic.utm_medium) customFields._utmMedium = traffic.utm_medium;
      if (traffic.utm_campaign) customFields._utmCampaign = traffic.utm_campaign;
      if (traffic._referrer) customFields._referrer = traffic._referrer;
    }

    let leadId: string;

    if (existing) {
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED" as any,
          description: "Conversation chatbot reçue (lead existant)" + (message ? " - " + message : ""),
          leadId: existing.id,
          organizationId: org.id,
        },
      });
      leadId = existing.id;
    } else {
      const newLead = await prisma.lead.create({
        data: {
          firstName: firstName.trim(),
          lastName: (lastName || "").trim() || "—",
          email: email?.trim().toLowerCase() || null,
          phone: phone?.trim() || "",
          whatsapp: phone?.trim() || null,
          source: "WEBSITE",
          sourceDetail: "Chatbot",
          stageId: defaultStage.id,
          organizationId: org.id,
          customFields,
        },
      });

      await prisma.activity.create({
        data: {
          type: "LEAD_CREATED",
          description: "Lead via chatbot : " + firstName + (message ? " - " + message : ""),
          leadId: newLead.id,
          organizationId: org.id,
        },
      });

      leadId = newLead.id;
    }
    // Save conversation as a message in the inbox
    if (history && Array.isArray(history) && history.length > 0) {
      var transcript = history.map(function(h: any) {
        return (h.from === "bot" ? "🤖 Bot: " : "👤 Visiteur: ") + h.text;
      }).join("\n");

      await prisma.message.create({
        data: {
          channel: "CHATBOT" as any,
          direction: "INBOUND",
          content: JSON.stringify({
            subject: "Conversation chatbot",
            body: transcript,
          }),
          status: "DELIVERED",
          sentAt: new Date(),
          deliveredAt: new Date(),
          leadId: leadId,
          organizationId: org.id,
        },
      });
    }

    return NextResponse.json({ success: true, leadId }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("[Chatbot Submit]", error);
    return NextResponse.json({ error: error.message || "Erreur" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}