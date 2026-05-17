"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get integration for current org ───
export async function getIntegration() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });
}

// ─── Create or update integration ───
export async function saveIntegration(data: {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  // Validation basique
  if (!data.phoneNumberId?.trim()) throw new Error("Le Phone Number ID est requis");
  if (!data.whatsappBusinessAccountId?.trim()) throw new Error("Le WhatsApp Business Account ID est requis");
  if (!data.accessToken?.trim()) throw new Error("L'Access Token est requis");
  if (!data.verifyToken?.trim()) throw new Error("Le Verify Token est requis");
  if (!data.appSecret?.trim()) throw new Error("L'App Secret est requis");

  // Vérifier si une intégration existe déjà
  const existing = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: orgId },
  });

  if (existing) {
    // Update
    await prisma.whatsAppIntegration.update({
      where: { organizationId: orgId },
      data: {
        phoneNumberId: data.phoneNumberId.trim(),
        whatsappBusinessAccountId: data.whatsappBusinessAccountId.trim(),
        accessToken: data.accessToken.trim(),
        verifyToken: data.verifyToken.trim(),
        appSecret: data.appSecret.trim(),
        displayPhoneNumber: data.displayPhoneNumber?.trim() || null,
        verifiedName: data.verifiedName?.trim() || null,
        isActive: true,
      },
    });
  } else {
    // Create
    await prisma.whatsAppIntegration.create({
      data: {
        organizationId: orgId,
        phoneNumberId: data.phoneNumberId.trim(),
        whatsappBusinessAccountId: data.whatsappBusinessAccountId.trim(),
        accessToken: data.accessToken.trim(),
        verifyToken: data.verifyToken.trim(),
        appSecret: data.appSecret.trim(),
        displayPhoneNumber: data.displayPhoneNumber?.trim() || null,
        verifiedName: data.verifiedName?.trim() || null,
        isActive: true,
      },
    });
  }

  revalidatePath("/settings/whatsapp-integration");
  return { success: true };
}

// ─── Toggle active/inactive ───
export async function toggleIntegrationActive(isActive: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.whatsAppIntegration.update({
    where: { organizationId: session.user.organizationId },
    data: { isActive },
  });

  revalidatePath("/settings/whatsapp-integration");
  return { success: true };
}

// ─── Delete integration ───
export async function deleteIntegration() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Vérifier qu'aucune campagne WhatsApp en cours
  const activeCampaigns = await prisma.whatsAppCampaign.count({
    where: {
      organizationId: session.user.organizationId,
      status: "SENDING",
    },
  });

  if (activeCampaigns > 0) {
    throw new Error(
      `Impossible de supprimer : ${activeCampaigns} campagne(s) en cours d'envoi. Attendez la fin.`
    );
  }

  await prisma.whatsAppIntegration.delete({
    where: { organizationId: session.user.organizationId },
  });

  revalidatePath("/settings/whatsapp-integration");
  return { success: true };
}

// ─── Get webhook URL for this org ───
export async function getWebhookUrl() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Détecter l'URL de base
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "app.talibcrm.com";
  const baseUrl = host.startsWith("http") ? host : `${protocol}://${host}`;

  return `${baseUrl}/api/webhooks/whatsapp/${session.user.organizationId}`;
}