import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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
    // Recent leads (last 24h) — duplicates filtered out below
    const since = new Date(Date.now() - 86400000);
    leads = await prisma.lead.findMany({
      where: {
        organizationId: wf.organizationId,
        createdAt: { gte: since },
        ...(config.source ? { source: config.source as any } : {}),
      },
      take: 50,
    });
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
      take: 50,
    });
  } else if (triggerType === "STAGE_CHANGED") {
    // Triggered manually via activity event — skip in cron
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

// ─── Execute an action node ───
async function executeAction(node: any, exec: any) {
  const action = node.data?.action;
  if (!exec.leadId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: exec.leadId },
    include: { organization: { select: { name: true } } },
  });
  if (!lead) return;

  if (action === "SEND_EMAIL") {
    if (!lead.email) return;
    const subject = replaceVars(node.data?.subject || "", lead);
    const body = replaceVars(node.data?.body || "", lead);
    // Auto-detect HTML: if body starts with HTML tag, mark as HTML
    const trimmed = body.trim();
    const isHtml = trimmed.startsWith("<") && (trimmed.includes("<html") || trimmed.includes("<!DOCTYPE") || trimmed.includes("<div") || trimmed.includes("<table") || trimmed.includes("<body"));
    await sendEmail({
      to: lead.email,
      toName: lead.firstName + " " + lead.lastName,
      subject,
      body,
      leadId: lead.id,
      organizationId: lead.organizationId,
      isHtml,
    });
  } else if (action === "CREATE_TASK") {
    await prisma.task.create({
      data: {
        title: replaceVars(node.data?.title || "Tâche", lead),
        description: replaceVars(node.data?.description || "", lead),
        type: (node.data?.taskType || "TODO") as any,
        priority: (node.data?.priority || "MEDIUM") as any,
        status: "TODO",
        leadId: lead.id,
        assignedToId: lead.assignedToId || (await getDefaultUser(lead.organizationId)),
        organizationId: lead.organizationId,
      },
    });
  } else if (action === "CHANGE_STAGE") {
    if (node.data?.stageId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { stageId: node.data.stageId },
      });
      await prisma.activity.create({
        data: {
          type: "LEAD_STAGE_CHANGED",
          description: "Étape changée par workflow",
          leadId: lead.id,
          organizationId: lead.organizationId,
        },
      });
    }
  } else if (action === "INCREASE_SCORE") {
    const delta = node.data?.delta || 10;
    await prisma.lead.update({
      where: { id: lead.id },
      data: { score: { increment: delta } },
    });
  } else if (action === "ADD_NOTE") {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        description: replaceVars(node.data?.note || "", lead),
        leadId: lead.id,
        organizationId: lead.organizationId,
      },
    });
  }
}

// ─── Evaluate a condition node ───
async function evaluateCondition(node: any, exec: any): Promise<boolean> {
  if (!exec.leadId) return false;
  const lead = await prisma.lead.findUnique({ where: { id: exec.leadId } });
  if (!lead) return false;

  const field = node.data?.field;
  const operator = node.data?.operator || "equals";
  const value = node.data?.value;

  let leadValue: any = (lead as any)[field];

  if (operator === "equals") return String(leadValue) === String(value);
  if (operator === "not_equals") return String(leadValue) !== String(value);
  if (operator === "contains") return String(leadValue || "").toLowerCase().includes(String(value).toLowerCase());
  if (operator === "greater_than") return Number(leadValue) > Number(value);
  if (operator === "less_than") return Number(leadValue) < Number(value);
  if (operator === "exists") return leadValue !== null && leadValue !== undefined && leadValue !== "";
  return false;
}

function replaceVars(text: string, lead: any): string {
  return text
    .replace(/\{\{prenom\}\}/gi, lead.firstName || "")
    .replace(/\{\{nom\}\}/gi, lead.lastName || "")
    .replace(/\{\{email\}\}/gi, lead.email || "")
    .replace(/\{\{ecole\}\}/gi, lead.organization?.name || "");
}

async function getDefaultUser(orgId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { organizationId: orgId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("No active user in org");
  return user.id;
}