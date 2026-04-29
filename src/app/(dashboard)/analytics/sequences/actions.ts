"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSequenceAnalytics(periodDays: number = 30) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;
  const since = new Date(Date.now() - periodDays * 86400000);

  // All executions in period
  const executions = await prisma.sequenceExecution.findMany({
    where: { organizationId: orgId, executedAt: { gte: since } },
    select: { leadId: true, stepName: true, status: true, executedAt: true },
  });

  // Group by step
  const stepStats: Record<string, { total: number; done: number; failed: number; skipped: number }> = {};
  const STEPS = ["J1_email", "J3_whatsapp", "J7_call_task", "J14_last_chance", "J21_auto_lost"];
  STEPS.forEach((s) => { stepStats[s] = { total: 0, done: 0, failed: 0, skipped: 0 }; });

  executions.forEach((e) => {
    if (!stepStats[e.stepName]) return;
    stepStats[e.stepName].total++;
    if (e.status === "DONE") stepStats[e.stepName].done++;
    else if (e.status === "FAILED") stepStats[e.stepName].failed++;
    else if (e.status === "SKIPPED") stepStats[e.stepName].skipped++;
  });

  // Distinct leads relancés
  const leadsRelance = new Set(executions.map((e) => e.leadId));
  const totalLeadsRelance = leadsRelance.size;

  // Inbound replies on leads in sequence
  const repliedLeadIds = new Set<string>();
  if (leadsRelance.size > 0) {
    const replies = await prisma.message.findMany({
      where: {
        organizationId: orgId,
        leadId: { in: Array.from(leadsRelance) },
        direction: "INBOUND",
        sentAt: { gte: since },
      },
      select: { leadId: true, sentAt: true, lead: { select: { createdAt: true } } },
    });
    replies.forEach((r) => { if (r.leadId) repliedLeadIds.add(r.leadId); });
  }

  // Tasks created by sequences (J3, J7)
  const tasksFromSequences = await prisma.task.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      OR: [
        { description: { contains: "Relance auto" } },
      ],
    },
  });

  const tasksDone = await prisma.task.count({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      status: "DONE",
      OR: [{ description: { contains: "Relance auto" } }],
    },
  });

  // Email engagement (open/click rates from MessageEvent if available)
  let emailStats = { sent: 0, opened: 0, clicked: 0, bounced: 0 };
  const j1Sent = stepStats["J1_email"].done + stepStats["J14_last_chance"].done;
  emailStats.sent = j1Sent;

  try {
    const events = await prisma.messageEvent.findMany({
      where: {
        message: {
          organizationId: orgId,
          sentAt: { gte: since },
          direction: "OUTBOUND",
          channel: "EMAIL",
        },
      },
      select: { event: true, messageId: true },
    });
    const openedMsgs = new Set<string>();
    const clickedMsgs = new Set<string>();
    let bounced = 0;
    events.forEach((e) => {
      if (e.event === "OPENED" && e.messageId) openedMsgs.add(e.messageId);
      if (e.event === "CLICKED" && e.messageId) clickedMsgs.add(e.messageId);
      if (e.event === "BOUNCED") bounced++;
    });
    emailStats.opened = openedMsgs.size;
    emailStats.clicked = clickedMsgs.size;
    emailStats.bounced = bounced;
  } catch {}

  // Average time to first reply (from last relance sent → first inbound after that)
  let totalReplyMs = 0;
  let replyCount = 0;
  if (repliedLeadIds.size > 0) {
    const repliedLeads = await prisma.lead.findMany({
      where: { id: { in: Array.from(repliedLeadIds) } },
      select: {
        id: true,
        sequenceExecutions: {
          where: { status: "DONE" },
          orderBy: { executedAt: "desc" },
          select: { executedAt: true },
        },
        messages: {
          where: { direction: "INBOUND" },
          orderBy: { sentAt: "asc" },
          select: { sentAt: true },
        },
      },
    });

    repliedLeads.forEach((l) => {
      // Find the first inbound that arrived AFTER any sequence execution
      for (const exec of l.sequenceExecutions.reverse()) {
        const reply = l.messages.find((m) => new Date(m.sentAt) >= new Date(exec.executedAt));
        if (reply) {
          const ms = new Date(reply.sentAt).getTime() - new Date(exec.executedAt).getTime();
          if (ms >= 0) {
            totalReplyMs += ms;
            replyCount++;
          }
          return;
        }
      }
    });
  }

  // Display in hours if average < 1 day, otherwise in days
  const avgReplyMs = replyCount > 0 ? totalReplyMs / replyCount : 0;
  const avgReplyDays = avgReplyMs / 86400000;
  const avgReplyHours = avgReplyMs / 3600000;

  // Auto-lost
  const autoLost = stepStats["J21_auto_lost"].done;

  // Conversion rate (leads in sequence that became students)
  const convertedFromSequence = await prisma.lead.count({
    where: {
      id: { in: Array.from(leadsRelance) },
      isConverted: true,
    },
  });

  return {
    period: { days: periodDays, since: since.toISOString() },
    overview: {
      totalLeadsRelance,
      repliedCount: repliedLeadIds.size,
      replyRate: totalLeadsRelance > 0 ? Math.round((repliedLeadIds.size / totalLeadsRelance) * 100) : 0,
      avgReplyDays: Math.round(avgReplyDays * 10) / 10,
      avgReplyHours: Math.round(avgReplyHours * 10) / 10,
      avgReplyDisplay: avgReplyDays >= 1
        ? Math.round(avgReplyDays * 10) / 10 + " j"
        : Math.round(avgReplyHours * 10) / 10 + " h",
      autoLost,
      converted: convertedFromSequence,
      conversionRate: totalLeadsRelance > 0 ? Math.round((convertedFromSequence / totalLeadsRelance) * 100) : 0,
    },
    funnel: STEPS.map((step) => ({
      step,
      label: STEP_LABELS[step] || step,
      total: stepStats[step].total,
      done: stepStats[step].done,
      failed: stepStats[step].failed,
      skipped: stepStats[step].skipped,
    })),
    emails: emailStats,
    tasks: { total: tasksFromSequences, done: tasksDone },
  };
}

