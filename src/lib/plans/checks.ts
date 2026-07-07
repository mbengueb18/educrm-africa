// src/lib/plans/checks.ts

import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, getNextPlan } from "./config";
import type { Feature, LimitCheckResult } from "./types";
import {
  PlanLimitError,
  FeatureNotAvailableError,
  QuotaExceededError,
} from "./errors";
import {
  countUsers,
  countPipelines,
  countDynamicAudiences,
  countActiveWorkflows,
  countWhatsAppTemplates,
  countEmailsSentThisMonth,
  getAIActionsUsedThisMonth,
} from "./usage";

/**
 * Récupère le plan et les flags d'add-on d'une org
 * Throws si l'org n'existe pas
 */
async function getOrgPlanInfo(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      plan: true,
      planLockedUntil: true,
      aiAddonEnabled: true,
      extraUsersCount: true,
    },
  });

  // Rétrogradation automatique : si le plan a une date de validité dépassée,
  // le plan effectif retombe à ESSENTIEL (offres promotionnelles, essais...).
  let effectivePlan = org.plan;
  if (org.planLockedUntil && org.planLockedUntil.getTime() < Date.now()) {
    effectivePlan = "ESSENTIEL";
  }

  return {
    plan: effectivePlan,
    aiAddonEnabled: org.aiAddonEnabled,
    extraUsersCount: org.extraUsersCount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKS QUANTITATIFS (limites avec quota)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si on peut ajouter un nouvel utilisateur
 * Tient compte des extra users si applicable
 */
export async function canAddUser(orgId: string): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  const currentUsers = await countUsers(orgId);
  // Utilisateurs max effectifs (plan + extra users payants)
  const effectiveMax = limits.maxUsers + org.extraUsersCount;
  // Plafond absolu (max users total du plan)
  const absoluteMax = limits.maxUsersTotal;

  // Cas 1 : On a atteint le plafond absolu
  if (currentUsers >= absoluteMax) {
    return {
      allowed: false,
      reason: `Plafond utilisateurs atteint pour le plan ${limits.name} (${absoluteMax} max).`,
      currentUsage: currentUsers,
      limit: absoluteMax,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  // Cas 2 : On a atteint les utilisateurs inclus, mais on peut acheter un extra
  if (currentUsers >= effectiveMax) {
    if (!limits.canAddExtraUsers) {
      return {
        allowed: false,
        reason: `Limite utilisateurs atteinte pour le plan ${limits.name}.`,
        currentUsage: currentUsers,
        limit: effectiveMax,
        upgradeTarget: getNextPlan(org.plan) ?? undefined,
      };
    }
    // L'org doit acheter un slot d'utilisateur supplémentaire
    return {
      allowed: false,
      reason: `Utilisateur additionnel requis (+${limits.extraUserPriceMonthly} FCFA/mois).`,
      currentUsage: currentUsers,
      limit: effectiveMax,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut créer un nouveau pipeline
 */
export async function canCreatePipeline(orgId: string): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  const current = await countPipelines(orgId);

  if (current >= limits.maxPipelines) {
    return {
      allowed: false,
      reason: `Limite de pipelines atteinte (${limits.maxPipelines}) pour le plan ${limits.name}.`,
      currentUsage: current,
      limit: limits.maxPipelines,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut créer une audience dynamique
 */
export async function canCreateDynamicAudience(orgId: string): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  // null = illimité
  if (limits.dynamicAudiencesMax === null) return { allowed: true };

  const current = await countDynamicAudiences(orgId);

  if (current >= limits.dynamicAudiencesMax) {
    return {
      allowed: false,
      reason: `Limite d'audiences dynamiques atteinte (${limits.dynamicAudiencesMax}) pour le plan ${limits.name}.`,
      currentUsage: current,
      limit: limits.dynamicAudiencesMax,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut créer un nouveau workflow
 */
export async function canCreateWorkflow(orgId: string): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  if (limits.workflowsCount === 0) {
    return {
      allowed: false,
      reason: `Les workflows ne sont pas disponibles dans le plan ${limits.name}.`,
      currentUsage: 0,
      limit: 0,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  const current = await countActiveWorkflows(orgId);

  if (current >= limits.workflowsCount) {
    return {
      allowed: false,
      reason: `Limite de workflows atteinte (${limits.workflowsCount}) pour le plan ${limits.name}.`,
      currentUsage: current,
      limit: limits.workflowsCount,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut créer un template WhatsApp
 */
export async function canCreateWhatsAppTemplate(orgId: string): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  if (!limits.whatsappBusinessAPI) {
    return {
      allowed: false,
      reason: `WhatsApp Business API n'est disponible qu'en plan Performance.`,
      upgradeTarget: "PERFORMANCE",
    };
  }

  const current = await countWhatsAppTemplates(orgId);

  if (current >= limits.whatsappTemplatesMax) {
    return {
      allowed: false,
      reason: `Limite de templates WhatsApp atteinte (${limits.whatsappTemplatesMax}).`,
      currentUsage: current,
      limit: limits.whatsappTemplatesMax,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut envoyer N emails (vérifie le quota mensuel)
 */
export async function canSendEmail(
  orgId: string,
  count: number = 1
): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  const current = await countEmailsSentThisMonth(orgId);
  const remaining = limits.emailsPerMonth - current;

  if (count > remaining) {
    return {
      allowed: false,
      reason: `Quota emails dépassé : ${current}/${limits.emailsPerMonth} envoyés ce mois, tentative ${count}, reste ${remaining}.`,
      currentUsage: current,
      limit: limits.emailsPerMonth,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  return { allowed: true };
}

/**
 * Vérifie si on peut consommer N actions IA
 */
export async function canUseAI(
  orgId: string,
  count: number = 1
): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  // Vérifier l'accès au feature IA
  if (!limits.aiAssistant && !org.aiAddonEnabled) {
    return {
      allowed: false,
      reason: `Assistant IA non disponible. ${
        limits.aiAddonAvailable
          ? `Activez l'add-on à ${limits.aiAddonPrice} FCFA/mois.`
          : "Passez au plan Performance pour bénéficier de l'IA incluse."
      }`,
      upgradeTarget: limits.aiAddonAvailable ? undefined : "PERFORMANCE",
    };
  }

  // Vérifier le quota
  const used = await getAIActionsUsedThisMonth(orgId);
  const remaining = limits.aiActionsPerMonth - used;

  if (count > remaining) {
    return {
      allowed: false,
      reason: `Quota IA dépassé : ${used}/${limits.aiActionsPerMonth} actions ce mois.`,
      currentUsage: used,
      limit: limits.aiActionsPerMonth,
    };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKS BINAIRES (feature gates)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si une feature est disponible dans le plan actuel
 * Pour les features booléennes (sans quota)
 */
export async function canAccessFeature(
  orgId: string,
  feature: Feature
): Promise<LimitCheckResult> {
  const org = await getOrgPlanInfo(orgId);
  const limits = PLAN_LIMITS[org.plan];

  // Map de chaque feature vers sa valeur de config
  const featureMap: Record<Feature, boolean> = {
    // WhatsApp
    WHATSAPP_MANUAL_LINK: limits.whatsappManualLink,
    WHATSAPP_BUSINESS_API: limits.whatsappBusinessAPI,
    WHATSAPP_TEMPLATES: limits.whatsappTemplatesMax > 0,
    WHATSAPP_CAMPAIGNS: limits.whatsappCampaigns,
    WHATSAPP_CHATBOT: limits.whatsappChatbot,
    WHATSAPP_SETUP_INCLUDED: limits.whatsappSetupIncluded,
    // Email
    EMAIL_CUSTOM_DOMAIN: limits.customEmailDomain,
    // IA
    AI_ASSISTANT: limits.aiAssistant || org.aiAddonEnabled,
    AI_AUTO_CLASSIFICATION: limits.aiAssistant || org.aiAddonEnabled,
    AI_LEAD_ANALYSIS: limits.aiAssistant || org.aiAddonEnabled,
    AI_MESSAGE_GENERATION: limits.aiAssistant || org.aiAddonEnabled,
    AI_CONVERSATION_SUMMARY: limits.aiAssistant || org.aiAddonEnabled,
    AI_MESSAGE_REFORMULATION: limits.aiAssistant || org.aiAddonEnabled,
    AI_ACTION_SUGGESTIONS: limits.aiAssistant || org.aiAddonEnabled,
    // Reporting
    REPORTING_DATE_FILTERS: limits.reportingDateFilters,
    REPORTING_CUSTOM_REPORTS: limits.reportingCustomReports,
    REPORTING_EXPORT_DATA: limits.reportingExportExcelPdf,
    REPORTING_SCHEDULED_EXPORT: limits.reportingScheduledExport,
    REPORTING_PERIOD_COMPARISON: limits.reportingPeriodComparison,
    // Lead Scoring
    AUTO_LEAD_SCORING: limits.autoScoring,
    HOT_WARM_COLD_AUTO: limits.hotWarmColdAuto,
    // Permissions
    CUSTOM_ROLES: limits.customRoles,
    GRANULAR_PERMISSIONS: limits.granularPermissions,
    CAMPUS_RESTRICTIONS: limits.campusRestrictions,
    // SSO
    GOOGLE_SSO: limits.googleSSO,
    MICROSOFT_SSO: limits.microsoftSSO,
    // Inbox
    INBOX_WHATSAPP_CHANNEL: limits.inboxChannels.includes("WHATSAPP"),
    INBOX_CHATBOT_CHANNEL: limits.inboxChannels.includes("CHATBOT"),
  };

  if (!featureMap[feature]) {
    return {
      allowed: false,
      reason: `La fonctionnalité ${feature} n'est pas disponible dans le plan ${limits.name}.`,
      upgradeTarget: getNextPlan(org.plan) ?? undefined,
    };
  }

  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS À UTILISER DANS LES SERVER ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrapper pour les server actions : throw si la limite est atteinte
 * Plus simple à utiliser que canXxx + condition manuelle
 *
 * @example
 * await assertCanAddUser(orgId);
 * await prisma.user.create({ ... });
 */
export async function assertCanAddUser(orgId: string): Promise<void> {
  const check = await canAddUser(orgId);
  if (!check.allowed) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true },
    });
    throw new PlanLimitError({
      code: "USER_LIMIT_EXCEEDED",
      message: check.reason || "Limite utilisateurs atteinte",
      currentPlan: org.plan,
      upgradeTarget: check.upgradeTarget,
      currentUsage: check.currentUsage,
      limit: check.limit,
    });
  }
}

export async function assertCanCreatePipeline(orgId: string): Promise<void> {
  const check = await canCreatePipeline(orgId);
  if (!check.allowed) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true },
    });
    throw new QuotaExceededError({
      resource: "pipelines",
      currentPlan: org.plan,
      currentUsage: check.currentUsage || 0,
      limit: check.limit || 0,
      upgradeTarget: check.upgradeTarget,
    });
  }
}

export async function assertCanAccessFeature(
  orgId: string,
  feature: Feature
): Promise<void> {
  const check = await canAccessFeature(orgId, feature);
  if (!check.allowed) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true },
    });
    throw new FeatureNotAvailableError({
      feature,
      currentPlan: org.plan,
      upgradeTarget: check.upgradeTarget,
    });
  }
}

export async function assertCanSendEmail(
  orgId: string,
  count: number = 1
): Promise<void> {
  const check = await canSendEmail(orgId, count);
  if (!check.allowed) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true },
    });
    throw new QuotaExceededError({
      resource: "emails",
      currentPlan: org.plan,
      currentUsage: check.currentUsage || 0,
      limit: check.limit || 0,
      upgradeTarget: check.upgradeTarget,
    });
  }
}

export async function assertCanUseAI(
  orgId: string,
  count: number = 1
): Promise<void> {
  const check = await canUseAI(orgId, count);
  if (!check.allowed) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { plan: true },
    });
    throw new QuotaExceededError({
      resource: "ai_actions",
      currentPlan: org.plan,
      currentUsage: check.currentUsage || 0,
      limit: check.limit || 0,
      upgradeTarget: check.upgradeTarget,
    });
  }
}