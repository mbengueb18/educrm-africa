// Moteur d'exécution des rapports (module serveur pur — PAS "use server").
// Importé par custom-reports.ts (onglet Rapports) et ai-analyst.ts (Analyste IA).
// executeReport reçoit un orgId déjà vérifié par l'appelant — ne jamais l'appeler
// directement depuis le client.

import { prisma } from "@/lib/prisma";
import {
  REPORT_SOURCES,
  validateReportConfig,
  measureFormat,
  isTimeDimension,
  type ReportConfig,
  type ReportSource,
  type MeasureFormat,
} from "./report-config";

// ─── Libellés des dimensions énumérées ───
const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Site web", FACEBOOK: "Facebook", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp",
  PHONE_CALL: "Appel", WALK_IN: "Visite", REFERRAL: "Parrainage", SALON: "Salon",
  RADIO: "Radio", TV: "TV", PARTNER: "Partenaire", IMPORT: "Import", OTHER: "Autre",
};
const STUDENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif", SUSPENDED: "Suspendu", ON_LEAVE: "En congé",
  GRADUATED: "Diplômé", WITHDRAWN: "Retiré", EXPELLED: "Exclu",
};
const CALL_OUTCOME_LABELS: Record<string, string> = {
  ANSWERED: "Décroché", NO_ANSWER: "Pas de réponse", BUSY: "Occupé", VOICEMAIL: "Messagerie",
  CALLBACK: "À rappeler", WRONG_NUMBER: "Mauvais numéro", NOT_INTERESTED: "Pas intéressé",
};
const CALL_DIRECTION_LABELS: Record<string, string> = { INBOUND: "Entrant", OUTBOUND: "Sortant" };
const APPT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Planifié", CONFIRMED: "Confirmé", IN_PROGRESS: "En cours",
  COMPLETED: "Honoré", CANCELLED: "Annulé", NO_SHOW: "Absent",
};
const APPT_TYPE_LABELS: Record<string, string> = { IN_PERSON: "Présentiel", PHONE: "Téléphone", VIDEO_CALL: "Visio" };
const TASK_STATUS_LABELS: Record<string, string> = { TODO: "À faire", IN_PROGRESS: "En cours", DONE: "Terminée", CANCELLED: "Annulée" };
const TASK_TYPE_LABELS: Record<string, string> = { TODO: "Général", CALL: "Appel", EMAIL: "Email", MEETING: "RDV", FOLLOW_UP: "Relance", DOCUMENT: "Document", OTHER: "Autre" };
const TASK_PRIORITY_LABELS: Record<string, string> = { LOW: "Basse", MEDIUM: "Moyenne", HIGH: "Haute", URGENT: "Urgente" };
const MSG_CHANNEL_LABELS: Record<string, string> = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email", PHONE_CALL: "Appel", IN_APP: "In-app", CHATBOT: "Chatbot" };
const MSG_DIRECTION_LABELS: Record<string, string> = { INBOUND: "Reçu", OUTBOUND: "Envoyé" };
const BOOL_CONVERTED_LABELS: Record<string, string> = { true: "Converti", false: "Non converti" };

type DimKind = "enum" | "relation" | "boolean" | "time";
type RelationKind = "pipelineStage" | "program" | "user" | "campus" | "campaign" | "pipeline";
interface DimExec {
  field: string;
  kind: DimKind;
  labels?: Record<string, string>;
  relation?: RelationKind;
  nullLabel: string;
}
type MeasExec =
  | { kind: "count"; filter?: { field: string; value: any } }
  | { kind: "rate"; filter: { field: string; value: any } }
  | { kind: "avg"; avgField: string };
interface SourceExec {
  model: any;
  dateField: string;
  dimensions: Record<string, DimExec>;
  measures: Record<string, MeasExec>;
}

