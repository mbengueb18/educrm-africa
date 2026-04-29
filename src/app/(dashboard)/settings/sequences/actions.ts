"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { DEFAULT_SEQUENCE_STEPS, getStepsOrDefault, type SequenceStep } from "@/lib/sequence-defaults";

export async function getSequenceConfig() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  let config = await prisma.organizationSequenceConfig.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!config) {
    config = await prisma.organizationSequenceConfig.create({
      data: { organizationId: session.user.organizationId },
    });
  }

  return {
    enabled: config.enabled,
    pauseOnReply: config.pauseOnReply,
    pauseOnAppointment: config.pauseOnAppointment,
    steps: getStepsOrDefault(config.steps),
  };
}

export async function updateSequenceConfig(data: {
  enabled: boolean;
  pauseOnReply: boolean;
  pauseOnAppointment: boolean;
  steps: SequenceStep[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.organizationSequenceConfig.upsert({
    where: { organizationId: session.user.organizationId },
    update: {
      enabled: data.enabled,
      pauseOnReply: data.pauseOnReply,
      pauseOnAppointment: data.pauseOnAppointment,
      steps: data.steps as any,
    },
    create: {
      organizationId: session.user.organizationId,
      enabled: data.enabled,
      pauseOnReply: data.pauseOnReply,
      pauseOnAppointment: data.pauseOnAppointment,
      steps: data.steps as any,
    },
  });

  revalidatePath("/settings/sequences");
  return { success: true };
}

export async function resetToDefaults() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.organizationSequenceConfig.update({
    where: { organizationId: session.user.organizationId },
    data: { steps: DEFAULT_SEQUENCE_STEPS as any },
  });

  revalidatePath("/settings/sequences");
  return { success: true };
}