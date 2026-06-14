"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCustomFields, addCustomField, updateCustomField } from "@/lib/custom-fields";

export interface FormSchemaField {
  name: string;
  type: string;
  label: string;
}

export interface FormSchema {
  formId: string;
  name: string;              // nom détecté (brut)
  customName?: string | null; // nom donné par l'utilisateur (prioritaire)
  pageUrl?: string;
  pageTitle?: string;
  fields: FormSchemaField[];
  firstSeen: string;
  lastSeen: string;
}

const NATIVE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  city: "Ville",
  civility: "Civilité",
  country: "Pays",
};

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

export interface FormWithMapping {
  formId: string;
  name: string;              // nom d'affichage résolu (customName || "Formulaire N" || name)
  customName?: string | null;
  pageUrl?: string;
  pageTitle?: string;
  firstSeen: string;
  lastSeen: string;
  fields: MappedField[];
  unmappedCount: number;
}

// Résout le nom d'affichage : customName > "Formulaire N" (depuis gform_N) > nom brut
function resolveDisplayName(form: FormSchema): string {
  if (form.customName && form.customName.trim()) return form.customName.trim();
  const m = /^gform_(\d+)$/.exec(form.formId);
  if (m) return `Formulaire ${m[1]}`;
  return form.name || form.formId;
}

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
  const standardMappings: Record<string, string> = settings.standardMappings || {};

  // Index insensible à la casse : "input_3" → "civility"
  const standardByField: Record<string, string> = {};
  for (const [formField, nativeCol] of Object.entries(standardMappings)) {
    standardByField[formField.toLowerCase()] = nativeCol;
  }

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
      
      // 0. Mappé vers une colonne native via standardMappings ?
      const nativeCol = standardByField[nameLower];
      if (nativeCol) {
        return { ...field, mapping: { kind: "standard" as const, target: nativeCol, label: NATIVE_LABELS[nativeCol] || nativeCol } };
      }

      const cf = fieldToConfig[nameLower];
      if (cf) {
        if (cf.target === "standard" && cf.standardField) {
          return { ...field, mapping: { kind: "standard" as const, target: cf.standardField, label: cf.label } };
        }
        return { ...field, mapping: { kind: "custom" as const, key: cf.key, label: cf.label } };
      }

      const auto = CORE_AUTO_PATTERNS.find((p) => p.test.test(nameLower) || p.test.test(labelLower));
      if (auto) {
        return { ...field, mapping: { kind: "auto" as const, target: auto.target } };
      }

      unmapped++;
      return { ...field, mapping: { kind: "none" as const } };
    });

    return {
      formId: form.formId,
      name: resolveDisplayName(form),
      customName: form.customName || null,
      pageUrl: form.pageUrl || "",
      pageTitle: form.pageTitle || "",
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

// ─── Renommer un formulaire (nom personnalisé, préservé entre les mises à jour de schéma) ───
export async function renameForm(formId: string, customName: string) {
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

  const updated = schemas.map((s) =>
    s.formId === formId ? { ...s, customName: customName.trim() || null } : s
  );

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: { ...settings, formSchemas: updated } },
  });

  revalidatePath("/settings/forms");
}

// ─── Supprimer un schéma de formulaire ───
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

// ─── Mapper un champ détecté vers un champ CRM (depuis la page Formulaires) ───
// 3 cas : standard | nouveau custom | custom existant

function toKey(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export type MapFieldInput =
  | { mode: "standard"; fieldName: string; label: string; standardField: string }
  | { mode: "new_custom"; fieldName: string; label: string; type?: "text" | "select" | "number" | "date" | "email" | "phone" }
  | { mode: "existing_custom"; fieldName: string; customFieldId: string };

export async function mapFieldFromForm(input: MapFieldInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée");
  }

  if (input.mode === "existing_custom") {
    // Ajouter le name au champ perso existant (sans doublon)
    const existing = await getCustomFields();
    const target = existing.find((f) => f.id === input.customFieldId);
    if (!target) throw new Error("Champ personnalisé introuvable");
    const already = target.mappedFormFields.some(
      (mf) => mf.toLowerCase() === input.fieldName.toLowerCase()
    );
    if (!already) {
      await updateCustomField(input.customFieldId, {
        mappedFormFields: [...target.mappedFormFields, input.fieldName],
      });
    }
    revalidatePath("/settings/forms");
    return;
  }

  if (input.mode === "standard") {
    // Écrire dans org.settings.standardMappings : { "input_3": "civility", ... }
    // (PAS de customField — le routage standard est séparé des champs personnalisés)
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const standardMappings: Record<string, string> = { ...(settings.standardMappings || {}) };
    standardMappings[input.fieldName] = input.standardField;

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { settings: { ...settings, standardMappings } },
    });
    revalidatePath("/settings/forms");
    return;
  }

  // new_custom
  const label = (input.label || input.fieldName).trim();
  await addCustomField({
    label,
    key: toKey(label) || toKey(input.fieldName),
    type: input.type || "text",
    mappedFormFields: [input.fieldName],
    required: false,
    showInCard: false,
    showInList: true,
    target: "custom",
  });
  revalidatePath("/settings/forms");
}

// ─── Lister les champs personnalisés existants (pour le mapping vers un existant) ───
export async function listCustomFieldsBrief(): Promise<{ id: string; label: string; target?: string; standardField?: string }[]> {
  const fields = await getCustomFields();
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    target: f.target,
    standardField: f.standardField,
  }));
}