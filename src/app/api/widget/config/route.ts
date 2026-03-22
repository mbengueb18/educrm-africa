import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint: returns form config for an organization
// GET /api/widget/config?org=ism-dakar
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("org");

  if (!slug) {
    return NextResponse.json({ error: "Paramètre 'org' requis" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      programs: {
        where: { isActive: true },
        select: { id: true, name: true, code: true, level: true },
        orderBy: { name: "asc" },
      },
      campuses: {
        select: { id: true, name: true, city: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
  }

  const response = NextResponse.json({
    organization: org.name,
    logo: org.logo,
    programs: org.programs,
    campuses: org.campuses,
  });

  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Cache-Control", "public, max-age=300"); // 5 min cache

  return response;
}
