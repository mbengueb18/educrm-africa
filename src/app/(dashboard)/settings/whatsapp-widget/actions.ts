"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";

// ─── Garde plan : même feature que l'intégration WhatsApp (plan Performance) ───
async function assertCanUseWhatsApp(organizationId: string) {
  try {
    await assertCanAccessFeature(organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "Le widget WhatsApp nécessite le plan Performance (WhatsApp Business API)."
      );
    }
    throw error;
  }
}

export interface WhatsAppWidgetData {
  enabled: boolean;
  title: string;
  welcomeMessage: string;
  replyTimeText: string;
  prefilledMessage: string;
  primaryColor: string;
  position: string;
}

// ─── Sauvegarde de la config du widget ───
// Retourne { ok, error } plutôt que throw : Next.js caviarde les throw des
// Server Actions en prod (« Server Components render… »), rendant le toast illisible.
export async function updateWhatsAppWidgetConfig(
  data: WhatsAppWidgetData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: "Non authentifié" };
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return { ok: false, error: "Seul un administrateur peut configurer le widget WhatsApp." };
    }

    const orgId = session.user.organizationId;
    await assertCanUseWhatsApp(orgId);

    // On ne peut activer le widget que si un numéro WhatsApp est bien connecté.
    if (data.enabled) {
      const integration = await prisma.whatsAppIntegration.findUnique({
        where: { organizationId: orgId },
        select: { isActive: true, displayPhoneNumber: true },
      });
      if (!integration || !integration.isActive || !integration.displayPhoneNumber) {
        return {
          ok: false,
          error:
            "Aucun numéro WhatsApp actif n'est connecté. Configurez d'abord Paramètres → WhatsApp.",
        };
      }
    }

    const clean = {
      enabled: data.enabled,
      title: data.title.trim() || "Entamer une conversation",
      welcomeMessage: data.welcomeMessage.trim(),
      replyTimeText: data.replyTimeText.trim(),
      prefilledMessage: data.prefilledMessage.trim(),
      primaryColor: data.primaryColor.trim() || "#25D366",
      position: data.position === "bottom-left" ? "bottom-left" : "bottom-right",
    };

    await prisma.whatsAppWidgetConfig.upsert({
      where: { organizationId: orgId },
      update: clean,
      create: { ...clean, organizationId: orgId },
    });

    revalidatePath("/settings/whatsapp-widget");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur lors de la sauvegarde" };
  }
}
