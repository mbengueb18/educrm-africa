/**
 * Moteur d'exécution des workflows — partagé entre :
 *  - le cron `/api/cron/workflows` (exécution asynchrone, pas à pas, avec `wait`)
 *  - le test manuel depuis l'éditeur (exécution synchrone, `wait` ignoré)
 *
 * Les actions ont de VRAIS effets de bord (emails/WhatsApp envoyés, tâches créées,
 * étape modifiée). Le test manuel les exécute donc réellement sur le lead ciblé.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { blocksToHtml } from "@/lib/email-blocks";
import { sendTemplateMessage, resolveVariablesFromLead } from "@/lib/whatsapp/send";
import { evaluateLeadFilters } from "@/lib/lead-filters-eval";

// Relations à charger pour qu'un lead soit évaluable contre les filtres avancés
// (chemins pointés type "program.formationType", champs d'assignation/campus…).
export const LEAD_FILTER_INCLUDE = {
  program: { select: { name: true, formationType: true } },
  campus: { select: { id: true, name: true, city: true } },
  stage: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

// ─── Exécution d'un noeud action ───
export async function executeAction(node: any, exec: { leadId?: string | null }) {
  const action = node.data?.action;
  if (!exec.leadId) return;

  const lead = await prisma.lead.findUnique({
    where: { id: exec.leadId },
    include: {
      organization: { select: { name: true } },
      program: { select: { name: true } },
    },
  });
  if (!lead) return;

  if (action === "SEND_EMAIL") {
    if (!lead.email) return;
    const subject = replaceVars(node.data?.subject || "", lead);

    let body = node.data?.body || "";
    let isHtml = node.data?.isHtml === true;

    // Si on a des blocs visuels, régénérer le HTML depuis eux
    if (node.data?.blocks && Array.isArray(node.data.blocks) && node.data.blocks.length > 0) {
      body = blocksToHtml(node.data.blocks, node.data?.brandColor || "#1B4F72");
      isHtml = true;
    }

    body = replaceVars(body, lead);

    if (!isHtml) {
      const trimmed = body.trim();
      isHtml = trimmed.startsWith("<") && (trimmed.includes("<html") || trimmed.includes("<!DOCTYPE") || trimmed.includes("<div") || trimmed.includes("<table") || trimmed.includes("<body"));
    }

    if (!body.trim()) {
      console.error("[Workflow SEND_EMAIL] Empty body for lead", lead.id);
      return;
    }

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
    // Échéance relative : « dans N jours »
    let dueDate: Date | null = null;
    const offset = Number(node.data?.dueOffsetDays);
    if (Number.isFinite(offset) && offset >= 0 && node.data?.dueOffsetDays !== null && node.data?.dueOffsetDays !== "") {
      dueDate = new Date(Date.now() + offset * 86400000);
    }

    // Assignation : conseiller précis (si valide/actif) sinon conseiller du lead sinon défaut
    let assignedToId: string | null = null;
    if (node.data?.assigneeUserId) {
      const u = await prisma.user.findFirst({
        where: { id: node.data.assigneeUserId, organizationId: lead.organizationId, isActive: true },
        select: { id: true },
      });
      assignedToId = u?.id || null;
    }
    if (!assignedToId) assignedToId = lead.assignedToId || (await getDefaultUser(lead.organizationId));

    await prisma.task.create({
      data: {
        title: replaceVars(node.data?.title || "Tâche", lead),
        description: replaceVars(node.data?.description || "", lead),
        type: (node.data?.taskType || "TODO") as any,
        priority: (node.data?.priority || "MEDIUM") as any,
        status: "TODO",
        leadId: lead.id,
        assignedToId,
        dueDate: dueDate || undefined,
        reminderAt: dueDate && node.data?.reminderAtDue ? dueDate : undefined,
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
  } else if (action === "SEND_WHATSAPP") {
    // Numéro : WhatsApp dédié sinon téléphone principal
    const to = lead.whatsapp || lead.phone;
    if (!to) {
      console.error("[Workflow SEND_WHATSAPP] Lead sans numéro", lead.id);
      return;
    }

    const templateId = node.data?.whatsappTemplateId;
    if (!templateId) {
      console.error("[Workflow SEND_WHATSAPP] Aucun template configuré", node.id);
      return;
    }

    // Le template doit exister, appartenir à l'org et être APPROUVÉ par Meta
    const template = await prisma.whatsAppTemplate.findFirst({
      where: { id: templateId, organizationId: lead.organizationId, status: "APPROVED" },
    });
    if (!template) {
      console.error("[Workflow SEND_WHATSAPP] Template introuvable ou non approuvé", templateId);
      return;
    }

    const bodyVariables = resolveVariablesFromLead(
      template.bodyText,
      (template.variableMapping as Record<string, string> | null) || null,
      lead,
    );

    const result = await sendTemplateMessage(lead.organizationId, {
      to,
      templateName: template.metaName,
      templateLanguage: template.language,
      bodyVariables,
    });

    // Contenu lisible pour l'inbox : substituer {{n}} par les valeurs résolues
    let resolvedContent = template.bodyText;
    bodyVariables.forEach((val, idx) => {
      resolvedContent = resolvedContent.replace(new RegExp("\\{\\{" + (idx + 1) + "\\}\\}", "g"), val);
    });

    await prisma.message.create({
      data: {
        leadId: lead.id,
        channel: "WHATSAPP",
        direction: "OUTBOUND",
        content: resolvedContent,
        status: result.success ? "SENT" : "FAILED",
        externalId: result.metaMessageId || null,
        organizationId: lead.organizationId,
      },
    });

    if (!result.success) {
      console.error("[Workflow SEND_WHATSAPP] Échec envoi", lead.id, result.errorCode, result.errorMessage);
    }
  } else if (action === "ASSIGN_TO") {
    const mode = node.data?.assignMode || "round_robin";
    let targetUserId: string | null = null;

    if (mode === "specific" && node.data?.userId) {
      // Vérifier que l'utilisateur appartient à l'org et est actif
      const u = await prisma.user.findFirst({
        where: { id: node.data.userId, organizationId: lead.organizationId, isActive: true },
        select: { id: true },
      });
      targetUserId = u?.id || null;
    } else {
      // Round-robin « moins chargé » parmi les commerciaux/admins actifs
      const where: any = {
        organizationId: lead.organizationId,
        isActive: true,
        role: { in: ["ADMIN", "COMMERCIAL"] },
      };
      // Optionnel : restreindre aux conseillers du même campus que le lead
      if (node.data?.sameCampusAsLead && lead.campusId) {
        where.OR = [{ campusId: lead.campusId }, { campusId: null }];
      }
      const users = await prisma.user.findMany({ where, select: { id: true } });
      if (users.length > 0) {
        const counts = await prisma.lead.groupBy({
          by: ["assignedToId"],
          where: {
            organizationId: lead.organizationId,
            isConverted: false,
            assignedToId: { in: users.map((u) => u.id) },
          },
          _count: { _all: true },
        });
        const countMap = new Map(counts.map((c) => [c.assignedToId, c._count._all]));
        users.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0));
        targetUserId = users[0].id;
      }
    }

    if (targetUserId && targetUserId !== lead.assignedToId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assignedToId: targetUserId },
      });
      await prisma.activity.create({
        data: {
          type: "LEAD_ASSIGNED",
          description: "Lead assigné automatiquement par workflow",
          leadId: lead.id,
          organizationId: lead.organizationId,
          metadata: { assignedToId: targetUserId, assignMode: mode } as any,
        },
      });
    } else if (!targetUserId) {
      console.error("[Workflow ASSIGN_TO] Aucun conseiller éligible", lead.id);
    }
  }
}

// ─── Évaluation d'un noeud condition ───
export async function evaluateCondition(node: any, exec: { leadId?: string | null }): Promise<boolean> {
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

export function replaceVars(text: string, lead: any): string {
  return text
    .replace(/\{\{prenom\}\}/gi, lead.firstName || "")
    .replace(/\{\{nom\}\}/gi, lead.lastName || "")
    .replace(/\{\{email\}\}/gi, lead.email || "")
    .replace(/\{\{ecole\}\}/gi, lead.organization?.name || "");
}

export async function getDefaultUser(orgId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { organizationId: orgId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("No active user in org");
  return user.id;
}

// ─── Déclenchement événementiel : soumission de formulaire ───
// Appelé (fire-and-forget) depuis la route de soumission de formulaire, à la
// manière du déclencheur STAGE_CHANGED. Ne throw jamais vers l'appelant.
export async function triggerFormSubmittedWorkflows(
  organizationId: string,
  leadId: string,
  formId: string,
): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    where: { organizationId, enabled: true, triggerType: "FORM_SUBMITTED" },
  });
  if (workflows.length === 0) return;

  // Chargé paresseusement seulement si un workflow a des filtres
  let lead: any = null;

  for (const wf of workflows) {
    const config = (wf.triggerConfig as any) || {};

    // Filtre sur un formulaire précis (vide = tous les formulaires)
    if (config.formId && config.formId !== formId) continue;

    // Filtres avancés (même moteur que les audiences/campagnes)
    if (config.filters && Array.isArray(config.filters.rules) && config.filters.rules.length > 0) {
      if (!lead) {
        lead = await prisma.lead.findUnique({
          where: { id: leadId },
          include: LEAD_FILTER_INCLUDE,
        });
      }
      if (!lead || !evaluateLeadFilters(lead, config.filters)) continue;
    }

    // Éviter un doublon d'exécution active pour ce lead/workflow
    const existing = await prisma.workflowExecution.findFirst({
      where: { workflowId: wf.id, leadId, status: { in: ["RUNNING", "WAITING"] } },
    });
    if (existing) continue;

    const graph = wf.graph as any;
    const startNode = graph.nodes?.find((n: any) => n.type === "trigger");

    await prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        leadId,
        status: "RUNNING",
        currentNode: startNode?.id || null,
        context: { trigger: "FORM_SUBMITTED", formId },
        organizationId,
      },
    });
  }
}

// ─── Runner synchrone pour le TEST MANUEL depuis l'éditeur ───
export interface WorkflowTestStep {
  nodeId: string;
  type: string;
  label: string;
  detail: string;
}

/**
 * Exécute le workflow de bout en bout sur un lead, de façon synchrone.
 * Les noeuds `wait` sont IGNORÉS (on passe au suivant immédiatement) afin de
 * dérouler tout le graphe en une passe. Les actions ont de vrais effets de bord.
 */
