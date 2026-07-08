import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLeadScores } from "@/app/(dashboard)/pipeline/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

// Recalcule quotidiennement le score de tous les leads non convertis, par organisation.
// Sert de filet de sécurité (backfill des leads à 0) et garde les scores à jour
// (interactions, récence) sans coût au chargement des pages.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.lead.findMany({
    where: { isConverted: false },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  let updated = 0;
  const failed: string[] = [];
  for (const { organizationId } of orgs) {
    try {
      const r = await calculateLeadScores(organizationId);
      updated += r.updated;
    } catch (e: any) {
      console.error("[cron/lead-scores] org " + organizationId + " failed:", e?.message);
      failed.push(organizationId);
    }
  }

  return NextResponse.json({ ok: true, organizations: orgs.length, leadsUpdated: updated, failed });
}
