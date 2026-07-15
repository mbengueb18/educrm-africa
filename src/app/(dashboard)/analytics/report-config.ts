// Whitelist partagée des rapports personnalisés (client + serveur).
// Aucune dépendance Prisma ici — sert au constructeur (UI) et à valider les
// configurations côté serveur avant exécution par report-engine.

export type ReportSource = "leads" | "students" | "appointments" | "calls";
export type VizType = "table" | "bar" | "pie";
export type MeasureFormat = "int" | "percent";

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
  { key: "table", label: "Tableau" },
  { key: "bar", label: "Barres" },
  { key: "pie", label: "Camembert" },
];

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
    ],
    measures: [
      { key: "count", label: "Nombre de leads", format: "int" },
      { key: "converted", label: "Convertis", format: "int" },
      { key: "conversionRate", label: "Taux de conversion", format: "percent" },
    ],
  },
  students: {
    key: "students",
    label: "Étudiants",
    dimensions: [
      { key: "program", label: "Filière" },
      { key: "campus", label: "Campus" },
      { key: "status", label: "Statut" },
    ],
    measures: [{ key: "count", label: "Nombre d'étudiants", format: "int" }],
  },
  appointments: {
    key: "appointments",
    label: "Rendez-vous",
    dimensions: [
      { key: "status", label: "Statut" },
      { key: "assignedTo", label: "Conseiller" },
    ],
    measures: [
      { key: "count", label: "Nombre de RDV", format: "int" },
      { key: "completed", label: "Honorés", format: "int" },
    ],
  },
  calls: {
    key: "calls",
    label: "Appels",
    dimensions: [
      { key: "outcome", label: "Résultat" },
      { key: "assignedTo", label: "Conseiller" },
    ],
    measures: [
      { key: "count", label: "Nombre d'appels", format: "int" },
      { key: "answered", label: "Décrochés", format: "int" },
      { key: "answerRate", label: "Taux de décroché", format: "percent" },
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
