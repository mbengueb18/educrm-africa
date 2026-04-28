import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ enabled: false });

  const config = await prisma.chatbotConfig.findUnique({
    where: { organizationId: session.user.organizationId },
    select: { enabled: true },
  });

  return NextResponse.json({ enabled: !!config?.enabled });
}