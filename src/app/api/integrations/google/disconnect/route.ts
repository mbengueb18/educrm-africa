import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  var session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  var integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider: "google_calendar",
      },
    },
  });

  if (integration) {
    try {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + integration.accessToken, {
        method: "POST",
      });
    } catch {}

    await prisma.userIntegration.delete({
      where: { id: integration.id },
    });
  }

  return NextResponse.json({ success: true });
}