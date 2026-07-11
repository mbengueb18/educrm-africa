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

// ─────────────────────────────────────────────────────────────────────────────
// CONTENU ÉDITABLE (parties + clauses)
// Stocké dans Contract.content ; pré-rempli à la création côté back-office, puis
// modifiable clause par clause. Les grilles tarifaires (Conditions Particulières,
// crédits IA, services) restent auto-générées depuis config.ts et ne sont pas ici.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractClause {
  n: number;
  title: string;
  body: string;
}

export interface ContractParties {
  editorLegal: string;
  editorRccm: string;
  editorAddress: string;
  editorSignName: string;
  editorSignRole: string;
  clientName: string;
  clientLegal: string;
  clientRccm: string;
  clientAddress: string;
  clientSignName: string;
  clientSignRole: string;
}

export interface ContractContent {
  parties: ContractParties;
  clauses: ContractClause[];
}

/** Contenu par défaut d'un contrat (pré-remplissage à la création). */
export function buildDefaultContent(plan: Plan, orgName: string): ContractContent {
  const v = buildContractView(plan);

  const compensation = v.compensation
    ? `En cas de non-respect caractérisé de ce taux sur un mois donné, le Client bénéficie, sur demande, d'un (1) mois d'abonnement offert à titre de compensation forfaitaire, à l'exclusion de toute autre indemnité.`
    : `Le présent plan ne prévoit pas de compensation financière au titre du SLA ; l'Éditeur s'engage sur des moyens raisonnables pour rétablir le Service dans les meilleurs délais.`;

  const clauses: ContractClause[] = [
    { n: 1, title: "Objet du contrat", body: `Le présent contrat a pour objet de définir les conditions dans lesquelles l'Éditeur met à la disposition du Client, en mode logiciel-service (SaaS) accessible en ligne, la plateforme TalibCRM (« le Service »), un logiciel de gestion de la relation prospects et étudiants destiné aux établissements d'enseignement et de formation, au titre de l'offre « ${v.planName} » décrite à l'article 3.` },
    { n: 2, title: "Documents contractuels", body: `Le contrat est formé du présent document, de ses Conditions Particulières (article 3) et, par renvoi, des Conditions Générales d'Utilisation et de la Politique de confidentialité publiées sur talibcrm.com, que le Client déclare avoir lues et acceptées. En cas de contradiction, les stipulations du présent contrat et de ses Conditions Particulières prévalent sur les documents généraux.` },
    { n: 3, title: "Description de l'offre souscrite", body: `Le Client souscrit à l'offre « ${v.planName} », dont le périmètre fonctionnel et les limites d'usage sont détaillés dans les Conditions Particulières ci-dessous. Les fonctionnalités non listées relèvent, le cas échéant, d'une offre supérieure ou d'options facturées séparément (article 6).` },
    { n: 4, title: "Durée, prise d'effet et reconduction", body: `Le contrat prend effet à la date d'activation de l'abonnement. Il est conclu pour la période d'engagement choisie par le Client — mensuelle ou annuelle — telle que retenue à l'article 5. À l'échéance, il se reconduit tacitement par périodes successives de même durée, sauf résiliation par l'une des Parties dans les conditions de l'article 13.` },
    { n: 5, title: "Prix et modalités de paiement", body: `Le prix de l'abonnement est fixé, selon la formule retenue par le Client, à :\n\n• Facturation mensuelle — ${v.priceMonthly} HT par mois ;\n• Engagement annuel — ${v.priceYearlyEq} HT par mois, facturés en une fois pour un total de ${v.priceYearlyTotal} HT par an.\n\nFormule retenue :  ☐ Mensuelle    ☐ Annuelle\n\nLes prix s'entendent hors taxes ; les taxes applicables sont ajoutées le cas échéant. Les factures sont payables à réception. Tout retard de paiement peut entraîner, après mise en demeure restée sans effet, la suspension du Service (article 13). Les tarifs peuvent être révisés à chaque reconduction, moyennant un préavis d'au moins trente (30) jours.` },
    { n: 6, title: "Options et services complémentaires", body: `Le Client peut souscrire, en cours de contrat, les options et prestations suivantes, facturées en sus de l'abonnement :\n\nUtilisateurs supplémentaires — Au-delà des ${v.usersIncluded} utilisateurs inclus et dans la limite de ${v.usersMax}, chaque utilisateur supplémentaire est facturé ${v.extraUser ?? "—"} HT par mois.\n\nDes packs de crédits IA (en cas de dépassement du quota) et des services ponctuels (formations, migration) sont disponibles aux tarifs figurant dans les grilles ci-dessous.` },
    { n: 7, title: "Obligations et engagement de service de l'Éditeur", body: `L'Éditeur s'engage à fournir le Service conformément aux Conditions Particulières et à mettre en œuvre les moyens raisonnables pour en assurer la continuité et la sécurité. Il vise un taux de disponibilité mensuel de ${v.slaPercent}, hors interruptions planifiées de maintenance notifiées à l'avance et hors force majeure (article 15). ${compensation}\n\nLe support est assuré selon les modalités suivantes : ${v.supportText}` },
    { n: 8, title: "Obligations du Client", body: `Le Client s'engage à utiliser le Service conformément aux lois applicables et aux Conditions Générales d'Utilisation. Il s'interdit notamment :\n\n• d'envoyer des messages non sollicités (spam) ou frauduleux, par email ou WhatsApp ;\n• d'importer ou de traiter des données personnelles sans base légale ni consentement approprié ;\n• de tenter de compromettre la sécurité ou l'intégrité de la plateforme ;\n• de céder ou partager ses accès en dehors du nombre d'utilisateurs souscrits.\n\nLe Client est responsable de l'exactitude des données qu'il importe, de la gestion des accès de ses utilisateurs et du respect des règles propres aux canaux utilisés (notamment les politiques de Meta pour WhatsApp).` },
    { n: 9, title: "Données personnelles", body: `Dans le cadre du Service, l'Éditeur agit en qualité de sous-traitant des données personnelles traitées pour le compte du Client, responsable de traitement. L'Éditeur traite ces données sur instruction du Client, dans le seul but de fournir le Service, et met en œuvre des mesures techniques et organisationnelles appropriées pour en assurer la sécurité. Les modalités détaillées figurent dans la Politique de confidentialité, qui vaut annexe.` },
    { n: 10, title: "Propriété intellectuelle", body: `L'Éditeur demeure titulaire de l'ensemble des droits de propriété intellectuelle relatifs à la plateforme TalibCRM. Le présent contrat confère au Client un simple droit d'usage personnel, non exclusif et non cessible du Service pendant sa durée. Le Client conserve la pleine propriété des données et contenus qu'il importe.` },
    { n: 11, title: "Confidentialité", body: `Chaque Partie s'engage à préserver la confidentialité des informations non publiques communiquées par l'autre Partie à l'occasion du contrat, et à ne les utiliser que pour les besoins de son exécution. Cet engagement demeure en vigueur pendant toute la durée du contrat et deux (2) ans après son terme.` },
    { n: 12, title: "Responsabilité", body: `L'Éditeur est tenu d'une obligation de moyens. Sa responsabilité ne saurait être engagée pour les dommages indirects (notamment perte de chiffre d'affaires, de clientèle ou de données imputable au Client). En tout état de cause, la responsabilité de l'Éditeur, toutes causes confondues, est plafonnée au montant des sommes effectivement versées par le Client au titre des douze (12) mois précédant le fait générateur.` },
    { n: 13, title: "Suspension et résiliation", body: `Chaque Partie peut résilier le contrat à l'échéance de la période d'engagement en cours, moyennant un préavis de trente (30) jours. En cas de manquement grave d'une Partie non réparé dans un délai de quinze (15) jours après mise en demeure, l'autre Partie peut résilier de plein droit. L'Éditeur peut suspendre l'accès au Service en cas de défaut de paiement ou d'abus avéré, après information du Client sauf urgence.` },
    { n: 14, title: "Réversibilité des données", body: `À tout moment pendant le contrat et pendant trente (30) jours après son terme, le Client peut exporter ses données dans un format standard exploitable (CSV/Excel). Passé ce délai, l'Éditeur procède à la suppression des données du Client, sous réserve des obligations légales de conservation.` },
    { n: 15, title: "Force majeure", body: `Aucune Partie ne pourra être tenue responsable d'un manquement résultant d'un cas de force majeure, tel que défini par la loi et la jurisprudence, y compris les défaillances des réseaux, hébergeurs ou fournisseurs tiers (notamment Meta pour WhatsApp) échappant à son contrôle raisonnable.` },
    { n: 16, title: "Modifications", body: `L'Éditeur peut faire évoluer les fonctionnalités du Service et mettre à jour les documents généraux. Toute modification substantielle affectant les conditions essentielles du présent contrat est notifiée au Client, qui pourra, s'il la refuse, résilier sans pénalité avant sa prise d'effet.` },
    { n: 17, title: "Droit applicable et règlement des litiges", body: `Le présent contrat est régi par le droit applicable au siège de l'Éditeur. En cas de différend, les Parties s'efforceront de trouver une solution amiable ; à défaut, le litige sera porté devant les juridictions compétentes du ressort du siège de l'Éditeur, sous réserve des dispositions légales impératives.` },
  ];

  return {
    parties: {
      editorLegal: "",
      editorRccm: "",
      editorAddress: "",
      editorSignName: "",
      editorSignRole: "",
      clientName: orgName,
      clientLegal: "",
      clientRccm: "",
      clientAddress: "",
      clientSignName: "",
      clientSignRole: "",
    },
    clauses,
  };
}

/** Normalise un contenu venu de la base (peut être partiel) vers un ContractContent sûr. */
export function normalizeContent(raw: unknown, plan: Plan, orgName: string): ContractContent {
  const def = buildDefaultContent(plan, orgName);
  if (!raw || typeof raw !== "object") return def;
  const r = raw as Partial<ContractContent>;
  return {
    parties: { ...def.parties, ...(r.parties || {}) },
    clauses: Array.isArray(r.clauses) && r.clauses.length ? r.clauses : def.clauses,
  };
}
