"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getWhatsAppIntegration } from "@/lib/whatsapp/integration";
import { sendTemplateMessage, resolveVariablesFromLead } from "@/lib/whatsapp/send";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";
import { estimateWhatsAppCost, type WhatsAppCostEstimate, type WhatsAppPricingCategory } from "@/lib/whatsapp/pricing";
import { getCampaignLeadsQuery } from "@/lib/campaign-leads";

/** Vrai si des règles de segmentation ad-hoc sont définies (format plat ou FilterGroup). */
function hasSegmentRules(rules: any): boolean {
  if (!rules) return false;
  if (Array.isArray(rules)) return rules.length > 0;
  return Array.isArray(rules.rules) && rules.rules.length > 0;
}

/**
 * Helper local : vérifie l'accès aux campagnes WhatsApp
 * Throws une erreur claire avec message d'upgrade si plan insuffisant
 */
async function assertCanUseWhatsAppCampaigns(organizationId: string) {
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_CAMPAIGNS");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "Les campagnes WhatsApp ne sont disponibles qu'en plan Performance. " +
        "Passez à Performance pour créer et envoyer des campagnes WhatsApp à vos audiences."
      );
    }
    throw error;
  }
}

// ─── Get all WhatsApp campaigns for organization ───
export async function getWhatsAppCampaigns() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.whatsAppCampaign.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      template: { select: { metaName: true, language: true, status: true } },
      audience: { select: { id: true, name: true, type: true } },
      _count: { select: { recipients: true } },
    },
  });
}

// ─── Quick create campaign (empty draft) ───
export async function quickCreateWhatsAppCampaign() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  // Trouver un premier template APPROVED comme template par défaut
  const firstTemplate = await prisma.whatsAppTemplate.findFirst({
    where: {
      organizationId: session.user.organizationId,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!firstTemplate) {
    throw new Error("Aucun template approuvé disponible. Créez et faites approuver un template d'abord.");
  }

  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      name: "Nouvelle campagne WhatsApp",
      templateId: firstTemplate.id,
      status: "DRAFT",
      createdById: session.user.id,
      organizationId: session.user.organizationId,
    },
  });

  return campaign;
}

// ─── Delete WhatsApp campaign ───
export async function deleteWhatsAppCampaign(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status === "SENDING") {
    throw new Error("Impossible de supprimer une campagne en cours d'envoi");
  }

  await prisma.whatsAppCampaign.delete({ where: { id: campaignId } });
  revalidatePath("/whatsapp-campaigns");
}

// ─── Update WhatsApp campaign draft (auto-save) ───
export async function updateWhatsAppCampaignDraft(campaignId: string, data: {
  name?: string;
  templateId?: string;
  audienceId?: string | null;
  segmentRules?: any[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    select: { id: true, status: true, audienceId: true, segmentRules: true },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") {
    throw new Error("Cette campagne ne peut plus être modifiée");
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.templateId !== undefined) updateData.templateId = data.templateId;
  if (data.audienceId !== undefined) updateData.audienceId = data.audienceId;
  if (data.segmentRules !== undefined) updateData.segmentRules = data.segmentRules as any;

  // Mode courant après application des changements (audience OU règles ad-hoc, comme l'emailing)
  const newAudienceId = data.audienceId !== undefined ? data.audienceId : campaign.audienceId;
  const newRules = data.segmentRules !== undefined ? data.segmentRules : (campaign.segmentRules as any);

  // Recalculer le compte des destinataires (leads avec WhatsApp) si audience ou règles changent
  let totalRecipients = 0;
  if (data.audienceId !== undefined || data.segmentRules !== undefined) {
    if (newAudienceId || hasSegmentRules(newRules)) {
      try {
        const { where } = await getCampaignLeadsQuery(session.user.organizationId, newAudienceId ?? null, newRules ?? []);
        totalRecipients = await prisma.lead.count({ where: { ...where, whatsapp: { not: null } } });
      } catch {
        // audience introuvable / dynamique → compte 0 (l'UI empêche déjà ces cas)
        totalRecipients = 0;
      }
    }
    updateData.totalRecipients = totalRecipients;
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: updateData,
  });

  return { success: true, totalRecipients };
}

// ─── Aperçu live d'un segment de règles ad-hoc (miroir de previewSegment email) ───
export async function previewWhatsAppSegment(rules: any) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { where } = await getCampaignLeadsQuery(session.user.organizationId, null, rules);
  const [count, totalMatching] = await Promise.all([
    prisma.lead.count({ where: { ...where, whatsapp: { not: null } } }),
    prisma.lead.count({ where }),
  ]);
  const withoutWhatsApp = Math.max(0, totalMatching - count);
  return { count, withoutWhatsApp, totalMatching };
}

