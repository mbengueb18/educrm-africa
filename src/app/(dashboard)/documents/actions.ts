"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { runExtraction } from "@/lib/documents/run-extraction";

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
    // On exclut `extractedText` (potentiellement volumineux) du payload envoyé au client.
    select: {
      id: true, name: true, description: true, category: true, folderId: true,
      path: true, mimeType: true, size: true, uploadedByName: true, createdAt: true,
      botVisible: true, extractionStatus: true,
    },
  });
}

export async function updateLibraryDocument(id: string, data: { name?: string; category?: string; description?: string | null; folderId?: string | null }) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== session.user.organizationId) throw new Error("Document introuvable");

  // Vérifie que le dossier appartient bien à l'org et au bon type
  let folderId: string | null | undefined = undefined;
  if (data.folderId !== undefined) {
    folderId = data.folderId || null;
    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId: session.user.organizationId, type: "DOCUMENT" } });
      if (!folder) throw new Error("Dossier introuvable");
    }
  }

  await prisma.libraryDocument.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() || doc.name } : {}),
      ...(data.category !== undefined ? { category: data.category.trim() || "Autre" } : {}),
      ...(data.description !== undefined ? { description: (data.description || "").trim() || null } : {}),
      ...(folderId !== undefined ? { folderId } : {}),
    },
  });
  revalidatePath("/documents");
  return { success: true };
}

// Active/désactive la visibilité d'un document pour le chatbot IA.
// À l'activation, si le texte n'a pas encore été extrait (docs uploadés avant la
// feature, ou extraction échouée), on relance l'extraction en tâche de fond → couvre
// le backfill des documents existants sans batch séparé.
export async function setDocumentBotVisible(id: string, visible: boolean) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc || doc.organizationId !== session.user.organizationId) {
    return { ok: false, error: "Document introuvable" };
  }

  await prisma.libraryDocument.update({ where: { id }, data: { botVisible: visible } });

  if (visible && doc.extractionStatus !== "DONE") {
    await prisma.libraryDocument.update({ where: { id }, data: { extractionStatus: "PENDING" } });
    after(() => runExtraction(id));
  }

  revalidatePath("/documents");
  return { ok: true };
}

// ─── Dossiers (rangement des documents) ───

export async function getDocumentFolders() {
  const session = await auth();
  if (!session?.user) return [];
  return prisma.folder.findMany({
    where: { organizationId: session.user.organizationId, type: "DOCUMENT" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function createDocumentFolder(name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const clean = name.trim();
  if (!clean) throw new Error("Nom du dossier requis");
  const folder = await prisma.folder.create({
    data: { organizationId: session.user.organizationId, type: "DOCUMENT", name: clean },
    select: { id: true, name: true },
  });
  revalidatePath("/documents");
  return { success: true, folder };
}

export async function renameDocumentFolder(id: string, name: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const clean = name.trim();
  if (!clean) throw new Error("Nom du dossier requis");
  const folder = await prisma.folder.findFirst({ where: { id, organizationId: session.user.organizationId, type: "DOCUMENT" } });
  if (!folder) throw new Error("Dossier introuvable");
  await prisma.folder.update({ where: { id }, data: { name: clean } });
  revalidatePath("/documents");
  return { success: true };
}

// Supprime le dossier ; les documents qu'il contenait deviennent « sans dossier ».
export async function deleteDocumentFolder(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const folder = await prisma.folder.findFirst({ where: { id, organizationId: session.user.organizationId, type: "DOCUMENT" } });
  if (!folder) throw new Error("Dossier introuvable");
  await prisma.folder.delete({ where: { id } });
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
