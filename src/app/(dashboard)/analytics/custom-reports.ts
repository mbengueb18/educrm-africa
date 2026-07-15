"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getReportingAccess } from "./access";
import {
  REPORT_SOURCES,
  validateReportConfig,
  measureFormat,
  type ReportConfig,
  type ReportSource,
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
const APPT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Planifié", CONFIRMED: "Confirmé", IN_PROGRESS: "En cours",
  COMPLETED: "Honoré", CANCELLED: "Annulé", NO_SHOW: "Absent",
};

type DimKind = "enum" | "relation";
interface DimExec {
  field: string;
  kind: DimKind;
  labels?: Record<string, string>; // enum
  relation?: "pipelineStage" | "program" | "user" | "campus"; // relation
  nullLabel: string;
}
interface MeasExec {
  kind: "count" | "rate";
  where?: Record<string, any>; // filtre additionnel (count) ou numérateur (rate)
}
interface SourceExec {
  model: any;
  dateField: string;
  dimensions: Record<string, DimExec>;
  measures: Record<string, MeasExec>;
}

function buildRegistry(): Record<ReportSource, SourceExec> {
  return {
    leads: {
      model: prisma.lead,
      dateField: "createdAt",
      dimensions: {
        source: { field: "source", kind: "enum", labels: SOURCE_LABELS, nullLabel: "(non défini)" },
        stage: { field: "stageId", kind: "relation", relation: "pipelineStage", nullLabel: "(sans étape)" },
        program: { field: "programId", kind: "relation", relation: "program", nullLabel: "(sans filière)" },
        assignedTo: { field: "assignedToId", kind: "relation", relation: "user", nullLabel: "Non attribué" },
        campus: { field: "campusId", kind: "relation", relation: "campus", nullLabel: "(sans campus)" },
      },
      measures: {
        count: { kind: "count" },
        converted: { kind: "count", where: { isConverted: true } },
        conversionRate: { kind: "rate", where: { isConverted: true } },
      },
    },
    students: {
      model: prisma.student,
      dateField: "enrollmentDate",
      dimensions: {
        program: { field: "programId", kind: "relation", relation: "program", nullLabel: "(sans filière)" },
        campus: { field: "campusId", kind: "relation", relation: "campus", nullLabel: "(sans campus)" },
        status: { field: "status", kind: "enum", labels: STUDENT_STATUS_LABELS, nullLabel: "(non défini)" },
      },
      measures: { count: { kind: "count" } },
    },
    appointments: {
      model: prisma.appointment,
      dateField: "startAt",
      dimensions: {
        status: { field: "status", kind: "enum", labels: APPT_STATUS_LABELS, nullLabel: "(non défini)" },
        assignedTo: { field: "assignedToId", kind: "relation", relation: "user", nullLabel: "Non attribué" },
      },
      measures: {
        count: { kind: "count" },
        completed: { kind: "count", where: { status: "COMPLETED" } },
      },
    },
    calls: {
      model: prisma.call,
      dateField: "calledAt",
      dimensions: {
        outcome: { field: "outcome", kind: "enum", labels: CALL_OUTCOME_LABELS, nullLabel: "(non défini)" },
        assignedTo: { field: "calledById", kind: "relation", relation: "user", nullLabel: "(non défini)" },
      },
      measures: {
        count: { kind: "count" },
        answered: { kind: "count", where: { outcome: "ANSWERED" } },
        answerRate: { kind: "rate", where: { outcome: "ANSWERED" } },
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
export interface RunReportResult {
  ok: boolean;
  error?: string;
  rows?: ReportRow[];
  format?: "int" | "percent";
}

/** Exécute une configuration de rapport (whitelistée) et renvoie les lignes agrégées. */
export async function runReportConfig(config: ReportConfig): Promise<RunReportResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const access = await getReportingAccess();
  if (!access?.tabs.custom) {
    return { ok: false, error: "Les rapports personnalisés nécessitent le plan Croissance ou supérieur." };
  }

  const err = validateReportConfig(config);
  if (err) return { ok: false, error: err };

  const orgId = session.user.organizationId;
  const registry = buildRegistry();
  const src = registry[config.source];
  const dim = src.dimensions[config.dimension];
  const meas = src.measures[config.measure];
  if (!dim || !meas) return { ok: false, error: "Configuration invalide." };

  const since = periodSince(config.period);
  const baseWhere: Record<string, any> = { organizationId: orgId };
  if (since) baseWhere[src.dateField] = { gte: since };

  const field = dim.field;
  let data: { key: string | null; value: number }[];

  try {
    if (meas.kind === "rate") {
      const [totalRows, numRows] = await Promise.all([
        src.model.groupBy({ by: [field], where: baseWhere, _count: { _all: true } }),
        src.model.groupBy({ by: [field], where: { ...baseWhere, ...meas.where }, _count: { _all: true } }),
      ]);
      const numMap: Record<string, number> = {};
      numRows.forEach((r: any) => { numMap[String(r[field])] = r._count._all; });
      data = totalRows.map((r: any) => {
        const tot = r._count._all;
        const num = numMap[String(r[field])] || 0;
        return { key: r[field], value: tot > 0 ? Math.round((num / tot) * 10000) / 100 : 0 };
      });
    } else {
      const where = meas.where ? { ...baseWhere, ...meas.where } : baseWhere;
      const rows = await src.model.groupBy({ by: [field], where, _count: { _all: true } });
      data = rows.map((r: any) => ({ key: r[field], value: r._count._all }));
    }
  } catch {
    return { ok: false, error: "Impossible d'exécuter le rapport." };
  }

  const resolved = await resolveLabels(dim, data);
  resolved.sort((a, b) => b.value - a.value);

  return { ok: true, rows: resolved.slice(0, 25), format: measureFormat(config.source, config.measure) };
}

async function resolveLabels(dim: DimExec, data: { key: string | null; value: number }[]): Promise<ReportRow[]> {
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
    }
  }

  return data.map((d) => ({
    key: String(d.key ?? "null"),
    label: d.key == null ? dim.nullLabel : nameMap[d.key] || "(inconnu)",
    value: d.value,
  }));
}

// ═══════════════════════ CRUD ═══════════════════════

export interface CustomReportItem {
  id: string;
  name: string;
  source: ReportSource;
  dimension: string;
  measure: string;
  period: string;
  vizType: string;
}
export interface CustomReportsList {
  reports: CustomReportItem[];
  max: number;
  canManage: boolean;
}

export async function listCustomReports(): Promise<CustomReportsList> {
  const session = await auth();
  if (!session?.user) return { reports: [], max: 0, canManage: false };

  const access = await getReportingAccess();
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

  if (!access?.tabs.custom) return { reports: [], max: 0, canManage: false };

  const reports = await prisma.customReport.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, source: true, dimension: true, measure: true, period: true, vizType: true },
  });

  return {
    reports: reports as CustomReportItem[],
    max: access.customReportsMax,
    canManage: isAdmin,
  };
}

