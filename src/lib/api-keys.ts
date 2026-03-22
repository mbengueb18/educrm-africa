"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { revalidatePath } from "next/cache";

// ─── Generate API key ───
export async function generateApiKey(name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Permission refusée");
  }

  const key = `ecrm_${crypto.randomBytes(24).toString("hex")}`;
  const hashedKey = crypto.createHash("sha256").update(key).digest("hex");

  // Store in organization settings
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  const apiKeys = settings.apiKeys || [];
  apiKeys.push({
    id: crypto.randomUUID(),
    name,
    hashedKey,
    prefix: key.slice(0, 12) + "...",
    createdAt: new Date().toISOString(),
    createdBy: session.user.name,
  });

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: { ...settings, apiKeys } },
  });

  revalidatePath("/settings");

  // Return the full key ONCE — it won't be retrievable after
  return { key, name };
}

// ─── Validate API key → returns organizationId ───
export async function validateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith("ecrm_")) return null;

  const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

  // Search across all organizations
  const orgs = await prisma.organization.findMany({
    select: { id: true, settings: true },
  });

  for (const org of orgs) {
    const settings = (org.settings as any) || {};
    const apiKeys = settings.apiKeys || [];
    const match = apiKeys.find((k: any) => k.hashedKey === hashedKey);
    if (match) return org.id;
  }

  return null;
}

// ─── List API keys for current org ───
export async function listApiKeys() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  return (settings.apiKeys || []).map((k: any) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt,
    createdBy: k.createdBy,
  }));
}

// ─── Delete API key ───
export async function deleteApiKey(keyId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });

  const settings = (org?.settings as any) || {};
  const apiKeys = (settings.apiKeys || []).filter((k: any) => k.id !== keyId);

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { settings: { ...settings, apiKeys } },
  });

  revalidatePath("/settings");
}
