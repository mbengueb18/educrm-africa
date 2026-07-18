"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";

// Envoi d'un email de test du template en cours d'édition.
// Retourne { ok, error } (jamais de throw) pour éviter la redaction Next.js en prod.
export async function sendTestEmailTemplate(data: {
  subject: string;
  html: string;
  to?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const to = (data.to || session.user.email || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: "Adresse email destinataire invalide" };
  }
  if (!data.subject?.trim()) return { ok: false, error: "Objet requis" };

  // Remplit les variables de fusion avec des valeurs d'exemple (pas de lead réel).
  const fill = (s: string) =>
    (s || "")
      .replace(/\{\{\s*(prenom|firstName)\s*\}\}/gi, session.user.name?.split(" ")[0] || "Awa")
      .replace(/\{\{\s*(nom|lastName)\s*\}\}/gi, "Diallo")
      .replace(/\{\{\s*email\s*\}\}/gi, to);

  try {
    const result = await sendEmail({
      to,
      subject: "[TEST] " + fill(data.subject),
      body: fill(data.html),
      organizationId: session.user.organizationId,
      sentById: session.user.id,
      isHtml: true,
      includeSignature: false,
    });
    if (!result.success) return { ok: false, error: result.error || "Échec de l'envoi" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur serveur" };
  }
}

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

// Infos de l'organisation pour préremplir le footer d'un nouveau template.
export async function getOrgEmailDefaults(): Promise<{
  name: string; address?: string; phone?: string; email?: string; website?: string;
}> {
  const session = await auth();
  if (!session?.user) return { name: "" };

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true, settings: true },
  });
  const s = (org?.settings as Record<string, any>) || {};
  return {
    name: org?.name || "",
    address: s.address || undefined,
    phone: s.contactPhone || undefined,
    email: s.contactEmail || undefined,
    website: s.website || undefined,
  };
}

export async function getEmailTemplate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const template = await prisma.messageTemplate.findFirst({
    where: { id, organizationId: session.user.organizationId, channel: "EMAIL" as any },
    select: {
      id: true, name: true, subject: true, body: true, blocks: true,
      brandColor: true, category: true, createdAt: true, updatedAt: true,
    },
  });
  return template;
}