"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";
import { buildLeadWhere } from "@/lib/lead-filters";
import { getCustomFields } from "@/lib/custom-fields";

/**
 * Helper local : vérifie l'accès aux campagnes WhatsApp depuis les audiences
 */
async function assertCanUseWhatsAppCampaigns(organizationId: string) {
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_CAMPAIGNS");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "Les campagnes WhatsApp ne sont disponibles qu'en plan Performance. " +
        "Passez à Performance pour envoyer des campagnes WhatsApp à vos audiences."
      );
    }
    throw error;
  }
}

// ─── Types pour les règles dynamiques ───
export interface FilterRule {
  field: string;       // ex: "source", "score", "customFields.budget", "stage.name"
  operator: string;    // "equals", "not_equals", "contains", "greater_than", "less_than", "in", "not_in", "exists", "not_exists"
  value?: any;
}

export interface FilterGroup {
  operator: "AND" | "OR";
  rules: (FilterRule | FilterGroup)[];
}

// ─── LIST audiences ───
export async function getAudiences() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audiences = await prisma.audience.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  // Pour les audiences DYNAMIC, le memberCount stocké peut être périmé
  // On le met à jour si non évalué depuis 5 minutes
  const now = Date.now();
  for (const a of audiences) {
    if (a.type === "DYNAMIC") {
      const lastEval = a.lastEvaluatedAt?.getTime() || 0;
      if (now - lastEval > 5 * 60 * 1000) {
        const count = await evaluateDynamicCount(a.id);
        await prisma.audience.update({
          where: { id: a.id },
          data: { memberCount: count, lastEvaluatedAt: new Date() },
        });
        a.memberCount = count;
      }
    }
  }

  return audiences;
}

// ─── GET single audience ───
export async function getAudience(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });

  if (!audience) throw new Error("Audience introuvable");
  return audience;
}

// ─── CREATE audience ───
const createAudienceSchema = z.object({
  name: z.string().min(1, "Nom requis").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["STATIC", "DYNAMIC", "IMPORTED"]).default("STATIC"),
  color: z.string().optional(),
  rules: z.any().optional(),
  importMetadata: z.any().optional(),
});

export async function createAudience(input: z.infer<typeof createAudienceSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const data = createAudienceSchema.parse(input);
  const orgId = session.user.organizationId;

  // Vérification unicité du nom
  const existing = await prisma.audience.findFirst({
    where: { organizationId: orgId, name: data.name },
  });
  if (existing) throw new Error(`Une audience nommée "${data.name}" existe déjà`);

  const audience = await prisma.audience.create({
    data: {
      name: data.name,
      description: data.description || null,
      type: data.type,
      color: data.color || null,
      rules: data.rules || undefined,
      importMetadata: data.importMetadata || undefined,
      organizationId: orgId,
      createdById: session.user.id,
    },
  });

  // Pour les DYNAMIC : calcul initial du memberCount
  if (audience.type === "DYNAMIC") {
    const count = await evaluateDynamicCount(audience.id);
    await prisma.audience.update({
      where: { id: audience.id },
      data: { memberCount: count, lastEvaluatedAt: new Date() },
    });
  }

  revalidatePath("/audiences");
  return { success: true, audience };
}

// ─── UPDATE audience ───
const updateAudienceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().nullable().optional(),
  rules: z.any().optional(),
});

export async function updateAudience(audienceId: string, input: z.infer<typeof updateAudienceSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const data = updateAudienceSchema.parse(input);
  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
  });
  if (!audience) throw new Error("Audience introuvable");

  // Vérification unicité du nom si changé
  if (data.name && data.name !== audience.name) {
    const existing = await prisma.audience.findFirst({
      where: { organizationId: orgId, name: data.name, NOT: { id: audienceId } },
    });
    if (existing) throw new Error(`Une audience nommée "${data.name}" existe déjà`);
  }

  const updated = await prisma.audience.update({
    where: { id: audienceId },
    data,
  });

  // Si on a changé les règles d'un DYNAMIC : recalcul du count
  if (updated.type === "DYNAMIC" && data.rules !== undefined) {
    const count = await evaluateDynamicCount(audienceId);
    await prisma.audience.update({
      where: { id: audienceId },
      data: { memberCount: count, lastEvaluatedAt: new Date() },
    });
  }

  revalidatePath("/audiences");
  revalidatePath(`/audiences/${audienceId}`);
  return { success: true, audience: updated };
}

