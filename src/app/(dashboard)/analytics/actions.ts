"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  var thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  var sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // ─── KPIs ───
  var [
    totalLeads, leadsThisMonth, leadsPrevMonth,
    convertedThisMonth, convertedPrevMonth,
    totalStudents, activeStudents,
    totalTasks, overdueTasks,
    callsThisWeek, callsAnswered,
    appointmentsThisWeek,
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.lead.count({ where: { organizationId: orgId, isConverted: true, convertedAt: { gte: monthStart } } }),
    prisma.lead.count({ where: { organizationId: orgId, isConverted: true, convertedAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.student.count({ where: { organizationId: orgId } }),
    prisma.student.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.task.count({ where: { organizationId: orgId, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { organizationId: orgId, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
    prisma.call.count({ where: { organizationId: orgId, calledAt: { gte: sevenDaysAgo } } }),
    prisma.call.count({ where: { organizationId: orgId, calledAt: { gte: sevenDaysAgo }, outcome: "ANSWERED" } }),
    prisma.appointment.count({ where: { organizationId: orgId, startAt: { gte: todayStart, lt: new Date(todayStart.getTime() + 7 * 86_400_000) } } }),
  ]);

  var conversionRate = totalLeads > 0 ? Math.round((convertedThisMonth / (leadsThisMonth || 1)) * 100) : 0;
  var leadsGrowth = leadsPrevMonth > 0 ? Math.round(((leadsThisMonth - leadsPrevMonth) / leadsPrevMonth) * 100) : 0;
  var conversionGrowth = convertedPrevMonth > 0 ? Math.round(((convertedThisMonth - convertedPrevMonth) / convertedPrevMonth) * 100) : 0;
  var callReachRate = callsThisWeek > 0 ? Math.round((callsAnswered / callsThisWeek) * 100) : 0;

  // ─── Leads par jour (30 derniers jours) ───
  var leadsRaw = await prisma.lead.findMany({
    where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
  });

  var leadsByDay: Record<string, number> = {};
  for (var i = 0; i < 30; i++) {
    var d = new Date(now.getTime() - (29 - i) * 86_400_000);
    var key = d.toISOString().split("T")[0];
    leadsByDay[key] = 0;
  }
  leadsRaw.forEach(function(l) {
    var k = new Date(l.createdAt).toISOString().split("T")[0];
    if (leadsByDay[k] !== undefined) leadsByDay[k]++;
  });

  var leadsTimeline = Object.entries(leadsByDay).map(function(entry) {
    return { date: entry[0], count: entry[1] };
  });

  // ─── Leads par source ───
  var leadsBySourceRaw = await prisma.lead.groupBy({
    by: ["source"],
    where: { organizationId: orgId },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  var leadsBySource = leadsBySourceRaw.map(function(s) {
    return { source: s.source, count: s._count.id };
  });

  // ─── Leads par étape (pipeline) ───
  var stages = await prisma.pipelineStage.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { leads: true } } },
    orderBy: { order: "asc" },
  });

  var leadsByStage = stages.map(function(s) {
    return { name: s.name, count: s._count.leads, color: s.color };
  });

  // ─── Leads par filière (top 5) ───
  var leadsByProgramRaw = await prisma.lead.groupBy({
    by: ["programId"],
    where: { organizationId: orgId, programId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
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

  // ─── Performance par commercial ───
  var commercials = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
    select: { id: true, name: true },
  });

  var commercialPerf = await Promise.all(
    commercials.map(async function(user) {
      var [assigned, converted, calls, tasks] = await Promise.all([
        prisma.lead.count({ where: { organizationId: orgId, assignedToId: user.id, isConverted: false } }),
        prisma.lead.count({ where: { organizationId: orgId, assignedToId: user.id, isConverted: true, convertedAt: { gte: monthStart } } }),
        prisma.call.count({ where: { organizationId: orgId, calledById: user.id, calledAt: { gte: sevenDaysAgo } } }),
        prisma.task.count({ where: { organizationId: orgId, assignedToId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } } }),
      ]);
      return { name: user.name, assigned, converted, calls, tasks };
    })
  );

  // ─── Conversions par jour (30 derniers jours) ───
  var conversionsRaw = await prisma.lead.findMany({
    where: { organizationId: orgId, isConverted: true, convertedAt: { gte: thirtyDaysAgo } },
    select: { convertedAt: true },
  });

  var conversionsByDay: Record<string, number> = {};
  for (var j = 0; j < 30; j++) {
    var d2 = new Date(now.getTime() - (29 - j) * 86_400_000);
    var key2 = d2.toISOString().split("T")[0];
    conversionsByDay[key2] = 0;
  }
  conversionsRaw.forEach(function(l) {
    if (l.convertedAt) {
      var k = new Date(l.convertedAt).toISOString().split("T")[0];
      if (conversionsByDay[k] !== undefined) conversionsByDay[k]++;
    }
  });

  var conversionsTimeline = Object.entries(conversionsByDay).map(function(entry) {
    return { date: entry[0], count: entry[1] };
  });

  // ─── Activité récente ───
  var recentActivities = await prisma.activity.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { name: true } },
      lead: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return {
    kpis: {
      totalLeads, leadsThisMonth, leadsPrevMonth, leadsGrowth,
      convertedThisMonth, convertedPrevMonth, conversionRate, conversionGrowth,
      totalStudents, activeStudents,
      totalTasks, overdueTasks,
      callsThisWeek, callReachRate,
      appointmentsThisWeek,
    },
    leadsTimeline,
    conversionsTimeline,
    leadsBySource,
    leadsByStage,
    leadsByProgram,
    commercialPerf,
    recentActivities,
  };
}