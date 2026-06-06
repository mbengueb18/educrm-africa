import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { slug: true, name: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  return NextResponse.json({ slug: org.slug, name: org.name });
}