export interface SaveCustomReportInput extends ReportConfig {
  id?: string;
  name: string;
}

export async function saveCustomReport(input: SaveCustomReportInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) return { ok: false, error: "Réservé aux administrateurs." };

  const access = await getReportingAccess();
  if (!access?.tabs.custom) {
    return { ok: false, error: "Les rapports personnalisés nécessitent le plan Croissance ou supérieur." };
  }

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Le nom du rapport est obligatoire." };

  const cfgErr = validateReportConfig(input);
  if (cfgErr) return { ok: false, error: cfgErr };

  const orgId = session.user.organizationId;
  const data = {
    name,
    source: input.source,
    dimension: input.dimension,
    measure: input.measure,
    period: input.period,
    vizType: input.vizType,
  };

  try {
    if (input.id) {
      const existing = await prisma.customReport.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Rapport introuvable." };
      await prisma.customReport.update({ where: { id: input.id }, data });
    } else {
      // Quota : refuse la création au-delà du plafond du plan
      const count = await prisma.customReport.count({ where: { organizationId: orgId } });
      if (count >= access.customReportsMax) {
        return {
          ok: false,
          error: `Quota atteint : votre plan permet ${access.customReportsMax} rapports personnalisés.`,
        };
      }
      await prisma.customReport.create({
        data: { ...data, organizationId: orgId, createdById: session.user.id },
      });
    }
    revalidatePath("/analytics");
    return { ok: true };
  } catch {
    return { ok: false, error: "Enregistrement impossible. Réessayez." };
  }
}

export async function deleteCustomReport(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) return { ok: false, error: "Réservé aux administrateurs." };

  try {
    const existing = await prisma.customReport.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Rapport introuvable." };
    await prisma.customReport.delete({ where: { id } });
    revalidatePath("/analytics");
    return { ok: true };
  } catch {
    return { ok: false, error: "Suppression impossible." };
  }
}
