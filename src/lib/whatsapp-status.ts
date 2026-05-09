"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type WhatsAppMode = "cloud_api" | "wa_link";

/**
 * Détecte si l'organisation utilise Cloud API ou doit retomber sur wa.me
 */
export async function getWhatsAppMode(): Promise<WhatsAppMode> {
  const session = await auth();
  if (!session?.user) return "wa_link";

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
    select: { isActive: true },
  });

  if (integration?.isActive) {
    return "cloud_api";
  }

  return "wa_link";
}