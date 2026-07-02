"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Liste des notifications de l'utilisateur courant (+ compteur non lues) ───
export async function getMyNotifications(limit = 20) {
  const session = await auth();
  if (!session?.user) return { count: 0, items: [] as any[] };

  const [items, count] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, type: true, title: true, body: true,
        url: true, isRead: true, createdAt: true, taskId: true, leadId: true,
      },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return { count, items };
}

// ─── Marquer une notification comme lue ───
export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });
  return { success: true };
}

// ─── Marquer toutes les notifications comme lues ───
export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
  return { success: true };
}
