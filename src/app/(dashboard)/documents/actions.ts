"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-storage";

// Réutilise le bucket des pièces jointes → « Joindre depuis la bibliothèque » = simple
// référence du path, sans ré-upload. (L'upload lui-même passe par /api/library/upload
// pour éviter la limite de taille des server actions.)
const BUCKET = "email-attachments";

export async function getLibraryDocuments() {
  const session = await auth();
  if (!session?.user) return [];
  return prisma.libraryDocument.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLibraryDocument(id: string, data: { name?: string; category?: string; description?: string | null }) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== session.user.organizationId) throw new Error("Document introuvable");

  await prisma.libraryDocument.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() || doc.name } : {}),
      ...(data.category !== undefined ? { category: data.category.trim() || "Autre" } : {}),
      ...(data.description !== undefined ? { description: (data.description || "").trim() || null } : {}),
    },
  });
  revalidatePath("/documents");
  return { success: true };
}

export async function deleteLibraryDocument(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== session.user.organizationId) throw new Error("Document introuvable");

  await supabaseAdmin.storage.from(BUCKET).remove([doc.path]).catch(() => {});
  await prisma.libraryDocument.delete({ where: { id } });

  revalidatePath("/documents");
  return { success: true };
}

// URL signée : téléchargement (1h, force le download) ou lien de partage (30 jours, ouverture navigateur).
export async function getLibraryDocumentUrl(id: string, share = false) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== session.user.organizationId) throw new Error("Document introuvable");

  const expiresIn = share ? 60 * 60 * 24 * 30 : 60 * 60;
  const options = share ? undefined : { download: doc.name };
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.path, expiresIn, options);
  if (error || !data?.signedUrl) throw new Error("Impossible de générer le lien");
  return { url: data.signedUrl, name: doc.name };
}
