// Whitelist partagée des rapports personnalisés (client + serveur).
// Aucune dépendance Prisma ici — sert au constructeur (UI) et à valider les
// configurations côté serveur avant exécution par report-engine.

export type ReportSource = "leads" | "students" | "appointments" | "calls" | "tasks" | "messages";
export type VizType = "table" | "bar" | "column" | "line" | "area" | "pie" | "donut" | "kpi";
export type MeasureFormat = "int" | "percent" | "duration";

export interface DimensionDef {
  key: string;
  label: string;
}
export interface MeasureDef {
  key: string;
  label: string;
  format: MeasureFormat;
}
export interface SourceDef {
  key: ReportSource;
  label: string;
  dimensions: DimensionDef[];
  measures: MeasureDef[];
}

export const REPORT_PERIODS: { key: string; label: string }[] = [
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
  { key: "12m", label: "12 mois" },
  { key: "all", label: "Tout l'historique" },
];

export const VIZ_TYPES: { key: VizType; label: string }[] = [
  { key: "bar", label: "Barres" },
  { key: "column", label: "Colonnes" },
  { key: "line", label: "Courbe" },
  { key: "area", label: "Aire" },
  { key: "pie", label: "Camembert" },
  { key: "donut", label: "Donut" },
  { key: "kpi", label: "Grand nombre" },
  { key: "table", label: "Tableau" },
];

// Dimensions temporelles communes (bucketing par date sur le champ de date de la source)
const TIME_DIMENSIONS: DimensionDef[] = [
  { key: "month", label: "Par mois" },
  { key: "week", label: "Par semaine" },
  { key: "day", label: "Par jour" },
];

/** Vrai si la dimension est temporelle (courbe/aire, ordre chronologique). */
export function isTimeDimension(key: string): boolean {
  return key === "day" || key === "week" || key === "month";
}

export const REPORT_SOURCES: Record<ReportSource, SourceDef> = {
  leads: {
    key: "leads",
    label: "Prospects",
    dimensions: [
      { key: "source", label: "Source" },
      { key: "stage", label: "Étape" },
      { key: "program", label: "Filière" },
      { key: "assignedTo", label: "Conseiller" },
      { key: "campus", label: "Campus" },
      { key: "campaign", label: "Campagne" },
      { key: "pipeline", label: "Pipeline" },
      { key: "country", label: "Pays" },
      { key: "city", label: "Ville" },
      { key: "civility", label: "Civilité" },
      { key: "lostReason", label: "Motif de perte" },
      { key: "isConverted", label: "Converti (oui/non)" },
      ...TIME_DIMENSIONS,
    ],
    measures: [
      { key: "count", label: "Nombre de leads", format: "int" },
      { key: "converted", label: "Convertis", format: "int" },
      { key: "conversionRate", label: "Taux de conversion", format: "percent" },
      { key: "avgScore", label: "Score moyen", format: "int" },
    ],
  },
  students: {
    key: "students",
    label: "Étudiants",
    dimensions: [
      { key: "program", label: "Filière" },
      { key: "campus", label: "Campus" },
      { key: "status", label: "Statut" },
      { key: "civility", label: "Civilité" },
      ...TIME_DIMENSIONS,
    ],
    measures: [{ key: "count", label: "Nombre d'étudiants", format: "int" }],
  },
  appointments: {
    key: "appointments",
    label: "Rendez-vous",
    dimensions: [
      { key: "status", label: "Statut" },
      { key: "type", label: "Type" },
      { key: "assignedTo", label: "Conseiller" },
      ...TIME_DIMENSIONS,
    ],
    measures: [
      { key: "count", label: "Nombre de RDV", format: "int" },
      { key: "completed", label: "Honorés", format: "int" },
      { key: "completionRate", label: "Taux de présence", format: "percent" },
      { key: "noShow", label: "Absents", format: "int" },
    ],
  },
  calls: {
    key: "calls",
    label: "Appels",
    dimensions: [
      { key: "outcome", label: "Résultat" },
      { key: "direction", label: "Sens (entrant/sortant)" },
      { key: "assignedTo", label: "Conseiller" },
      ...TIME_DIMENSIONS,
    ],
    measures: [
      { key: "count", label: "Nombre d'appels", format: "int" },
      { key: "answered", label: "Décrochés", format: "int" },
      { key: "answerRate", label: "Taux de décroché", format: "percent" },
      { key: "avgDuration", label: "Durée moyenne", format: "duration" },
    ],
  },
  tasks: {
    key: "tasks",
    label: "Tâches",
    dimensions: [
      { key: "status", label: "Statut" },
      { key: "type", label: "Type" },
      { key: "priority", label: "Priorité" },
      { key: "assignedTo", label: "Assigné à" },
      ...TIME_DIMENSIONS,
    ],
    measures: [
      { key: "count", label: "Nombre de tâches", format: "int" },
      { key: "done", label: "Terminées", format: "int" },
      { key: "doneRate", label: "Taux de complétion", format: "percent" },
    ],
  },
  messages: {
    key: "messages",
    label: "Communications",
    dimensions: [
      { key: "channel", label: "Canal" },
      { key: "direction", label: "Sens (reçu/envoyé)" },
      { key: "sentBy", label: "Envoyé par" },
      ...TIME_DIMENSIONS,
    ],
    measures: [
      { key: "count", label: "Nombre de messages", format: "int" },
      { key: "inbound", label: "Reçus", format: "int" },
      { key: "outbound", label: "Envoyés", format: "int" },
    ],
  },
};

export interface ReportConfig {
  source: ReportSource;
  dimension: string;
  measure: string;
  period: string;
  vizType: VizType;
}

/** Valide une config contre la whitelist. Renvoie un message d'erreur ou null. */
export function validateReportConfig(c: Partial<ReportConfig>): string | null {
  if (!c.source || !(c.source in REPORT_SOURCES)) return "Source invalide.";
  const src = REPORT_SOURCES[c.source];
  if (!c.dimension || !src.dimensions.some((d) => d.key === c.dimension)) return "Dimension invalide pour cette source.";
  if (!c.measure || !src.measures.some((m) => m.key === c.measure)) return "Mesure invalide pour cette source.";
  if (!c.period || !REPORT_PERIODS.some((p) => p.key === c.period)) return "Période invalide.";
  if (!c.vizType || !VIZ_TYPES.some((v) => v.key === c.vizType)) return "Visualisation invalide.";
  return null;
}

export function measureFormat(source: ReportSource, measure: string): MeasureFormat {
  const m = REPORT_SOURCES[source]?.measures.find((x) => x.key === measure);
  return m?.format || "int";
}
