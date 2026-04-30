"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getDocumentSignedUrl(documentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { lead: { select: { organizationId: true } } },
  });

  if (!doc || doc.lead?.organizationId !== session.user.organizationId) {
    throw new Error("Document introuvable");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from("lead-documents")
    .createSignedUrl(doc.url, 3600); // 1h

  if (error || !data?.signedUrl) throw new Error("Impossible de générer le lien");

  return { url: data.signedUrl, filename: doc.name, mimeType: doc.mimeType };
}

export async function deleteDocument(documentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { lead: { select: { organizationId: true, id: true } } },
  });

  if (!doc || doc.lead?.organizationId !== session.user.organizationId) {
    throw new Error("Document introuvable");
  }

  // Delete from Supabase storage
  const supabase = getSupabase();
  await supabase.storage.from("lead-documents").remove([doc.url]).catch(() => {});

  // Delete from DB
  await prisma.document.delete({ where: { id: documentId } });

  if (doc.lead?.id) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        description: "Document supprimé : " + doc.name,
        userId: session.user.id,
        leadId: doc.lead.id,
        organizationId: session.user.organizationId,
      },
    });
  }

  revalidatePath("/leads/" + doc.lead?.id);
  revalidatePath("/pipeline");
  return { success: true };
}