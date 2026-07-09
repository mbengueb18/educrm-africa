"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Masque définitivement la checklist de premier démarrage pour l'organisation
 * (drapeau dans Organization.settings). Fusionne pour ne pas écraser les autres réglages.
 */
export async function dismissOnboardingChecklist(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user) return { success: false };

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as Record<string, unknown> | null) || {};
  settings.onboardingChecklistDismissed = true;

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: settings as any },
  });

  return { success: true };
}