// ─── Get recipient stats for confirmation modal ───
export async function getWhatsAppCampaignRecipientStats(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: {
      template: { select: { category: true } },
    },
  });
  if (!campaign) throw new Error("Campagne introuvable");

  let total = 0;
  let withWhatsApp = 0;
  let withoutWhatsApp = 0;
  let fromAudience = false;
  let audienceName: string | undefined;
  let estimatedCost: WhatsAppCostEstimate | null = null;

  const rules = (campaign.segmentRules as any) ?? [];

  // Mode audience OU règles ad-hoc — même moteur que l'emailing (getCampaignLeadsQuery)
  if (campaign.audienceId || hasSegmentRules(rules)) {
    const query = await getCampaignLeadsQuery(session.user.organizationId, campaign.audienceId, rules);
    fromAudience = query.fromAudience;
    audienceName = query.audienceName;

    const [totalCount, recipients] = await Promise.all([
      prisma.lead.count({ where: query.where }),
      prisma.lead.findMany({
        where: { ...query.where, whatsapp: { not: null } },
        select: { whatsapp: true },
      }),
    ]);
    total = totalCount;
    withWhatsApp = recipients.length;
    withoutWhatsApp = total - withWhatsApp;

    // Estimation du coût Meta (par message, selon catégorie du template + pays)
    if (recipients.length > 0 && campaign.template) {
      estimatedCost = estimateWhatsAppCost(
        recipients.map(r => r.whatsapp!),
        campaign.template.category as WhatsAppPricingCategory
      );
    }
  }

  return {
    total,
    withWhatsApp,
    withoutWhatsApp,
    fromAudience,
    audienceName,
    estimatedCost,
  };
}

// ─── Get available audiences for WhatsApp campaign ───
export async function getAvailableAudiencesForWhatsAppCampaign() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const audiences = await prisma.audience.findMany({
    where: {
      organizationId: session.user.organizationId,
      type: { in: ["STATIC", "IMPORTED"] },
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      memberCount: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Pour chaque audience, compter les leads avec/sans WhatsApp
  const enriched = await Promise.all(audiences.map(async aud => {
    const members = await prisma.audienceMember.findMany({
      where: { audienceId: aud.id },
      select: { leadId: true },
    });
    const leadIds = members.map(m => m.leadId);

    if (leadIds.length === 0) {
      return { ...aud, withWhatsApp: 0, withoutWhatsApp: 0 };
    }

    const [withWhatsApp, total] = await Promise.all([
      prisma.lead.count({
        where: { id: { in: leadIds }, whatsapp: { not: null }, isConverted: false },
      }),
      prisma.lead.count({
        where: { id: { in: leadIds }, isConverted: false },
      }),
    ]);

    return {
      ...aud,
      withWhatsApp,
      withoutWhatsApp: total - withWhatsApp,
    };
  }));

  return enriched;
}

// ─── Send WhatsApp campaign ───
export async function sendWhatsAppCampaign(campaignId: string) {
  // Pattern { ok, error } : Next.js caviarde les throw des server actions en prod
  // (toast illisible « Server Components render… ») — on retourne l'erreur.
  try {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate AVANT toute opération
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  // Récupérer la campagne avec template
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: {
      template: true,
    },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne a déjà été envoyée");
  if (!campaign.template) throw new Error("Template introuvable");
  if (campaign.template.status !== "APPROVED") {
    throw new Error("Le template doit être approuvé par Meta avant utilisation");
  }
  const rules = (campaign.segmentRules as any) ?? [];
  if (!campaign.audienceId && !hasSegmentRules(rules)) {
    throw new Error("Aucune audience ni règle de segmentation sélectionnée");
  }

  // ⚡ Vérifier l'intégration WhatsApp AVANT de commencer
  // Cela évite de créer des recipients FAILED si l'intégration est manquante
  try {
    await getWhatsAppIntegration(session.user.organizationId);
  } catch (e: any) {
    throw new Error(e.message);
  }

  // Récupérer les leads (audience figée OU règles ad-hoc) qui ont un WhatsApp
  const { where } = await getCampaignLeadsQuery(session.user.organizationId, campaign.audienceId, rules);
  const leads = await prisma.lead.findMany({
    where: { ...where, whatsapp: { not: null } },
    include: { program: { select: { name: true } } }, // pour résoudre {{lead.programName}}
  });

  if (leads.length === 0) throw new Error("Aucun lead avec WhatsApp dans ce segment");

  // Marquer la campagne comme SENDING
  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENDING",
      sentAt: new Date(),
      totalRecipients: leads.length,
    },
  });

  // Créer les recipients en PENDING
  await prisma.whatsAppCampaignRecipient.createMany({
    data: leads.map((lead) => ({
      campaignId: campaignId,
      leadId: lead.id,
      whatsappNumber: lead.whatsapp!,
      status: "PENDING" as const,
    })),
  });

  // L'envoi réel se fait par lots via le cron /api/cron/campaigns (comme les campagnes
  // email) : la server action retourne immédiatement — plus de timeout au-delà de
  // ~50 destinataires, et reprise automatique si un tick échoue.
  revalidatePath("/whatsapp-campaigns");
  revalidatePath(`/whatsapp-campaigns/${campaignId}`);

  return {
    ok: true as const,
    queued: leads.length,
    total: leads.length,
  };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Erreur lors de l'envoi de la campagne" };
  }
}
// ─── Programmer l'envoi d'une campagne WhatsApp (miroir des campagnes email) ───
export async function scheduleWhatsAppCampaign(campaignId: string, scheduledAtISO: string) {
  try {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: { template: true },
  });
  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne ne peut plus être programmée.");
  if (!campaign.template || campaign.template.status !== "APPROVED") {
    throw new Error("Le template doit être approuvé par Meta avant utilisation");
  }
  const rules = (campaign.segmentRules as any) ?? [];
  if (!campaign.audienceId && !hasSegmentRules(rules)) {
    throw new Error("Aucune audience ni règle de segmentation sélectionnée");
  }
  // Valide l'audience/les règles dès maintenant (rejette audience dynamique/introuvable)
  await getCampaignLeadsQuery(session.user.organizationId, campaign.audienceId, rules);
  // Intégration vérifiée dès maintenant (échec clair plutôt qu'à l'échéance)
  await getWhatsAppIntegration(session.user.organizationId);

  const when = new Date(scheduledAtISO);
  if (isNaN(when.getTime())) throw new Error("Date invalide.");
  if (when.getTime() < Date.now() + 60 * 1000) throw new Error("Choisissez une date au moins 1 minute dans le futur.");

  // Les destinataires seront calculés à l'échéance (par le cron), sur l'audience à jour.
  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: { status: "SCHEDULED", scheduledAt: when },
  });

  revalidatePath("/whatsapp-campaigns");
  revalidatePath(`/whatsapp-campaigns/${campaignId}`);
  return { ok: true as const, scheduledAt: when };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Impossible de programmer l'envoi" };
  }
}

