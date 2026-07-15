"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getReportingAccess } from "./access";
import { validateReportConfig, type ReportConfig, type ReportSource } from "./report-config";
import { executeReport, type ReportRow } from "./report-engine";

export interface RunReportResult {
  ok: boolean;
  error?: string;
  rows?: ReportRow[];
  format?: "int" | "percent";
}

/** Exécute une configuration de rapport (whitelistée) — onglet Rapports personnalisés. */
export async function runReportConfig(config: ReportConfig): Promise<RunReportResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const access = await getReportingAccess();
  if (!access?.tabs.custom) {
    return { ok: false, error: "Les rapports personnalisés nécessitent le plan Croissance ou supérieur." };
  }

  const err = validateReportConfig(config);
  if (err) return { ok: false, error: err };

  try {
    const { rows, format } = await executeReport(session.user.organizationId, config);
    return { ok: true, rows, format };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Impossible d'exécuter le rapport." };
  }
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
