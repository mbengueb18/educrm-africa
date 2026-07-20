import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { extractText } from "./extract-text";

const BUCKET = "email-attachments";

// Télécharge un document depuis Supabase, en extrait le texte et met à jour la ligne.
// Best-effort : ne throw jamais (destiné à tourner via `after()` ou un cron, hors du
// chemin critique de l'upload). Met à jour extractedText / extractionStatus / extractedAt.
export async function runExtraction(documentId: string): Promise<void> {
  try {
    const doc = await prisma.libraryDocument.findUnique({
      where: { id: documentId },
      select: { id: true, path: true, mimeType: true, name: true },
    });
    if (!doc) return;

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(doc.path);
    if (error || !data) {
      await prisma.libraryDocument.update({
        where: { id: doc.id },
        data: { extractionStatus: "FAILED", extractedAt: new Date() },
      });
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const { text, status } = await extractText(buffer, doc.mimeType, doc.name);

    await prisma.libraryDocument.update({
      where: { id: doc.id },
      data: {
        extractedText: status === "DONE" ? text : null,
        extractionStatus: status,
        extractedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[run-extraction]", documentId, (err as Error).message);
    // On tente de marquer FAILED pour ne pas rester bloqué en PENDING.
    await prisma.libraryDocument
      .update({ where: { id: documentId }, data: { extractionStatus: "FAILED", extractedAt: new Date() } })
      .catch(() => {});
  }
}
