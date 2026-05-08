"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

interface WhatsAppConfig {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
}

// ─── Sauvegarder la config ───
export async function saveWhatsAppConfig(config: WhatsAppConfig) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée");
  }

  const orgId = session.user.organizationId;

  // Validation basique
  if (!config.phoneNumberId || !config.accessToken || !config.verifyToken || !config.appSecret) {
    throw new Error("Tous les champs sont requis");
  }

  // Test de l'API : récupérer les infos du numéro pour valider les credentials
  let displayPhoneNumber: string | null = null;
  let verifiedName: string | null = null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${config.phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Meta API: ${err.error?.message || "Credentials invalides"}`);
    }

    const data = await response.json();
    displayPhoneNumber = data.display_phone_number || null;
    verifiedName = data.verified_name || null;
  } catch (e: any) {
    throw new Error(`Validation Meta échouée : ${e.message}`);
  }

  // Upsert (créer ou mettre à jour)
  await prisma.whatsAppIntegration.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      phoneNumberId: config.phoneNumberId,
      whatsappBusinessAccountId: config.whatsappBusinessAccountId,
      accessToken: config.accessToken,
      verifyToken: config.verifyToken,
      appSecret: config.appSecret,
      displayPhoneNumber,
      verifiedName,
      lastSyncedAt: new Date(),
    },
    update: {
      phoneNumberId: config.phoneNumberId,
      whatsappBusinessAccountId: config.whatsappBusinessAccountId,
      accessToken: config.accessToken,
      verifyToken: config.verifyToken,
      appSecret: config.appSecret,
      displayPhoneNumber,
      verifiedName,
      lastSyncedAt: new Date(),
    },
  });

  revalidatePath("/settings/whatsapp");
  return { success: true, displayPhoneNumber, verifiedName };
}

// ─── Tester la connexion ───
export async function testWhatsAppConnection() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!integration) throw new Error("Aucune intégration configurée");

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${integration.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    {
      headers: { Authorization: `Bearer ${integration.accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Meta API: ${err.error?.message || "Erreur"}`);
  }

  const data = await response.json();

  // Mettre à jour les métadonnées
  await prisma.whatsAppIntegration.update({
    where: { organizationId: session.user.organizationId },
    data: {
      displayPhoneNumber: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      lastSyncedAt: new Date(),
    },
  });

  return {
    success: true,
    displayPhoneNumber: data.display_phone_number,
    verifiedName: data.verified_name,
    qualityRating: data.quality_rating,
  };
}

// ─── Désactiver l'intégration ───
export async function disconnectWhatsApp() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée");
  }

  await prisma.whatsAppIntegration.delete({
    where: { organizationId: session.user.organizationId },
  });

  revalidatePath("/settings/whatsapp");
  return { success: true };
}