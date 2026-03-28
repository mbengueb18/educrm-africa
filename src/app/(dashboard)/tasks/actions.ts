"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get all tasks ───
export async function getTasks(filters?: {
  assignedToId?: string;
  status?: string;
  priority?: string;
  type?: string;
  leadId?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var where: any = { organizationId: session.user.organizationId };

  if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.type) where.type = filters.type;
  if (filters?.leadId) where.leadId = filters.leadId;

  var tasks = await prisma.task.findMany({
    where,
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
      { priority: "desc" },
    ],
  });

  return tasks;
}

// ─── Get task stats ───
export async function getTaskStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEnd = new Date(todayStart.getTime() + 86_400_000);

  var [total, todo, inProgress, done, overdue, dueToday] = await Promise.all([
    prisma.task.count({ where: { organizationId: orgId, status: { not: "CANCELLED" } } }),
    prisma.task.count({ where: { organizationId: orgId, status: "TODO" } }),
    prisma.task.count({ where: { organizationId: orgId, status: "IN_PROGRESS" } }),
    prisma.task.count({ where: { organizationId: orgId, status: "DONE" } }),
    prisma.task.count({
      where: {
        organizationId: orgId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        organizationId: orgId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: todayStart, lt: todayEnd },
      },
    }),
  ]);

  return { total, todo, inProgress, done, overdue, dueToday };
}

// ─── Create task ───
export async function createTask(data: {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  dueDate?: string;
  reminderAt?: string;
  leadId?: string;
  assignedToId: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: (data.type || "TODO") as any,
      priority: (data.priority || "MEDIUM") as any,
      status: "TODO",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      leadId: data.leadId || null,
      assignedToId: data.assignedToId,
      createdById: session.user.id,
      organizationId: session.user.organizationId,
    },
  });

  if (data.leadId) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED" as any,
        description: "Tâche créée : " + data.title,
        userId: session.user.id,
        leadId: data.leadId,
        organizationId: session.user.organizationId,
        metadata: { taskId: task.id, taskType: data.type },
      },
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/pipeline");
  return { success: true, task };
}

// ─── Update task ───
export async function updateTask(taskId: string, data: {
  title?: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  assignedToId?: string;
  leadId?: string | null;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "DONE") updateData.completedAt = new Date();
    if (data.status === "TODO" || data.status === "IN_PROGRESS") updateData.completedAt = null;
  }
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.reminderAt !== undefined) updateData.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
  if (data.leadId !== undefined) updateData.leadId = data.leadId;

  var task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });

  revalidatePath("/tasks");
  revalidatePath("/pipeline");
  return { success: true, task };
}

// ─── Delete task ───
export async function deleteTask(taskId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath("/tasks");
  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Bulk update status ───
export async function bulkUpdateTaskStatus(taskIds: string[], status: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = { status };
  if (status === "DONE") updateData.completedAt = new Date();
  if (status === "TODO" || status === "IN_PROGRESS") updateData.completedAt = null;

  await prisma.task.updateMany({
    where: {
      id: { in: taskIds },
      organizationId: session.user.organizationId,
    },
    data: updateData,
  });

  revalidatePath("/tasks");
  return { success: true, count: taskIds.length };
}