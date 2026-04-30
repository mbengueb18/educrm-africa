"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  body: string;
  blocks: any;
  brandColor?: string;
  category?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const template = await prisma.messageTemplate.create({
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      blocks: data.blocks || null,
      brandColor: data.brandColor || "#1B4F72",
      channel: "EMAIL" as any,
      category: (data.category || "RECRUITMENT") as any,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/settings/email-templates");
  return { success: true, template };
}

export async function updateEmailTemplate(id: string, data: {
  name?: string;
  subject?: string;
  body?: string;
  blocks?: any;
  brandColor?: string;
  category?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.blocks !== undefined) updateData.blocks = data.blocks;
  if (data.brandColor !== undefined) updateData.brandColor = data.brandColor;
  if (data.category !== undefined) updateData.category = data.category;

  const template = await prisma.messageTemplate.update({
    where: { id, organizationId: session.user.organizationId },
    data: updateData,
  });

  revalidatePath("/settings/email-templates");
  return { success: true, template };
}

export async function deleteEmailTemplate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.messageTemplate.delete({
    where: { id, organizationId: session.user.organizationId },
  });

  revalidatePath("/settings/email-templates");
  return { success: true };
}

export async function duplicateEmailTemplate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const original = await prisma.messageTemplate.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!original) throw new Error("Template introuvable");

  const copy = await prisma.messageTemplate.create({
    data: {
      name: original.name + " (copie)",
      subject: original.subject,
      body: original.body,
      blocks: original.blocks as any,
      brandColor: original.brandColor,
      channel: original.channel,
      category: original.category,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/settings/email-templates");
  return { success: true, template: copy };
}