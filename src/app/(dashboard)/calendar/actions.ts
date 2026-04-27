"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCalendarEvents(params?: {
  start?: Date;
  end?: Date;
  userId?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const where: any = { organizationId: session.user.organizationId };
  if (params?.userId) where.assignedToId = params.userId;

  // Tasks
  const tasks = await prisma.task.findMany({
    where: {
      ...where,
      dueDate: { not: null },
      ...(params?.start && params?.end ? { dueDate: { gte: params.start, lte: params.end } } : {}),
      status: { in: ["TODO", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      dueDate: true,
      lead: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    take: 200,
  });

  // Appointments
  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(params?.userId ? { assignedToId: params.userId } : {}),
      ...(params?.start && params?.end ? { startAt: { gte: params.start, lte: params.end } } : {}),
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      startAt: true,
      endAt: true,
      location: true,
      meetingUrl: true,
      lead: { select: { id: true, firstName: true, lastName: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    take: 200,
  });

  return {
    tasks,
    appointments,
  };
}

export async function rescheduleTask(taskId: string, newDate: Date) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.task.update({
    where: { id: taskId },
    data: { dueDate: newDate },
  });

  revalidatePath("/calendar");
  return { success: true };
}

export async function rescheduleAppointment(appointmentId: string, newStart: Date, newEnd: Date) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { startAt: newStart, endAt: newEnd },
  });

  revalidatePath("/calendar");
  return { success: true };
}

export async function getCalendarUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.user.findMany({
    where: { organizationId: session.user.organizationId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}