const STEP_LABELS: Record<string, string> = {
  J1_email: "J+1 Email",
  J3_whatsapp: "J+3 WhatsApp",
  J7_call_task: "J+7 Appel URGENT",
  J14_last_chance: "J+14 Last Chance",
  J21_auto_lost: "J+21 Auto-perdu",
};

export async function getLeadsInSequence() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  // Get all leads with at least one sequence execution and still active
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      isConverted: false,
      sequenceExecutions: { some: {} },
      stage: { name: { notIn: ["Perdu", "Admis", "Inscrit"] } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      createdAt: true,
      stage: { select: { name: true, color: true } },
      assignedTo: { select: { name: true } },
      sequenceExecutions: {
        orderBy: { executedAt: "desc" },
        select: { stepName: true, executedAt: true, status: true },
      },
      messages: {
        where: { direction: "INBOUND" },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { sentAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return leads.map((l) => {
    const lastStep = l.sequenceExecutions[0];
    const daysSinceCreated = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000);
    return {
      id: l.id,
      name: l.firstName + " " + l.lastName,
      email: l.email,
      phone: l.phone,
      stage: l.stage,
      assignedToName: l.assignedTo?.name || null,
      daysSinceCreated,
      lastStep: lastStep ? STEP_LABELS[lastStep.stepName] || lastStep.stepName : null,
      lastStepAt: lastStep?.executedAt || null,
      hasReplied: l.messages.length > 0,
      stepCount: l.sequenceExecutions.length,
    };
  });
}

// ─── Cohorte temporelle : à quel moment les leads répondent ───
export async function getCohortAnalysis(months: number = 3) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  // Get leads created in period that have at least one sequence execution
  const leads = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      sequenceExecutions: { some: {} },
    },
    select: {
      id: true,
      createdAt: true,
      messages: {
        where: { direction: "INBOUND" },
        orderBy: { sentAt: "asc" },
        take: 1,
        select: { sentAt: true },
      },
    },
  });

  // Group by month cohort
  const cohorts: Record<string, { total: number; reply_d0: number; reply_d1: number; reply_d3: number; reply_d7: number; reply_d14: number; reply_d21: number }> = {};

  leads.forEach((l) => {
    const month = new Date(l.createdAt).toISOString().substring(0, 7); // "2026-04"
    if (!cohorts[month]) {
      cohorts[month] = { total: 0, reply_d0: 0, reply_d1: 0, reply_d3: 0, reply_d7: 0, reply_d14: 0, reply_d21: 0 };
    }
    cohorts[month].total++;

    if (l.messages[0]) {
      const replyDays = (new Date(l.messages[0].sentAt).getTime() - new Date(l.createdAt).getTime()) / 86400000;
      if (replyDays <= 0) cohorts[month].reply_d0++;
      if (replyDays <= 1) cohorts[month].reply_d1++;
      if (replyDays <= 3) cohorts[month].reply_d3++;
      if (replyDays <= 7) cohorts[month].reply_d7++;
      if (replyDays <= 14) cohorts[month].reply_d14++;
      if (replyDays <= 21) cohorts[month].reply_d21++;
    }
  });

  // Convert to array sorted by month asc
  const cohortArray = Object.entries(cohorts)
    .map(([month, data]) => ({
      month,
      monthLabel: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      total: data.total,
      d0: data.total > 0 ? Math.round((data.reply_d0 / data.total) * 100) : 0,
      d1: data.total > 0 ? Math.round((data.reply_d1 / data.total) * 100) : 0,
      d3: data.total > 0 ? Math.round((data.reply_d3 / data.total) * 100) : 0,
      d7: data.total > 0 ? Math.round((data.reply_d7 / data.total) * 100) : 0,
      d14: data.total > 0 ? Math.round((data.reply_d14 / data.total) * 100) : 0,
      d21: data.total > 0 ? Math.round((data.reply_d21 / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return cohortArray;
}

// ─── Comparaison "avec vs sans relance" ───
export async function getSequenceImpact(periodDays: number = 90) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;
  const since = new Date(Date.now() - periodDays * 86400000);

  // Leads in sequence
  const leadsInSequenceIds = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      sequenceExecutions: { some: {} },
    },
    select: { id: true },
  });
  const inSeqIds = leadsInSequenceIds.map((l) => l.id);

  // Leads NOT in sequence (created in same period, no executions)
  const leadsNotInSequence = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: since },
      sequenceExecutions: { none: {} },
    },
    select: { id: true },
  });
  const notInSeqIds = leadsNotInSequence.map((l) => l.id);

  // Conversion stats for both groups
  async function getStats(ids: string[]) {
    if (ids.length === 0) {
      return { total: 0, converted: 0, conversionRate: 0, replied: 0, replyRate: 0, lost: 0, lostRate: 0 };
    }
    const [converted, replied, lost] = await Promise.all([
      prisma.lead.count({ where: { id: { in: ids }, isConverted: true } }),
      prisma.lead.count({
        where: {
          id: { in: ids },
          messages: { some: { direction: "INBOUND" } },
        },
      }),
      prisma.lead.count({
        where: {
          id: { in: ids },
          stage: { name: { contains: "Perdu", mode: "insensitive" } },
        },
      }),
    ]);
    return {
      total: ids.length,
      converted,
      conversionRate: ids.length > 0 ? Math.round((converted / ids.length) * 1000) / 10 : 0,
      replied,
      replyRate: ids.length > 0 ? Math.round((replied / ids.length) * 1000) / 10 : 0,
      lost,
      lostRate: ids.length > 0 ? Math.round((lost / ids.length) * 1000) / 10 : 0,
    };
  }

  const [withSequence, withoutSequence] = await Promise.all([
    getStats(inSeqIds),
    getStats(notInSeqIds),
  ]);

  // Calculate uplift
  const uplift = {
    conversion: withSequence.conversionRate - withoutSequence.conversionRate,
    reply: withSequence.replyRate - withoutSequence.replyRate,
  };

  return { withSequence, withoutSequence, uplift, periodDays };
}