// ─── DELETE audience ───
export async function deleteAudience(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
  });
  if (!audience) throw new Error("Audience introuvable");

  await prisma.audience.delete({ where: { id: audienceId } });
  // Les AudienceMember sont supprimés en cascade (onDelete: Cascade)

  revalidatePath("/audiences");
  return { success: true };
}

// ─── GET LEADS of an audience (with pagination) ───
export async function getAudienceLeads(audienceId: string, page = 1, pageSize = 50) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
  });
  if (!audience) throw new Error("Audience introuvable");

  const orgId = session.user.organizationId;
  const skip = (page - 1) * pageSize;

  if (audience.type === "DYNAMIC") {
    // Évaluer les règles en live
    const allLeads = await evaluateDynamicLeads(audienceId);
    const total = allLeads.length;
    const ids = allLeads.slice(skip, skip + pageSize);
    
    const leads = await prisma.lead.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        stage: { select: { name: true, color: true } },
        program: { select: { name: true } },
      },
    });
    
    // Préserver l'ordre
    const leadsMap = new Map(leads.map(l => [l.id, l]));
    const orderedLeads = ids.map(id => leadsMap.get(id)).filter(Boolean);
    
    return { leads: orderedLeads, total, page, pageSize };
  } else {
    // STATIC / IMPORTED : on lit AudienceMember
    // Sécurité multi-tenant : n'inclure que les membres dont le lead appartient à l'org
    const memberWhere = { audienceId, lead: { organizationId: orgId } };
    const [members, total] = await Promise.all([
      prisma.audienceMember.findMany({
        where: memberWhere,
        include: {
          lead: {
            include: {
              assignedTo: { select: { id: true, name: true } },
              stage: { select: { name: true, color: true } },
              program: { select: { name: true } },
            },
          },
        },
        orderBy: { addedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.audienceMember.count({ where: memberWhere }),
    ]);

    return {
      leads: members.map(m => m.lead),
      total,
      page,
      pageSize,
    };
  }
}

// ─── ADD leads to STATIC audience ───
export async function addLeadsToAudience(audienceId: string, leadIds: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
  });
  if (!audience) throw new Error("Audience introuvable");
  if (audience.type === "DYNAMIC") throw new Error("Impossible d'ajouter manuellement à une audience dynamique");

  // Filtrer les leads qui existent et appartiennent à l'org
  const validLeads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, organizationId: session.user.organizationId },
    select: { id: true },
  });

  // Insertion en batch, ignorant les doublons via skipDuplicates
  const result = await prisma.audienceMember.createMany({
    data: validLeads.map(l => ({
      audienceId,
      leadId: l.id,
      addedById: session.user.id,
    })),
    skipDuplicates: true,
  });

  // Mise à jour du count
  const newCount = await prisma.audienceMember.count({ where: { audienceId } });
  await prisma.audience.update({
    where: { id: audienceId },
    data: { memberCount: newCount },
  });

  revalidatePath("/audiences");
  revalidatePath(`/audiences/${audienceId}`);
  return { added: result.count, total: newCount };
}

