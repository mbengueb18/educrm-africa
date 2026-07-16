import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeAction, evaluateCondition, LEAD_FILTER_INCLUDE } from "@/lib/workflows/engine";
import { evaluateLeadFilters } from "@/lib/lead-filters-eval";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { triggered: 0, advanced: 0, completed: 0, errors: 0 };

  try {
    // ─── 1. Trigger new executions for active workflows ───
    const activeWorkflows = await prisma.workflow.findMany({
      where: { enabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    for (const wf of activeWorkflows) {
      try {
        const triggered = await checkAndTriggerWorkflow(wf);
        stats.triggered += triggered;
      } catch (err: any) {
        console.error("[Workflow trigger] " + wf.id, err.message);
        stats.errors++;
      }
    }

    // ─── 2. Resume waiting executions ───
    const waitingExecs = await prisma.workflowExecution.findMany({
      where: {
        status: "WAITING",
        waitUntil: { lte: new Date() },
      },
      include: { workflow: true },
      take: 100,
    });

    for (const exec of waitingExecs) {
      try {
        await executeNextStep(exec);
        stats.advanced++;
      } catch (err: any) {
        console.error("[Workflow advance] " + exec.id, err.message);
        await prisma.workflowExecution.update({
          where: { id: exec.id },
          data: { status: "FAILED", errorMessage: err.message },
        });
        stats.errors++;
      }
    }

    // ─── 3. Process running executions (just started) ───
    const runningExecs = await prisma.workflowExecution.findMany({
      where: {
        status: "RUNNING",
        waitUntil: null,
      },
      include: { workflow: true },
      take: 100,
    });

    for (const exec of runningExecs) {
      try {
        await executeNextStep(exec);
        stats.advanced++;
      } catch (err: any) {
        console.error("[Workflow run] " + exec.id, err.message);
        await prisma.workflowExecution.update({
          where: { id: exec.id },
          data: { status: "FAILED", errorMessage: err.message },
        });
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("[Cron Workflows]", error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}

// ─── Trigger workflow if conditions match ───
async function checkAndTriggerWorkflow(wf: any): Promise<number> {
  const triggerType = wf.triggerType;
  const config = (wf.triggerConfig as any) || {};

  // Find candidate leads not yet in execution for this workflow
  let leads: any[] = [];

  if (triggerType === "LEAD_CREATED") {
    const since = new Date(Date.now() - 86400000);
    leads = await prisma.lead.findMany({
      where: {
        organizationId: wf.organizationId,
        createdAt: { gte: since },
        ...(config.source ? { source: config.source as any } : {}),
      },
      include: LEAD_FILTER_INCLUDE,
      take: 200,
    });
    // Apply advanced filters (même moteur que les audiences/campagnes)
    if (config.filters) {
      leads = leads.filter((l) => evaluateLeadFilters(l, config.filters));
    }
  } else if (triggerType === "NO_RESPONSE_DAYS") {
    const days = config.days || 7;
    const cutoff = new Date(Date.now() - days * 86400000);
    leads = await prisma.lead.findMany({
      where: {
        organizationId: wf.organizationId,
        isConverted: false,
        createdAt: { lte: cutoff },
        messages: { none: { direction: "INBOUND" } },
      },
      include: LEAD_FILTER_INCLUDE,
      take: 50,
    });
    // Apply advanced filters (même moteur que les audiences/campagnes)
    if (config.filters) {
      leads = leads.filter((l) => evaluateLeadFilters(l, config.filters));
    }
  } else if (triggerType === "STAGE_CHANGED" || triggerType === "FORM_SUBMITTED") {
    // Déclencheurs événementiels (pipeline / soumission de formulaire) — pas dans le cron
    return 0;
  }

  // Filter out leads with existing execution
  const existingExecs = await prisma.workflowExecution.findMany({
    where: {
      workflowId: wf.id,
      leadId: { in: leads.map((l) => l.id) },
    },
    select: { leadId: true },
  });
  const executedIds = new Set(existingExecs.map((e) => e.leadId));
  const newLeads = leads.filter((l) => !executedIds.has(l.id));

  // Create executions
  const graph = wf.graph as any;
  const startNode = graph.nodes?.find((n: any) => n.type === "trigger");

  for (const lead of newLeads) {
    await prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        leadId: lead.id,
        status: "RUNNING",
        currentNode: startNode?.id || null,
        context: { trigger: triggerType },
        organizationId: wf.organizationId,
      },
    });
  }

  return newLeads.length;
}

// ─── Execute next step in a workflow execution ───
async function executeNextStep(exec: any) {
  const graph = exec.workflow.graph as any;
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  if (!exec.currentNode) {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  // Find current node
  const currentNode = nodes.find((n: any) => n.id === exec.currentNode);
  if (!currentNode) {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "FAILED", errorMessage: "Noeud introuvable" },
    });
    return;
  }

  // Find next node(s) based on outgoing edges
  const outgoingEdges = edges.filter((e: any) => e.source === exec.currentNode);

  let nextNodeId: string | null = null;

  if (currentNode.type === "trigger") {
    // Trigger node has been "consumed" — go to the connected node
    nextNodeId = outgoingEdges[0]?.target || null;
  } else if (currentNode.type === "action") {
    // Execute the action
    await executeAction(currentNode, exec);
    nextNodeId = outgoingEdges[0]?.target || null;
  } else if (currentNode.type === "condition") {
    // Evaluate condition, pick branch
    const result = await evaluateCondition(currentNode, exec);
    const matchingEdge = outgoingEdges.find((e: any) => e.sourceHandle === (result ? "yes" : "no"));
    nextNodeId = matchingEdge?.target || null;
  } else if (currentNode.type === "wait") {
    // Schedule waitUntil, then return
    const waitDays = currentNode.data?.days || 1;
    const waitUntil = new Date(Date.now() + waitDays * 86400000);
    const next = outgoingEdges[0]?.target || null;
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "WAITING", waitUntil, currentNode: next },
    });
    return;
  } else if (currentNode.type === "stop") {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return;
  }

  // Move to next node
  if (!nextNodeId) {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "COMPLETED", completedAt: new Date(), currentNode: null },
    });
  } else {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { currentNode: nextNodeId, waitUntil: null, status: "RUNNING" },
    });
  }
}
