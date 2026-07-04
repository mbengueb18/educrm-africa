"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPlanLimits } from "@/lib/plans/config";
import { getBoSession, setBoCookie, clearBoCookie, createToken, type BoSession } from "@/lib/bo-auth";

const VALID_PLANS = ["ESSENTIEL", "CROISSANCE", "PERFORMANCE"] as const;
type PlanKey = (typeof VALID_PLANS)[number];
const BO_ROLES = ["OWNER", "ADMIN", "SUPPORT"] as const;

async function requireBo(): Promise<BoSession> {
  const s = await getBoSession();
  if (!s) throw new Error("Non authentifié");
  return s;
}
async function requireOwner(): Promise<BoSession> {
  const s = await requireBo();
  if (s.role !== "OWNER") throw new Error("Réservé au propriétaire du back-office");
  return s;
}

// ─── Auth ───
export async function boLogin(email: string, password: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: (email || "").trim().toLowerCase() } });
  if (!admin || !admin.isActive) return { success: false, error: "Identifiants invalides" };
  const ok = await bcrypt.compare(password || "", admin.passwordHash);
  if (!ok) return { success: false, error: "Identifiants invalides" };

  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await setBoCookie(createToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role }));
  return { success: true };
}

export async function boLogout() {
  await clearBoCookie();
  return { success: true };
}

// ─── Organisations ───
export async function getOrganizations() {
  await requireBo();
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, plan: true, planLockedUntil: true,
      aiAddonEnabled: true, createdAt: true,
      _count: { select: { users: true, leads: true } },
    },
  });
  const now = Date.now();
  return orgs.map((o) => {
    const expired = !!(o.planLockedUntil && o.planLockedUntil.getTime() < now);
    const effectivePlan = (expired ? "ESSENTIEL" : o.plan) as PlanKey;
    return {
      id: o.id, name: o.name, slug: o.slug, plan: o.plan, effectivePlan,
      trialUntil: o.planLockedUntil && !expired && o.plan !== "ESSENTIEL" ? o.planLockedUntil : null,
      aiAddonEnabled: o.aiAddonEnabled, createdAt: o.createdAt,
      users: o._count.users, maxUsers: getPlanLimits(effectivePlan).maxUsersTotal, leads: o._count.leads,
    };
  });
}

export async function changePlan(data: { orgId: string; plan: string; temporary?: boolean; durationDays?: number; note?: string }) {
  const s = await requireBo();
  if (!VALID_PLANS.includes(data.plan as PlanKey)) throw new Error("Plan invalide");
  const org = await prisma.organization.findUnique({ where: { id: data.orgId }, select: { plan: true } });
  if (!org) throw new Error("Organisation introuvable");

  const temporary = data.plan !== "ESSENTIEL" && !!data.temporary;
  const days = Math.max(1, Math.min(365, Number(data.durationDays) || 14));
  const until = temporary ? new Date(Date.now() + days * 86_400_000) : null;

  await prisma.organization.update({
    where: { id: data.orgId },
    data: { plan: data.plan as PlanKey, planChangedAt: new Date(), planLockedUntil: until },
  });
  await prisma.planChangeLog.create({
    data: { organizationId: data.orgId, changedById: s.id, fromPlan: org.plan, toPlan: data.plan, temporaryUntil: until, note: (data.note || "").trim() || null },
  });
  revalidatePath("/backoffice");
  return { success: true };
}

export async function getPlanChangeLogs(limit = 15) {
  await requireBo();
  return prisma.planChangeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { organization: { select: { name: true, slug: true } }, changedBy: { select: { name: true } } },
  });
}

// ─── Gestion des admins du back-office (OWNER uniquement) ───
export async function getPlatformAdmins() {
  await requireBo();
  return prisma.platformAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

export async function createPlatformAdmin(data: { email: string; name: string; role: string; password: string }) {
  await requireOwner();
  const email = (data.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email invalide");
  if (!data.name?.trim()) throw new Error("Nom requis");
  if (!BO_ROLES.includes(data.role as any)) throw new Error("Rôle invalide");
  if (!data.password || data.password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");

  const exists = await prisma.platformAdmin.findUnique({ where: { email } });
  if (exists) throw new Error("Un admin avec cet email existe déjà");

  await prisma.platformAdmin.create({
    data: { email, name: data.name.trim(), role: data.role, passwordHash: await bcrypt.hash(data.password, 10) },
  });
  revalidatePath("/backoffice/admins");
  return { success: true };
}

export async function updatePlatformAdmin(id: string, data: { role?: string; isActive?: boolean; name?: string }) {
  const s = await requireOwner();
  const target = await prisma.platformAdmin.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new Error("Admin introuvable");

  // Ne pas se rétrograder/désactiver soi-même s'il ne reste qu'un OWNER actif
  if (id === s.id && (data.role && data.role !== "OWNER" || data.isActive === false)) {
    const owners = await prisma.platformAdmin.count({ where: { role: "OWNER", isActive: true } });
    if (owners <= 1) throw new Error("Impossible : vous êtes le dernier propriétaire actif");
  }
  if (data.role && !BO_ROLES.includes(data.role as any)) throw new Error("Rôle invalide");

  await prisma.platformAdmin.update({
    where: { id },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    },
  });
  revalidatePath("/backoffice/admins");
  return { success: true };
}

export async function resetPlatformAdminPassword(id: string, password: string) {
  await requireOwner();
  if (!password || password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
  await prisma.platformAdmin.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { success: true };
}

export async function deletePlatformAdmin(id: string) {
  const s = await requireOwner();
  if (id === s.id) throw new Error("Vous ne pouvez pas vous supprimer vous-même");
  await prisma.platformAdmin.delete({ where: { id } });
  revalidatePath("/backoffice/admins");
  return { success: true };
}
