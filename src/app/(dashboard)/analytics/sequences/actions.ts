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

  // Average time to first reply
  let totalReplyDays = 0;
  let replyCount = 0;
  if (repliedLeadIds.size > 0) {
    const repliedLeads = await prisma.lead.findMany({
      where: { id: { in: Array.from(repliedLeadIds) } },
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
    repliedLeads.forEach((l) => {
      if (l.messages[0]) {
        const days = (new Date(l.messages[0].sentAt).getTime() - new Date(l.createdAt).getTime()) / 86400000;
        if (days >= 0) {
          totalReplyDays += days;
          replyCount++;
        }
      }
    });
  }

  const avgReplyDays = replyCount > 0 ? totalReplyDays / replyCount : 0;

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