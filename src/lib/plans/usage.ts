// src/lib/plans/usage.ts

import { prisma } from "@/lib/prisma";

/**
 * Helpers de comptage de l'usage actuel d'une organisation
 * Utilisé par les checks de limites pour comparer usage vs limite
 */

/**
 * Nombre total d'utilisateurs actifs dans l'org
 */
export async function countUsers(orgId: string): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId: orgId,
      isActive: true,
    },
  });
}

/**
 * Nombre de pipelines actifs dans l'org
 */
export async function countPipelines(orgId: string): Promise<number> {
  return prisma.pipeline.count({
    where: {
      organizationId: orgId,
      isActive: true,
    },
  });
}

/**
 * Nombre d'audiences dynamiques dans l'org
 */
export async function countDynamicAudiences(orgId: string): Promise<number> {
  return prisma.audience.count({
    where: {
      organizationId: orgId,
      type: "DYNAMIC",
    },
  });
}

/**
 * Nombre de workflows actifs dans l'org
 */
export async function countActiveWorkflows(orgId: string): Promise<number> {
  return prisma.workflow.count({
    where: {
      organizationId: orgId,
      enabled: true,
    },
  });
}

/**
 * Nombre de templates WhatsApp dans l'org
 */
export async function countWhatsAppTemplates(orgId: string): Promise<number> {
  return prisma.whatsAppTemplate.count({
    where: {
      organizationId: orgId,
      status: { in: ["DRAFT", "PENDING", "APPROVED"] },
    },
  });
}

/**
 * Nombre d'emails envoyés ce mois calendaire
 * Utilise les emails de messages + email campaigns
 */
export async function countEmailsSentThisMonth(orgId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Compte les messages email outbound
  const messagesCount = await prisma.message.count({
    where: {
      organizationId: orgId,
      channel: "EMAIL",
      direction: "OUTBOUND",
      sentAt: { gte: startOfMonth },
      status: { in: ["SENT", "DELIVERED", "READ"] },
    },
  });

  // Compte les destinataires des campagnes email envoyées
  const campaignRecipients = await prisma.emailCampaignRecipient.count({
    where: {
      campaign: {
        organizationId: orgId,
        sentAt: { gte: startOfMonth },
      },
      status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] },
    },
  });

  return messagesCount + campaignRecipients;
}

/**
 * Récupère l'usage IA actuel de l'org (compteur stocké en BDD)
 * Si le mois en cours a changé depuis aiActionsResetAt, reset le compteur
 */
export async function getAIActionsUsedThisMonth(orgId: string): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      aiActionsUsedThisMonth: true,
      aiActionsResetAt: true,
    },
  });

  const now = new Date();
  const resetAt = new Date(org.aiActionsResetAt);

  // Si le mois calendaire a changé, reset le compteur
  if (
    now.getMonth() !== resetAt.getMonth() ||
    now.getFullYear() !== resetAt.getFullYear()
  ) {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        aiActionsUsedThisMonth: 0,
        aiActionsResetAt: now,
      },
    });
    return 0;
  }

  return org.aiActionsUsedThisMonth;
}

/**
 * Incrémente le compteur d'actions IA
 * À appeler après chaque utilisation effective de l'IA
 */
export async function incrementAIActions(
  orgId: string,
  count: number = 1
): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      aiActionsUsedThisMonth: { increment: count },
    },
  });
}

/**
 * Snapshot complet de l'usage actuel (utile pour affichage admin)
 */
export interface OrganizationUsage {
  users: number;
  pipelines: number;
  dynamicAudiences: number;
  activeWorkflows: number;
  whatsappTemplates: number;
  emailsSentThisMonth: number;
  aiActionsUsedThisMonth: number;
}

export async function getOrganizationUsage(orgId: string): Promise<OrganizationUsage> {
  const [
    users,
    pipelines,
    dynamicAudiences,
    activeWorkflows,
    whatsappTemplates,
    emailsSentThisMonth,
    aiActionsUsedThisMonth,
  ] = await Promise.all([
    countUsers(orgId),
    countPipelines(orgId),
    countDynamicAudiences(orgId),
    countActiveWorkflows(orgId),
    countWhatsAppTemplates(orgId),
    countEmailsSentThisMonth(orgId),
    getAIActionsUsedThisMonth(orgId),
  ]);

  return {
    users,
    pipelines,
    dynamicAudiences,
    activeWorkflows,
    whatsappTemplates,
    emailsSentThisMonth,
    aiActionsUsedThisMonth,
  };
}