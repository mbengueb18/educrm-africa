"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getWhatsAppIntegration } from "@/lib/whatsapp/integration";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";

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

  // Recalculer le compte des destinataires
  let totalRecipients = 0;
  if (data.audienceId) {
    const audience = await prisma.audience.findFirst({
      where: { id: data.audienceId, organizationId: session.user.organizationId },
    });
    if (audience && audience.type !== "DYNAMIC") {
      const members = await prisma.audienceMember.findMany({
        where: { audienceId: data.audienceId },
        select: { leadId: true },
      });
      const leadIds = members.map(m => m.leadId);
      if (leadIds.length > 0) {
        totalRecipients = await prisma.lead.count({
          where: {
            id: { in: leadIds },
            whatsapp: { not: null },
            isConverted: false,
          },
        });
      }
    }
  }
  updateData.totalRecipients = totalRecipients;

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: updateData,
  });

  return { success: true, totalRecipients };
}

// ─── Get recipient stats for confirmation modal ───
export async function getWhatsAppCampaignRecipientStats(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: {
      audience: { select: { id: true, name: true, type: true } },
    },
  });
  if (!campaign) throw new Error("Campagne introuvable");

  let total = 0;
  let withWhatsApp = 0;
  let withoutWhatsApp = 0;
  let fromAudience = false;
  let audienceName: string | undefined;

  if (campaign.audienceId && campaign.audience) {
    fromAudience = true;
    audienceName = campaign.audience.name;

    if (campaign.audience.type === "DYNAMIC") {
      throw new Error("Les audiences dynamiques ne peuvent pas être utilisées pour les campagnes WhatsApp");
    }

    const members = await prisma.audienceMember.findMany({
      where: { audienceId: campaign.audienceId },
      select: { leadId: true },
    });
    const leadIds = members.map(m => m.leadId);

    if (leadIds.length > 0) {
      [total, withWhatsApp] = await Promise.all([
        prisma.lead.count({
          where: { id: { in: leadIds }, isConverted: false },
        }),
        prisma.lead.count({
          where: { id: { in: leadIds }, whatsapp: { not: null }, isConverted: false },
        }),
      ]);
      withoutWhatsApp = total - withWhatsApp;
    }
  }

  return {
    total,
    withWhatsApp,
    withoutWhatsApp,
    fromAudience,
    audienceName,
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
import { sendTemplateMessage, formatPhoneForMeta, resolveVariablesFromLead } from "@/lib/whatsapp/send";

export async function sendWhatsAppCampaign(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate AVANT toute opération
  await assertCanUseWhatsAppCampaigns(session.user.organizationId);

  // Récupérer la campagne avec template + audience
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    include: {
      template: true,
      audience: { select: { id: true, name: true, type: true } },
    },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne a déjà été envoyée");
  if (!campaign.template) throw new Error("Template introuvable");
  if (campaign.template.status !== "APPROVED") {
    throw new Error("Le template doit être approuvé par Meta avant utilisation");
  }
  if (!campaign.audienceId) throw new Error("Aucune audience sélectionnée");
  if (!campaign.audience) throw new Error("Audience introuvable");
  if (campaign.audience.type === "DYNAMIC") {
    throw new Error("Les audiences dynamiques ne peuvent pas être utilisées");
  }

  // ⚡ Vérifier l'intégration WhatsApp AVANT de commencer
  // Cela évite de créer des recipients FAILED si l'intégration est manquante
  try {
    await getWhatsAppIntegration(session.user.organizationId);
  } catch (e: any) {
    throw new Error(e.message);
  }

  // Récupérer les leads de l'audience qui ont un WhatsApp
  const members = await prisma.audienceMember.findMany({
    where: { audienceId: campaign.audienceId },
    select: { leadId: true },
  });
  const leadIds = members.map((m) => m.leadId);

  if (leadIds.length === 0) throw new Error("Aucun lead dans l'audience");

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      whatsapp: { not: null },
      isConverted: false,
    },
    include: { program: { select: { name: true } } }, // pour résoudre {{lead.programName}}
  });

  if (leads.length === 0) throw new Error("Aucun lead avec WhatsApp dans cette audience");

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

  // Récupérer les recipients créés pour pouvoir les mettre à jour
  const recipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaignId },
  });

  // Mapping variables du template
  const variableMapping = (campaign.template.variableMapping as Record<string, string> | null) || {};

  let sentCount = 0;
  let failedCount = 0;

  // Boucle d'envoi avec rate limit (250ms entre chaque message pour rester sous les limites Meta)
  for (const recipient of recipients) {
    const lead = leads.find((l) => l.id === recipient.leadId);
    if (!lead) continue;

    // Résoudre les variables pour ce lead
    const bodyVariables = resolveVariablesFromLead(campaign.template.bodyText, variableMapping, lead);

    // Envoyer via Meta
    const result = await sendTemplateMessage(session.user.organizationId, {
      to: lead.whatsapp!,
      templateName: campaign.template.metaName,
      templateLanguage: campaign.template.language,
      bodyVariables: bodyVariables,
    });

    if (result.success) {
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          metaMessageId: result.metaMessageId || null,
          variableValues: bodyVariables.reduce((acc: any, val, idx) => {
            acc[(idx + 1).toString()] = val;
            return acc;
          }, {}),
        },
      });
      sentCount++;
    } else {
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "FAILED",
          errorCode: result.errorCode || "UNKNOWN",
          errorMessage: result.errorMessage || "Erreur inconnue",
        },
      });
      failedCount++;
    }

    // Rate limit Meta : ~80 msg/seconde max, on reste sage avec 250ms
    await new Promise((r) => setTimeout(r, 250));
  }

  // Mettre à jour les totaux finaux
  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      completedAt: new Date(),
      sentCount: sentCount,
      failedCount: failedCount,
    },
  });

  revalidatePath("/whatsapp-campaigns");
  revalidatePath(`/whatsapp-campaigns/${campaignId}`);

  return {
    sentCount,
    failedCount,
    total: leads.length,
  };
}