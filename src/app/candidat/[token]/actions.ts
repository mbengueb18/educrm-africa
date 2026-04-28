"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getValidToken(token: string) {
  const t = await prisma.leadPortalToken.findUnique({
    where: { token },
    include: {
      lead: {
        include: {
          program: { select: { id: true, name: true, code: true, level: true, durationMonths: true, tuitionAmount: true, currency: true } },
          campus: { select: { id: true, name: true, city: true, country: true } },
          stage: { select: { id: true, name: true, color: true, order: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          documents: {
            select: { id: true, name: true, url: true, mimeType: true, size: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
          appointments: {
            where: { startAt: { gte: new Date() } },
            orderBy: { startAt: "asc" },
            take: 5,
            select: {
              id: true, title: true, type: true, status: true,
              startAt: true, endAt: true, location: true, meetingUrl: true,
            },
          },
          messages: {
            where: { channel: "EMAIL" },
            orderBy: { sentAt: "desc" },
            take: 10,
            select: {
              id: true, channel: true, direction: true, content: true,
              status: true, sentAt: true,
            },
          },
        },
      },
      organization: { select: { id: true, name: true, logo: true, slug: true } },
    },
  });

  if (!t) return null;
  if (t.expiresAt < new Date()) return null;

  // Update last accessed (silently)
  prisma.leadPortalToken.update({
    where: { id: t.id },
    data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
  }).catch(function() {});

  return t;
}

export async function getPortalData(token: string) {
  return getValidToken(token);
}

export async function uploadCandidateDocument(token: string, formData: FormData) {
  const t = await prisma.leadPortalToken.findUnique({
    where: { token },
    select: { id: true, leadId: true, organizationId: true, expiresAt: true },
  });

  if (!t || t.expiresAt < new Date()) {
    return { success: false, error: "Lien invalide ou expiré" };
  }

  // Use the existing inscription upload endpoint (it's already public)
  // We'll just create the Document record here
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "Aucun fichier" };

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "Fichier trop volumineux (max 10 MB)" };
  }

  // Upload via Supabase
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = "portal/" + t.organizationId + "/" + t.leadId + "/" + timestamp + "-" + cleanName;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("lead-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) return { success: false, error: "Upload échoué" };

  await prisma.document.create({
    data: {
      name: file.name,
      type: "OTHER" as any,
      url: path,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      leadId: t.leadId,
    },
  });

  await prisma.activity.create({
    data: {
      type: "DOCUMENT_UPLOADED",
      description: "Document déposé via portail : " + file.name,
      leadId: t.leadId,
      organizationId: t.organizationId,
    },
  });

  revalidatePath("/candidat/" + token);
  return { success: true };
}