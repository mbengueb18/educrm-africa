// lib/plans/config.ts

/**
 * SOURCE DE VÉRITÉ DES PLANS TALIBCRM
 *
 * Toutes les limites, prix et features sont définies ici.
 * Modifier ce fichier suffit à mettre à jour tout le système.
 *
 * Version : V1.0
 * Validé le : 22 mai 2026
 */

import type { Plan, PlanLimits } from "./types";

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  // ─────────────────────────────────────────────────────────────────────────
  // ESSENTIEL — Gratuit à vie
  // ─────────────────────────────────────────────────────────────────────────
  ESSENTIEL: {
    name: "Essentiel",
    tagline: "Pour démarrer avec le pipeline et l'email",
    priceMonthly: 0,
    priceYearly: 0,
    priceYearlyTotal: 0,

    // Utilisateurs
    maxUsers: 2,
    canAddExtraUsers: false,
    extraUserPriceMonthly: null,
    maxUsersTotal: 2,

    // Pipelines & Leads
    maxPipelines: 1,
    maxLeads: null,

    // Email Marketing
    emailsPerMonth: 3_000,
    emailBranding: true,
    customEmailDomain: false,

    // WhatsApp
    whatsappManualLink: false,
    whatsappBusinessAPI: false,
    whatsappTemplatesMax: 0,
    whatsappCampaigns: false,
    whatsappChatbot: false,
    whatsappChatbotScenariosMax: 0,
    whatsappSetupIncluded: false,

    // Audiences
    dynamicAudiencesMax: 20,

    // Inbox
    inboxChannels: ["EMAIL"],

    // Assistant IA
    aiAssistant: false,
    aiActionsPerMonth: 0,
    aiAddonAvailable: false,
    aiAddonPrice: null,

    // Activités
    tasks: true,
    calls: true,
    appointments: true,
    duplicates: true,
    importExport: true,

    // Automatisation
    sequencesCount: 0,
    sequencesCustomizable: false,
    sequenceReportingLevel: null,
    workflowsCount: 0,
    workflowReportingLevel: null,

    // Reporting
    reportingLevel: "BASIC",
    reportingDateFilters: false,
    reportingAdvancedFilters: false,
    reportingCustomReports: false,
    reportingCustomReportsMax: 0,
    reportingDashboardsMax: 0,
    reportingExportExcelPdf: false,
    reportingScheduledExport: false,
    reportingPeriodComparison: false,
    reportingAI: false,

    // Lead Scoring
    manualScoring: true,
    autoScoring: false,
    autoScoringRulesMax: 0,
    hotWarmColdAuto: false,

    // Rôles
    availableRoles: ["ADMIN"],
    presetRolesCount: 1,
    customRoles: false,
    customRolesMax: 0,
    permissionsByModule: false,
    granularPermissions: false,
    campusRestrictions: false,

    // Auth
    emailPasswordLogin: true,
    googleSSO: false,
    microsoftSSO: false,

    // SLA
    slaPercent: null,
    supportChannel: "COMMUNITY",
    supportResponseHours: null,
    slaCompensation: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CROISSANCE — 45 000 FCFA/mois (37 500 si annuel)
  // ─────────────────────────────────────────────────────────────────────────
  CROISSANCE: {
    name: "Croissance",
    tagline: "Pour une équipe admissions structurée",
    priceMonthly: 45_000,
    priceYearly: 37_500,
    priceYearlyTotal: 450_000,

    // Utilisateurs
    maxUsers: 7,
    canAddExtraUsers: true,
    extraUserPriceMonthly: 4_500,
    maxUsersTotal: 15,

    // Pipelines & Leads
    maxPipelines: 3,
    maxLeads: null,

    // Email Marketing
    emailsPerMonth: 15_000,
    emailBranding: false,
    customEmailDomain: true,

    // WhatsApp
    whatsappManualLink: true, // ← bouton wa.me/numéro
    whatsappBusinessAPI: false,
    whatsappTemplatesMax: 0,
    whatsappCampaigns: false,
    whatsappChatbot: false,
    whatsappChatbotScenariosMax: 0,
    whatsappSetupIncluded: false,

    // Audiences
    dynamicAudiencesMax: 100,

    // Inbox
    inboxChannels: ["EMAIL"],

    // Assistant IA
    aiAssistant: false, // par défaut OFF
    aiActionsPerMonth: 1_000, // si add-on activé
    aiAddonAvailable: true,
    aiAddonPrice: 15_000,

    // Activités
    tasks: true,
    calls: true,
    appointments: true,
    duplicates: true,
    importExport: true,

    // Automatisation
    sequencesCount: 1,
    sequencesCustomizable: false,
    sequenceReportingLevel: "BASIC",
    workflowsCount: 2,
    workflowReportingLevel: "BASIC",

    // Reporting
    reportingLevel: "ADVANCED",
    reportingDateFilters: true,
    reportingAdvancedFilters: true,
    reportingCustomReports: true,
    reportingCustomReportsMax: 3,
    reportingDashboardsMax: 1,
    reportingExportExcelPdf: true,
    reportingScheduledExport: false,
    reportingPeriodComparison: true,
    reportingAI: false,

    // Lead Scoring
    manualScoring: true,
    autoScoring: true,
    autoScoringRulesMax: 3,
    hotWarmColdAuto: true,

    // Rôles
    availableRoles: ["ADMIN", "COMMERCIAL", "VIEWER"],
    presetRolesCount: 3,
    customRoles: false,
    customRolesMax: 0,
    permissionsByModule: true,
    granularPermissions: false,
    campusRestrictions: false,

    // Auth
    emailPasswordLogin: true,
    googleSSO: true,
    microsoftSSO: false,

    // SLA
    slaPercent: 99,
    supportChannel: "EMAIL",
    supportResponseHours: 48,
    slaCompensation: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PERFORMANCE — 100 000 FCFA/mois (83 333 si annuel)
  // ─────────────────────────────────────────────────────────────────────────
  PERFORMANCE: {
    name: "Performance",
    tagline: "Pour les écoles ambitieuses sur WhatsApp et IA",
    priceMonthly: 100_000,
    priceYearly: 83_333,
    priceYearlyTotal: 1_000_000,

    // Utilisateurs
    maxUsers: 25,
    canAddExtraUsers: true,
    extraUserPriceMonthly: 5_500,
    maxUsersTotal: 50,

    // Pipelines & Leads
    maxPipelines: 7,
    maxLeads: null,

    // Email Marketing
    emailsPerMonth: 100_000,
    emailBranding: false,
    customEmailDomain: true,

    // WhatsApp
    whatsappManualLink: true,
    whatsappBusinessAPI: true,
    whatsappTemplatesMax: 10,
    whatsappCampaigns: true,
    whatsappChatbot: true,
    whatsappChatbotScenariosMax: 10,
    whatsappSetupIncluded: true,

    // Audiences
    dynamicAudiencesMax: null, // illimité

    // Inbox
    inboxChannels: ["EMAIL", "WHATSAPP", "CHATBOT"],

    // Assistant IA
    aiAssistant: true, // inclus
    aiActionsPerMonth: 5_000,
    aiAddonAvailable: false, // déjà inclus, pas d'add-on à proposer
    aiAddonPrice: null,

    // Activités
    tasks: true,
    calls: true,
    appointments: true,
    duplicates: true,
    importExport: true,

    // Automatisation
    sequencesCount: 1,
    sequencesCustomizable: true,
    sequenceReportingLevel: "ADVANCED",
    workflowsCount: 7,
    workflowReportingLevel: "ADVANCED",

    // Reporting
    reportingLevel: "ADVANCED",
    reportingDateFilters: true,
    reportingAdvancedFilters: true,
    reportingCustomReports: true,
    reportingCustomReportsMax: 10,
    reportingDashboardsMax: 5,
    reportingExportExcelPdf: true,
    reportingScheduledExport: true,
    reportingPeriodComparison: true,
    reportingAI: true,

    // Lead Scoring
    manualScoring: true,
    autoScoring: true,
    autoScoringRulesMax: null, // illimité
    hotWarmColdAuto: true,

    // Rôles
    availableRoles: ["ADMIN", "COMMERCIAL", "TEACHER", "ACCOUNTANT", "VIEWER"],
    presetRolesCount: 5,
    customRoles: true,
    customRolesMax: 5,
    permissionsByModule: true,
    granularPermissions: true,
    campusRestrictions: true,

    // Auth
    emailPasswordLogin: true,
    googleSSO: true,
    microsoftSSO: true,

    // SLA
    slaPercent: 99.5,
    supportChannel: "WHATSAPP",
    supportResponseHours: 4,
    slaCompensation: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// CRÉDITS IA SUPPLÉMENTAIRES (si dépassement quota)
// ─────────────────────────────────────────────────────────────────────────
export const AI_CREDIT_PACKS = [
  { actions: 1_000, price: 10_000 },
  { actions: 5_000, price: 40_000 },
  { actions: 20_000, price: 120_000 },
] as const;

// ─────────────────────────────────────────────────────────────────────────
// SERVICES ONE-SHOT
// ─────────────────────────────────────────────────────────────────────────
export const ONE_SHOT_SERVICES = {
  TRAINING_ONSITE_DAKAR: { name: "Formation équipe sur site Dakar (1 journée)", price: 250_000 },
  TRAINING_ONLINE: { name: "Formation équipe en ligne (1 journée)", price: 200_000 },
  MIGRATION: { name: "Migration depuis HubSpot/Pipedrive/Salesforce", price: 150_000 },
} as const;

// ─────────────────────────────────────────────────────────────────────────
// HELPERS DE LECTURE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Récupère la config d'un plan
 */
export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Liste des plans dans l'ordre d'affichage commercial
 */
export const PLAN_ORDER: readonly Plan[] = ["ESSENTIEL", "CROISSANCE", "PERFORMANCE"] as const;

/**
 * Vérifie si un plan est "supérieur ou égal" à un autre dans la hiérarchie
 * Utile pour gates : if (isPlanAtLeast(org.plan, "CROISSANCE")) { ... }
 */
export function isPlanAtLeast(currentPlan: Plan, requiredPlan: Plan): boolean {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}

/**
 * Le prochain plan dans la hiérarchie (pour suggérer un upgrade)
 */
export function getNextPlan(currentPlan: Plan): Plan | null {
  const index = PLAN_ORDER.indexOf(currentPlan);
  if (index === -1 || index === PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[index + 1];
}