export async function runWorkflowTest(
  graph: any,
  leadId: string,
): Promise<{ steps: WorkflowTestStep[]; status: string }> {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const start = nodes.find((n: any) => n.type === "trigger");
  const steps: WorkflowTestStep[] = [];

  if (!start) return { steps, status: "NO_TRIGGER" };

  const exec = { leadId };
  let current: any = start;
  let guard = 0;

  while (current && guard < 50) {
    guard++;
    const outgoing = edges.filter((e: any) => e.source === current.id);
    const nextOf = (target: string | undefined | null) => nodes.find((n: any) => n.id === target) || null;

    if (current.type === "trigger") {
      steps.push({ nodeId: current.id, type: "trigger", label: current.data?.label || "Déclencheur", detail: "Point de départ" });
      current = nextOf(outgoing[0]?.target);
    } else if (current.type === "action") {
      try {
        await executeAction(current, exec);
        steps.push({ nodeId: current.id, type: "action", label: current.data?.label || current.data?.action || "Action", detail: "Exécutée ✓" });
      } catch (e: any) {
        steps.push({ nodeId: current.id, type: "action", label: current.data?.label || current.data?.action || "Action", detail: "Échec : " + (e?.message || "erreur") });
        return { steps, status: "FAILED" };
      }
      current = nextOf(outgoing[0]?.target);
    } else if (current.type === "condition") {
      const result = await evaluateCondition(current, exec);
      steps.push({ nodeId: current.id, type: "condition", label: current.data?.label || "Condition", detail: result ? "Vrai → branche OUI" : "Faux → branche NON" });
      const edge = outgoing.find((e: any) => e.sourceHandle === (result ? "yes" : "no"));
      current = nextOf(edge?.target);
    } else if (current.type === "wait") {
      steps.push({ nodeId: current.id, type: "wait", label: "Attendre", detail: (current.data?.days || 1) + " j — ignoré en mode test" });
      current = nextOf(outgoing[0]?.target);
    } else if (current.type === "stop") {
      steps.push({ nodeId: current.id, type: "stop", label: "Fin", detail: "Arrêt du workflow" });
      current = null;
    } else {
      current = null;
    }
  }

  return { steps, status: "COMPLETED" };
}
