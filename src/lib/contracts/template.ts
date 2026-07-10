// lib/contracts/template.ts
//
// Construit les données d'affichage d'un contrat d'abonnement à partir de la
// source de vérité des plans (lib/plans/config.ts). Le texte des clauses vit
// dans le composant de rendu ; ici on ne produit que les valeurs variables
// (tarifs, limites, SLA…) et l'identité de l'offre.

import { getPlanLimits } from "@/lib/plans/config";
import type { Plan } from "@/lib/plans/types";

/** Bucket Supabase privé dédié aux contrats signés (à créer côté Supabase). */
export const CONTRACTS_BUCKET = "contracts";

/** Préfixe de référence contrat par plan (TC-CRO-0001, TC-PER-0001…). */
export const CONTRACT_PLAN_PREFIX: Record<Plan, string> = {
  ESSENTIEL: "ESS",
  CROISSANCE: "CRO",
  PERFORMANCE: "PER",
};

/** Plans pour lesquels un contrat d'abonnement a du sens (offres payantes). */
export const CONTRACTABLE_PLANS: Plan[] = ["CROISSANCE", "PERFORMANCE"];

export function isContractablePlan(plan: Plan): boolean {
  return CONTRACTABLE_PLANS.includes(plan);
}

/** Montant FCFA formaté à la française : 45000 → « 45 000 FCFA ». */
export function fcfa(n: number): string {
  // On normalise l'espace fine insécable en espace normal pour l'impression.
  return n.toLocaleString("fr-FR").replace(/ | /g, " ") + " FCFA";
}

/** Numéro → référence contrat, ex. (CROISSANCE, 1) → « TC-CRO-0001 ». */
export function buildReference(plan: Plan, seq: number): string {
  return `TC-${CONTRACT_PLAN_PREFIX[plan]}-${String(seq).padStart(4, "0")}`;
}

export interface ContractSpecRow {
  label: string;
  value: string;
  badge?: "inc" | "opt";
}

export interface ContractView {
  plan: Plan;
  planName: string;
  tagline: string;
  prefix: string;
  // Tarifs
  priceMonthly: string;
  priceYearlyEq: string;
  priceYearlyTotal: string;
  // Options
  usersIncluded: number;
  usersMax: number;
  extraUser: string | null;
  slaPercent: string;
  supportText: string;
  compensation: boolean;
  iaIncluded: boolean;
  iaAddonPrice: string | null;
  // Tableau « Conditions particulières »
  rows: ContractSpecRow[];
}