// ─── REMOVE leads from STATIC audience ───
export async function removeLeadsFromAudience(audienceId: string, leadIds: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
  });
  if (!audience) throw new Error("Audience introuvable");
  if (audience.type === "DYNAMIC") throw new Error("Impossible de retirer manuellement d'une audience dynamique");

  const result = await prisma.audienceMember.deleteMany({
    where: { audienceId, leadId: { in: leadIds } },
  });

  const newCount = await prisma.audienceMember.count({ where: { audienceId } });
  await prisma.audience.update({
    where: { id: audienceId },
    data: { memberCount: newCount },
  });

  revalidatePath("/audiences");
  revalidatePath(`/audiences/${audienceId}`);
  return { removed: result.count, total: newCount };
}

// ─── ÉVALUATION DES RÈGLES DYNAMIQUES ───

/**
 * Évalue les règles d'une audience DYNAMIC et retourne le nombre de leads qui matchent
 */
async function evaluateDynamicCount(audienceId: string): Promise<number> {
  const leads = await evaluateDynamicLeads(audienceId);
  return leads.length;
}

/**
 * Évalue les règles d'une audience DYNAMIC et retourne les IDs des leads qui matchent
 */
async function evaluateDynamicLeads(audienceId: string): Promise<string[]> {
  const audience = await prisma.audience.findUnique({
    where: { id: audienceId },
    select: { rules: true, organizationId: true },
  });
  if (!audience || !audience.rules) return [];

  // On récupère tous les leads de l'org puis on filtre côté JS
  // (pour éviter de tenter de traduire les règles complexes en SQL Prisma)
  const allLeads = await prisma.lead.findMany({
    where: { organizationId: audience.organizationId, isConverted: false },
    include: {
      stage: { select: { id: true, name: true } },
      program: { select: { id: true, name: true, formationType: true } },
      campus: { select: { id: true, name: true, city: true } },
      pipeline: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const rules = audience.rules as any as FilterGroup;
  const matching = allLeads.filter(lead => evaluateFilterGroup(lead, rules));
  return matching.map(l => l.id);
}

/**
 * Évalue un groupe de filtres (AND/OR avec règles + groupes imbriqués)
 */
function evaluateFilterGroup(lead: any, group: FilterGroup): boolean {
  if (!group || !group.rules || group.rules.length === 0) return true;

  const results = group.rules.map(rule => {
    // Si c'est un groupe imbriqué (a la propriété "operator" et "rules")
    if ("operator" in rule && "rules" in rule) {
      return evaluateFilterGroup(lead, rule as FilterGroup);
    }
    return evaluateFilterRule(lead, rule as FilterRule);
  });

  if (group.operator === "OR") {
    return results.some(r => r);
  }
  // AND par défaut
  return results.every(r => r);
}

/**
 * Évalue une règle individuelle sur un lead
 */
function evaluateFilterRule(lead: any, rule: FilterRule): boolean {
  const { field, operator, value } = rule;

  // Récupération de la valeur du champ (avec support des chemins type "program.name", "customFields.budget")
  let leadValue: any = getNestedValue(lead, field);

  switch (operator) {
    case "exists":
      return leadValue !== null && leadValue !== undefined && leadValue !== "";
    case "not_exists":
      return leadValue === null || leadValue === undefined || leadValue === "";

    case "equals":
      return String(leadValue ?? "") === String(value ?? "");
    case "not_equals":
      return String(leadValue ?? "") !== String(value ?? "");

    case "contains":
      return String(leadValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
    case "not_contains":
      return !String(leadValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());

    case "starts_with":
      return String(leadValue ?? "").toLowerCase().startsWith(String(value ?? "").toLowerCase());
    case "ends_with":
      return String(leadValue ?? "").toLowerCase().endsWith(String(value ?? "").toLowerCase());

    case "greater_than":
      if (isDateField(field)) {
        return new Date(leadValue) > new Date(value);
      }
      return Number(leadValue) > Number(value);

    case "less_than":
      if (isDateField(field)) {
        return new Date(leadValue) < new Date(value);
      }
      return Number(leadValue) < Number(value);

    case "in":
      if (!Array.isArray(value)) return false;
      return value.map(v => String(v)).includes(String(leadValue ?? ""));
    case "not_in":
      if (!Array.isArray(value)) return true;
      return !value.map(v => String(v)).includes(String(leadValue ?? ""));

    default:
      return false;
  }
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  const parts = path.split(".");
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Support pour customFields (JSON)
    if (part === "customFields" || (parts[0] === "customFields" && parts.indexOf(part) > 0)) {
      if (typeof current.customFields === "object" && current.customFields !== null) {
        current = current.customFields;
        if (parts.indexOf(part) === 0) continue;
      }
    }
    
    current = current[part];
  }
  
  return current;
}

function isDateField(field: string): boolean {
  return field.toLowerCase().includes("date") ||
    field.toLowerCase().includes("at") ||
    field === "createdAt" ||
    field === "updatedAt" ||
    field === "convertedAt" ||
    field === "lastContactAt";
}

// ─── PREVIEW d'une règle (sans sauvegarde) ───
export async function previewAudienceRules(rules: FilterGroup): Promise<{ count: number; sample: any[] }> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const allLeads = await prisma.lead.findMany({
    where: { organizationId: session.user.organizationId, isConverted: false },
    include: {
      stage: { select: { id: true, name: true } },
      program: { select: { id: true, name: true, formationType: true } },
      campus: { select: { id: true, name: true, city: true } },
      pipeline: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const matching = allLeads.filter(lead => evaluateFilterGroup(lead, rules));
  const sample = matching.slice(0, 10).map(l => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    email: l.email,
    phone: l.phone,
  }));

  return { count: matching.length, sample };
}

// ─── CREATE audience FROM CSV IMPORT (appelé par le module Import) ───
export async function createAudienceFromImport(
  name: string,
  leadIds: string[],
  metadata: { filename?: string; importedRows?: number; skippedRows?: number }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  if (leadIds.length === 0) throw new Error("Aucun lead à ajouter à l'audience");

  // Sécurité multi-tenant : ne garder que les leads appartenant à l'organisation
  const ownedLeads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, organizationId: session.user.organizationId },
    select: { id: true },
  });
  leadIds = ownedLeads.map((l) => l.id);
  if (leadIds.length === 0) throw new Error("Aucun lead à ajouter à l'audience");

  // Vérifier unicité du nom
  let finalName = name;
  let suffix = 1;
  while (true) {
    const existing = await prisma.audience.findFirst({
      where: { organizationId: session.user.organizationId, name: finalName },
    });
    if (!existing) break;
    suffix++;
    finalName = `${name} (${suffix})`;
  }

  const audience = await prisma.audience.create({
    data: {
      name: finalName,
      type: "IMPORTED",
      description: metadata.filename ? `Import du fichier ${metadata.filename}` : "Import CSV",
      importMetadata: {
        filename: metadata.filename || null,
        importedAt: new Date().toISOString(),
        importedRows: metadata.importedRows || leadIds.length,
        skippedRows: metadata.skippedRows || 0,
        importedById: session.user.id,
      },
      memberCount: leadIds.length,
      organizationId: session.user.organizationId,
      createdById: session.user.id,
    },
  });

  // Ajout des leads en batch
  await prisma.audienceMember.createMany({
    data: leadIds.map(leadId => ({
      audienceId: audience.id,
      leadId,
      addedById: session.user.id,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/audiences");
  return audience;
}

// ─── Get filter options for the rule builder ───
export async function getFilterOptions() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const [stages, pipelines, programs, campuses, users] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, pipelineId: true },
      orderBy: { order: "asc" },
    }),
    prisma.pipeline.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, formationType: true },
      orderBy: { order: "asc" },
    }),
    prisma.program.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, code: true, formationType: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { stages, pipelines, programs, campuses, users };
}

