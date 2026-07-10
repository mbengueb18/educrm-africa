"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";
/**
 * Helper local : vérifie l'accès WhatsApp Business API
 * Throws une erreur claire avec message d'upgrade si plan insuffisant
 */
async function assertCanUseWhatsAppBusinessAPI(organizationId: string) {
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "WhatsApp Business API est exclusivement disponible dans le plan Performance. " +
        "Passez à Performance pour configurer votre compte Meta, créer des templates et envoyer des campagnes WhatsApp."
      );
    }
    throw error;
  }
}

// ─── Get integration for current org ───
export async function getIntegration() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
  });
}

// ─── Auto-découverte des numéros WhatsApp d'un WABA ───
// Valide (Access Token + WABA ID) ET récupère les numéros + leur Phone Number ID,
// pour éviter à l'école de chercher son Phone Number ID à la main.
export async function discoverPhoneNumbers(data: {
  whatsappBusinessAccountId: string;
  accessToken: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée. Seul un administrateur peut configurer WhatsApp.");
  }

  await assertCanUseWhatsAppBusinessAPI(session.user.organizationId);

  const waba = data.whatsappBusinessAccountId?.trim();
  const token = data.accessToken?.trim();
  if (!waba) throw new Error("Le WhatsApp Business Account ID est requis");
  if (!token) throw new Error("L'Access Token est requis");

  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Impossible de récupérer les numéros du compte");
    }

    const json = await res.json();
    const numbers = (json.data || []).map((n: any) => ({
      id: n.id as string,
      displayPhoneNumber: (n.display_phone_number as string) || "",
      verifiedName: (n.verified_name as string) || "",
      qualityRating: (n.quality_rating as string) || null,
      codeVerificationStatus: (n.code_verification_status as string) || null,
    }));

    if (numbers.length === 0) {
      throw new Error(
        "Aucun numéro WhatsApp trouvé sur ce compte. Ajoutez d'abord un numéro dans Meta Business Manager."
      );
    }

    return { success: true, numbers };
  } catch (e: any) {
    throw new Error(
      `Connexion Meta échouée : ${e.message}. Vérifiez votre Access Token et le WhatsApp Business Account ID.`
    );
  }
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

  // check feature gate Performance
  await assertCanUseWhatsAppBusinessAPI(orgId);

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

  // Abonne l'app à la WABA (webhook au niveau du compte WhatsApp Business).
  // Étape DISTINCTE de l'abonnement au champ `messages` côté app : sans elle,
  // Meta ne route AUCUN message entrant vers notre webhook. Non-bloquant.
  try {
    const subRes = await fetch(
      `https://graph.facebook.com/v22.0/${data.whatsappBusinessAccountId.trim()}/subscribed_apps`,
      { method: "POST", headers: { Authorization: `Bearer ${data.accessToken.trim()}` } }
    );
    if (!subRes.ok) {
      const err = await subRes.json().catch(() => ({}));
      console.warn(`[WA saveIntegration] subscribed_apps échoué:`, err?.error?.message || subRes.status);
    } else {
      console.log(`[WA saveIntegration] App abonnée à la WABA ${data.whatsappBusinessAccountId.trim()}`);
    }
  } catch (e: any) {
    console.warn(`[WA saveIntegration] subscribed_apps error:`, e.message);
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

  // check feature gate
  await assertCanUseWhatsAppBusinessAPI(session.user.organizationId);

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

  // Détecter l'URL de base — priorité à une URL STABLE (le webhook doit rester
  // constant dans Meta). VERCEL_URL est l'URL par déploiement (hash instable),
  // donc on ne l'utilise qu'en dernier recours.
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const host =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "app.talibcrm.com";
  const baseUrl = host.startsWith("http") ? host : `${protocol}://${host}`;

  return `${baseUrl}/api/webhooks/whatsapp/${session.user.organizationId}`;
}

// ─── Test de connexion Meta ───
export async function testConnection() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // check feature gate
  await assertCanUseWhatsAppBusinessAPI(session.user.organizationId);

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