function buildRegistry(): Record<ReportSource, SourceExec> {
  const timeDim = (dateField: string): DimExec => ({ field: dateField, kind: "time", nullLabel: "(sans date)" });
  const withTime = (dateField: string, dims: Record<string, DimExec>): Record<string, DimExec> => ({
    ...dims,
    day: timeDim(dateField),
    week: timeDim(dateField),
    month: timeDim(dateField),
  });

  return {
    leads: {
      model: prisma.lead,
      dateField: "createdAt",
      dimensions: withTime("createdAt", {
        source: { field: "source", kind: "enum", labels: SOURCE_LABELS, nullLabel: "(non défini)" },
        stage: { field: "stageId", kind: "relation", relation: "pipelineStage", nullLabel: "(sans étape)" },
        program: { field: "programId", kind: "relation", relation: "program", nullLabel: "(sans filière)" },
        assignedTo: { field: "assignedToId", kind: "relation", relation: "user", nullLabel: "Non attribué" },
        campus: { field: "campusId", kind: "relation", relation: "campus", nullLabel: "(sans campus)" },
        campaign: { field: "campaignId", kind: "relation", relation: "campaign", nullLabel: "(sans campagne)" },
        pipeline: { field: "pipelineId", kind: "relation", relation: "pipeline", nullLabel: "(sans pipeline)" },
        country: { field: "country", kind: "enum", nullLabel: "(non défini)" },
        city: { field: "city", kind: "enum", nullLabel: "(non défini)" },
        civility: { field: "civility", kind: "enum", nullLabel: "(non défini)" },
        lostReason: { field: "lostReason", kind: "enum", nullLabel: "(non défini)" },
        isConverted: { field: "isConverted", kind: "boolean", labels: BOOL_CONVERTED_LABELS, nullLabel: "(non défini)" },
      }),
      measures: {
        count: { kind: "count" },
        converted: { kind: "count", filter: { field: "isConverted", value: true } },
        conversionRate: { kind: "rate", filter: { field: "isConverted", value: true } },
        avgScore: { kind: "avg", avgField: "score" },
      },
    },
    students: {
      model: prisma.student,
      dateField: "enrollmentDate",
      dimensions: withTime("enrollmentDate", {
        program: { field: "programId", kind: "relation", relation: "program", nullLabel: "(sans filière)" },
        campus: { field: "campusId", kind: "relation", relation: "campus", nullLabel: "(sans campus)" },
        status: { field: "status", kind: "enum", labels: STUDENT_STATUS_LABELS, nullLabel: "(non défini)" },
        civility: { field: "civility", kind: "enum", nullLabel: "(non défini)" },
      }),
      measures: { count: { kind: "count" } },
    },
    appointments: {
      model: prisma.appointment,
      dateField: "startAt",
      dimensions: withTime("startAt", {
        status: { field: "status", kind: "enum", labels: APPT_STATUS_LABELS, nullLabel: "(non défini)" },
        type: { field: "type", kind: "enum", labels: APPT_TYPE_LABELS, nullLabel: "(non défini)" },
        assignedTo: { field: "assignedToId", kind: "relation", relation: "user", nullLabel: "Non attribué" },
      }),
      measures: {
        count: { kind: "count" },
        completed: { kind: "count", filter: { field: "status", value: "COMPLETED" } },
        completionRate: { kind: "rate", filter: { field: "status", value: "COMPLETED" } },
        noShow: { kind: "count", filter: { field: "status", value: "NO_SHOW" } },
      },
    },
    calls: {
      model: prisma.call,
      dateField: "calledAt",
      dimensions: withTime("calledAt", {
        outcome: { field: "outcome", kind: "enum", labels: CALL_OUTCOME_LABELS, nullLabel: "(non défini)" },
        direction: { field: "direction", kind: "enum", labels: CALL_DIRECTION_LABELS, nullLabel: "(non défini)" },
        assignedTo: { field: "calledById", kind: "relation", relation: "user", nullLabel: "(non défini)" },
      }),
      measures: {
        count: { kind: "count" },
        answered: { kind: "count", filter: { field: "outcome", value: "ANSWERED" } },
        answerRate: { kind: "rate", filter: { field: "outcome", value: "ANSWERED" } },
        avgDuration: { kind: "avg", avgField: "duration" },
      },
    },
    tasks: {
      model: prisma.task,
      dateField: "createdAt",
      dimensions: withTime("createdAt", {
        status: { field: "status", kind: "enum", labels: TASK_STATUS_LABELS, nullLabel: "(non défini)" },
        type: { field: "type", kind: "enum", labels: TASK_TYPE_LABELS, nullLabel: "(non défini)" },
        priority: { field: "priority", kind: "enum", labels: TASK_PRIORITY_LABELS, nullLabel: "(non défini)" },
        assignedTo: { field: "assignedToId", kind: "relation", relation: "user", nullLabel: "Non attribué" },
      }),
      measures: {
        count: { kind: "count" },
        done: { kind: "count", filter: { field: "status", value: "DONE" } },
        doneRate: { kind: "rate", filter: { field: "status", value: "DONE" } },
      },
    },
    messages: {
      model: prisma.message,
      dateField: "sentAt",
      dimensions: withTime("sentAt", {
        channel: { field: "channel", kind: "enum", labels: MSG_CHANNEL_LABELS, nullLabel: "(non défini)" },
        direction: { field: "direction", kind: "enum", labels: MSG_DIRECTION_LABELS, nullLabel: "(non défini)" },
        sentBy: { field: "sentById", kind: "relation", relation: "user", nullLabel: "Automatique" },
      }),
      measures: {
        count: { kind: "count" },
        inbound: { kind: "count", filter: { field: "direction", value: "INBOUND" } },
        outbound: { kind: "count", filter: { field: "direction", value: "OUTBOUND" } },
      },
    },
  };
}

