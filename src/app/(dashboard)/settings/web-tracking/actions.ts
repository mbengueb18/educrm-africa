"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleWebTracking(enabled: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { webTrackingEnabled: enabled },
  });

  revalidatePath("/settings/web-tracking");
  revalidatePath("/analytics/web");
  return { success: true };
}

export async function purgeTrackingData() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  // Supprimer dans le bon ordre (FK)
  await prisma.pageView.deleteMany({ where: { organizationId: orgId } });
  await prisma.session.deleteMany({ where: { organizationId: orgId } });
  await prisma.visitor.deleteMany({ where: { organizationId: orgId } });

  revalidatePath("/settings/web-tracking");
  revalidatePath("/analytics/web");
  return { success: true };
}