// ─── Annuler une programmation ───
export async function cancelScheduledWhatsAppCampaign(campaignId: string) {
  try {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
  });
  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "SCHEDULED") throw new Error("Cette campagne n'est pas programmée.");

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: { status: "DRAFT", scheduledAt: null },
  });

  revalidatePath("/whatsapp-campaigns");
  revalidatePath(`/whatsapp-campaigns/${campaignId}`);
  return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Impossible d'annuler la programmation" };
  }
}

// ─── Envoyer un message de TEST du template à un numéro donné ───
export async function sendWhatsAppTestMessage(campaignId: string, toNumber: string) {
  try {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  const to = (toNumber || "").trim();
  if (!to) throw new Error("Saisissez un numéro WhatsApp.");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: { template: true },
  });
  if (!campaign) throw new Error("Campagne introuvable");
  if (!campaign.template || campaign.template.status !== "APPROVED") {
    throw new Error("Le template doit être approuvé par Meta avant utilisation");
  }
  await getWhatsAppIntegration(session.user.organizationId);

  // Variables résolues depuis un vrai lead du segment si possible, sinon valeurs de démo
  let sampleLead: any = null;
  const testRules = (campaign.segmentRules as any) ?? [];
  if (campaign.audienceId || hasSegmentRules(testRules)) {
    try {
      const { where } = await getCampaignLeadsQuery(session.user.organizationId, campaign.audienceId, testRules);
      sampleLead = await prisma.lead.findFirst({
        where: { ...where, whatsapp: { not: null } },
        include: { program: { select: { name: true } } },
      });
    } catch {
      sampleLead = null;
    }
  }
  if (!sampleLead) {
    sampleLead = {
      firstName: "Fatou", lastName: "Diallo", email: "fatou@example.com",
      phone: "+221770000000", whatsapp: "+221770000000", city: "Dakar",
      score: 75, customFields: {}, program: { name: "MBA Marketing Digital" },
    };
  }

  const variableMapping = (campaign.template.variableMapping as Record<string, string> | null) || {};
  const bodyVariables = resolveVariablesFromLead(campaign.template.bodyText, variableMapping, sampleLead);

  const result = await sendTemplateMessage(session.user.organizationId, {
    to,
    templateName: campaign.template.metaName,
    templateLanguage: campaign.template.language,
    bodyVariables,
  });

  if (!result.success) {
    throw new Error(result.errorMessage || "Échec de l'envoi du test");
  }
  return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Échec de l'envoi du test" };
  }
}

// ─── Progression d'une campagne en cours d'envoi (pour la barre de progression) ───
export async function getWhatsAppCampaignProgress(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const recipientWhere = {
    campaignId: campaignId,
    campaign: { organizationId: session.user.organizationId },
  };
  const [total, done] = await Promise.all([
    prisma.whatsAppCampaignRecipient.count({ where: recipientWhere }),
    prisma.whatsAppCampaignRecipient.count({
      where: { ...recipientWhere, status: { notIn: ["PENDING", "PROCESSING"] } },
    }),
  ]);

  return { total, done };
}
