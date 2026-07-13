// lib/plans/types.ts

/**
 * Types et interfaces pour le système de plans TalibCRM
 * Source de vérité unique : config.ts
 */

export type Plan = "ESSENTIEL" | "CROISSANCE" | "PERFORMANCE";

export type BillingCycle = "MONTHLY" | "YEARLY";

export type ReportingLevel = "BASIC" | "STANDARD" | "ADVANCED";

export type SupportChannel = "COMMUNITY" | "EMAIL" | "WHATSAPP";

/**
 * Liste des fonctionnalités gates pour les checks rapides.
 * Utilisé par canAccessFeature(orgId, feature)
 */
export type Feature =
  // WhatsApp
  | "WHATSAPP_MANUAL_LINK"
  | "WHATSAPP_BUSINESS_API"
  | "WHATSAPP_TEMPLATES"
  | "WHATSAPP_CAMPAIGNS"
  | "WHATSAPP_CHATBOT"
  | "WHATSAPP_SETUP_INCLUDED"
  // Email
  | "EMAIL_CUSTOM_DOMAIN"
  // IA
  | "AI_ASSISTANT"
  | "AI_AUTO_CLASSIFICATION"
  | "AI_LEAD_ANALYSIS"
  | "AI_MESSAGE_GENERATION"
  | "AI_CONVERSATION_SUMMARY"
  | "AI_MESSAGE_REFORMULATION"
  | "AI_ACTION_SUGGESTIONS"
  // Reporting
  | "REPORTING_DATE_FILTERS"
  | "REPORTING_CUSTOM_REPORTS"
  | "REPORTING_EXPORT_DATA"
  | "REPORTING_SCHEDULED_EXPORT"
  | "REPORTING_PERIOD_COMPARISON"
  | "REPORTING_AI"
  // Lead Scoring
  | "AUTO_LEAD_SCORING"
  | "HOT_WARM_COLD_AUTO"
  // Permissions
  | "CUSTOM_ROLES"
  | "GRANULAR_PERMISSIONS"
  | "CAMPUS_RESTRICTIONS"
  // SSO
  | "GOOGLE_SSO"
  | "MICROSOFT_SSO"
  // Other
  | "INBOX_WHATSAPP_CHANNEL"
  | "INBOX_CHATBOT_CHANNEL";

/**
 * Limites complètes d'un plan
 * Toutes les caractéristiques d'un plan en un seul objet
 */
export interface PlanLimits {
  // Identité
  name: string;
  tagline: string;
  priceMonthly: number; // FCFA
  priceYearly: number; // FCFA (équivalent mensuel)
  priceYearlyTotal: number; // FCFA (montant annuel facturé)

  // Utilisateurs
  maxUsers: number;
  canAddExtraUsers: boolean;
  extraUserPriceMonthly: number | null; // FCFA
  maxUsersTotal: number; // Plafond max avec add-ons

  // Pipelines & Leads
  maxPipelines: number;
  maxLeads: number | null; // null = illimité

  // Email Marketing
  emailsPerMonth: number;
  emailBranding: boolean; // true = branding TalibCRM visible
  customEmailDomain: boolean;

  // WhatsApp
  whatsappManualLink: boolean; // Bouton wa.me/{numéro}
  whatsappBusinessAPI: boolean; // API officielle Meta
  whatsappTemplatesMax: number;
  whatsappCampaigns: boolean;
  whatsappChatbot: boolean;
  whatsappChatbotScenariosMax: number;
  whatsappSetupIncluded: boolean; // Setup Meta gratuit

  // Audiences
  dynamicAudiencesMax: number | null; // null = illimité

  // Inbox
  inboxChannels: ("EMAIL" | "WHATSAPP" | "CHATBOT")[];

  // Assistant IA
  aiAssistant: boolean;
  aiActionsPerMonth: number;
  aiAddonAvailable: boolean; // Disponible en add-on à 15k/mois
  aiAddonPrice: number | null; // FCFA

  // Activités (toujours incluses)
  tasks: boolean;
  calls: boolean;
  appointments: boolean;
  duplicates: boolean;
  importExport: boolean;

  // Automatisation
  sequencesCount: number;
  sequencesCustomizable: boolean;
  sequenceReportingLevel: ReportingLevel | null;
  workflowsCount: number;
  workflowReportingLevel: ReportingLevel | null;

  // Reporting
  reportingLevel: ReportingLevel;
  reportingDateFilters: boolean;
  reportingAdvancedFilters: boolean;
  reportingCustomReports: boolean; // true dès qu'au moins 1 rapport custom est autorisé
  reportingCustomReportsMax: number; // Nombre de rapports personnalisés (0 = aucun)
  reportingExportExcelPdf: boolean;
  reportingScheduledExport: boolean;
  reportingPeriodComparison: boolean;
  reportingAI: boolean; // Analyste IA (langage naturel + insights auto)

  // Lead Scoring
  manualScoring: boolean;
  autoScoring: boolean;
  autoScoringRulesMax: number | null; // null = illimité, 0 = pas dispo
  hotWarmColdAuto: boolean;

  // Rôles & Permissions
  availableRoles: string[];
  presetRolesCount: number;
  customRoles: boolean;
  customRolesMax: number;
  permissionsByModule: boolean;
  granularPermissions: boolean;
  campusRestrictions: boolean;

  // Authentification
  emailPasswordLogin: boolean;
  googleSSO: boolean;
  microsoftSSO: boolean;

  // SLA & Support
  slaPercent: number | null; // 99, 99.5, null = best effort
  supportChannel: SupportChannel;
  supportResponseHours: number | null; // 48 = sous 48h, null = pas de garantie
  slaCompensation: boolean; // 1 mois offert si manquement
}

/**
 * Résultat d'un check de limite
 * Format uniforme pour gérer les erreurs proprement
 */
export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  upgradeTarget?: Plan; // Vers quel plan upgrader si bloqué
}

/**
 * Mapping des anciens plans vers les nouveaux
 * Utilisé pour la migration BDD
 */
export const LEGACY_PLAN_MAPPING: Record<string, Plan> = {
  FREE: "ESSENTIEL",
  STARTER: "CROISSANCE",
  PRO: "PERFORMANCE",
  ENTERPRISE: "PERFORMANCE",
};