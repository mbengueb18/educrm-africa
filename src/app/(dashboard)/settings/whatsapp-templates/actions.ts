"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  listMetaTemplates,
  submitMetaTemplate,
  deleteMetaTemplate,
  convertTemplateForMeta,
  parseMetaTemplate,
  mapMetaStatusToLocal,
} from "@/lib/whatsapp/templates";

import { assertCanAccessFeature } from "@/lib/plans/checks";
import { canCreateWhatsAppTemplate } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";

/**
 * Helper local : vérifie l'accès à la création de templates WhatsApp
 * - Check feature gate (WHATSAPP_BUSINESS_API uniquement Performance)
 * - Check quota templates (max 10 en Performance)
 */
async function assertCanCreateWhatsAppTemplate(organizationId: string) {
  // Check 1 : feature gate
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "Les templates WhatsApp ne sont disponibles qu'en plan Performance. " +
        "Passez à Performance pour créer vos modèles de messages WhatsApp validés par Meta."
      );
    }
    throw error;
  }

  // Check 2 : quota templates
  const check = await canCreateWhatsAppTemplate(organizationId);
  if (!check.allowed) {
    throw new Error(
      check.reason || `Limite de templates WhatsApp atteinte (10 max).`
    );
  }
}

/**
 * Helper local pour les actions de gestion (édition, soumission, sync)
 * Ne check QUE le feature gate, pas le quota
 */
async function assertCanManageWhatsAppTemplates(organizationId: string) {
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "La gestion des templates WhatsApp nécessite le plan Performance. " +
        "Passez à Performance pour modifier ou soumettre vos templates Meta."
      );
    }
    throw error;
  }
}

// ─── List templates (local DB) ───
export async function listTemplates() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.whatsAppTemplate.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { campaigns: true } },
    },
  });
}

// ─── Get template detail ───
export async function getTemplate(templateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: templateId, organizationId: session.user.organizationId },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { campaigns: true } },
    },
  });

  if (!template) throw new Error("Template introuvable");
  return template;
}

// ─── Create template (local draft) ───
export async function createTemplate(data: {
  metaName: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttons?: any[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate + quota
  await assertCanCreateWhatsAppTemplate(session.user.organizationId);

  // Valider le nom : seulement lowercase, chiffres et underscores
  if (!/^[a-z0-9_]+$/.test(data.metaName)) {
    throw new Error("Le nom du template doit contenir uniquement des lettres minuscules, chiffres et underscores (ex: rentree_2026_fr)");
  }

  if (!data.bodyText.trim()) {
    throw new Error("Le corps du message est obligatoire");
  }

  // Calculer le mapping {{1}}, {{2}}... pour Meta
  const { variableMapping } = convertTemplateForMeta(data.bodyText);

  const template = await prisma.whatsAppTemplate.create({
    data: {
      organizationId: session.user.organizationId,
      metaName: data.metaName,
      language: data.language,
      category: data.category,
      bodyText: data.bodyText,
      headerText: data.headerText || null,
      footerText: data.footerText || null,
      buttons: data.buttons as any || null,
      variableMapping: variableMapping as any,
      status: "DRAFT",
      source: "local",
      createdById: session.user.id,
    },
  });

  revalidatePath("/settings/whatsapp-templates");
  return template;
}

// ─── Update template (only if DRAFT) ───
export async function updateTemplate(templateId: string, data: {
  metaName?: string;
  language?: string;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  bodyText?: string;
  headerText?: string | null;
  footerText?: string | null;
  buttons?: any[] | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate (pas de quota check pour update)
  await assertCanManageWhatsAppTemplates(session.user.organizationId);

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: templateId, organizationId: session.user.organizationId },
  });

  if (!template) throw new Error("Template introuvable");
  if (template.status !== "DRAFT") {
    throw new Error("Seuls les brouillons peuvent être modifiés. Les templates soumis à Meta sont verrouillés.");
  }

  if (data.metaName && !/^[a-z0-9_]+$/.test(data.metaName)) {
    throw new Error("Le nom du template doit contenir uniquement des lettres minuscules, chiffres et underscores");
  }

  // Recalculer le mapping si le bodyText change
  let variableMapping = template.variableMapping;
  if (data.bodyText !== undefined) {
    const result = convertTemplateForMeta(data.bodyText);
    variableMapping = result.variableMapping as any;
  }

  await prisma.whatsAppTemplate.update({
    where: { id: templateId },
    data: {
      metaName: data.metaName ?? template.metaName,
      language: data.language ?? template.language,
      category: data.category ?? template.category,
      bodyText: data.bodyText ?? template.bodyText,
      headerText: data.headerText !== undefined ? data.headerText : template.headerText,
      footerText: data.footerText !== undefined ? data.footerText : template.footerText,
      buttons: (data.buttons !== undefined ? data.buttons : template.buttons) as any,
      variableMapping: variableMapping as any,
    },
  });

  revalidatePath("/settings/whatsapp-templates");
  return { success: true };
}