/** Construit la vue d'un contrat pour un plan donné. */
export function buildContractView(plan: Plan): ContractView {
  const L = getPlanLimits(plan);

  const supportText =
    L.supportChannel === "WHATSAPP"
      ? `Support prioritaire par WhatsApp${L.supportResponseHours ? `, réponse cible sous ${L.supportResponseHours} h ouvrées.` : "."}`
      : L.supportChannel === "EMAIL"
        ? `Support par email${L.supportResponseHours ? `, réponse cible sous ${L.supportResponseHours} h ouvrées.` : "."}`
        : "Support communautaire.";

  const whatsappText = L.whatsappBusinessAPI
    ? `API WhatsApp Business officielle (Meta), configuration prise en charge par l'Éditeur, jusqu'à ${L.whatsappTemplatesMax} modèles de messages${L.whatsappCampaigns ? ", campagnes WhatsApp" : ""}${L.whatsappChatbot ? ` et chatbot (jusqu'à ${L.whatsappChatbotScenariosMax} scénarios)` : ""}.`
    : L.whatsappManualLink
      ? "Bouton de contact manuel (lien wa.me vers le numéro de l'établissement). L'API WhatsApp Business, les campagnes et le chatbot ne sont pas inclus."
      : "Non inclus.";

  const iaText = L.aiAssistant
    ? `Assistant IA inclus, dans la limite de ${L.aiActionsPerMonth.toLocaleString("fr-FR")} actions IA par mois.`
    : L.aiAddonAvailable && L.aiAddonPrice
      ? `Non incluse. Disponible en option (add-on) au tarif de ${fcfa(L.aiAddonPrice)}/mois pour ${L.aiActionsPerMonth.toLocaleString("fr-FR")} actions IA par mois.`
      : "Non incluse.";

  const rows: ContractSpecRow[] = [
    { label: "Assistant IA", value: iaText, badge: L.aiAssistant ? "inc" : "opt" },
    {
      label: "Utilisateurs",
      value: `${L.maxUsers} utilisateurs inclus, extensible jusqu'à ${L.maxUsersTotal}${L.extraUserPriceMonthly ? ` (utilisateur supplémentaire : ${fcfa(L.extraUserPriceMonthly)}/mois)` : ""}.`,
    },
    { label: "Pipelines commerciaux", value: `${L.maxPipelines} pipelines · prospects (leads) illimités.` },
    {
      label: "Emailing",
      value: `Jusqu'à ${L.emailsPerMonth.toLocaleString("fr-FR")} emails / mois · domaine d'expédition personnalisé${L.emailBranding ? "" : " · sans mention publicitaire de l'Éditeur"}.`,
    },
    { label: "WhatsApp", value: whatsappText },
    { label: "Boîte de réception", value: `Boîte unifiée — ${L.inboxChannels.join(", ")}.` },
    {
      label: "Audiences dynamiques",
      value: L.dynamicAudiencesMax == null ? "Illimité." : `Jusqu'à ${L.dynamicAudiencesMax}.`,
    },
    {
      label: "Automatisation",
      value: `${L.sequencesCount} séquence(s) de relance${L.sequencesCustomizable ? " personnalisables" : ""}, ${L.workflowsCount} workflows.`,
    },
    {
      label: "Lead scoring",
      value: `Scoring manuel${L.autoScoring ? ` et automatique (${L.autoScoringRulesMax == null ? "règles illimitées" : `${L.autoScoringRulesMax} règles`})` : ""}${L.hotWarmColdAuto ? ", classification Chaud / Tiède / Froid" : ""}.`,
    },
    { label: "Reporting", value: `Niveau ${L.reportingLevel === "ADVANCED" ? "Avancé" : L.reportingLevel === "STANDARD" ? "Standard" : "Basique"}${L.reportingExportExcelPdf ? ", export Excel/PDF" : ""}${L.reportingScheduledExport ? ", exports programmés" : ""}${L.reportingPeriodComparison ? ", comparaison de périodes" : ""}.` },
    {
      label: "Rôles & permissions",
      value: `${L.presetRolesCount} rôles préconfigurés${L.customRoles ? ` + rôles personnalisés (jusqu'à ${L.customRolesMax})` : ""}${L.granularPermissions ? ", permissions granulaires" : L.permissionsByModule ? ", permissions par module" : ""}${L.campusRestrictions ? ", restrictions par campus" : ""}.`,
    },
    {
      label: "Authentification",
      value: `Email/mot de passe${L.googleSSO ? ", SSO Google" : ""}${L.microsoftSSO ? " et Microsoft" : ""}.`,
    },
    {
      label: "Disponibilité (SLA)",
      value: `Taux de disponibilité mensuel cible de ${formatSla(L.slaPercent)}. ${supportText}${L.slaCompensation ? " En cas de manquement caractérisé, un (1) mois d'abonnement est offert." : ""}`,
    },
  ];

  return {
    plan,
    planName: L.name,
    tagline: L.tagline,
    prefix: CONTRACT_PLAN_PREFIX[plan],
    priceMonthly: fcfa(L.priceMonthly),
    priceYearlyEq: fcfa(L.priceYearly),
    priceYearlyTotal: fcfa(L.priceYearlyTotal),
    usersIncluded: L.maxUsers,
    usersMax: L.maxUsersTotal,
    extraUser: L.extraUserPriceMonthly ? fcfa(L.extraUserPriceMonthly) : null,
    slaPercent: formatSla(L.slaPercent),
    supportText,
    compensation: L.slaCompensation,
    iaIncluded: L.aiAssistant,
    iaAddonPrice: L.aiAddonPrice ? fcfa(L.aiAddonPrice) : null,
    rows,
  };
}

function formatSla(sla: number | null): string {
  if (sla == null) return "best effort";
  return `${sla.toString().replace(".", ",")} %`;
}
