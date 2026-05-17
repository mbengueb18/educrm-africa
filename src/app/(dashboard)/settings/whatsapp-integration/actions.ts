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
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée. Seul un administrateur peut configurer WhatsApp.");
  }

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

  // Validation côté Meta : appel API pour vérifier les credentials
  let displayPhoneNumber: string | null = data.displayPhoneNumber?.trim() || null;
  let verifiedName: string | null = data.verifiedName?.trim() || null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${data.phoneNumberId.trim()}?fields=display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${data.accessToken.trim()}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Credentials invalides côté Meta");
    }

    const meta = await response.json();
    // On écrase avec les vraies valeurs Meta (plus fiable que ce que l'utilisateur a saisi)
    if (meta.display_phone_number) displayPhoneNumber = meta.display_phone_number;
    if (meta.verified_name) verifiedName = meta.verified_name;
  } catch (e: any) {
    throw new Error(`Validation Meta échouée : ${e.message}. Vérifiez votre Access Token et Phone Number ID.`);
  }

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
        displayPhoneNumber: displayPhoneNumber,
        verifiedName: verifiedName,
        lastSyncedAt: new Date(),
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
        displayPhoneNumber: displayPhoneNumber,
        verifiedName: verifiedName,
        lastSyncedAt: new Date(),
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
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée. Seul un administrateur peut configurer WhatsApp.");
  }

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
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée. Seul un administrateur peut configurer WhatsApp.");
  }

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

// ─── Test de connexion Meta ───
export async function testConnection() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!integration) throw new Error("Aucune intégration configurée");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${integration.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Erreur Meta");
    }

    const data = await response.json();

    // Mettre à jour les métadonnées
    await prisma.whatsAppIntegration.update({
      where: { organizationId: session.user.organizationId },
      data: {
        displayPhoneNumber: data.display_phone_number || integration.displayPhoneNumber,
        verifiedName: data.verified_name || integration.verifiedName,
        lastSyncedAt: new Date(),
      },
    });

    revalidatePath("/settings/whatsapp-integration");

    return {
      success: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
    };
  } catch (e: any) {
    throw new Error(`Test échoué : ${e.message}`);
  }
}