"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLeadRouting } from "@/lib/pipeline-routing";
import { getCustomFields } from "@/lib/custom-fields";
import { computeLeadScore } from "@/lib/lead-score";

// ─── Rôles autorisés à assigner/réassigner un lead ───
function canAssignLeads(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

// ─── Get all pipelines of the organization ───
export async function getOrgPipelines() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const pipelines = await prisma.pipeline.findMany({
    where: { 
      organizationId: session.user.organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      formationType: true,
      isDefault: true,
      color: true,
      order: true,
    },
    orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return pipelines;
}

// ─── Get pipeline data ───
export async function getPipelineData(pipelineId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  // Déterminer le pipeline cible : celui passé, sinon le défaut, sinon le premier
  let targetPipelineId = pipelineId;
  // Si un pipelineId est fourni, vérifier qu'il est actif
  if (pipelineId) {
    const requested = await prisma.pipeline.findFirst({
      where: { id: pipelineId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!requested) {
      // Pipeline inactif ou inexistant → fallback sur le défaut
      targetPipelineId = undefined;
    }
  }
  if (!targetPipelineId) {
    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { organizationId, isDefault: true, isActive: true  },
      select: { id: true },
    });
    if (defaultPipeline) {
      targetPipelineId = defaultPipeline.id;
    } else {
      // Fallback : premier pipeline de l'org
      const firstPipeline = await prisma.pipeline.findFirst({
        where: { organizationId, isActive: true },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      targetPipelineId = firstPipeline?.id;
    }
  }

  // Si toujours pas de pipeline (cas edge), on récupère sans filtre
  const stageFilter = targetPipelineId 
    ? { organizationId, pipelineId: targetPipelineId }
    : { organizationId };

  const leadFilter = targetPipelineId
    ? { organizationId, isConverted: false, pipelineId: targetPipelineId }
    : { organizationId, isConverted: false };

  const [stages, leads, users] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: stageFilter,
      orderBy: { order: "asc" },
    }),
    prisma.lead.findMany({
      where: leadFilter,
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true } },
        program: { select: { id: true, name: true, code: true } },
        campaign: { select: { id: true, name: true } },
        _count: { select: { messages: true, activities: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { organizationId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
      select: { id: true, name: true, avatar: true },
    }),
  ]);

  // Auto-calculate lead scores — RETIRÉ du chargement de page (trop coûteux avec gros volumes)
  // Le score est désormais recalculé à la demande / à la création, pas à chaque rendu.
  // await calculateLeadScores(organizationId);

  // Calculate last contact date for each lead
  var leadIds = leads.map(function(l) { return l.id; });

  var [lastCalls, lastMessages, lastAppointments] = await Promise.all([
    prisma.call.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { calledAt: true },
    }),
    prisma.message.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, direction: "OUTBOUND" },
      _max: { sentAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, status: { in: ["COMPLETED", "CONFIRMED", "SCHEDULED"] } },
      _max: { startAt: true },
    }),
  ]);

  var enrichedLeads = leads.map(function(lead) {
    var callDate = lastCalls.find(function(c) { return c.leadId === lead.id; })?._max?.calledAt;
    var msgDate = lastMessages.find(function(m) { return m.leadId === lead.id; })?._max?.sentAt;
    var apptDate = lastAppointments.find(function(a) { return a.leadId === lead.id; })?._max?.startAt;

    var dates = [callDate, msgDate, apptDate].filter(Boolean) as Date[];
    var lastContactAt = dates.length > 0 ? new Date(Math.max(...dates.map(function(d) { return d.getTime(); }))) : null;

    var now = new Date();
    var daysSinceContact = lastContactAt
      ? Math.floor((now.getTime() - lastContactAt.getTime()) / 86_400_000)
      : Math.floor((now.getTime() - lead.createdAt.getTime()) / 86_400_000);

    return { ...lead, lastContactAt, daysSinceContact };
  });

  return { stages, leads: enrichedLeads, users, currentPipelineId: targetPipelineId };
}
// ─── Move lead to stage ───
export async function moveLeadToStage(leadId: string, stageId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { stageId },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_STAGE_CHANGED",
      description: `Lead déplacé vers une nouvelle étape`,
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
      metadata: { newStageId: stageId },
    },
  });

  // ─── Trigger workflows on stage change ───
  try {
    const matchingWorkflows = await prisma.workflow.findMany({
      where: {
        organizationId: session.user.organizationId,
        enabled: true,
        triggerType: "STAGE_CHANGED",
      },
    });

    for (const wf of matchingWorkflows) {
      const config = (wf.triggerConfig as any) || {};
      // Match if no specific stage configured, OR if matches target stage
      if (config.stageId && config.stageId !== stageId) continue;

      // Apply advanced filters
      if (config.filters && config.filters.rules && config.filters.rules.length > 0) {
        const fullLead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!fullLead || !evaluateFiltersInline(fullLead, config.filters)) continue;
      }

      // Avoid duplicate execution for same lead/workflow currently active
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
          context: { trigger: "STAGE_CHANGED", newStageId: stageId },
          organizationId: session.user.organizationId,
        },
      });
    }
  } catch (err) {
    console.error("[Workflow trigger STAGE_CHANGED]", err);
    // Don't fail the stage change if workflow trigger fails
  }

  revalidatePath("/pipeline");
  return lead;
}

