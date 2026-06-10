"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface FormSchemaField {
  name: string;   // "input_20.3"
  type: string;   // "text" | "email" | "select" | "checkbox" | ...
  label: string;  // "Prénom"
}

export interface FormSchema {
  formId: string;       // "gform_8"
  name: string;         // "Candidature en ligne"
  fields: FormSchemaField[];
  firstSeen: string;    // ISO date
  lastSeen: string;     // ISO date
}

// ─── Lire les schémas de formulaires détectés ───
export async function getFormSchemas(): Promise<FormSchema[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  const schemas: FormSchema[] = settings.formSchemas || [];
  // Tri : le plus récemment vu en premier
  return [...schemas].sort((a, b) =>
    new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

// ─── Supprimer un schéma de formulaire (nettoyage manuel) ───
export async function deleteFormSchema(formId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée");
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as any) || {};
  const schemas: FormSchema[] = settings.formSchemas || [];
  const filtered = schemas.filter((s) => s.formId !== formId);

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: { ...settings, formSchemas: filtered } },
  });

  revalidatePath("/settings/forms");
}