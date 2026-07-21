"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import { assertCanAddUser } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";
import { sendUserInvitation } from "@/lib/user-invitation";

// Résultat standard des actions d'écriture : on RENVOIE l'erreur métier au lieu
// de la throw. En prod, Next.js masque le message des erreurs throw des Server
// Actions ("An error occurred in the Server Components render...") ; un retour
// permet d'afficher un message clair côté client.
// `warning` : succès de l'opération mais effet secondaire non bloquant échoué (ex. email).
type ActionResult = { ok: true; warning?: string } | { ok: false; error: string };

export async function getUsers() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  return prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      campus: { select: { id: true, name: true, city: true } },
      _count: { select: { assignedLeads: true, activities: true, sentMessages: true } },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });
}

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

export async function createUser(data: {
  name: string; email: string; phone?: string; role: string; campusId?: string;
}): Promise<ActionResult> {
  var session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé aux administrateurs" };

  // Vérifier la limite du plan AVANT toute autre opération
  try {
    await assertCanAddUser(session.user.organizationId);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      var msg = error.upgradeTarget
        ? error.message + " Passez au plan " + error.upgradeTarget + " pour augmenter la limite."
        : error.message;
      return { ok: false, error: msg };
    }
    throw error;
  }

  var existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
  if (existing) return { ok: false, error: "Cet email est déjà utilisé" };

  // Mode invitation : l'utilisateur définira son mot de passe via l'email d'activation.
  // En attendant, on stocke un hash ALÉATOIRE inutilisable (aucun mot de passe connu
  // ne permet de se connecter tant que le compte n'est pas activé).
  var passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  var created = await prisma.user.create({
    data: {
      name: data.name.trim(), email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || null, passwordHash,
      role: data.role as any, isActive: true,
      campusId: data.campusId || null,
      organizationId: session.user.organizationId,
    },
    select: { id: true },
  });

  // Email d'invitation (crée le token + envoie). Non bloquant : si l'envoi échoue, le
  // compte existe déjà — l'admin pourra renvoyer l'invitation.
  var invite = await sendUserInvitation(created.id);

  revalidatePath("/settings/users");
  if (!invite.success) {
    return { ok: true, warning: "Compte créé, mais l'email d'invitation n'a pas pu être envoyé. Renvoyez-le depuis la fiche de l'utilisateur." };
  }
  return { ok: true };
}

/**
 * (Re)envoie l'email d'invitation à un utilisateur (créer son mot de passe / activer).
 * Utile pour les comptes créés avant l'envoi automatique, ou si l'email s'est perdu.
 */
export async function resendInvitation(userId: string): Promise<ActionResult> {
  var session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé aux administrateurs" };

  // Isolation tenant : on ne renvoie une invitation qu'à un membre de SA propre organisation.
  var target = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!target || target.organizationId !== session.user.organizationId) return { ok: false, error: "Utilisateur introuvable" };

  var invite = await sendUserInvitation(userId);
  if (!invite.success) return { ok: false, error: invite.error || "L'envoi de l'invitation a échoué" };
  return { ok: true };
}

export async function updateUser(userId: string, data: {
  name?: string; email?: string; phone?: string; role?: string; campusId?: string | null; isActive?: boolean;
}): Promise<ActionResult> {
  var session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé aux administrateurs" };

  // Si on réactive un utilisateur, vérifier la limite
  if (data.isActive === true) {
    var currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    // Seulement si on passe de inactif à actif
    if (currentUser && !currentUser.isActive) {
      try {
        await assertCanAddUser(session.user.organizationId);
      } catch (error) {
        if (error instanceof PlanLimitError) {
          var msg = error.upgradeTarget
            ? error.message + " Passez au plan " + error.upgradeTarget + " pour réactiver cet utilisateur."
            : error.message;
          return { ok: false, error: msg };
        }
        throw error;
      }
    }
  }

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) {
    var e = data.email.toLowerCase().trim();
    var dup = await prisma.user.findFirst({ where: { email: e, id: { not: userId } } });
    if (dup) return { ok: false, error: "Cet email est déjà utilisé" };
    updateData.email = e;
  }
  if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.campusId !== undefined) updateData.campusId = data.campusId || null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  await prisma.user.update({ where: { id: userId }, data: updateData });
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<ActionResult> {
  var session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé aux administrateurs" };
  if (newPassword.length < 6) return { ok: false, error: "Min. 6 caractères" };
  var hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  var session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé aux administrateurs" };
  if (session.user.id === userId) return { ok: false, error: "Impossible de supprimer votre propre compte" };
  await prisma.lead.updateMany({ where: { assignedToId: userId }, data: { assignedToId: null } });
  await prisma.task.updateMany({ where: { assignedToId: userId }, data: { assignedToId: session.user.id } });
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/settings/users");
  return { ok: true };
}
