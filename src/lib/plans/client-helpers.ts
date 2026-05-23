// src/lib/plans/client-helpers.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "./config";
import type { Plan, Feature } from "./types";

/**
 * Helper côté serveur (à utiliser dans les composants serveur ou les pages)
 * Renvoie le plan + les features accessibles pour l'org actuelle
 * 
 * Usage dans une page :
 *   const planInfo = await getCurrentPlanInfo();
 *   return <Component planInfo={planInfo} />;
 */
export async function getCurrentPlanInfo() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      plan: true,
      aiAddonEnabled: true,
    },
  });

  if (!org) return null;

  const limits = PLAN_LIMITS[org.plan];

  // Map des features avec leur accessibilité
  const features: Record<string, boolean> = {
    WHATSAPP_BUSINESS_API: limits.whatsappBusinessAPI,
    WHATSAPP_CAMPAIGNS: limits.whatsappCampaigns,
    WHATSAPP_CHATBOT: limits.whatsappChatbot,
    AI_ASSISTANT: limits.aiAssistant || org.aiAddonEnabled,
    CUSTOM_ROLES: limits.customRoles,
    EMAIL_CUSTOM_DOMAIN: limits.customEmailDomain,
  };

  return {
    plan: org.plan,
    planName: limits.name,
    tagline: limits.tagline,
    features,
    aiAddonEnabled: org.aiAddonEnabled,
  };
}

export type CurrentPlanInfo = NonNullable<Awaited<ReturnType<typeof getCurrentPlanInfo>>>;