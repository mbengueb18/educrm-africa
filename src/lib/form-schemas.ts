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

// Champs core reconnus automatiquement par le tracker (mapping implicite, non configurable)
const CORE_AUTO_PATTERNS: { test: RegExp; target: string }[] = [
  { test: /prenom|first[\s_-]?name|fname/i, target: "Prénom" },
  { test: /nom|last[\s_-]?name|lname|surname/i, target: "Nom" },
  { test: /e[\s_-]?mail|courriel/i, target: "Email" },
  { test: /phone|tel|mobile|portable|telephone/i, target: "Téléphone" },
];

export type FieldMappingState =
  | { kind: "auto"; target: string }
  | { kind: "standard"; target: string; label: string }
  | { kind: "custom"; key: string; label: string }
  | { kind: "none" };

export interface MappedField extends FormSchemaField {
  mapping: FieldMappingState;
}

export interface FormWithMapping extends Omit<FormSchema, "fields"> {
  fields: MappedField[];
  unmappedCount: number;
}

// ─── Lire les schémas bruts ───
export async function getFormSchemas(): Promise<FormSchema[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  const schemas: FormSchema[] = settings.formSchemas || [];
  return [...schemas].sort((a, b) =>
    new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

// ─── Lire les formulaires AVEC leur état de mapping (croisement schéma + customFields) ───
export async function getFormsWithMapping(): Promise<FormWithMapping[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as any) || {};
  const schemas: FormSchema[] = settings.formSchemas || [];
  const customFields: any[] = settings.customFields || [];

  // Index : nom de champ formulaire (lowercase) → customField config
  const fieldToConfig: Record<string, any> = {};
  for (const cf of customFields) {
    for (const mf of (cf.mappedFormFields || [])) {
      fieldToConfig[String(mf).toLowerCase()] = cf;
    }
  }

  const result: FormWithMapping[] = schemas.map((form) => {
    let unmapped = 0;
    const fields: MappedField[] = (form.fields || []).map((field) => {
      const nameLower = field.name.toLowerCase();
      const labelLower = (field.label || "").toLowerCase();

      // 1. Mapping explicite via customFields ?
      const cf = fieldToConfig[nameLower];
      if (cf) {
        if (cf.target === "standard" && cf.standardField) {
          return { ...field, mapping: { kind: "standard" as const, target: cf.standardField, label: cf.label } };
        }
        return { ...field, mapping: { kind: "custom" as const, key: cf.key, label: cf.label } };
      }

      // 2. Reconnu automatiquement par le tracker (prénom, nom, email, tel) ?
      const auto = CORE_AUTO_PATTERNS.find((p) => p.test.test(nameLower) || p.test.test(labelLower));
      if (auto) {
        return { ...field, mapping: { kind: "auto" as const, target: auto.target } };
      }

      // 3. Non mappé
      unmapped++;
      return { ...field, mapping: { kind: "none" as const } };
    });

    return {
      formId: form.formId,
      name: form.name,
      firstSeen: form.firstSeen,
      lastSeen: form.lastSeen,
      fields,
      unmappedCount: unmapped,
    };
  });

  return result.sort((a, b) =>
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