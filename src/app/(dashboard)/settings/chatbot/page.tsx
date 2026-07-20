import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessFeature } from "@/lib/plans/checks";
import { ChatbotSettingsClient } from "./chatbot-settings-client";

export const metadata: Metadata = {
  title: "Configuration Chatbot",
};

export default async function ChatbotSettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  let config = await prisma.chatbotConfig.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!config) {
    config = await prisma.chatbotConfig.create({
      data: { organizationId: session.user.organizationId },
    });
  }

  // Le plan de l'org autorise-t-il le chatbot IA (réponses à partir des documents) ?
  const aiFeature = await canAccessFeature(session.user.organizationId, "CHATBOT_AI");

  return <ChatbotSettingsClient config={config} chatbotAiAllowed={aiFeature.allowed} />;
}