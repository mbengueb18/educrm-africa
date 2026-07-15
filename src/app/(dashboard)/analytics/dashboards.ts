"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getReportingAccess } from "./access";
import { executeReport, type ReportRow } from "./report-engine";
import type { ReportConfig, ReportSource, VizType, MeasureFormat } from "./report-config";

function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export interface DashboardSummary {
  id: string;
  name: string;
  itemCount: number;
}
export interface DashboardsList {
  dashboards: DashboardSummary[];
  max: number;
  canManage: boolean;
}

export async function listDashboards(): Promise<DashboardsList> {
  const session = await auth();
  if (!session?.user) return { dashboards: [], max: 0, canManage: false };

  const access = await getReportingAccess();
  if (!access?.tabs.dashboards) return { dashboards: [], max: 0, canManage: false };

  const dashboards = await prisma.reportDashboard.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });

  return {
    dashboards: dashboards.map((d) => ({ id: d.id, name: d.name, itemCount: d._count.items })),
    max: access.dashboardsMax,
    canManage: isAdminRole(session.user.role),
  };
}

export interface DashboardItemResult {
  id: string;
  width: string;
  reportId: string;
  name: string;
  config: ReportConfig;
  ok: boolean;
  rows: ReportRow[];
  format: MeasureFormat;
  total: number;
}
export interface DashboardDetail {
  ok: boolean;
  error?: string;
  id?: string;
  name?: string;
  items?: DashboardItemResult[];
  canManage?: boolean;
}

export async function getDashboard(id: string): Promise<DashboardDetail> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const access = await getReportingAccess();
  if (!access?.tabs.dashboards) return { ok: false, error: "Indisponible sur votre plan." };

  const orgId = session.user.organizationId;
  const dashboard = await prisma.reportDashboard.findFirst({
    where: { id, organizationId: orgId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { report: true },
      },
    },
  });
  if (!dashboard) return { ok: false, error: "Tableau de bord introuvable." };

  const items: DashboardItemResult[] = await Promise.all(
    dashboard.items.map(async (it) => {
      const config: ReportConfig = {
        source: it.report.source as ReportSource,
        dimension: it.report.dimension,
        measure: it.report.measure,
        period: it.report.period,
        vizType: it.report.vizType as VizType,
      };
      try {
        const out = await executeReport(orgId, config);
        return { id: it.id, width: it.width, reportId: it.reportId, name: it.report.name, config, ok: true, rows: out.rows, format: out.format, total: out.total };
      } catch {
        return { id: it.id, width: it.width, reportId: it.reportId, name: it.report.name, config, ok: false, rows: [], format: "int" as MeasureFormat, total: 0 };
      }
    })
  );

  return { ok: true, id: dashboard.id, name: dashboard.name, items, canManage: isAdminRole(session.user.role) };
}

export async function createDashboard(name: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  const access = await getReportingAccess();
  if (!access?.tabs.dashboards) {
    return { ok: false, error: "Les tableaux de bord nécessitent le plan Croissance ou supérieur." };
  }

  const clean = (name || "").trim();
  if (!clean) return { ok: false, error: "Le nom est obligatoire." };

  const orgId = session.user.organizationId;
  const count = await prisma.reportDashboard.count({ where: { organizationId: orgId } });
  if (count >= access.dashboardsMax) {
    return {
      ok: false,
      error: `Votre plan permet ${access.dashboardsMax} tableau${access.dashboardsMax > 1 ? "x" : ""} de bord. Pour aller au-delà, contactez-nous pour un devis.`,
    };
  }

  try {
    const d = await prisma.reportDashboard.create({
      data: { organizationId: orgId, name: clean, createdById: session.user.id },
    });
    revalidatePath("/analytics");
    return { ok: true, id: d.id };
  } catch {
    return { ok: false, error: "Création impossible." };
  }
}

export async function renameDashboard(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  const clean = (name || "").trim();
  if (!clean) return { ok: false, error: "Le nom est obligatoire." };

  const existing = await prisma.reportDashboard.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Introuvable." };

  await prisma.reportDashboard.update({ where: { id }, data: { name: clean } });
  revalidatePath("/analytics");
  return { ok: true };
}

export async function deleteDashboard(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  const existing = await prisma.reportDashboard.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Introuvable." };

  await prisma.reportDashboard.delete({ where: { id } });
  revalidatePath("/analytics");
  return { ok: true };
}

export async function addReportToDashboard(dashboardId: string, reportId: string, width: "half" | "full" = "half"): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  const orgId = session.user.organizationId;
  // Vérifie que dashboard ET rapport appartiennent à l'org (isolation)
  const [dashboard, report] = await Promise.all([
    prisma.reportDashboard.findFirst({ where: { id: dashboardId, organizationId: orgId }, select: { id: true } }),
    prisma.customReport.findFirst({ where: { id: reportId, organizationId: orgId }, select: { id: true } }),
  ]);
  if (!dashboard || !report) return { ok: false, error: "Élément introuvable." };

  const existing = await prisma.dashboardItem.findFirst({ where: { dashboardId, reportId }, select: { id: true } });
  if (existing) return { ok: false, error: "Ce rapport est déjà sur le tableau de bord." };

  const count = await prisma.dashboardItem.count({ where: { dashboardId } });
  await prisma.dashboardItem.create({ data: { dashboardId, reportId, width, position: count } });
  revalidatePath("/analytics");
  return { ok: true };
}

export async function removeDashboardItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  // Isolation : l'item doit appartenir à un dashboard de l'org
  const item = await prisma.dashboardItem.findFirst({
    where: { id: itemId, dashboard: { organizationId: session.user.organizationId } },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Introuvable." };

  await prisma.dashboardItem.delete({ where: { id: itemId } });
  revalidatePath("/analytics");
  return { ok: true };
}

export async function setDashboardItemWidth(itemId: string, width: "half" | "full"): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (!isAdminRole(session.user.role)) return { ok: false, error: "Réservé aux administrateurs." };

  const item = await prisma.dashboardItem.findFirst({
    where: { id: itemId, dashboard: { organizationId: session.user.organizationId } },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Introuvable." };

  await prisma.dashboardItem.update({ where: { id: itemId }, data: { width } });
  revalidatePath("/analytics");
  return { ok: true };
}
