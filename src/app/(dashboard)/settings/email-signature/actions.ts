"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getMyEmailSignature() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const [user, org] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, role: true, emailSignature: true, emailSignatureEnabled: true },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, logo: true },
    }),
  ]);

  return {
    signature: user?.emailSignature || "",
    enabled: user?.emailSignatureEnabled ?? true,
    profile: { name: user?.name || "", phone: user?.phone || "", role: (user?.role as string) || "" },
    org: { name: org?.name || "", logo: org?.logo || null },
  };
}

export async function updateEmailSignature(data: { signature: string; enabled: boolean }) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const html = (data.signature || "").slice(0, 20000).trim();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailSignature: html || null, emailSignatureEnabled: !!data.enabled },
  });

  revalidatePath("/settings/email-signature");
  return { success: true };
}