// ─── Search leads available to add to an audience (excludes existing members) ───
export async function searchLeadsForAudience(
  audienceId: string,
  filters: {
    search?: string;
    onlyMine?: boolean;
    unassignedOnly?: boolean;
    source?: string;
    stageId?: string;
    pipelineId?: string;
    programId?: string;
    campusId?: string;
    minScore?: number;
    maxScore?: number;
    limit?: number;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  // Vérifier que l'audience existe et appartient à l'org
  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true, type: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  // Récupère les leadIds déjà membres pour exclusion
  const existingMembers = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const existingIds = existingMembers.map(m => m.leadId);

  // Construit le filtre
  const where: any = {
    organizationId: orgId,
    isConverted: false,
    id: { notIn: existingIds.length > 0 ? existingIds : undefined },
  };

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.onlyMine) {
    where.assignedToId = session.user.id;
  }

  if (filters.unassignedOnly) {
    where.assignedToId = null;
  }

  if (filters.source) {
    where.source = filters.source;
  }

  if (filters.stageId) {
    where.stageId = filters.stageId;
  }

  if (filters.pipelineId) {
    where.pipelineId = filters.pipelineId;
  }

  if (filters.programId) {
    where.programId = filters.programId;
  }

  if (filters.campusId) {
    where.campusId = filters.campusId;
  }

  // Filtre score (range)
  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = {};
    if (filters.minScore !== undefined) where.score.gte = filters.minScore;
    if (filters.maxScore !== undefined) where.score.lte = filters.maxScore;
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      score: true,
      source: true,
      stage: { select: { name: true, color: true } },
      program: { select: { name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: filters.limit || 100,
  });

  // Compte total disponible (sans la limite)
  const totalAvailable = await prisma.lead.count({ where });

  return { leads, totalAvailable };
}

