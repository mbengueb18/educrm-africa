"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";
import { canUseAI } from "@/lib/plans/checks";
import { incrementAIActions } from "@/lib/plans/usage";
import { getReportingAccess } from "./access";
import { executeReport, type ReportRow } from "./report-engine";
import {
  REPORT_SOURCES, REPORT_PERIODS, VIZ_TYPES,
  validateReportConfig,
  type ReportConfig, type ReportSource, type VizType, type MeasureFormat,
} from "./report-config";

const AI_COST = 2; // 2 crédits : interprétation + narration

export interface AnalystResult {
  ok: boolean;
  error?: string;
  question?: string;
  answer?: string;
  config?: ReportConfig;
  rows?: ReportRow[];
  format?: MeasureFormat;
  total?: number;
}

/** Extrait un objet JSON d'une réponse LLM (retire d'éventuelles clôtures ```json). */
function parseJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

function whitelistPrompt(): string {
  const lines: string[] = [];
  (Object.values(REPORT_SOURCES)).forEach((s) => {
    const dims = s.dimensions.map((d) => `${d.key} (${d.label})`).join(", ");
    const meas = s.measures.map((m) => `${m.key} (${m.label})`).join(", ");
    lines.push(`- source "${s.key}" (${s.label}) : dimensions = [${dims}] ; mesures = [${meas}]`);
  });
  const periods = REPORT_PERIODS.map((p) => `${p.key} (${p.label})`).join(", ");
  const vizs = VIZ_TYPES.map((v) => v.key).join(", ");
  return `Sources et champs autorisés :\n${lines.join("\n")}\nPériodes autorisées : ${periods}\nVisualisations : ${vizs}`;
}

/**
 * Analyste IA (plan Performance) : question en langage naturel → l'IA choisit
 * une config de rapport (whitelist), on exécute le vrai groupBy, puis l'IA
 * rédige une analyse ancrée sur les chiffres réels. Coûte 2 crédits IA.
 */
export async function askAnalyst(question: string): Promise<AnalystResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const q = (question || "").trim();
  if (q.length < 4) return { ok: false, error: "Posez une question un peu plus précise." };
  if (q.length > 400) return { ok: false, error: "Question trop longue." };

  const orgId = session.user.organizationId;

  const access = await getReportingAccess();
  if (!access?.ai) {
    return { ok: false, error: "L'Analyste IA est réservé au plan Performance." };
  }

  // Quota crédits IA (2 appels)
  const credit = await canUseAI(orgId, AI_COST);
  if (!credit.allowed) return { ok: false, error: credit.reason || "Quota IA atteint." };

  // ─── Passe 1 : question → config de rapport ───
  let config: ReportConfig;
  try {
    const raw = await callGemini(
      [{ role: "user", parts: [{ text: q }] }],
      `Tu convertis une question en UNE configuration de rapport pour un CRM d'école supérieure.
${whitelistPrompt()}
Choisis les valeurs les plus pertinentes. Par défaut period="90d" et vizType="bar".
Réponds STRICTEMENT en JSON : {"source": "...", "dimension": "...", "measure": "...", "period": "...", "vizType": "..."}`
    );
    const parsed = parseJson(raw);
    config = {
      source: parsed.source as ReportSource,
      dimension: String(parsed.dimension),
      measure: String(parsed.measure),
      period: String(parsed.period || "90d"),
      vizType: (parsed.vizType as VizType) || "bar",
    };
  } catch {
    return { ok: false, error: "Je n'ai pas pu interpréter la question. Reformulez-la (ex. « leads par filière ce trimestre »)." };
  }

  const cfgErr = validateReportConfig(config);
  if (cfgErr) {
    return { ok: false, error: "Je n'ai pas trouvé de rapport correspondant. Essayez une formulation plus proche de vos données (prospects, étudiants, rendez-vous, appels)." };
  }

  // ─── Exécution ancrée ───
  let rows: ReportRow[];
  let format: MeasureFormat;
  let total = 0;
  try {
    const out = await executeReport(orgId, config);
    rows = out.rows;
    format = out.format;
    total = out.total;
  } catch {
    return { ok: false, error: "Impossible d'exécuter le rapport correspondant." };
  }

  // ─── Passe 2 : narration ancrée sur les chiffres réels ───
  const srcDef = REPORT_SOURCES[config.source];
  const dimLabel = srcDef.dimensions.find((d) => d.key === config.dimension)?.label || config.dimension;
  const measLabel = srcDef.measures.find((m) => m.key === config.measure)?.label || config.measure;
  const perLabel = REPORT_PERIODS.find((p) => p.key === config.period)?.label || config.period;
  const isPct = format === "percent";
  const dataForPrompt = rows.slice(0, 12).map((r) => `${r.label}: ${r.value}${isPct ? "%" : ""}`).join(" | ");

  let answer = "";
  try {
    const raw = await callGemini(
      [{ role: "user", parts: [{ text: `Question : ${q}\nRapport : ${measLabel} par ${dimLabel} (${perLabel}).\nDonnées réelles : ${dataForPrompt || "aucune donnée"}` }] }],
      `Tu es analyste CRM pour une école supérieure. À partir UNIQUEMENT des données réelles fournies, rédige en français :
1) une analyse concise (2 à 4 phrases) qui met en avant les points saillants ;
2) une recommandation actionnable.
N'invente aucun chiffre au-delà de ceux fournis. Reste factuel et concret.
Réponds STRICTEMENT en JSON : {"answer": "..."}`
    );
    answer = String(parseJson(raw).answer || "").trim();
  } catch {
    // La narration a échoué mais les données sont valides : on renvoie quand même le rapport.
    answer = "";
  }

  // Conso crédits (les 2 appels ont été tentés)
  try { await incrementAIActions(orgId, AI_COST); } catch {}

  // Historique
  try {
    await prisma.aiReportQuery.create({
      data: {
        organizationId: orgId,
        userId: session.user.id,
        question: q,
        source: config.source,
        dimension: config.dimension,
        measure: config.measure,
        period: config.period,
        vizType: config.vizType,
        answer: answer,
      },
    });
  } catch {}

  return { ok: true, question: q, answer, config, rows, format, total };
}

export interface AnalystHistoryItem {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export async function getAnalystHistory(): Promise<AnalystHistoryItem[]> {
  const session = await auth();
  if (!session?.user) return [];

  const access = await getReportingAccess();
  if (!access?.ai) return [];

  const rows = await prisma.aiReportQuery.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, question: true, answer: true, createdAt: true },
  });

  return rows.map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    createdAt: r.createdAt.toISOString(),
  }));
}
