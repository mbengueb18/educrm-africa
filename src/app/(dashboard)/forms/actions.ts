"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { newField, slugify, isLongForm, DEFAULT_SETTINGS, type FormField, type FormSettings, type FormRouting } from "@/lib/forms";

async function requireOrg() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  return session;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let i = 1;
  while (true) {
    const existing = await prisma.form.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    i += 1;
    slug = slugify(base) + "-" + i;
  }
}

export async function getForms() {
  const session = await requireOrg();
  return prisma.form.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, slug: true, status: true, submissionsCount: true, createdAt: true, updatedAt: true },
  });
}

export async function createForm() {
  const session = await requireOrg();
  const name = "Nouveau formulaire";
  const slug = await uniqueSlug(name + "-" + Date.now().toString(36).slice(-4));

  const fields: FormField[] = [
    { ...newField("text"), label: "Prénom", name: "firstName", required: true, width: "half" },
    { ...newField("text"), label: "Nom", name: "lastName", required: true, width: "half" },
    { ...newField("email"), label: "Email", name: "email", required: true },
    { ...newField("tel"), label: "Téléphone", name: "phone", required: true },
  ];

  const form = await prisma.form.create({
    data: {
      organizationId: session.user.organizationId,
      name,
      slug,
      fields: fields as any,
      settings: DEFAULT_SETTINGS as any,
      routing: {} as any,
      status: "DRAFT",
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/forms");
  return { id: form.id };
}

// Crée un formulaire brouillon à partir d'une liste de champs déjà normalisés
// (utilisé par l'import PDF). Les champs doivent passer par normalizeImportedFields en amont.
export async function createFormWithFields(name: string, fields: FormField[]) {
  const session = await requireOrg();
  const cleanName = (name || "").trim().slice(0, 120) || "Formulaire importé";
  const slug = await uniqueSlug(cleanName + "-" + Date.now().toString(36).slice(-4));

  // Multi-étapes pré-activé pour les formulaires longs (souvent le cas à l'import PDF).
  const settings: FormSettings = { ...DEFAULT_SETTINGS, multiStep: isLongForm(fields) };

  const form = await prisma.form.create({
    data: {
      organizationId: session.user.organizationId,
      name: cleanName,
      slug,
      fields: fields as any,
      settings: settings as any,
      routing: {} as any,
      status: "DRAFT",
      createdById: session.user.id,
    },
    select: { id: true },
  });

  revalidatePath("/forms");
  return { id: form.id };
}

export async function getForm(id: string) {
  const session = await requireOrg();
  const form = await prisma.form.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!form) throw new Error("Formulaire introuvable");
  return form;
}

export async function updateForm(id: string, data: {
  name?: string; description?: string | null; slug?: string;
  fields?: FormField[]; settings?: FormSettings; routing?: FormRouting;
}) {
  const session = await requireOrg();
  const form = await prisma.form.findFirst({ where: { id, organizationId: session.user.organizationId }, select: { id: true } });
  if (!form) throw new Error("Formulaire introuvable");

  const update: any = {};
  if (data.name !== undefined) update.name = data.name.trim() || "Formulaire";
  if (data.description !== undefined) update.description = data.description;
  if (data.slug !== undefined) update.slug = await uniqueSlug(data.slug, id);
  if (data.fields !== undefined) update.fields = data.fields as any;
  if (data.settings !== undefined) update.settings = data.settings as any;
  if (data.routing !== undefined) update.routing = data.routing as any;

  await prisma.form.update({ where: { id }, data: update });
  revalidatePath("/forms");
  revalidatePath("/forms/" + id + "/edit");
  return { success: true };
}

export async function setFormStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const session = await requireOrg();
  const form = await prisma.form.findFirst({ where: { id, organizationId: session.user.organizationId }, select: { id: true } });
  if (!form) throw new Error("Formulaire introuvable");
  await prisma.form.update({ where: { id }, data: { status } });
  revalidatePath("/forms");
  revalidatePath("/forms/" + id + "/edit");
  return { success: true };
}

export async function deleteForm(id: string) {
  const session = await requireOrg();
  const form = await prisma.form.findFirst({ where: { id, organizationId: session.user.organizationId }, select: { id: true } });
  if (!form) throw new Error("Formulaire introuvable");
  await prisma.form.delete({ where: { id } });
  revalidatePath("/forms");
  return { success: true };
}

// Données pour les listes de routage (étapes de pipeline + utilisateurs).
export async function getFormRoutingData() {
  const session = await requireOrg();
  const [stages, users, programs] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, pipelineId: true },
    }),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Filières de l'org : source du champ « Filière » (le créateur coche celles à proposer).
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true, diploma: true, level: true },
      orderBy: [{ diploma: "asc" }, { name: "asc" }],
    }),
  ]);
  return { stages, users, programs };
}

export async function getFormSubmissions(id: string) {
  const session = await requireOrg();
  const form = await prisma.form.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true, name: true, slug: true, submissionsCount: true, fields: true },
  });
  if (!form) throw new Error("Formulaire introuvable");

  const submissions = await prisma.formSubmission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, data: true, leadId: true, createdAt: true },
  });
  return { form, submissions };
}