// ─── Get all matching lead IDs (without limit) for "Select all" feature ───
export async function getAllMatchingLeadIds(
  audienceId: string,
  filters: {
    search?: string;
    onlyMine?: boolean;
    unassignedOnly?: boolean;
    source?: string;
    stageId?: string;
    pipelineId?: string;
    programId?: string;
    campusId?: string;
    minScore?: number;
    maxScore?: number;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  // Récupère les leadIds déjà membres pour exclusion
  const existingMembers = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const existingIds = existingMembers.map(m => m.leadId);

  const where: any = {
    organizationId: orgId,
    isConverted: false,
    id: { notIn: existingIds.length > 0 ? existingIds : undefined },
  };

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.onlyMine) where.assignedToId = session.user.id;
  if (filters.unassignedOnly) where.assignedToId = null;
  if (filters.source) where.source = filters.source;
  if (filters.stageId) where.stageId = filters.stageId;
  if (filters.pipelineId) where.pipelineId = filters.pipelineId;
  if (filters.programId) where.programId = filters.programId;
  if (filters.campusId) where.campusId = filters.campusId;
  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = {};
    if (filters.minScore !== undefined) where.score.gte = filters.minScore;
    if (filters.maxScore !== undefined) where.score.lte = filters.maxScore;
  }

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true },
  });

  return leads.map(l => l.id);
}

// ─── FILTRES AVANCÉS (règles récursives ET/OU) pour peupler une audience statique ───
// Réutilise le moteur de règles partagé (buildLeadWhere) — mêmes capacités que les
// audiences dynamiques et les règles ad-hoc de campagne (champs perso, activité, dates…).

/** Données nécessaires au FilterGroupBuilder (mêmes props que l'éditeur de campagne). */
export async function getAudienceAdvancedFilterData() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;
  const [stages, programs, audiences, users, customFields] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: orgId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.program.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.audience.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCustomFields(),
  ]);

  return { stages, programs, audiences, users, customFields };
}

