"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getReportingAccess } from "./access";

const TYPE_LABELS: Record<string, string> = {
  INITIAL: "Formation Initiale (FI)",
  CONTINUE: "Formation Continue (FC)",
  BOTH: "Mixte (FI / FC)",
};
const TYPE_ORDER = ["INITIAL", "CONTINUE", "BOTH"];

export interface FunnelRow {
  programId: string;
  name: string;
  reached: number[]; // par étape non-perdue (cumulatif « a atteint »)
  inscrits: number;
  admis: number;
  transformationRate: number; // inscrits / admis (%)
  target: number;
  realized: number; // = inscrits
  realizationRate: number; // inscrits / objectif (%)
}
export interface FunnelGroup {
  type: string;
  label: string;
  rows: FunnelRow[];
  subtotal: FunnelRow;
}
export interface ProgramFunnel {
  ok: boolean;
  error?: string;
  stages?: { id: string; name: string }[];
  groups?: FunnelGroup[];
  total?: FunnelRow;
  canEdit?: boolean;
}

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

function aggregate(rows: FunnelRow[], name: string, stageCount: number): FunnelRow {
  const reached = new Array(stageCount).fill(0);
  let inscrits = 0, admis = 0, target = 0;
  for (const r of rows) {
    r.reached.forEach((v, i) => { reached[i] += v; });
    inscrits += r.inscrits;
    admis += r.admis;
    target += r.target;
  }
  return {
    programId: "", name, reached, inscrits, admis,
    transformationRate: rate(inscrits, admis),
    target, realized: inscrits, realizationRate: rate(inscrits, target),
  };
}

/**
 * Funnel de recrutement par programme (cumulatif, instantané), groupé par type
 * de formation (FI/FC), avec taux de transformation (inscrits/admis), objectif
 * par programme et taux de réalisation (inscrits/objectif).
 */
export async function getProgramFunnel(): Promise<ProgramFunnel> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const access = await getReportingAccess();
  if (!access?.objectives) {
    return { ok: false, error: "Le recrutement par programme nécessite le plan Croissance ou supérieur." };
  }

  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

  const [stages, programs, byProgStage, byProgConverted, goals] = await Promise.all([
    prisma.pipelineStage.findMany({ where: { organizationId: orgId }, orderBy: { order: "asc" }, select: { id: true, name: true, order: true, isLost: true } }),
    prisma.program.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, formationType: true } }),
    prisma.lead.groupBy({ by: ["programId", "stageId"], where: { organizationId: orgId, programId: { not: null } }, _count: { id: true } }),
    prisma.lead.groupBy({ by: ["programId"], where: { organizationId: orgId, programId: { not: null }, isConverted: true }, _count: { id: true } }),
    prisma.programGoal.findMany({ where: { organizationId: orgId }, select: { programId: true, targetEnrollments: true } }),
  ]);

  const nonLost = stages.filter((s) => !s.isLost);
  const stageOrder: Record<string, number> = {};
  const lostIds = new Set<string>();
  stages.forEach((s) => { stageOrder[s.id] = s.order; if (s.isLost) lostIds.add(s.id); });

  // program -> stageId -> count
  const cmap: Record<string, Record<string, number>> = {};
  byProgStage.forEach((r) => {
    if (!r.programId) return;
    (cmap[r.programId] ||= {})[r.stageId || "none"] = r._count.id;
  });
  const convMap: Record<string, number> = {};
  byProgConverted.forEach((r) => { if (r.programId) convMap[r.programId] = r._count.id; });
  const targetMap: Record<string, number> = {};
  goals.forEach((g) => { targetMap[g.programId] = g.targetEnrollments; });

  const reachedFor = (progId: string, minOrder: number): number => {
    const sc = cmap[progId] || {};
    let sum = 0;
    for (const sid in sc) {
      if (lostIds.has(sid)) continue;
      if ((stageOrder[sid] ?? -1) >= minOrder) sum += sc[sid];
    }
    return sum;
  };

  const buildRow = (prog: { id: string; name: string; code: string | null }): FunnelRow => {
    const reached = nonLost.map((s) => reachedFor(prog.id, s.order));
    const inscrits = convMap[prog.id] || 0;
    const admis = reached.length > 0 ? reached[reached.length - 1] : 0;
    const target = targetMap[prog.id] || 0;
    return {
      programId: prog.id,
      name: prog.code ? `${prog.code} — ${prog.name}` : prog.name,
      reached, inscrits, admis,
      transformationRate: rate(inscrits, admis),
      target, realized: inscrits, realizationRate: rate(inscrits, target),
    };
  };

  const groups: FunnelGroup[] = [];
  for (const type of TYPE_ORDER) {
    const progs = programs.filter((p) => p.formationType === type);
    if (progs.length === 0) continue;
    const rows = progs.map(buildRow);
    groups.push({ type, label: TYPE_LABELS[type], rows, subtotal: aggregate(rows, "Sous-total " + TYPE_LABELS[type], nonLost.length) });
  }

  const allRows = groups.flatMap((g) => g.rows);
  const total = aggregate(allRows, "TOTAL", nonLost.length);

  return {
    ok: true,
    stages: nonLost.map((s) => ({ id: s.id, name: s.name })),
    groups,
    total,
    canEdit: isAdmin,
  };
}

// ─── Édition des objectifs par programme ───
export interface ProgramGoalEditItem {
  programId: string;
  name: string;
  type: string;
  typeLabel: string;
  target: number;
}

export async function getProgramGoalsForEdit(): Promise<ProgramGoalEditItem[]> {
  const session = await auth();
  if (!session?.user) return [];
  const access = await getReportingAccess();
  if (!access?.objectives) return [];

  const orgId = session.user.organizationId;
  const [programs, goals] = await Promise.all([
    prisma.program.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: [{ formationType: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, formationType: true } }),
    prisma.programGoal.findMany({ where: { organizationId: orgId }, select: { programId: true, targetEnrollments: true } }),
  ]);
  const targetMap: Record<string, number> = {};
  goals.forEach((g) => { targetMap[g.programId] = g.targetEnrollments; });

  return programs.map((p) => ({
    programId: p.id,
    name: p.code ? `${p.code} — ${p.name}` : p.name,
    type: p.formationType,
    typeLabel: TYPE_LABELS[p.formationType] || p.formationType,
    target: targetMap[p.id] || 0,
  }));
}

export async function saveProgramGoals(items: { programId: string; target: number }[]): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) return { ok: false, error: "Réservé aux administrateurs." };

  const access = await getReportingAccess();
  if (!access?.objectives) return { ok: false, error: "Nécessite le plan Croissance ou supérieur." };

  const orgId = session.user.organizationId;
  // Ne garder que les programmes de l'org (isolation)
  const orgPrograms = await prisma.program.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const validIds = new Set(orgPrograms.map((p) => p.id));

  try {
    await prisma.$transaction(
      items
        .filter((it) => validIds.has(it.programId))
        .map((it) =>
          prisma.programGoal.upsert({
            where: { organizationId_programId: { organizationId: orgId, programId: it.programId } },
            create: { organizationId: orgId, programId: it.programId, targetEnrollments: Math.max(0, Math.round(it.target || 0)) },
            update: { targetEnrollments: Math.max(0, Math.round(it.target || 0)) },
          })
        )
    );
    revalidatePath("/analytics");
    return { ok: true };
  } catch {
    return { ok: false, error: "Enregistrement impossible." };
  }
}