function periodSince(period: string): Date | null {
  if (period === "all") return null;
  const days = period === "30d" ? 30 : period === "12m" ? 365 : 90;
  return new Date(Date.now() - days * 86_400_000);
}

export interface ReportRow { key: string; label: string; value: number }
export interface ReportOutput { rows: ReportRow[]; format: MeasureFormat; total: number }

/**
 * Exécute une config de rapport pour une org DÉJÀ vérifiée par l'appelant.
 */
export async function executeReport(orgId: string, config: ReportConfig): Promise<ReportOutput> {
  const err = validateReportConfig(config);
  if (err) throw new Error(err);

  const registry = buildRegistry();
  const src = registry[config.source];
  const dim = src.dimensions[config.dimension];
  const meas = src.measures[config.measure];
  if (!dim || !meas) throw new Error("Configuration invalide.");

  const since = periodSince(config.period);
  const baseWhere: Record<string, any> = { organizationId: orgId };
  if (since) baseWhere[src.dateField] = { gte: since };

  const format = measureFormat(config.source, config.measure);
  const total = await computeTotal(src.model, baseWhere, meas);

  let rows: ReportRow[];
  if (dim.kind === "time") {
    rows = await timeSeries(src, baseWhere, dim, meas, config.dimension as "day" | "week" | "month");
  } else {
    rows = await grouped(src, baseWhere, dim, meas);
  }

  return { rows, format, total };
}

// ─── Chemin groupBy (dimensions non temporelles) ───
async function grouped(src: SourceExec, baseWhere: Record<string, any>, dim: DimExec, meas: MeasExec): Promise<ReportRow[]> {
  const field = dim.field;
  let data: { key: any; value: number }[];

  if (meas.kind === "rate") {
    const [totalRows, numRows] = await Promise.all([
      src.model.groupBy({ by: [field], where: baseWhere, _count: { _all: true } }),
      src.model.groupBy({ by: [field], where: { ...baseWhere, [meas.filter.field]: meas.filter.value }, _count: { _all: true } }),
    ]);
    const numMap: Record<string, number> = {};
    numRows.forEach((r: any) => { numMap[String(r[field])] = r._count._all; });
    data = totalRows.map((r: any) => {
      const tot = r._count._all;
      const num = numMap[String(r[field])] || 0;
      return { key: r[field], value: tot > 0 ? Math.round((num / tot) * 10000) / 100 : 0 };
    });
  } else if (meas.kind === "avg") {
    const rows = await src.model.groupBy({ by: [field], where: baseWhere, _avg: { [meas.avgField]: true } });
    data = rows.map((r: any) => ({ key: r[field], value: Math.round(r._avg?.[meas.avgField] || 0) }));
  } else {
    const where = meas.filter ? { ...baseWhere, [meas.filter.field]: meas.filter.value } : baseWhere;
    const rows = await src.model.groupBy({ by: [field], where, _count: { _all: true } });
    data = rows.map((r: any) => ({ key: r[field], value: r._count._all }));
  }

  const resolved = await resolveLabels(dim, data);
  resolved.sort((a, b) => b.value - a.value);
  return resolved.slice(0, 25);
}