/** Recherche de leads via règles avancées (exclut les membres déjà présents). */
export async function searchLeadsForAudienceAdvanced(
  audienceId: string,
  rules: any,
  limit = 100
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  const existingMembers = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const existingIds = existingMembers.map(m => m.leadId);

  // buildLeadWhere pose déjà organizationId + isConverted:false
  const rulesWhere = await buildLeadWhere(rules, orgId);
  const where: any = {
    ...rulesWhere,
    ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
  };

  const [leads, totalAvailable] = await Promise.all([
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        score: true,
        source: true,
        stage: { select: { name: true, color: true } },
        program: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, totalAvailable };
}

/** Tous les IDs correspondant aux règles avancées (pour « Tout sélectionner »). */
export async function getAllMatchingLeadIdsAdvanced(audienceId: string, rules: any) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  const existingMembers = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const existingIds = existingMembers.map(m => m.leadId);

  const rulesWhere = await buildLeadWhere(rules, orgId);
  const where: any = {
    ...rulesWhere,
    ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
  };

  const leads = await prisma.lead.findMany({ where, select: { id: true } });
  return leads.map(l => l.id);
}

// ─── Create a campaign pre-filled with this audience ───
export async function createCampaignFromAudience(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  // Vérifier que l'audience existe et qu'elle est compatible (pas DYNAMIC)
  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true, name: true, type: true, memberCount: true },
  });

  if (!audience) throw new Error("Audience introuvable");
  if (audience.type === "DYNAMIC") {
    throw new Error("Les audiences dynamiques ne peuvent pas être utilisées pour les campagnes");
  }

  // Compter les leads avec email
  const members = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const leadIds = members.map(m => m.leadId);

  const withEmailCount = leadIds.length > 0
    ? await prisma.lead.count({
        where: { id: { in: leadIds }, email: { not: null }, isConverted: false },
      })
    : 0;

  // Création de la campagne brouillon
  const campaign = await prisma.emailCampaign.create({
    data: {
      name: `Campagne — ${audience.name}`,
      subject: "",
      body: "[]",
      segmentRules: [],
      audienceId: audienceId,
      status: "DRAFT",
      totalRecipients: withEmailCount,
      createdById: session.user.id,
      organizationId: orgId,
    },
  });

  revalidatePath("/campaigns");
  return campaign;
}

// ─── Create a WhatsApp campaign pre-filled with this audience ───
export async function createWhatsAppCampaignFromAudience(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  const orgId = session.user.organizationId;

  // Vérifier l'audience
  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true, name: true, type: true, memberCount: true },
  });

  if (!audience) throw new Error("Audience introuvable");
  if (audience.type === "DYNAMIC") {
    throw new Error("Les audiences dynamiques ne peuvent pas être utilisées pour les campagnes");
  }

  // Trouver un template approuvé par défaut
  const firstTemplate = await prisma.whatsAppTemplate.findFirst({
    where: {
      organizationId: orgId,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!firstTemplate) {
    throw new Error("Aucun template WhatsApp approuvé disponible. Créez et faites approuver un template d'abord.");
  }

  // Compter les leads avec WhatsApp
  const members = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const leadIds = members.map((m) => m.leadId);

  const withWhatsAppCount = leadIds.length > 0
    ? await prisma.lead.count({
        where: {
          id: { in: leadIds },
          whatsapp: { not: null },
          isConverted: false,
        },
      })
    : 0;

  // Création de la campagne brouillon
  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      name: `Campagne WhatsApp — ${audience.name}`,
      templateId: firstTemplate.id,
      audienceId: audienceId,
      status: "DRAFT",
      totalRecipients: withWhatsAppCount,
      createdById: session.user.id,
      organizationId: orgId,
    },
  });

  revalidatePath("/whatsapp-campaigns");
  return campaign;
}

