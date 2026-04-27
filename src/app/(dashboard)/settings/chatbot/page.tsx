import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  return <ChatbotSettingsClient config={config} />;
}