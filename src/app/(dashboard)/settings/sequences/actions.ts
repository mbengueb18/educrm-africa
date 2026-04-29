"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateSequenceConfig(data: {
  enabled: boolean;
  pauseOnReply: boolean;
  pauseOnAppointment: boolean;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.organizationSequenceConfig.upsert({
    where: { organizationId: session.user.organizationId },
    update: data,
    create: { ...data, organizationId: session.user.organizationId },
  });

  revalidatePath("/settings/sequences");
  return { success: true };
}