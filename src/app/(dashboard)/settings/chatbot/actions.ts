"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { canAccessFeature } from "@/lib/plans/checks";
import { generateSuggestions } from "@/lib/documents/generate-suggestions";

export async function updateChatbotConfig(data: {
  enabled: boolean;
  agentName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: string;
  knowledgeEnabled?: boolean;
  systemPromptExtra?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Le mode « réponses IA à partir des documents » est réservé aux plans qui
  // incluent CHATBOT_AI. On empêche l'activation côté serveur (défense en profondeur :
  // l'UI le grise déjà, l'endpoint public re-vérifie aussi).
  let knowledgeEnabled = !!data.knowledgeEnabled;
  if (knowledgeEnabled) {
    const feature = await canAccessFeature(session.user.organizationId, "CHATBOT_AI");
    if (!feature.allowed) {
      return { ok: false, error: "Le chatbot IA (réponses à partir de vos documents) nécessite le plan Performance." };
    }
  }

  await prisma.chatbotConfig.upsert({
    where: { organizationId: session.user.organizationId },
    update: {
      enabled: data.enabled,
      agentName: data.agentName,
      welcomeMessage: data.welcomeMessage,
      primaryColor: data.primaryColor,
      position: data.position,
      knowledgeEnabled,
      systemPromptExtra: (data.systemPromptExtra || "").trim() || null,
    },
    create: {
      organizationId: session.user.organizationId,
      enabled: data.enabled,
      agentName: data.agentName,
      welcomeMessage: data.welcomeMessage,
      primaryColor: data.primaryColor,
      position: data.position,
      knowledgeEnabled,
      systemPromptExtra: (data.systemPromptExtra || "").trim() || null,
    },
  });

  // Mode IA activé → (re)génère les raccourcis suggérés depuis les documents, en tâche de fond.
  if (knowledgeEnabled) {
    after(() => generateSuggestions(session.user.organizationId));
  }

  revalidatePath("/settings/chatbot");
  return { ok: true };
}