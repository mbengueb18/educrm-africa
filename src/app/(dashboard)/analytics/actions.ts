"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getDashboardData(filters?: {
  period?: string; // "7d" | "30d" | "90d" | "12m"
  userId?: string;
  campusId?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;
  var now = new Date();
  var period = filters?.period || "30d";

  // Calculate date ranges
  var daysBack = period === "7d" ? 7 : period === "90d" ? 90 : period === "12m" ? 365 : 30;
  var currentStart = new Date(now.getTime() - daysBack * 86_400_000);
  var previousStart = new Date(currentStart.getTime() - daysBack * 86_400_000);
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEnd = new Date(todayStart.getTime() + 86_400_000);
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var weekStart = new Date(now.getTime() - 7 * 86_400_000);

  // Base filter for scoped queries
  var baseWhere: any = { organizationId: orgId };
  if (filters?.userId) baseWhere.assignedToId = filters.userId;
  if (filters?.campusId) baseWhere.campusId = filters.campusId;

  // ─── MAIN KPIs (current vs previous period) ───
  var [
    leadsCurrentPeriod, leadsPreviousPeriod,
    convertedCurrentPeriod, convertedPreviousPeriod,
    totalLeads, totalStudents, activeStudents,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: currentStart } } }),
    prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.lead.count({ where: { ...baseWhere, isConverted: true, convertedAt: { gte: currentStart } } }),
    prisma.lead.count({ where: { ...baseWhere, isConverted: true, convertedAt: { gte: previousStart, lt: currentStart } } }),
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.student.count({ where: { organizationId: orgId } }),
    prisma.student.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
  ]);

  var leadsGrowth = leadsPreviousPeriod > 0 ? Math.round(((leadsCurrentPeriod - leadsPreviousPeriod) / leadsPreviousPeriod) * 100) : 0;
  var conversionRate = leadsCurrentPeriod > 0 ? Math.round((convertedCurrentPeriod / leadsCurrentPeriod) * 100) : 0;
  var conversionGrowth = convertedPreviousPeriod > 0 ? Math.round(((convertedCurrentPeriod - convertedPreviousPeriod) / convertedPreviousPeriod) * 100) : 0;

  // ─── CALLS & APPOINTMENTS KPIs ───
  var callBaseWhere: any = { organizationId: orgId };
  if (filters?.userId) callBaseWhere.calledById = filters.userId;

  var apptBaseWhere: any = { organizationId: orgId };
  if (filters?.userId) apptBaseWhere.assignedToId = filters.userId;

  var [
    callsTotal, callsToday, callsThisWeek, callsAnswered, callsAvgDuration,
    apptsTotal, apptsToday, apptsThisWeek, apptsCompleted, apptsNoShow,
    tasksOpen, tasksOverdue,
  ] = await Promise.all([
    prisma.call.count({ where: { ...callBaseWhere, calledAt: { gte: currentStart } } }),
    prisma.call.count({ where: { ...callBaseWhere, calledAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.call.count({ where: { ...callBaseWhere, calledAt: { gte: weekStart } } }),
    prisma.call.count({ where: { ...callBaseWhere, calledAt: { gte: currentStart }, outcome: "ANSWERED" } }),
    prisma.call.aggregate({ where: { ...callBaseWhere, calledAt: { gte: currentStart }, duration: { not: null } }, _avg: { duration: true } }),
    prisma.appointment.count({ where: { ...apptBaseWhere, startAt: { gte: currentStart } } }),
    prisma.appointment.count({ where: { ...apptBaseWhere, startAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { ...apptBaseWhere, startAt: { gte: weekStart } } }),
    prisma.appointment.count({ where: { ...apptBaseWhere, startAt: { gte: currentStart }, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { ...apptBaseWhere, startAt: { gte: currentStart }, status: "NO_SHOW" } }),
    prisma.task.count({ where: { organizationId: orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { organizationId: orgId, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
  ]);

  var callReachRate = callsTotal > 0 ? Math.round((callsAnswered / callsTotal) * 100) : 0;
  var avgDuration = Math.round(callsAvgDuration._avg.duration || 0);
  var apptPresenceRate = (apptsCompleted + apptsNoShow) > 0 ? Math.round((apptsCompleted / (apptsCompleted + apptsNoShow)) * 100) : 0;

  // ─── LEADS TIMELINE (daily) ───
  var leadsRaw = await prisma.lead.findMany({
    where: { ...baseWhere, createdAt: { gte: currentStart } },
    select: { createdAt: true, isConverted: true, convertedAt: true },
  });

  var leadsTimeline: { date: string; leads: number; conversions: number }[] = [];
  for (var i = 0; i < daysBack; i++) {
    var d = new Date(now.getTime() - (daysBack - 1 - i) * 86_400_000);
    var key = d.toISOString().split("T")[0];
    var dayLeads = leadsRaw.filter(function(l) { return new Date(l.createdAt).toISOString().split("T")[0] === key; }).length;
    var dayConversions = leadsRaw.filter(function(l) { return l.isConverted && l.convertedAt && new Date(l.convertedAt).toISOString().split("T")[0] === key; }).length;
    leadsTimeline.push({ date: key, leads: dayLeads, conversions: dayConversions });
  }

  // ─── PIPELINE CONVERSION FUNNEL ───
  var stages = await prisma.pipelineStage.findMany({
    where: { organizationId: orgId, isLost: false },
    include: { _count: { select: { leads: true } } },
    orderBy: { order: "asc" },
  });

  var lostStage = await prisma.pipelineStage.findFirst({
    where: { organizationId: orgId, isLost: true },
    include: { _count: { select: { leads: true } } },
  });

  var totalInPipeline = stages.reduce(function(sum, s) { return sum + s._count.leads; }, 0);
  var pipelineFunnel = stages.map(function(s, idx) {
    var convRate = idx === 0 ? 100 : (totalInPipeline > 0 ? Math.round((s._count.leads / stages[0]._count.leads) * 100) : 0);
    return { name: s.name, count: s._count.leads, color: s.color, conversionRate: convRate };
  });

  if (lostStage) {
    pipelineFunnel.push({ name: lostStage.name, count: lostStage._count.leads, color: lostStage.color, conversionRate: 0 });
  }

  // ─── SOURCES BREAKDOWN ───
  var leadsBySourceRaw = await prisma.lead.groupBy({
    by: ["source"],
    where: { ...baseWhere, createdAt: { gte: currentStart } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  var totalSourceLeads = leadsBySourceRaw.reduce(function(sum, s) { return sum + s._count.id; }, 0);
  var leadsBySource = leadsBySourceRaw.map(function(s) {
    return { source: s.source, count: s._count.id, pct: totalSourceLeads > 0 ? Math.round((s._count.id / totalSourceLeads) * 100) : 0 };
  });

  // ─── TOP PROGRAMS ───
  var leadsByProgramRaw = await prisma.lead.groupBy({
    by: ["programId"],
    where: { ...baseWhere, programId: { not: null }, createdAt: { gte: currentStart } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 6,
  });

  var programIds = leadsByProgramRaw.map(function(p) { return p.programId!; });
  var programsData = await prisma.program.findMany({
    where: { id: { in: programIds } },
    select: { id: true, name: true, code: true },
  });

  var leadsByProgram = leadsByProgramRaw.map(function(p) {
    var prog = programsData.find(function(pd) { return pd.id === p.programId; });
    return { name: prog?.code || prog?.name || "Inconnu", count: p._count.id };
  });

  // ─── COMMERCIAL PERFORMANCE ───
  var commercials = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
    select: { id: true, name: true },
  });

  // Agrégations groupées (une requête par métrique, au lieu de 5 × N commerciaux)
  var commercialIds = commercials.map(function(u) { return u.id; });
  var [assignedGrouped, convertedGrouped, callsGrouped, apptsGrouped, tasksGrouped] = await Promise.all([
    prisma.lead.groupBy({ by: ["assignedToId"], where: { organizationId: orgId, assignedToId: { in: commercialIds }, isConverted: false }, _count: { id: true } }),
    prisma.lead.groupBy({ by: ["assignedToId"], where: { organizationId: orgId, assignedToId: { in: commercialIds }, isConverted: true, convertedAt: { gte: currentStart } }, _count: { id: true } }),
    prisma.call.groupBy({ by: ["calledById"], where: { organizationId: orgId, calledById: { in: commercialIds }, calledAt: { gte: currentStart } }, _count: { id: true } }),
    prisma.appointment.groupBy({ by: ["assignedToId"], where: { organizationId: orgId, assignedToId: { in: commercialIds }, startAt: { gte: currentStart } }, _count: { id: true } }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { organizationId: orgId, assignedToId: { in: commercialIds }, status: { in: ["TODO", "IN_PROGRESS"] } }, _count: { id: true } }),
  ]);

  var countBy = function(rows: any[], key: string): Record<string, number> {
    var m: Record<string, number> = {};
    rows.forEach(function(r) { if (r[key]) m[r[key]] = r._count.id; });
    return m;
  };
  var assignedMap = countBy(assignedGrouped, "assignedToId");
  var convertedMap = countBy(convertedGrouped, "assignedToId");
  var callsMap = countBy(callsGrouped, "calledById");
  var apptsMap = countBy(apptsGrouped, "assignedToId");
  var tasksMap = countBy(tasksGrouped, "assignedToId");

  var commercialPerf = commercials.map(function(user) {
    var assigned = assignedMap[user.id] || 0;
    var converted = convertedMap[user.id] || 0;
    var convRate = (assigned + converted) > 0 ? Math.round((converted / (assigned + converted)) * 100) : 0;
    return {
      id: user.id, name: user.name, assigned, converted,
      calls: callsMap[user.id] || 0,
      appointments: apptsMap[user.id] || 0,
      tasks: tasksMap[user.id] || 0,
      convRate,
    };
  });

  commercialPerf.sort(function(a, b) { return b.converted - a.converted; });

  // ─── CALLS BY DAY (for chart) ───
  var callsRaw = await prisma.call.findMany({
    where: { ...callBaseWhere, calledAt: { gte: currentStart } },
    select: { calledAt: true, outcome: true },
  });

  var callsByDay: { date: string; total: number; answered: number }[] = [];
  for (var j = 0; j < Math.min(daysBack, 30); j++) {
    var d2 = new Date(now.getTime() - (Math.min(daysBack, 30) - 1 - j) * 86_400_000);
    var key2 = d2.toISOString().split("T")[0];
    var dayCalls = callsRaw.filter(function(c) { return new Date(c.calledAt).toISOString().split("T")[0] === key2; });
    callsByDay.push({
      date: key2,
      total: dayCalls.length,
      answered: dayCalls.filter(function(c) { return c.outcome === "ANSWERED"; }).length,
    });
  }

  // ─── CYCLE MOYEN (capture → conversion) ───
  var convertedForCycle = await prisma.lead.findMany({
    where: { ...baseWhere, isConverted: true, convertedAt: { gte: currentStart } },
    select: { createdAt: true, convertedAt: true },
  });
  var cycleTotal = 0, cycleCount = 0;
  convertedForCycle.forEach(function(l) {
    if (l.convertedAt) {
      var days = (new Date(l.convertedAt).getTime() - new Date(l.createdAt).getTime()) / 86_400_000;
      if (days >= 0) { cycleTotal += days; cycleCount++; }
    }
  });
  var avgCycleDays = cycleCount > 0 ? Math.round((cycleTotal / cycleCount) * 10) / 10 : 0;

  // ─── PERFORMANCE DES CAMPAGNES (email + WhatsApp unifiés) ───
  var [emailCampaigns, waCampaigns] = await Promise.all([
    prisma.emailCampaign.findMany({
      where: { organizationId: orgId, status: "SENT", sentAt: { gte: currentStart } },
      select: { id: true, name: true, sentCount: true, deliveredCount: true, openedCount: true, clickedCount: true, sentAt: true },
      orderBy: { sentAt: "desc" }, take: 20,
    }),
    prisma.whatsAppCampaign.findMany({
      where: { organizationId: orgId, sentAt: { gte: currentStart } },
      select: { id: true, name: true, sentCount: true, deliveredCount: true, readCount: true, sentAt: true },
      orderBy: { sentAt: "desc" }, take: 20,
    }),
  ]);

  var campaignPerf = [
    ...emailCampaigns.map(function(c) {
      return { id: c.id, channel: "EMAIL" as const, name: c.name, sent: c.sentCount, delivered: c.deliveredCount, opened: c.openedCount, clicked: c.clickedCount as number | null, sentAt: c.sentAt };
    }),
    ...waCampaigns.map(function(c) {
      return { id: c.id, channel: "WHATSAPP" as const, name: c.name, sent: c.sentCount, delivered: c.deliveredCount, opened: c.readCount, clicked: null as number | null, sentAt: c.sentAt };
    }),
  ].sort(function(a, b) { return (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0); }).slice(0, 12);

  // ─── RECENT ACTIVITY ───
  var recentActivities = await prisma.activity.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // ─── FILTER OPTIONS ───
  var users = await prisma.user.findMany({
    where: { organizationId: orgId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  var campuses = await prisma.campus.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  return {
    period,
    kpis: {
      totalLeads, leadsCurrentPeriod, leadsPreviousPeriod, leadsGrowth,
      convertedCurrentPeriod, convertedPreviousPeriod, conversionRate, conversionGrowth,
      totalStudents, activeStudents,
      callsTotal, callsToday, callsThisWeek, callReachRate, avgDuration,
      apptsTotal, apptsToday, apptsThisWeek, apptsCompleted, apptsNoShow, apptPresenceRate,
      tasksOpen, tasksOverdue,
      avgCycleDays, pipelineTotal: totalInPipeline,
    },
    leadsTimeline,
    callsByDay,
    pipelineFunnel,
    leadsBySource,
    leadsByProgram,
    commercialPerf,
    campaignPerf,
    recentActivities,
    filterOptions: { users, campuses },
  };
}