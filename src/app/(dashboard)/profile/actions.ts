"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ─── Update own profile ───
export async function updateProfile(data: {
  name?: string;
  phone?: string;
  avatar?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
  if (data.avatar !== undefined) updateData.avatar = data.avatar || null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  revalidatePath("/profile");
  return { success: true };
}

// ─── Change own password ───
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  if (data.newPassword.length < 6) throw new Error("Le nouveau mot de passe doit contenir au moins 6 caractères");

  var user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) throw new Error("Utilisateur introuvable");

  var isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Le mot de passe actuel est incorrect");

  var passwordHash = await bcrypt.hash(data.newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return { success: true };
}