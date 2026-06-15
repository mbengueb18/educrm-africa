import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  var session = await auth();
  if (!session?.user) {
    return NextResponse.json({ connected: false });
  }

  var integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider: "gmail",
      },
    },
    select: { isActive: true, accountEmail: true },
  });

  return NextResponse.json({
    connected: !!(integration && integration.isActive),
    email: integration?.accountEmail || null,
  });
}