// ─── Export CSV des leads en séquence ───
export async function exportLeadsInSequenceCSV() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const leads = await prisma.lead.findMany({
    where: {
      organizationId: session.user.organizationId,
      sequenceExecutions: { some: {} },
    },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      createdAt: true,
      stage: { select: { name: true } },
      assignedTo: { select: { name: true } },
      sequenceExecutions: {
        orderBy: { executedAt: "desc" },
        select: { stepName: true, executedAt: true, status: true },
      },
      messages: {
        where: { direction: "INBOUND" },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { sentAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // CSV header
  const headers = [
    "Prénom", "Nom", "Email", "Téléphone", "Date création", "Étape",
    "Commercial", "Étapes exécutées", "Dernière étape", "Date dernière étape",
    "A répondu", "Date 1ère réponse",
  ];

  const rows = leads.map((l) => {
    const lastStep = l.sequenceExecutions[0];
    const reply = l.messages[0];
    return [
      l.firstName,
      l.lastName,
      l.email || "",
      l.phone,
      new Date(l.createdAt).toLocaleDateString("fr-FR"),
      l.stage.name,
      l.assignedTo?.name || "",
      l.sequenceExecutions.length.toString(),
      lastStep?.stepName || "",
      lastStep ? new Date(lastStep.executedAt).toLocaleDateString("fr-FR") : "",
      reply ? "Oui" : "Non",
      reply ? new Date(reply.sentAt).toLocaleDateString("fr-FR") : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}