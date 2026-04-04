"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ─── Get all users ───
export async function getUsers() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      campus: { select: { id: true, name: true, city: true } },
      _count: {
        select: {
          assignedLeads: true,
          activities: true,
          sentMessages: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return users;
}

// ─── Get user stats ───
export async function getUserStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  var [total, active, admins, commercials] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.user.count({ where: { organizationId: orgId, role: "ADMIN", isActive: true } }),
    prisma.user.count({ where: { organizationId: orgId, role: "COMMERCIAL", isActive: true } }),
  ]);

  return { total, active, inactive: total - active, admins, commercials };
}

// ─── Create user ───
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
  campusId?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Seuls les administrateurs peuvent créer des utilisateurs");

  // Check email uniqueness
  var existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
  if (existing) throw new Error("Cet email est déjà utilisé");

  var passwordHash = await bcrypt.hash(data.password, 12);

  var user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || null,
      passwordHash,
      role: data.role as any,
      isActive: true,
      campusId: data.campusId || null,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/users");
  return { success: true, user };
}

// ─── Update user ───
export async function updateUser(userId: string, data: {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  campusId?: string | null;
  isActive?: boolean;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Seuls les administrateurs peuvent modifier des utilisateurs");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) {
    var emailLower = data.email.toLowerCase().trim();
    var existing = await prisma.user.findFirst({ where: { email: emailLower, id: { not: userId } } });
    if (existing) throw new Error("Cet email est déjà utilisé par un autre utilisateur");
    updateData.email = emailLower;
  }
  if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.campusId !== undefined) updateData.campusId = data.campusId || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  var user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  revalidatePath("/users");
  return { success: true, user };
}

// ─── Reset password ───
export async function resetUserPassword(userId: string, newPassword: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Seuls les administrateurs peuvent réinitialiser les mots de passe");

  if (newPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");

  var passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  revalidatePath("/users");
  return { success: true };
}

// ─── Delete user ───
export async function deleteUser(userId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Seuls les administrateurs peuvent supprimer des utilisateurs");
  if (session.user.id === userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");

  // Unassign leads
  await prisma.lead.updateMany({
    where: { assignedToId: userId },
    data: { assignedToId: null },
  });

  // Unassign tasks
  await prisma.task.updateMany({
    where: { assignedToId: userId },
    data: { assignedToId: session.user.id },
  });

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/users");
  return { success: true };
}