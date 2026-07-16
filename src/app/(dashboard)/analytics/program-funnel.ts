"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  globaux: number;   // tous les prospects du programme
  qualifies: number; // contactés au moins une fois (appel/message) — filière renseignée
  admis: number;     // au stade Admis OU déjà inscrits (les admis évoluent vers inscrit)
  inscrits: number;  // convertis en étudiants
  transformationRate: number; // inscrits / qualifiés (%)
  target: number;             // objectif d'inscrits (Program.targetEnrollments)
  realized: number;           // = inscrits
  realizationRate: number;    // inscrits / objectif (%)
}
export interface DiplomaGroup {
  diploma: string;
  rows: FunnelRow[];
  subtotal: FunnelRow;
}
export interface FunnelGroup {
  type: string;
  label: string;
  diplomas: DiplomaGroup[];
  subtotal: FunnelRow;
}
export interface FunnelSummary {
  leadsTotal: number;   // tous les leads du CRM
  contacted: number;    // contactés au moins une fois (toutes filières)
  qualified: number;    // contactés + filière renseignée
  inscrits: number;     // convertis
  target: number;       // somme des objectifs
  transformationRate: number; // inscrits / qualifiés
  realizationRate: number;    // inscrits / objectif
}
export interface ProgramFunnel {
  ok: boolean;
  error?: string;
  summary?: FunnelSummary;
  groups?: FunnelGroup[];
  total?: FunnelRow;
  noProgram?: FunnelRow | null; // prospects sans filière renseignée (à qualifier)
  types?: { value: string; label: string }[];
}

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function aggregate(rows: FunnelRow[], name: string): FunnelRow {
  let globaux = 0, qualifies = 0, admis = 0, inscrits = 0, target = 0;
  for (const r of rows) {
    globaux += r.globaux; qualifies += r.qualifies; admis += r.admis;
    inscrits += r.inscrits; target += r.target;
  }
  return {
    programId: "", name, globaux, qualifies, admis, inscrits,
    transformationRate: rate(inscrits, qualifies),
    target, realized: inscrits, realizationRate: rate(inscrits, target),
  };
}

/**
 * Recrutement par programme (instantané, cumulatif). Définitions métier :
 * - Prospects globaux : tous les leads du programme.
 * - Qualifiés : contactés ≥1 fois (appel OU message sortant) + filière renseignée.
 * - Admis : au stade « Admis » OU déjà inscrits (les admis évoluent vers inscrit).
 * - Inscrits : leads convertis en étudiants.
 * Taux transformation = Inscrits / Qualifiés ; Taux réalisation = Inscrits / Objectif.
 */
