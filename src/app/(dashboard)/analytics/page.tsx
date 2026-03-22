import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const { organizationId } = session.user;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    totalLeads,
    totalStudents,
    totalPayments,
    overduePayments,
    recentLeads,
    stages,
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId } }),
    prisma.student.count({ where: { organizationId } }),
    prisma.payment.aggregate({
      where: { organizationId, status: "PAID" },
      _sum: { paidAmount: true },
    }),
    prisma.payment.count({
      where: { organizationId, status: "OVERDUE" },
    }),
    prisma.lead.findMany({
      where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
      select: { id: true, createdAt: true, source: true },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: "asc" },
    }),
  ]);

  // Build source breakdown
  const sourceMap: Record<string, number> = {};
  recentLeads.forEach((l) => {
    sourceMap[l.source] = (sourceMap[l.source] || 0) + 1;
  });
  const sourceBreakdown = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Build pipeline funnel
  const funnel = stages
    .filter((s) => !s.isLost)
    .map((s) => ({ name: s.name, count: s._count.leads, color: s.color }));

  // Build leads per day (last 30 days)
  const leadsPerDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const count = recentLeads.filter(
      (l) => l.createdAt.toISOString().slice(0, 10) === key
    ).length;
    leadsPerDay.push({ date: key, count });
  }

  return (
    <DashboardClient
      stats={{
        totalLeads,
        totalStudents,
        totalRevenue: totalPayments._sum.paidAmount || 0,
        overduePayments,
        newLeadsMonth: recentLeads.length,
      }}
      funnel={funnel}
      sourceBreakdown={sourceBreakdown}
      leadsPerDay={leadsPerDay}
    />
  );
}
