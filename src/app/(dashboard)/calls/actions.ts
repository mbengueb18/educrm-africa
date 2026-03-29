"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get all calls ───
export async function getCalls(filters?: {
  calledById?: string;
  direction?: string;
  outcome?: string;
  leadId?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var where: any = { organizationId: session.user.organizationId };

  if (filters?.calledById) where.calledById = filters.calledById;
  if (filters?.direction) where.direction = filters.direction;
  if (filters?.outcome) where.outcome = filters.outcome;
  if (filters?.leadId) where.leadId = filters.leadId;

  var calls = await prisma.call.findMany({
    where,
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      calledBy: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { calledAt: "desc" },
  });

  return calls;
}

// ─── Get call stats ───
export async function getCallStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEnd = new Date(todayStart.getTime() + 86_400_000);
  var weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86_400_000);

  var [total, today, thisWeek, answered, noAnswer, avgDuration] = await Promise.all([
    prisma.call.count({ where: { organizationId: orgId } }),
    prisma.call.count({ where: { organizationId: orgId, calledAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.call.count({ where: { organizationId: orgId, calledAt: { gte: weekStart } } }),
    prisma.call.count({ where: { organizationId: orgId, outcome: "ANSWERED" } }),
    prisma.call.count({ where: { organizationId: orgId, outcome: "NO_ANSWER" } }),
    prisma.call.aggregate({ where: { organizationId: orgId, duration: { not: null } }, _avg: { duration: true } }),
  ]);

  var reachRate = total > 0 ? Math.round((answered / total) * 100) : 0;
  var avgDur = Math.round(avgDuration._avg.duration || 0);

  return { total, today, thisWeek, answered, noAnswer, reachRate, avgDuration: avgDur };
}

// ─── Log a call ───
export async function logCall(data: {
  leadId?: string;
  direction: string;
  outcome: string;
  duration?: number;
  phoneNumber: string;
  notes?: string;
  calledAt?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var call = await prisma.call.create({
    data: {
      leadId: data.leadId || null,
      direction: data.direction as any,
      outcome: data.outcome as any,
      duration: data.duration || null,
      phoneNumber: data.phoneNumber,
      notes: data.notes || null,
      calledById: session.user.id,
      calledAt: data.calledAt ? new Date(data.calledAt) : new Date(),
      organizationId: session.user.organizationId,
    },
  });

  // Log activity if linked to a lead
  if (data.leadId) {
    var outcomeLabels: Record<string, string> = {
      ANSWERED: "Décroché", NO_ANSWER: "Pas de réponse", BUSY: "Occupé",
      VOICEMAIL: "Messagerie", CALLBACK: "Rappeler", WRONG_NUMBER: "Mauvais numéro",
      NOT_INTERESTED: "Pas intéressé",
    };
    var dirLabel = data.direction === "INBOUND" ? "Appel entrant" : "Appel sortant";
    var outcomeLabel = outcomeLabels[data.outcome] || data.outcome;

    await prisma.activity.create({
      data: {
        type: "CALL_LOGGED",
        description: dirLabel + " — " + outcomeLabel + (data.duration ? " (" + formatDuration(data.duration) + ")" : ""),
        userId: session.user.id,
        leadId: data.leadId,
        organizationId: session.user.organizationId,
        metadata: { callId: call.id, direction: data.direction, outcome: data.outcome, duration: data.duration },
      },
    });
  }

  revalidatePath("/calls");
  revalidatePath("/pipeline");
  return { success: true, call };
}

// ─── Update call ───
export async function updateCall(callId: string, data: {
  outcome?: string;
  duration?: number;
  notes?: string;
  leadId?: string | null;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = {};
  if (data.outcome !== undefined) updateData.outcome = data.outcome;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.leadId !== undefined) updateData.leadId = data.leadId;

  var call = await prisma.call.update({
    where: { id: callId },
    data: updateData,
  });

  revalidatePath("/calls");
  return { success: true, call };
}

// ─── Delete call ───
export async function deleteCall(callId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.call.delete({ where: { id: callId } });

  revalidatePath("/calls");
  return { success: true };
}

function formatDuration(seconds: number): string {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  if (m === 0) return s + "s";
  return m + "min " + (s > 0 ? s + "s" : "");
}