export async function getProgramFunnel(): Promise<ProgramFunnel> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const access = await getReportingAccess();
  if (!access?.objectives) {
    return { ok: false, error: "Le recrutement par programme nécessite le plan Croissance ou supérieur." };
  }

  const orgId = session.user.organizationId;

  const [allLeads, programs, stages, callLeads, msgLeads, emailCampLeads, waCampLeads] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: orgId }, select: { id: true, programId: true, stageId: true, isConverted: true } }),
    prisma.program.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, formationType: true, targetEnrollments: true, diploma: true } }),
    prisma.pipelineStage.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, isLost: true } }),
    prisma.call.findMany({ where: { organizationId: orgId, leadId: { not: null } }, select: { leadId: true }, distinct: ["leadId"] }),
    // Tous les messages (email, WhatsApp, chatbot, SMS… toutes directions)
    prisma.message.findMany({ where: { organizationId: orgId, leadId: { not: null } }, select: { leadId: true }, distinct: ["leadId"] }),
    // Destinataires de campagnes email
    prisma.emailCampaignRecipient.findMany({ where: { campaign: { organizationId: orgId } }, select: { leadId: true }, distinct: ["leadId"] }),
    // Destinataires de campagnes WhatsApp
    prisma.whatsAppCampaignRecipient.findMany({ where: { campaign: { organizationId: orgId } }, select: { leadId: true }, distinct: ["leadId"] }),
  ]);

  // Ensemble des leads contactés au moins une fois (appel, message tous canaux,
  // ou destinataire d'une campagne email / WhatsApp)
  const contacted = new Set<string>();
  callLeads.forEach((c) => { if (c.leadId) contacted.add(c.leadId); });
  msgLeads.forEach((m) => { if (m.leadId) contacted.add(m.leadId); });
  emailCampLeads.forEach((e) => { if (e.leadId) contacted.add(e.leadId); });
  waCampLeads.forEach((w) => { if (w.leadId) contacted.add(w.leadId); });

  // Étape « Admis »
  const admisStage = stages.find((s) => normalize(s.name).includes("admis"));
  const admisStageId = admisStage?.id || null;
  // Étapes « perdu »
  const lostIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
  // Un lead qualifié : filière renseignée ET (converti OU pas dans une étape perdue)
  const isQualified = (l: { programId: string | null; stageId: string; isConverted: boolean }) =>
    !!l.programId && (l.isConverted || !lostIds.has(l.stageId));

  // ─── Résumé global (KPIs Vue d'ensemble) ───
  const targetTotal = programs.reduce((sum, p) => sum + (p.targetEnrollments || 0), 0);
  const summary: FunnelSummary = {
    leadsTotal: allLeads.length,
    contacted: allLeads.filter((l) => contacted.has(l.id) || l.isConverted).length,
    // Qualifiés = filière renseignée ET pas perdu (les inscrits/étudiants sont inclus)
    qualified: allLeads.filter(isQualified).length,
    inscrits: allLeads.filter((l) => l.isConverted).length,
    target: targetTotal,
    transformationRate: 0,
    realizationRate: 0,
  };
  summary.transformationRate = rate(summary.inscrits, summary.qualified);
  summary.realizationRate = rate(summary.inscrits, summary.target);

  // ─── Lignes par programme (+ bucket sans filière) ───
  const byProgram: Record<string, { g: number; q: number; a: number; i: number }> = {};
  const np = { g: 0, a: 0, i: 0 }; // sans filière : qualifiés = 0 par définition
  for (const l of allLeads) {
    if (!l.programId) {
      np.g++;
      if (l.isConverted || (admisStageId && l.stageId === admisStageId)) np.a++;
      if (l.isConverted) np.i++;
      continue;
    }
    const b = (byProgram[l.programId] ||= { g: 0, q: 0, a: 0, i: 0 });
    b.g++;
    if (isQualified(l)) b.q++;
    if (l.isConverted || (admisStageId && l.stageId === admisStageId)) b.a++;
    if (l.isConverted) b.i++;
  }
  const noProgram: FunnelRow | null = np.g > 0
    ? { programId: "", name: "Sans filière renseignée", globaux: np.g, qualifies: 0, admis: np.a, inscrits: np.i, transformationRate: 0, target: 0, realized: np.i, realizationRate: 0 }
    : null;

  const buildRow = (prog: { id: string; name: string; code: string | null; targetEnrollments: number }): FunnelRow => {
    const b = byProgram[prog.id] || { g: 0, q: 0, a: 0, i: 0 };
    const target = prog.targetEnrollments || 0;
    return {
      programId: prog.id,
      name: prog.code ? `${prog.code} — ${prog.name}` : prog.name,
      globaux: b.g, qualifies: b.q, admis: b.a, inscrits: b.i,
      transformationRate: rate(b.i, b.q),
      target, realized: b.i, realizationRate: rate(b.i, target),
    };
  };

  const groups: FunnelGroup[] = [];
  for (const type of TYPE_ORDER) {
    const progs = programs.filter((p) => p.formationType === type);
    if (progs.length === 0) continue;

    // Sous-regroupement par Programme/diplôme
    const byDiploma: Record<string, FunnelRow[]> = {};
    for (const p of progs) {
      const dip = (p.diploma && p.diploma.trim()) || "(sans programme)";
      (byDiploma[dip] ||= []).push(buildRow(p));
    }
    const diplomas: DiplomaGroup[] = Object.keys(byDiploma)
      .sort((a, b) => a.localeCompare(b))
      .map((dip) => ({ diploma: dip, rows: byDiploma[dip], subtotal: aggregate(byDiploma[dip], "Sous-total " + dip) }));

    const allTypeRows = diplomas.flatMap((d) => d.rows);
    groups.push({ type, label: TYPE_LABELS[type], diplomas, subtotal: aggregate(allTypeRows, "Sous-total " + TYPE_LABELS[type]) });
  }

  // Total = toutes les filières + les prospects sans filière (→ « Prospects globaux » = tous les leads)
  const allRows = groups.flatMap((g) => g.diplomas.flatMap((d) => d.rows));
  const total = aggregate(noProgram ? [...allRows, noProgram] : allRows, "TOTAL");

  return {
    ok: true,
    summary,
    groups,
    total,
    noProgram,
    types: groups.map((g) => ({ value: g.type, label: g.label })),
  };
}