// ─── Submit template to Meta for approval ───
export async function submitTemplate(templateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate
  await assertCanManageWhatsAppTemplates(session.user.organizationId);

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: templateId, organizationId: session.user.organizationId },
  });

  if (!template) throw new Error("Template introuvable");
  if (template.status !== "DRAFT") throw new Error("Ce template a déjà été soumis");

  // Convertir la syntaxe TalibCRM vers Meta ({{lead.X}} -> {{1}})
  const { metaBody, variableMapping } = convertTemplateForMeta(template.bodyText);

  // Soumettre à Meta
  try {
    const result = await submitMetaTemplate(session.user.organizationId, {
      name: template.metaName,
      language: template.language,
      category: template.category,
      bodyText: metaBody,
      headerText: template.headerText,
      footerText: template.footerText,
      buttons: template.buttons as any,
    });

    // Mettre à jour en local
    await prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        status: mapMetaStatusToLocal(result.status),
        metaTemplateId: result.id,
        variableMapping: variableMapping as any,
        submittedAt: new Date(),
      },
    });

    revalidatePath("/settings/whatsapp-templates");
    return { success: true, status: result.status };
  } catch (err: any) {
    throw new Error(`Soumission échouée : ${err.message}`);
  }
}

// ─── Sync templates from Meta ───
export async function syncTemplatesFromMeta() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

    // check feature gate
  await assertCanManageWhatsAppTemplates(session.user.organizationId);

  const orgId = session.user.organizationId;

  try {
    const metaTemplates = await listMetaTemplates(orgId);

    let created = 0;
    let updated = 0;

    for (const meta of metaTemplates) {
      const parsed = parseMetaTemplate(meta);
      const localStatus = mapMetaStatusToLocal(meta.status);

      // Calculer le mapping inverse pour le bodyText
      // Meta nous donne du {{1}}, {{2}} — on les laisse tel quels pour le moment
      const variableMapping: Record<string, string> = {};

      // Chercher si on a déjà ce template
      const existing = await prisma.whatsAppTemplate.findUnique({
        where: {
          organizationId_metaName_language: {
            organizationId: orgId,
            metaName: meta.name,
            language: meta.language,
          },
        },
      });

      if (existing) {
        // Update existing
        await prisma.whatsAppTemplate.update({
          where: { id: existing.id },
          data: {
            status: localStatus,
            metaTemplateId: meta.id || existing.metaTemplateId,
            category: meta.category,
            bodyText: parsed.bodyText,
            headerText: parsed.headerText,
            footerText: parsed.footerText,
            buttons: parsed.buttons as any,
            rejectionReason: meta.rejected_reason || null,
            approvedAt: localStatus === "APPROVED" ? (existing.approvedAt || new Date()) : existing.approvedAt,
          },
        });
        updated++;
      } else {
        // Create new
        await prisma.whatsAppTemplate.create({
          data: {
            organizationId: orgId,
            metaName: meta.name,
            metaTemplateId: meta.id,
            language: meta.language,
            category: meta.category,
            status: localStatus,
            bodyText: parsed.bodyText,
            headerText: parsed.headerText,
            footerText: parsed.footerText,
            buttons: parsed.buttons as any,
            variableMapping: variableMapping as any,
            rejectionReason: meta.rejected_reason || null,
            source: "meta_sync",
            submittedAt: new Date(),
            approvedAt: localStatus === "APPROVED" ? new Date() : null,
            createdById: session.user.id,
          },
        });
        created++;
      }
    }

    revalidatePath("/settings/whatsapp-templates");
    return { success: true, created, updated, total: metaTemplates.length };
  } catch (err: any) {
    throw new Error(`Sync échoué : ${err.message}`);
  }
}

// ─── Delete template ───
export async function deleteTemplate(templateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: templateId, organizationId: session.user.organizationId },
    include: { _count: { select: { campaigns: true } } },
  });

  if (!template) throw new Error("Template introuvable");

  // Vérifier qu'aucune campagne n'utilise ce template
  if (template._count.campaigns > 0) {
    throw new Error(`Impossible de supprimer : ${template._count.campaigns} campagne(s) utilisent ce template`);
  }

  // Si soumis à Meta, supprimer côté Meta aussi
  if (template.metaTemplateId && template.status !== "DRAFT") {
    try {
      await deleteMetaTemplate(session.user.organizationId, template.metaName);
    } catch (err: any) {
      // Si Meta refuse (template déjà supprimé, etc), on continue quand même
      console.warn(`Suppression Meta échouée : ${err.message}`);
    }
  }

  await prisma.whatsAppTemplate.delete({ where: { id: templateId } });
  revalidatePath("/settings/whatsapp-templates");
  return { success: true };
}

// ─── Get approved templates (for campaign editor) ───
export async function getApprovedTemplates() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.whatsAppTemplate.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: "APPROVED",
    },
    orderBy: { metaName: "asc" },
    select: {
      id: true,
      metaName: true,
      language: true,
      category: true,
      bodyText: true,
      headerText: true,
      footerText: true,
      buttons: true,
      variableMapping: true,
    },
  });
}