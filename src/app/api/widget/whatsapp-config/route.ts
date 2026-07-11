import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Config JSON du widget WhatsApp, consommée par le tracker ecrm.js (comme /api/chatbot/config).
// Renvoie { enabled: false } si le widget est off, l'intégration inactive ou le numéro absent.
// Usage : GET /api/widget/whatsapp-config?org=<slug>

export async function GET(request: NextRequest) {
  const slug =
    request.nextUrl.searchParams.get("org") ||
    request.nextUrl.searchParams.get("id") ||
    "";

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60, s-maxage=60",
  };
  const disabled = () => NextResponse.json({ enabled: false }, { headers: CORS });

  if (!slug) return disabled();

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        whatsappWidgetConfig: true,
        whatsappIntegration: {
          select: { isActive: true, displayPhoneNumber: true },
        },
      },
    });

    const config = org?.whatsappWidgetConfig;
    const integration = org?.whatsappIntegration;

    if (!config?.enabled || !integration?.isActive || !integration.displayPhoneNumber) {
      return disabled();
    }

    // wa.me exige le numéro au format international sans + ni espaces.
    const number = integration.displayPhoneNumber.replace(/\D/g, "");
    if (!number) return disabled();

    return NextResponse.json(
      {
        enabled: true,
        number,
        title: config.title,
        welcome: config.welcomeMessage,
        replyTime: config.replyTimeText,
        prefill: config.prefilledMessage,
        color: config.primaryColor,
        position: config.position === "bottom-left" ? "bottom-left" : "bottom-right",
      },
      { headers: CORS }
    );
  } catch {
    return disabled();
  }
}
