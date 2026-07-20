import { callGeminiWithPdf } from "@/lib/gemini";

// Extraction du texte d'un document de la bibliothèque, pour alimenter le chatbot IA.
// Formats gérés (Phase 1) : PDF (texte + fallback OCR pour les scans), docx, txt/md/csv.
// Tout le reste → UNSUPPORTED (pptx, xlsx, images seules…).

export type ExtractionStatus = "DONE" | "FAILED" | "UNSUPPORTED";

export interface ExtractResult {
  text: string;
  status: ExtractionStatus;
}

// Nettoie et borne le texte extrait (garde-fou taille + espaces).
const MAX_CHARS = 200_000; // ~50k tokens : large pour un doc, borné pour la base.

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);
}

function isTextLike(mimeType: string, name: string): boolean {
  const lower = name.toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    /\.(txt|md|markdown|csv|json)$/.test(lower)
  );
}

function isDocx(mimeType: string, name: string): boolean {
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(name)
  );
}

function isPdf(mimeType: string, name: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(name);
}

// PDF texte natif via unpdf (bundle pd.js serverless-friendly).
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

// Fallback OCR : PDF scanné (pas de couche texte) → Gemini multimodal (déjà en place).
// Renvoie du texte brut ; on demande explicitement de retranscrire sans commentaire.
async function extractPdfViaOcr(buffer: Buffer): Promise<string> {
  const raw = await callGeminiWithPdf(
    buffer.toString("base64"),
    "application/pdf",
    'Retranscris intégralement le texte de ce document, fidèlement et sans commentaire. Réponds en JSON: {"text": "<contenu>"}.',
  );
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.text === "string") return parsed.text;
  } catch {
    // Si la réponse n'est pas du JSON propre, on garde le brut.
  }
  return raw;
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  name: string,
): Promise<ExtractResult> {
  try {
    if (isTextLike(mimeType, name)) {
      return { text: normalize(buffer.toString("utf-8")), status: "DONE" };
    }

    if (isDocx(mimeType, name)) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      const text = normalize(value || "");
      return { text, status: text ? "DONE" : "FAILED" };
    }

    if (isPdf(mimeType, name)) {
      let text = "";
      try {
        text = normalize(await extractPdfText(buffer));
      } catch (err) {
        console.warn("[extract-text] unpdf a échoué, tentative OCR:", (err as Error).message);
      }
      // Trop peu de texte → probablement un scan : on tente l'OCR Gemini.
      if (text.replace(/\s/g, "").length < 40) {
        try {
          const ocr = normalize(await extractPdfViaOcr(buffer));
          if (ocr) return { text: ocr, status: "DONE" };
        } catch (err) {
          console.warn("[extract-text] OCR Gemini a échoué:", (err as Error).message);
        }
      }
      return { text, status: text ? "DONE" : "FAILED" };
    }

    return { text: "", status: "UNSUPPORTED" };
  } catch (err) {
    console.error("[extract-text] erreur:", (err as Error).message);
    return { text: "", status: "FAILED" };
  }
}