// ─── Chemin série temporelle (bucketing par jour/semaine/mois) ───
async function timeSeries(src: SourceExec, baseWhere: Record<string, any>, dim: DimExec, meas: MeasExec, gran: "day" | "week" | "month"): Promise<ReportRow[]> {
  const dateField = dim.field;
  const select: Record<string, boolean> = { [dateField]: true };
  if (meas.kind === "rate" || (meas.kind === "count" && meas.filter)) select[(meas as any).filter.field] = true;
  if (meas.kind === "avg") select[meas.avgField] = true;

  const records: any[] = await src.model.findMany({ where: baseWhere, select, take: 20000 });

  const buckets: Record<string, { key: string; label: string; total: number; num: number; sum: number; cnt: number }> = {};
  for (const r of records) {
    const d = r[dateField];
    if (!d) continue;
    const bk = bucketKey(new Date(d), gran);
    if (!buckets[bk.key]) buckets[bk.key] = { key: bk.key, label: bk.label, total: 0, num: 0, sum: 0, cnt: 0 };
    const b = buckets[bk.key];
    b.total++;
    if ((meas.kind === "rate" || (meas.kind === "count" && meas.filter))) {
      const f = (meas as any).filter;
      if (r[f.field] === f.value) b.num++;
    }
    if (meas.kind === "avg") {
      const v = r[meas.avgField];
      if (v != null) { b.sum += v; b.cnt++; }
    }
  }

  const rows = Object.values(buckets).map((b) => {
    let value: number;
    if (meas.kind === "rate") value = b.total > 0 ? Math.round((b.num / b.total) * 10000) / 100 : 0;
    else if (meas.kind === "avg") value = b.cnt > 0 ? Math.round(b.sum / b.cnt) : 0;
    else if (meas.kind === "count" && meas.filter) value = b.num;
    else value = b.total;
    return { key: b.key, label: b.label, value };
  });

  rows.sort((a, b) => a.key.localeCompare(b.key)); // chronologique
  return rows.slice(-120);
}

function bucketKey(d: Date, gran: "day" | "week" | "month"): { key: string; label: string } {
  if (gran === "month") {
    const key = d.toISOString().slice(0, 7);
    return { key, label: d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) };
  }
  if (gran === "week") {
    const monday = new Date(d);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    return { key, label: "sem. " + monday.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) };
  }
  const key = d.toISOString().slice(0, 10);
  return { key, label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) };
}

// ─── Total global (pour le KPI « grand nombre ») ───
async function computeTotal(model: any, baseWhere: Record<string, any>, meas: MeasExec): Promise<number> {
  if (meas.kind === "avg") {
    const agg = await model.aggregate({ where: baseWhere, _avg: { [meas.avgField]: true } });
    return Math.round(agg._avg?.[meas.avgField] || 0);
  }
  if (meas.kind === "rate") {
    const [tot, num] = await Promise.all([
      model.count({ where: baseWhere }),
      model.count({ where: { ...baseWhere, [meas.filter.field]: meas.filter.value } }),
    ]);
    return tot > 0 ? Math.round((num / tot) * 10000) / 100 : 0;
  }
  const where = meas.filter ? { ...baseWhere, [meas.filter.field]: meas.filter.value } : baseWhere;
  return model.count({ where });
}

// ─── Résolution des libellés ───
async function resolveLabels(dim: DimExec, data: { key: any; value: number }[]): Promise<ReportRow[]> {
  if (dim.kind === "boolean") {
    return data.map((d) => ({
      key: String(d.key),
      label: dim.labels?.[String(d.key)] || (d.key ? "Oui" : "Non"),
      value: d.value,
    }));
  }

  if (dim.kind === "enum") {
    return data.map((d) => ({
      key: String(d.key ?? "null"),
      label: d.key == null ? dim.nullLabel : dim.labels?.[String(d.key)] || String(d.key),
      value: d.value,
    }));
  }

  // relation : résoudre les noms
  const ids = data.map((d) => d.key).filter((k): k is string => !!k);
  const nameMap: Record<string, string> = {};
  if (ids.length > 0) {
    if (dim.relation === "program") {
      const rows = await prisma.program.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, code: true } });
      rows.forEach((r) => { nameMap[r.id] = r.code || r.name; });
    } else if (dim.relation === "pipelineStage") {
      const rows = await prisma.pipelineStage.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      rows.forEach((r) => { nameMap[r.id] = r.name; });
    } else if (dim.relation === "user") {
      const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      rows.forEach((r) => { nameMap[r.id] = r.name; });
    } else if (dim.relation === "campus") {
      const rows = await prisma.campus.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      rows.forEach((r) => { nameMap[r.id] = r.name; });
    } else if (dim.relation === "campaign") {
      const rows = await prisma.campaign.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      rows.forEach((r) => { nameMap[r.id] = r.name; });
    } else if (dim.relation === "pipeline") {
      const rows = await prisma.pipeline.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      rows.forEach((r) => { nameMap[r.id] = r.name; });
    }
  }

  return data.map((d) => ({
    key: String(d.key ?? "null"),
    label: d.key == null ? dim.nullLabel : nameMap[d.key] || "(inconnu)",
    value: d.value,
  }));
}
