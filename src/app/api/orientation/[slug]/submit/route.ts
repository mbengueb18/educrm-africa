import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { firstName, lastName, phone, email, recommendedProgramId, conversation, traffic } = body;

    if (!firstName?.trim()) {
      return NextResponse.json({ error: "Prénom requis" }, { status: 400 });
    }
    if (!phone?.trim() && !email?.trim()) {
      return NextResponse.json({ error: "Téléphone ou email requis" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!org) return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });

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
    if (traffic) {
      if (traffic.utm_source) customFields._utmSource = traffic.utm_source;
      if (traffic.utm_medium) customFields._utmMedium = traffic.utm_medium;
      if (traffic.utm_campaign) customFields._utmCampaign = traffic.utm_campaign;
      if (traffic._referrer) customFields._referrer = traffic._referrer;
    }
    customFields._orientation_test = true;

    let leadId: string;

    if (existing) {
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED" as any,
          description: "Test orientation IA effectué (lead existant)",
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
          sourceDetail: "Test orientation IA",
          programId: recommendedProgramId || null,
          stageId: defaultStage.id,
          organizationId: org.id,
          customFields,
          score: 70, // Pre-qualified through IA test
        },
      });

      await prisma.activity.create({
        data: {
          type: "LEAD_CREATED",
          description: "Lead via test orientation IA : " + firstName,
          leadId: newLead.id,
          organizationId: org.id,
        },
      });

      leadId = newLead.id;
    }

    // Save conversation as message
    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      const transcript = conversation.map((m: any) =>
        (m.role === "user" ? "👤 Candidat: " : "✨ IA: ") + (typeof m.content === "string" ? m.content : JSON.stringify(m.content))
      ).join("\n\n");

      await prisma.message.create({
        data: {
          channel: "CHATBOT" as any,
          direction: "INBOUND",
          content: JSON.stringify({
            subject: "Test d'orientation IA",
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
    console.error("[Orientation Submit]", error);
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