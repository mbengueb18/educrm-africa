"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get all appointments ───
export async function getAppointments(filters?: {
  assignedToId?: string;
  status?: string;
  type?: string;
  leadId?: string;
  from?: string;
  to?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var where: any = { organizationId: session.user.organizationId };

  if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters?.status) where.status = filters.status;
  if (filters?.type) where.type = filters.type;
  if (filters?.leadId) where.leadId = filters.leadId;
  if (filters?.from || filters?.to) {
    where.startAt = {};
    if (filters?.from) where.startAt.gte = new Date(filters.from);
    if (filters?.to) where.startAt.lte = new Date(filters.to);
  }

  var appointments = await prisma.appointment.findMany({
    where,
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return appointments;
}

// ─── Get appointment stats ───
export async function getAppointmentStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEnd = new Date(todayStart.getTime() + 86_400_000);
  var weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);

  var [total, today, thisWeek, scheduled, completed, cancelled, noShow] = await Promise.all([
    prisma.appointment.count({ where: { organizationId: orgId } }),
    prisma.appointment.count({ where: { organizationId: orgId, startAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { organizationId: orgId, startAt: { gte: todayStart, lt: weekEnd } } }),
    prisma.appointment.count({ where: { organizationId: orgId, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
    prisma.appointment.count({ where: { organizationId: orgId, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { organizationId: orgId, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { organizationId: orgId, status: "NO_SHOW" } }),
  ]);

  var completionRate = (completed + cancelled + noShow) > 0
    ? Math.round((completed / (completed + cancelled + noShow)) * 100) : 0;

  return { total, today, thisWeek, scheduled, completed, cancelled, noShow, completionRate };
}

// ─── Create appointment ───
export async function createAppointment(data: {
  title: string;
  description?: string;
  type?: string;
  startAt: string;
  endAt: string;
  location?: string;
  meetingUrl?: string;
  meetingProvider?: string;
  leadId?: string;
  assignedToId: string;
  reminderAt?: string;
  notes?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var appointment = await prisma.appointment.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: (data.type || "IN_PERSON") as any,
      status: "SCHEDULED",
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      location: data.location || null,
      meetingUrl: data.meetingUrl || null,
      meetingProvider: data.meetingProvider || null,
      leadId: data.leadId || null,
      assignedToId: data.assignedToId,
      createdById: session.user.id,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      notes: data.notes || null,
      organizationId: session.user.organizationId,
    },
  });

  if (data.leadId) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED" as any,
        description: "Rendez-vous planifié : " + data.title,
        userId: session.user.id,
        leadId: data.leadId,
        organizationId: session.user.organizationId,
        metadata: { appointmentId: appointment.id, type: data.type },
      },
    });
  }

  revalidatePath("/appointments");
  revalidatePath("/pipeline");
  return { success: true, appointment };
}

// ─── Update appointment ───
export async function updateAppointment(appointmentId: string, data: {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  meetingUrl?: string;
  meetingProvider?: string;
  leadId?: string | null;
  assignedToId?: string;
  reminderAt?: string | null;
  notes?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startAt !== undefined) updateData.startAt = new Date(data.startAt);
  if (data.endAt !== undefined) updateData.endAt = new Date(data.endAt);
  if (data.location !== undefined) updateData.location = data.location;
  if (data.meetingUrl !== undefined) updateData.meetingUrl = data.meetingUrl;
  if (data.meetingProvider !== undefined) updateData.meetingProvider = data.meetingProvider;
  if (data.leadId !== undefined) updateData.leadId = data.leadId;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
  if (data.reminderAt !== undefined) updateData.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
  if (data.notes !== undefined) updateData.notes = data.notes;

  var appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: updateData,
  });

  revalidatePath("/appointments");
  revalidatePath("/pipeline");
  return { success: true, appointment };
}

// ─── Delete appointment ───
export async function deleteAppointment(appointmentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.appointment.delete({ where: { id: appointmentId } });

  revalidatePath("/appointments");
  return { success: true };
}