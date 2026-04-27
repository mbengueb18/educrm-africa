"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateChatbotConfig(data: {
  enabled: boolean;
  agentName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.chatbotConfig.upsert({
    where: { organizationId: session.user.organizationId },
    update: data,
    create: { ...data, organizationId: session.user.organizationId },
  });

  revalidatePath("/settings/chatbot");
  return { success: true };
}