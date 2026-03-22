"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CustomFieldConfig {
  id: string;
  label: string;           // Display name in CRM: "Niveau d'études actuel"
  key: string;             // Internal key: "niveau_etudes"
  type: "text" | "select" | "number" | "date" | "email" | "phone";
  options?: string[];       // For select type: ["Terminale", "Bac", "Bac+1", ...]
  mappedFormFields: string[]; // Form field names that map here: ["niveau_actuel", "niveau", "level", "education_level"]
  required: boolean;
  showInCard: boolean;      // Show on Kanban card
  showInList: boolean;      // Show in student table
  order: number;
}

// ─── Get custom fields config ───
export async function getCustomFields(): Promise<CustomFieldConfig[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  return settings.customFields || [];
}

// ─── Save custom fields config ───
export async function saveCustomFields(fields: CustomFieldConfig[]) {
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

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: { ...settings, customFields: fields } },
  });

  revalidatePath("/settings");
  revalidatePath("/pipeline");
}

// ─── Add a custom field ───
export async function addCustomField(field: Omit<CustomFieldConfig, "id" | "order">) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const existing = await getCustomFields();
  const newField: CustomFieldConfig = {
    ...field,
    id: crypto.randomUUID(),
    order: existing.length,
  };

  await saveCustomFields([...existing, newField]);
  return newField;
}

// ─── Update a custom field ───
export async function updateCustomField(fieldId: string, updates: Partial<CustomFieldConfig>) {
  const existing = await getCustomFields();
  const updated = existing.map((f) =>
    f.id === fieldId ? { ...f, ...updates } : f
  );
  await saveCustomFields(updated);
}

// ─── Delete a custom field ───
export async function deleteCustomField(fieldId: string) {
  const existing = await getCustomFields();
  await saveCustomFields(existing.filter((f) => f.id !== fieldId));
}

// ─── Get unmapped fields from recent leads ───
export async function getUnmappedFields(): Promise<{ field: string; count: number; sampleValue: string }[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Get configured custom fields
  const configuredFields = await getCustomFields();
  const mappedKeys = new Set<string>();

  // Collect all configured keys AND all mapped form field names
  for (const cf of configuredFields) {
    mappedKeys.add(cf.key.toLowerCase());
    for (const mf of cf.mappedFormFields) {
      mappedKeys.add(mf.toLowerCase());
    }
  }

  const recentLeads = await prisma.lead.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { customFields: true },
  });

  const fieldCounts: Record<string, { count: number; sample: string }> = {};

  for (const lead of recentLeads) {
    const custom = (lead.customFields as any) || {};
    for (const [key, value] of Object.entries(custom)) {
      if (key.startsWith("_")) continue;
      // Skip fields that are already configured
      if (mappedKeys.has(key.toLowerCase())) continue;
      if (!fieldCounts[key]) {
        fieldCounts[key] = { count: 0, sample: String(value) };
      }
      fieldCounts[key].count++;
    }
  }

  return Object.entries(fieldCounts)
    .map(([field, data]) => ({ field, count: data.count, sampleValue: data.sample }))
    .sort((a, b) => b.count - a.count);
}