// ─── Create new lead ───
const createLeadSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().min(8, "Téléphone requis"),
  whatsapp: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  city: z.string().optional(),
  source: z.enum([
    "WEBSITE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "PHONE_CALL",
    "WALK_IN", "REFERRAL", "SALON", "RADIO", "TV", "PARTNER", "IMPORT", "OTHER",
  ]),
  sourceDetail: z.string().optional(),
  programId: z.string().optional(),
  campusId: z.string().optional(),
  assignedToId: z.string().optional(),
});

export async function createLead(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  const data = createLeadSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    city: formData.get("city"),
    source: formData.get("source"),
    sourceDetail: formData.get("sourceDetail"),
    programId: formData.get("programId") || undefined,
    campusId: formData.get("campusId") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
  });

  // Routing automatique vers le bon pipeline selon la filière
const routing = await getLeadRouting(organizationId, data.programId || null);

if (!routing.stageId) throw new Error("Aucune étape par défaut configurée");

// Auto-assignation : le créateur du lead en devient l'assigné par défaut.
// Un admin peut toutefois désigner explicitement un autre commercial dans le formulaire.
var assignedToIdSafe =
  canAssignLeads(session.user.role) && data.assignedToId
    ? data.assignedToId
    : session.user.id;

const lead = await prisma.lead.create({
  data: {
    ...data,
    assignedToId: assignedToIdSafe,
    email: data.email || null,
    whatsapp: data.whatsapp || data.phone,
    stageId: routing.stageId,
    pipelineId: routing.pipelineId,
    organizationId,
    score: computeLeadScore({
      source: (data as any).source,
      email: data.email || null,
      whatsapp: data.whatsapp || data.phone,
      programId: (data as any).programId,
      campusId: (data as any).campusId,
    }),
  },
});

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Nouveau lead: ${data.firstName} ${data.lastName}`,
      userId: session.user.id,
      leadId: lead.id,
      organizationId,
    },
  });

  // Trace l'assignation dans l'historique du lead
  await prisma.activity.create({
    data: {
      type: "LEAD_ASSIGNED",
      description:
        assignedToIdSafe === session.user.id
          ? `Lead auto-assigné à ${session.user.name}`
          : "Lead assigné",
      userId: session.user.id,
      leadId: lead.id,
      organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true, lead };
}

// ─── Update lead score ───
export async function updateLeadScore(leadId: string, score: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.lead.update({
    where: { id: leadId },
    data: { score: Math.max(0, Math.min(100, score)) },
  });

  revalidatePath("/pipeline");
}

// ─── Assign lead ───
export async function assignLead(leadId: string, userId: string | null): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Seuls ADMIN/SUPER_ADMIN peuvent (ré)assigner un lead
  if (!canAssignLeads(session.user.role)) {
    return { success: false, error: "Seul un administrateur peut assigner les leads" };
  }

  // Sécurité multi-tenant : le lead doit appartenir à l'organisation
  var target = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!target) {
    return { success: false, error: "Lead introuvable" };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: userId },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_ASSIGNED",
      description: userId ? "Lead assigné" : "Lead désassigné",
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Get pipeline stats ───
export async function getPipelineStats() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [totalLeads, newLeadsWeek, convertedMonth, stages] = await Promise.all([
    prisma.lead.count({
      where: { organizationId, isConverted: false },
    }),
    prisma.lead.count({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.lead.count({
      where: { organizationId, isConverted: true, convertedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: "asc" },
    }),
  ]);

  return {
    totalLeads,
    newLeadsWeek,
    convertedMonth,
    stageBreakdown: stages.map((s) => ({
      name: s.name,
      count: s._count.leads,
      color: s.color,
    })),
  };
}

// ─── Update lead ───
export async function updateLead(leadId: string, data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  city?: string;
  source?: string;
  sourceDetail?: string;
  programId?: string | null;
  campusId?: string | null;
  assignedToId?: string | null;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  // Lit l'état actuel du lead pour comparer
  var currentLead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { programId: true, pipelineId: true, stageId: true },
  });
  if (!currentLead) throw new Error("Lead introuvable");

  var updateData: any = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email || null,
    whatsapp: data.whatsapp,
    city: data.city,
    source: data.source as any,
    sourceDetail: data.sourceDetail,
    programId: data.programId,
    campusId: data.campusId,
  };

  // Seul un admin peut modifier l'assignation via l'édition du lead
  if (canAssignLeads(session.user.role) && data.assignedToId !== undefined) {
    updateData.assignedToId = data.assignedToId;
  }

  // ─── Re-routing automatique si la filière change ───
  var programChanged = data.programId !== undefined && data.programId !== currentLead.programId;
  
  if (programChanged) {
    var { getLeadRouting } = await import("@/lib/pipeline-routing");
    var routing = await getLeadRouting(orgId, data.programId || null);

    // Si le pipeline cible est différent du pipeline actuel, on déplace le lead
    if (routing.pipelineId && routing.pipelineId !== currentLead.pipelineId) {
      updateData.pipelineId = routing.pipelineId;
      updateData.stageId = routing.stageId;  // On le met à l'étape "Nouveau" du nouveau pipeline
    }
  }

  var lead = await prisma.lead.update({
    where: { id: leadId },
    data: updateData,
  });

  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED" as any,
      description: "Informations du lead mises à jour",
      userId: session.user.id,
      leadId,
      organizationId: orgId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true, lead };
}

// ─── Delete lead ───
export async function deleteLead(leadId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Delete related records first
  await prisma.activity.deleteMany({ where: { leadId } });
  await prisma.message.deleteMany({ where: { leadId } });
  await prisma.document.deleteMany({ where: { leadId } });
  await prisma.emailCampaignRecipient.deleteMany({ where: { leadId } });

  await prisma.lead.delete({ where: { id: leadId } });

  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Delete multiple leads ───
export async function deleteLeads(leadIds: string[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  for (var id of leadIds) {
    await prisma.activity.deleteMany({ where: { leadId: id } });
    await prisma.message.deleteMany({ where: { leadId: id } });
    await prisma.document.deleteMany({ where: { leadId: id } });
    await prisma.emailCampaignRecipient.deleteMany({ where: { leadId: id } });
  }

  await prisma.lead.deleteMany({
    where: { id: { in: leadIds }, organizationId: session.user.organizationId },
  });

  revalidatePath("/pipeline");
  return { success: true, count: leadIds.length };
}

// ─── Import leads from CSV data (optimisé) ───
export async function importLeadsFromCSV(
  rows: Array<Record<string, string>>,
  opts?: { defaultSource?: string; defaultSourceDetail?: string }
) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var { organizationId } = session.user;

  // Champs système gérés nativement (tout le reste = custom field)
  var SYSTEM_KEYS = new Set([
    "firstName", "lastName", "phone", "email", "whatsapp",
    "city", "source", "sourceDetail", "programCode", "programId", "campusId",
    "civility", "country", "message", "subject",
  ]);

  // Config custom fields (non utilisé directement ici mais conservé pour cohérence)
  await getCustomFields();

  var programs = await prisma.program.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true },
  });

  // ── OPTIM 1 : charger TOUS les doublons existants en UNE requête ──
  var existingLeads = await prisma.lead.findMany({
    where: { organizationId },
    select: { phone: true, email: true },
  });
  var existingPhones = new Set<string>();
  var existingEmails = new Set<string>();
  existingLeads.forEach(function(l) {
    if (l.phone) existingPhones.add(l.phone.trim());
    if (l.email) existingEmails.add(l.email.trim().toLowerCase());
  });

  // ── OPTIM 2 : cache du routing par programId ──
  var routingCache: Record<string, { stageId: string | null; pipelineId: string | null }> = {};
  async function resolveRouting(programId: string | null) {
    var cacheKey = programId || "__none__";
    if (routingCache[cacheKey]) return routingCache[cacheKey];
    var r = await getLeadRouting(organizationId, programId);
    routingCache[cacheKey] = r;
    return r;
  }

  var sourceMap: Record<string, string> = {
    "site web": "WEBSITE", "website": "WEBSITE", "web": "WEBSITE",
    "facebook": "FACEBOOK", "fb": "FACEBOOK",
    "instagram": "INSTAGRAM", "insta": "INSTAGRAM",
    "whatsapp": "WHATSAPP", "wa": "WHATSAPP",
    "salon": "SALON", "forum": "SALON",
    "parrainage": "REFERRAL", "referral": "REFERRAL",
    "appel": "PHONE_CALL", "telephone": "PHONE_CALL", "téléphone": "PHONE_CALL", "phone": "PHONE_CALL", "phone_call": "PHONE_CALL",
    "visite": "WALK_IN", "walk-in": "WALK_IN", "walk in": "WALK_IN", "porte a porte": "WALK_IN",
    "radio": "RADIO", "tv": "TV", "television": "TV", "télévision": "TV",
    "partenaire": "PARTNER", "partner": "PARTNER",
    "autre": "OTHER", "other": "OTHER",
    "import": "IMPORT",
  };

  // Provenance déclarée pour tout le lot (source du fichier). La colonne « source »
  // par ligne, si présente, reste prioritaire ; sinon on retombe sur cette provenance.
  var VALID_SOURCES = new Set([
    "WEBSITE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "PHONE_CALL", "WALK_IN",
    "REFERRAL", "SALON", "RADIO", "TV", "PARTNER", "IMPORT", "OTHER",
  ]);
  var batchSource = opts?.defaultSource && VALID_SOURCES.has(opts.defaultSource) ? opts.defaultSource : "IMPORT";
  var batchDetail = opts?.defaultSourceDetail?.trim() || "";

  var created = 0;
  var skipped = 0;
  var errors: string[] = [];

  // Doublons DANS le fichier lui-même (deux lignes même tel/email)
  var seenPhones = new Set<string>();
  var seenEmails = new Set<string>();

  // Accumulateur pour insertion par lots
  var toInsert: any[] = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row.firstName || !row.lastName) {
      errors.push("Ligne " + (i + 2) + ": prenom et nom requis");
      skipped++;
      continue;
    }
    if (!row.phone && !row.email) {
      errors.push("Ligne " + (i + 2) + ": téléphone ou email requis");
      skipped++;
      continue;
    }

    var phoneTrim = row.phone ? row.phone.trim() : "";
    var emailTrim = row.email ? row.email.trim().toLowerCase() : "";

    // ── Doublon (base existante OU déjà vu dans ce fichier) ──
    var isDup =
      (phoneTrim && (existingPhones.has(phoneTrim) || seenPhones.has(phoneTrim))) ||
      (emailTrim && (existingEmails.has(emailTrim) || seenEmails.has(emailTrim)));
    if (isDup) {
      skipped++;
      continue;
    }

    // Match program
    var programId: string | null = null;
    if (row.programCode) {
      var match = programs.find(function(p) {
        return (p.code && p.code.toLowerCase() === row.programCode!.toLowerCase()) ||
          p.name.toLowerCase().includes(row.programCode!.toLowerCase());
      });
      if (match) programId = match.id;
    }

    // Source : colonne par ligne prioritaire, sinon provenance déclarée du lot, sinon Import
    var source = batchSource;
    if (row.source) {
      source = sourceMap[row.source.toLowerCase()] || batchSource;
    }

    // Custom fields
    var rowCustomFields: Record<string, string> = {};
    for (var fieldKey in row) {
      if (!row.hasOwnProperty(fieldKey)) continue;
      var fieldVal = row[fieldKey];
      if (!fieldVal || !String(fieldVal).trim()) continue;
      if (!SYSTEM_KEYS.has(fieldKey)) {
        rowCustomFields[fieldKey] = String(fieldVal).trim();
      }
    }

    // Routing (depuis le cache)
    var routing = await resolveRouting(programId);
    if (!routing.stageId) {
      errors.push("Ligne " + (i + 2) + ": Aucune étape configurée");
      skipped++;
      continue;
    }

    // Marquer comme vu (anti-doublon intra-fichier)
    if (phoneTrim) seenPhones.add(phoneTrim);
    if (emailTrim) seenEmails.add(emailTrim);

    var emailClean = row.email ? row.email.trim() : null;
    var whatsappClean = row.whatsapp?.trim() || phoneTrim || null;
    toInsert.push({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      phone: phoneTrim || "N/A",
      email: emailClean,
      whatsapp: whatsappClean,
      city: row.city?.trim() || null,
      source: source as any,
      sourceDetail: row.sourceDetail?.trim() || batchDetail || "Import CSV",
      stageId: routing.stageId,
      pipelineId: routing.pipelineId,
      programId,
      organizationId,
      // Score de base immédiat (interactions = 0 à l'import) — le cron affinera ensuite.
      score: computeLeadScore({ source, email: emailClean, whatsapp: whatsappClean, programId }),
      customFields: Object.keys(rowCustomFields).length > 0 ? rowCustomFields : undefined,
    });
  }

  // ── OPTIM 3 : insertion par lots ──
  var BATCH = 100;
  for (var b = 0; b < toInsert.length; b += BATCH) {
    var slice = toInsert.slice(b, b + BATCH);
    try {
      var res = await prisma.lead.createMany({ data: slice });
      created += res.count;
    } catch (err: any) {
      errors.push("Lot " + (b / BATCH + 1) + ": " + (err.message || "Erreur insertion"));
      skipped += slice.length;
    }
  }

  // Récupérer les IDs des leads créés (pour l'audience)
  // On retrouve les leads importés via leurs téléphones/emails (sur cette org)
  var insertedPhones = toInsert.map(function(l) { return l.phone; }).filter(function(p) { return p && p !== "N/A"; });
  var insertedEmails = toInsert.map(function(l) { return l.email; }).filter(Boolean) as string[];
  var createdLeadIds: string[] = [];
  if (insertedPhones.length > 0 || insertedEmails.length > 0) {
    var createdLeads = await prisma.lead.findMany({
      where: {
        organizationId,
        OR: [
          insertedPhones.length > 0 ? { phone: { in: insertedPhones } } : undefined,
          insertedEmails.length > 0 ? { email: { in: insertedEmails } } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    });
    createdLeadIds = createdLeads.map(function(l) { return l.id; });
  }

  revalidatePath("/pipeline");
  return { created, skipped, errors, total: rows.length, createdLeadIds };
}

// ─── Export leads as CSV string ───
export async function exportLeadsCSV() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var leads = await prisma.lead.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      stage: { select: { name: true } },
      program: { select: { name: true, code: true } },
      campus: { select: { name: true, city: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  var headers = [
    "Prenom", "Nom", "Téléphone", "Email", "WhatsApp", "Ville",
    "Source", "Detail source", "Filière", "Campus", "Étape",
    "Score", "Assigne a", "Date création", "Converti"
  ];

  var rows = leads.map(function(l) {
    return [
      l.firstName,
      l.lastName,
      l.phone,
      l.email || "",
      l.whatsapp || "",
      l.city || "",
      l.source,
      l.sourceDetail || "",
      l.program?.name || "",
      l.campus?.city || "",
      l.stage?.name || "",
      String(l.score),
      l.assignedTo?.name || "",
      l.createdAt.toISOString().split("T")[0],
      l.isConverted ? "Oui" : "Non",
    ];
  });

  // Build CSV with BOM for Excel
  var csvContent = "\uFEFF" + headers.join(";") + "\n" +
    rows.map(function(row) {
      return row.map(function(cell) {
        // Escape cells containing separator or quotes
        if (cell.includes(";") || cell.includes('"') || cell.includes("\n")) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(";");
    }).join("\n");

  return csvContent;
}

// ─── Recalcul manuel des scores (bouton admin) ───
export async function recalculateOrgLeadScores() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Réservé aux administrateurs");
  }
  var result = await calculateLeadScores(session.user.organizationId);
  revalidatePath("/pipeline");
  return result; // { updated }
}

// ─── Calculate lead score ───
export async function calculateLeadScores(orgId: string) {
  var leads = await prisma.lead.findMany({
    where: { organizationId: orgId, isConverted: false },
    select: {
      id: true, source: true, email: true, whatsapp: true,
      programId: true, campusId: true, score: true, createdAt: true,
      _count: { select: { calls: true, messages: true, appointments: true } },
    },
  });

  var now = new Date();

  // Get last contact dates
  var leadIds = leads.map(function(l) { return l.id; });
  var [lastCalls, lastMessages] = await Promise.all([
    prisma.call.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { calledAt: true },
    }),
    prisma.message.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, direction: "OUTBOUND" },
      _max: { sentAt: true },
    }),
  ]);

  var updates: { id: string; score: number }[] = [];

  for (var lead of leads) {
    // Dernier contact (appel/message) pour le bonus de récence
    var callDate = lastCalls.find(function(c) { return c.leadId === lead.id; })?._max?.calledAt;
    var msgDate = lastMessages.find(function(m) { return m.leadId === lead.id; })?._max?.sentAt;
    var dates = [callDate, msgDate].filter(Boolean) as Date[];
    var lastContact = dates.length > 0 ? new Date(Math.max(...dates.map(function(d) { return d.getTime(); }))) : null;

    var score = computeLeadScore({
      source: lead.source,
      email: lead.email,
      whatsapp: lead.whatsapp,
      programId: lead.programId,
      campusId: lead.campusId,
      calls: lead._count.calls,
      messages: lead._count.messages,
      appointments: lead._count.appointments,
      lastContact,
      now,
    });

    if (score !== lead.score) {
      updates.push({ id: lead.id, score });
    }
  }

  // Mise à jour groupée : 1 requête SQL par lot (bien plus rapide qu'un UPDATE par lead).
  // UPDATE ... FROM (unnest(ids), unnest(scores)) — évite N allers-retours DB.
  if (updates.length > 0) {
    var CHUNK = 1000;
    for (var b = 0; b < updates.length; b += CHUNK) {
      var slice = updates.slice(b, b + CHUNK);
      var ids = slice.map(function(u) { return u.id; });
      var scores = slice.map(function(u) { return u.score; });
      await prisma.$executeRaw`
        UPDATE "leads" AS l
        SET score = data.score
        FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${scores}::int[]) AS score) AS data
        WHERE l.id = data.id AND l."organizationId" = ${orgId}
      `;
    }
  }

  return { updated: updates.length };
}

// ─── Detect duplicate leads ───
export async function detectDuplicates() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  var leads = await prisma.lead.findMany({
    where: { organizationId: orgId, isConverted: false },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, email: true, whatsapp: true,
      score: true, source: true, createdAt: true,
      stageId: true,
      assignedTo: { select: { name: true } },
      program: { select: { name: true } },
      _count: { select: { calls: true, messages: true, appointments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  var duplicateGroups: { key: string; reason: string; leads: typeof leads }[] = [];
  var processed = new Set<string>();

  for (var i = 0; i < leads.length; i++) {
    if (processed.has(leads[i].id)) continue;

    var group: typeof leads = [leads[i]];

    for (var j = i + 1; j < leads.length; j++) {
      if (processed.has(leads[j].id)) continue;

      var reason = "";

      // Same phone
      if (leads[i].phone && leads[j].phone) {
        var p1 = leads[i].phone.replace(/\D/g, "");
        var p2 = leads[j].phone.replace(/\D/g, "");
        if (p1.length >= 8 && p1 === p2) {
          reason = "Même téléphone";
        }
      }

      // Same email
      if (!reason && leads[i].email && leads[j].email) {
        if (leads[i].email!.toLowerCase() === leads[j].email!.toLowerCase()) {
          reason = "Même email";
        }
      }

      if (reason) {
        group.push(leads[j]);
        processed.add(leads[j].id);
        if (!duplicateGroups.find(function(g) { return g.key === leads[i].id; })) {
          // Set reason for first match
        }
      }
    }

    if (group.length > 1) {
      processed.add(leads[i].id);
      duplicateGroups.push({
        key: leads[i].id,
        reason: getGroupReason(leads[i], group.slice(1)),
        leads: group,
      });
    }
  }

  return duplicateGroups;
}

function getGroupReason(lead: any, others: any[]): string {
  var reasons: string[] = [];
  for (var other of others) {
    var p1 = lead.phone?.replace(/\D/g, "") || "";
    var p2 = other.phone?.replace(/\D/g, "") || "";
    if (p1.length >= 8 && p1 === p2 && !reasons.includes("Même téléphone")) reasons.push("Même téléphone");
    if (lead.email && other.email && lead.email!.toLowerCase() === other.email!.toLowerCase() && !reasons.includes("Même email")) reasons.push("Même email");
  }
  return reasons.join(" + ");
}

// ─── Merge duplicate leads ───
export async function mergeDuplicateLeads(keepId: string, removeIds: string[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  // Verify all leads belong to org
  var leads = await prisma.lead.findMany({
    where: { id: { in: [keepId, ...removeIds] }, organizationId: orgId },
  });

  if (leads.length !== 1 + removeIds.length) throw new Error("Leads introuvables");

  var keepLead = leads.find(function(l) { return l.id === keepId; });
  if (!keepLead) throw new Error("Lead principal introuvable");

  // Transfer all related data to the kept lead
  for (var removeId of removeIds) {
    await prisma.activity.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.message.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.call.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.appointment.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.task.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.document.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.emailCampaignRecipient.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });

    // Merge missing fields
    var removeLead = leads.find(function(l) { return l.id === removeId; });
    if (removeLead) {
      var updates: any = {};
      if (!keepLead.email && removeLead.email) updates.email = removeLead.email;
      if (!keepLead.whatsapp && removeLead.whatsapp) updates.whatsapp = removeLead.whatsapp;
      if (!keepLead.city && removeLead.city) updates.city = removeLead.city;
      if (!keepLead.programId && removeLead.programId) updates.programId = removeLead.programId;
      if (!keepLead.campusId && removeLead.campusId) updates.campusId = removeLead.campusId;
      if (!keepLead.assignedToId && removeLead.assignedToId) updates.assignedToId = removeLead.assignedToId;

      if (Object.keys(updates).length > 0) {
        await prisma.lead.update({ where: { id: keepId }, data: updates });
      }
    }

    // Delete the duplicate
    await prisma.lead.delete({ where: { id: removeId } });
  }

  // Log activity
  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED" as any,
      description: removeIds.length + " doublon(s) fusionné(s)",
      userId: session.user.id,
      leadId: keepId,
      organizationId: orgId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Evaluate filters helper (duplicated for server actions) ───
function evaluateFiltersInline(lead: any, filters: any): boolean {
  if (!filters || !filters.rules || filters.rules.length === 0) return true;
  const op = filters.operator || "AND";
  const results = filters.rules.map((rule: any) => {
    if (rule.operator_group) {
      return evaluateFiltersInline(lead, { operator: rule.operator_group, rules: rule.rules || [] });
    }
    return evaluateRuleInline(lead, rule);
  });
  if (op === "AND") return results.every((r: boolean) => r);
  return results.some((r: boolean) => r);
}

function evaluateRuleInline(lead: any, rule: any): boolean {
  const field = rule.field;
  const operator = rule.operator || "equals";
  const value = rule.value;

  // Handle custom fields
  let leadValue: any = lead[field];
  if (leadValue === undefined && lead.customFields && typeof lead.customFields === "object") {
    leadValue = (lead.customFields as any)[field];
  }

  if (operator === "exists") return leadValue !== null && leadValue !== undefined && leadValue !== "";
  if (operator === "not_exists") return leadValue === null || leadValue === undefined || leadValue === "";
  if (operator === "equals") return String(leadValue || "") === String(value || "");
  if (operator === "not_equals") return String(leadValue || "") !== String(value || "");
  if (operator === "contains") return String(leadValue || "").toLowerCase().includes(String(value || "").toLowerCase());
  if (operator === "starts_with") return String(leadValue || "").toLowerCase().startsWith(String(value || "").toLowerCase());
  if (operator === "greater_than") {
    if (rule.field?.includes("date") || rule.field?.includes("Date") || rule.field?.includes("At")) {
      return new Date(leadValue) > new Date(value);
    }
    return Number(leadValue) > Number(value);
  }
  if (operator === "less_than") {
    if (rule.field?.includes("date") || rule.field?.includes("Date") || rule.field?.includes("At")) {
      return new Date(leadValue) < new Date(value);
    }
    return Number(leadValue) < Number(value);
  }
  return false;
}