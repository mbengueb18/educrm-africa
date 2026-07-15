import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, getNextPlan } from "@/lib/plans/config";
import type { Plan } from "@/lib/plans/types";

/**
 * Droits d'accès au reporting, dérivés du plan de l'org.
 * Consommé par la coquille du hub (`ReportingHub`) pour verrouiller onglets,
 * filtres, comparaison de période, export et rapports personnalisés.
 *
 * Appelé depuis un composant serveur (RSC), pas une server action.
 */
export interface ReportingAccess {
  plan: Plan;
  planName: string;
  nextPlanName: string | null;
  // Onglets
  tabs: {
    overview: boolean;
    pipeline: boolean;
    team: boolean;
    acquisition: boolean;
    sequences: boolean;
    custom: boolean;
    dashboards: boolean;
    ai: boolean;
  };
  // Capacités transverses
  dateFilters: boolean;
  advancedFilters: boolean;
  periodComparison: boolean;
  exportData: boolean;
  scheduledExport: boolean;
  objectives: boolean;
  customReportsMax: number;
  dashboardsMax: number;
  ai: boolean;
}

export async function getReportingAccess(): Promise<ReportingAccess | null> {
  const session = await auth();
  if (!session?.user) return null;

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true, planLockedUntil: true },
  });
  if (!org) return null;

  // Rétrogradation auto (offres promotionnelles / essais expirés), aligné sur checks.ts
  let plan: Plan = org.plan;
  if (org.planLockedUntil && org.planLockedUntil.getTime() < Date.now()) {
    plan = "ESSENTIEL";
  }

  const limits = PLAN_LIMITS[plan];
  const isAdvanced = limits.reportingLevel !== "BASIC";
  const nextPlan = getNextPlan(plan);

  return {
    plan,
    planName: limits.name,
    nextPlanName: nextPlan ? PLAN_LIMITS[nextPlan].name : null,
    tabs: {
      overview: true,
      pipeline: true,
      team: true,
      acquisition: isAdvanced,
      sequences: limits.sequenceReportingLevel !== null,
      custom: limits.reportingCustomReportsMax > 0,
      dashboards: limits.reportingDashboardsMax > 0,
      ai: limits.reportingAI,
    },
    dateFilters: limits.reportingDateFilters,
    advancedFilters: limits.reportingAdvancedFilters,
    periodComparison: limits.reportingPeriodComparison,
    exportData: limits.reportingExportExcelPdf,
    scheduledExport: limits.reportingScheduledExport,
    objectives: isAdvanced,
    customReportsMax: limits.reportingCustomReportsMax,
    dashboardsMax: limits.reportingDashboardsMax,
    ai: limits.reportingAI,
  };
}
