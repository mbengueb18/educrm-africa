import { prisma } from "@/lib/prisma";

export interface WhatsAppIntegrationCredentials {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isActive: boolean;
}

/**
 * Récupère l'intégration WhatsApp d'une organisation.
 * Lance une erreur claire si non configurée ou désactivée.
 */
export async function getWhatsAppIntegration(orgId: string): Promise<WhatsAppIntegrationCredentials> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: orgId },
  });

  if (!integration) {
    throw new Error(
      "WhatsApp n'est pas configuré pour votre organisation. Allez dans Paramètres → Intégration WhatsApp pour le configurer."
    );
  }

  if (!integration.isActive) {
    throw new Error(
      "L'intégration WhatsApp est désactivée. Réactivez-la dans Paramètres → Intégration WhatsApp."
    );
  }

  // Validation minimale des champs critiques
  if (!integration.accessToken || !integration.phoneNumberId) {
    throw new Error(
      "L'intégration WhatsApp est incomplète. Vérifiez vos credentials dans Paramètres → Intégration WhatsApp."
    );
  }

  return integration as WhatsAppIntegrationCredentials;
}

/**
 * Variante qui retourne null au lieu de throw (pour les vérifications en UI).
 */
export async function tryGetWhatsAppIntegration(orgId: string): Promise<WhatsAppIntegrationCredentials | null> {
  try {
    return await getWhatsAppIntegration(orgId);
  } catch {
    return null;
  }
}