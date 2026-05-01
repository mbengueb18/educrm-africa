"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── List workflows ───
export async function getWorkflows() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const workflows = await prisma.workflow.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { executions: true } },
    },
  });

  return workflows;
}

// ─── Get one workflow ───
export async function getWorkflow(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const workflow = await prisma.workflow.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      executions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!workflow) throw new Error("Workflow introuvable");
  return workflow;
}

// ─── Create workflow ───
export async function createWorkflow(data: {
  name: string;
  description?: string;
  triggerType?: string;
  triggerConfig?: any;
  graph?: any;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const workflow = await prisma.workflow.create({
    data: {
      name: data.name,
      description: data.description || null,
      triggerType: data.triggerType || "LEAD_CREATED",
      triggerConfig: data.triggerConfig || {},
      graph: data.graph || { nodes: [], edges: [] },
      enabled: false,
      organizationId: session.user.organizationId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/workflows");
  return workflow;
}

// ─── Update workflow ───
export async function updateWorkflow(id: string, data: {
  name?: string;
  description?: string;
  enabled?: boolean;
  triggerType?: string;
  triggerConfig?: any;
  graph?: any;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
  if (data.triggerConfig !== undefined) updateData.triggerConfig = data.triggerConfig;
  if (data.graph !== undefined) updateData.graph = data.graph;

  const workflow = await prisma.workflow.update({
    where: { id, organizationId: session.user.organizationId },
    data: updateData,
  });

  revalidatePath("/workflows");
  revalidatePath("/workflows/" + id);
  return workflow;
}

// ─── Delete workflow ───
export async function deleteWorkflow(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.workflow.delete({
    where: { id, organizationId: session.user.organizationId },
  });

  revalidatePath("/workflows");
  return { success: true };
}

// ─── Toggle enabled ───
export async function toggleWorkflow(id: string, enabled: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.workflow.update({
    where: { id, organizationId: session.user.organizationId },
    data: { enabled },
  });

  revalidatePath("/workflows");
  return { success: true };
}

// ─── Manual trigger (test a workflow on a specific lead) ───
export async function triggerWorkflowManually(workflowId: string, leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: session.user.organizationId },
  });
  if (!workflow) throw new Error("Workflow introuvable");

  const graph = workflow.graph as any;
  const startNode = graph.nodes?.find((n: any) => n.type === "trigger");

  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      leadId,
      status: "RUNNING",
      currentNode: startNode?.id || null,
      context: { triggeredManually: true, userId: session.user.id },
      organizationId: session.user.organizationId,
    },
  });

  return { success: true, executionId: execution.id };
}