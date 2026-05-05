"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getLeadJourney(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Vérifier que le lead appartient à l'organisation
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead introuvable");

  // Récupérer le visitor lié à ce lead
  const visitors = await prisma.visitor.findMany({
    where: { leadId, organizationId: session.user.organizationId },
    include: {
      sessions: {
        orderBy: { startedAt: "asc" },
        include: {
          pageViews: {
            orderBy: { viewedAt: "asc" },
          },
        },
      },
    },
  });

  // Toutes les sessions à plat (un visitor peut avoir plusieurs sessions)
  const allSessions = visitors.flatMap((v) => v.sessions);

  // Stats globales
  const totalPageViews = allSessions.reduce((sum, s) => sum + s.pageViews.length, 0);
  const totalEngagedTimeMs = allSessions.reduce((sum, s) => sum + s.engagedTimeMs, 0);

  // Top pages
  const pageCounts: Record<string, { count: number; title: string; totalEngagedMs: number }> = {};
  for (const s of allSessions) {
    for (const pv of s.pageViews) {
      if (!pageCounts[pv.path]) {
        pageCounts[pv.path] = { count: 0, title: pv.title || pv.path, totalEngagedMs: 0 };
      }
      pageCounts[pv.path].count++;
      pageCounts[pv.path].totalEngagedMs += pv.engagedTimeMs || 0;
    }
  }
  const topPages = Object.entries(pageCounts)
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    sessions: allSessions,
    visitorsCount: visitors.length,
    stats: {
      sessionCount: allSessions.length,
      totalPageViews,
      totalEngagedTimeMs,
      topPages,
    },
  };
}