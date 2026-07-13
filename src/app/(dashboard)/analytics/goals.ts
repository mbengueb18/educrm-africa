"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getReportingAccess } from "./access";

export interface GoalProgress {
  goal: {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    targetEnrollments: number;
    targetLeads: number;
    targetConversionRate: number | null;
  } | null;
  progress: { enrollments: number; leads: number; conversionRate: number } | null;
  daysLeft: number | null;
  canEdit: boolean;
}

/**
 * Objectif « actif » de l'org (période englobant aujourd'hui, sinon le plus
 * récent) + progression calculée sur la fenêtre [début → min(fin, maintenant)].
 * Lecture seule — appelé depuis la page RSC.
 */
export async function getGoalWithProgress(): Promise<GoalProgress> {
  const session = await auth();
  if (!session?.user) return { goal: null, progress: null, daysLeft: null, canEdit: false };

  const orgId = session.user.organizationId;
  const access = await getReportingAccess();
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const canEdit = !!access?.objectives && isAdmin;

  // Sans le droit objectifs (plan BASIC), on ne charge rien.
  if (!access?.objectives) return { goal: null, progress: null, daysLeft: null, canEdit: false };

  const now = new Date();

  // Objectif actif : période courante, sinon le plus récent
  const goal =
    (await prisma.reportingGoal.findFirst({
      where: { organizationId: orgId, startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { endDate: "desc" },
    })) ||
    (await prisma.reportingGoal.findFirst({
      where: { organizationId: orgId },
      orderBy: { endDate: "desc" },
    }));

  if (!goal) return { goal: null, progress: null, daysLeft: null, canEdit };

  const windowEnd = now < goal.endDate ? now : goal.endDate;

  const [enrollments, leads, converted] = await Promise.all([
    prisma.student.count({
      where: { organizationId: orgId, enrollmentDate: { gte: goal.startDate, lte: windowEnd } },
    }),
    prisma.lead.count({
      where: { organizationId: orgId, createdAt: { gte: goal.startDate, lte: windowEnd } },
    }),
    prisma.lead.count({
      where: { organizationId: orgId, isConverted: true, convertedAt: { gte: goal.startDate, lte: windowEnd } },
    }),
  ]);

  const conversionRate = leads > 0 ? Math.round((converted / leads) * 10000) / 100 : 0;
  const daysLeft = Math.max(0, Math.ceil((goal.endDate.getTime() - now.getTime()) / 86_400_000));

  return {
    goal: {
      id: goal.id,
      label: goal.label,
      startDate: goal.startDate.toISOString(),
      endDate: goal.endDate.toISOString(),
      targetEnrollments: goal.targetEnrollments,
      targetLeads: goal.targetLeads,
      targetConversionRate: goal.targetConversionRate,
    },
    progress: { enrollments, leads, conversionRate },
    daysLeft,
    canEdit,
  };
}

export interface SaveGoalInput {
  id?: string;
  label: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  targetEnrollments: number;
  targetLeads: number;
  targetConversionRate: number | null;
}

/** Créer / mettre à jour un objectif (admin + plan avec objectifs). */
export async function saveReportingGoal(input: SaveGoalInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) return { ok: false, error: "Réservé aux administrateurs." };

  const access = await getReportingAccess();
  if (!access?.objectives) {
    return { ok: false, error: "Les objectifs de rentrée nécessitent le plan Croissance ou supérieur." };
  }

  const label = input.label?.trim();
  if (!label) return { ok: false, error: "Le libellé est obligatoire." };

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, error: "Dates invalides." };
  if (end <= start) return { ok: false, error: "La date de fin doit être postérieure au début." };

  const data = {
    label,
    startDate: start,
    endDate: end,
    targetEnrollments: Math.max(0, Math.round(input.targetEnrollments || 0)),
    targetLeads: Math.max(0, Math.round(input.targetLeads || 0)),
    targetConversionRate:
      input.targetConversionRate == null ? null : Math.max(0, Math.min(100, input.targetConversionRate)),
  };

  try {
    if (input.id) {
      // Vérifie l'appartenance à l'org avant update (isolation multi-tenant)
      const existing = await prisma.reportingGoal.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Objectif introuvable." };
      await prisma.reportingGoal.update({ where: { id: input.id }, data });
    } else {
      await prisma.reportingGoal.create({
        data: { ...data, organizationId: orgId, createdById: session.user.id },
      });
    }
    revalidatePath("/analytics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Enregistrement impossible. Réessayez." };
  }
}

/** Supprimer un objectif (admin + plan avec objectifs). */
export async function deleteReportingGoal(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const orgId = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (!isAdmin) return { ok: false, error: "Réservé aux administrateurs." };

  try {
    const existing = await prisma.reportingGoal.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Objectif introuvable." };
    await prisma.reportingGoal.delete({ where: { id } });
    revalidatePath("/analytics");
    return { ok: true };
  } catch {
    return { ok: false, error: "Suppression impossible." };
  }
}