// ─── Get audience stats for both Email + WhatsApp ───
export async function getAudienceCampaignStats(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true, type: true },
  });

  if (!audience) throw new Error("Audience introuvable");

  const members = await prisma.audienceMember.findMany({
    where: { audienceId },
    select: { leadId: true },
  });
  const leadIds = members.map((m) => m.leadId);

  if (leadIds.length === 0) {
    return { total: 0, withEmail: 0, withWhatsApp: 0 };
  }

  const [total, withEmail, withWhatsApp] = await Promise.all([
    prisma.lead.count({ where: { id: { in: leadIds }, isConverted: false } }),
    prisma.lead.count({ where: { id: { in: leadIds }, email: { not: null }, isConverted: false } }),
    prisma.lead.count({ where: { id: { in: leadIds }, whatsapp: { not: null }, isConverted: false } }),
  ]);

  return { total, withEmail, withWhatsApp };
}

// ─── ASSIGN audience members to a user (bulk) ───
export async function assignAudienceMembers(
  audienceId: string,
  userId: string | null,
  leadIds?: string[] // si fourni : assigne cette sélection ; sinon : toute l'audience
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Garde-fou rôle : seuls ADMIN/SUPER_ADMIN peuvent assigner
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Seuls les administrateurs peuvent assigner des leads");
  }

  const orgId = session.user.organizationId;

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: orgId },
    select: { id: true, type: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  // Si un user est ciblé, vérifier qu'il appartient à l'org
  if (userId) {
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      select: { id: true },
    });
    if (!targetUser) throw new Error("Utilisateur introuvable");
  }

  // Déterminer les leads à assigner
  let targetLeadIds: string[];

  if (leadIds && leadIds.length > 0) {
    // Sélection explicite — on vérifie que ces leads sont bien membres de l'audience
    if (audience.type === "DYNAMIC") {
      // Pour DYNAMIC, on fait confiance aux IDs passés (déjà affichés), filtrés par org plus bas
      targetLeadIds = leadIds;
    } else {
      const members = await prisma.audienceMember.findMany({
        where: { audienceId, leadId: { in: leadIds } },
        select: { leadId: true },
      });
      targetLeadIds = members.map(m => m.leadId);
    }
  } else {
    // Toute l'audience
    if (audience.type === "DYNAMIC") {
      throw new Error("L'assignation de toute l'audience n'est pas disponible pour les audiences dynamiques");
    }
    const members = await prisma.audienceMember.findMany({
      where: { audienceId },
      select: { leadId: true },
    });
    targetLeadIds = members.map(m => m.leadId);
  }

  if (targetLeadIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Assignation en masse (une seule requête), bornée à l'org pour la sécurité
  const result = await prisma.lead.updateMany({
    where: { id: { in: targetLeadIds }, organizationId: orgId },
    data: { assignedToId: userId },
  });

  revalidatePath(`/audiences/${audienceId}`);
  return { success: true, count: result.count };
}

// ─── GET ALL LEADS of an audience (no pagination, for client-side paging) ───
export async function getAllAudienceLeads(audienceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audience = await prisma.audience.findFirst({
    where: { id: audienceId, organizationId: session.user.organizationId },
  });
  if (!audience) throw new Error("Audience introuvable");

  const orgId = session.user.organizationId;

  if (audience.type === "DYNAMIC") {
    const ids = await evaluateDynamicLeads(audienceId);
    const leads = await prisma.lead.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, score: true,
        createdAt: true,
        stage: { select: { name: true, color: true } },
        program: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    // Préserver l'ordre des règles
    const map = new Map(leads.map(l => [l.id, l]));
    const ordered = ids.map(id => map.get(id)).filter(Boolean);
    return { leads: ordered, total: ordered.length };
  } else {
    const members = await prisma.audienceMember.findMany({
      // Sécurité multi-tenant : n'inclure que les membres dont le lead appartient à l'org
      where: { audienceId, lead: { organizationId: orgId } },
      include: {
        lead: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true, score: true,
            createdAt: true,
            stage: { select: { name: true, color: true } },
            program: { select: { name: true } },
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });
    const leads = members.map(m => m.lead).filter(Boolean);
    return { leads, total: leads.length };
  }
}