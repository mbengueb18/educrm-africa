import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════
// 1) VÉRIFICATION SIGNATURE HMAC
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie la signature HMAC SHA256 envoyée par Meta dans X-Hub-Signature-256.
 * Le body DOIT être lu en raw (await request.text()), pas en JSON parsé.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;

  // Header format : "sha256=ABCDEF..."
  const signature = signatureHeader.replace(/^sha256=/, "");

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf-8")
    .digest("hex");

  // Comparaison sécurisée (timing-safe) pour éviter les attaques par timing
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2) NORMALISATION NUMÉRO DE TÉLÉPHONE
// ═══════════════════════════════════════════════════════════════

/**
 * Supprime tous les caractères non-numériques.
 * Ex: "+221 77 532 03 55" → "221775320355"
 */
export function normalizePhoneNumber(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Extrait les 9 derniers chiffres pour matching robuste
 * (gère les variations +221, 00221, 0, etc.)
 */
export function getPhoneSuffix(phone: string, length = 9): string {
  const normalized = normalizePhoneNumber(phone);
  return normalized.slice(-length);
}

// ═══════════════════════════════════════════════════════════════
// 3) RECHERCHE DE LEAD PAR NUMÉRO
// ═══════════════════════════════════════════════════════════════

export async function findLeadByPhone(
  organizationId: string,
  fromPhoneNumber: string
) {
  const suffix = getPhoneSuffix(fromPhoneNumber);
  if (!suffix || suffix.length < 7) return null;

  // On cherche les leads dont les 9 derniers chiffres du phone OU whatsapp matchent
  const lead = await prisma.lead.findFirst({
    where: {
      organizationId,
      OR: [
        { phone: { contains: suffix } },
        { whatsapp: { contains: suffix } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedToId: true,
      phone: true,
      whatsapp: true,
    },
  });

  return lead;
}

// ═══════════════════════════════════════════════════════════════
// 4) CRÉATION DE LEAD ORPHELIN
// ═══════════════════════════════════════════════════════════════

/**
 * Quand un message arrive d'un numéro inconnu, on crée un lead orphelin
 * pour que le commercial puisse le qualifier ensuite.
 */
export async function createOrphanLead(
  organizationId: string,
  fromPhoneNumber: string,
  whatsappContactName: string | null
) {
  // Routing automatique vers le bon pipeline (lead sans filière → pipeline FI par défaut)
  const { getLeadRouting } = await import("@/lib/pipeline-routing");
  const routing = await getLeadRouting(organizationId, null);

  if (!routing.stageId) {
    throw new Error("Aucune étape de pipeline configurée pour cette org");
  }

  const normalized = normalizePhoneNumber(fromPhoneNumber);
  const formattedPhone = `+${normalized}`;

  // Si on a un nom WhatsApp, essaie de le splitter
  let firstName = "Contact";
  let lastName = "WhatsApp";
  if (whatsappContactName) {
    const parts = whatsappContactName.trim().split(/\s+/);
    firstName = parts[0] || "Contact";
    lastName = parts.slice(1).join(" ") || "WhatsApp";
  }

  const lead = await prisma.lead.create({
    data: {
      organizationId,
      firstName,
      lastName,
      phone: formattedPhone,
      whatsapp: formattedPhone,
      source: "WHATSAPP",
      stageId: routing.stageId,
      pipelineId: routing.pipelineId,    // NOUVEAU
      score: 0,
      customFields: {
        _orphan: true,
        _createdViaWebhook: true,
        _whatsappContactName: whatsappContactName,
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      assignedToId: true,
      phone: true,
      whatsapp: true,
    },
  });

  return lead;
}

// ═══════════════════════════════════════════════════════════════
// 5) PARSING D'UN MESSAGE META
// ═══════════════════════════════════════════════════════════════

export interface ParsedIncomingMessage {
  externalId: string;       // wamid Meta
  from: string;              // numéro lead (ex: "221775320355")
  timestamp: Date;
  type: "text" | "image" | "audio" | "document" | "video" | "location" | "contacts" | "sticker" | "unknown";
  textContent: string | null; // contenu texte ou caption ou label
  mediaId: string | null;     // ID Meta du média à télécharger
  contactName: string | null; // Nom WhatsApp du contact
}

/**
 * Parse un message Meta brut en données structurées.
 * Gère text, image, audio, document, video, location.
 */
export function parseIncomingMessage(
  message: any,
  contacts: any[]
): ParsedIncomingMessage | null {
  if (!message?.id || !message?.from) return null;

  const externalId = message.id;
  const from = message.from;
  const timestamp = new Date(parseInt(message.timestamp) * 1000);
  const type = message.type as ParsedIncomingMessage["type"];

  // Récupère le nom du contact si présent
  const contact = contacts?.find((c) => c.wa_id === from);
  const contactName = contact?.profile?.name || null;

  let textContent: string | null = null;
  let mediaId: string | null = null;

  switch (type) {
    case "text":
      textContent = message.text?.body || null;
      break;

    case "image":
      mediaId = message.image?.id || null;
      textContent = message.image?.caption || "[Image reçue]";
      break;

    case "audio":
      mediaId = message.audio?.id || null;
      textContent = "[Message vocal reçu]";
      break;

    case "video":
      mediaId = message.video?.id || null;
      textContent = message.video?.caption || "[Vidéo reçue]";
      break;

    case "document":
      mediaId = message.document?.id || null;
      const docName = message.document?.filename || "document";
      textContent = `[Document reçu: ${docName}]${message.document?.caption ? ` — ${message.document.caption}` : ""}`;
      break;

    case "location":
      const lat = message.location?.latitude;
      const lng = message.location?.longitude;
      const name = message.location?.name || "";
      textContent = `[Localisation reçue: ${name} (${lat}, ${lng})]`;
      break;

    case "contacts":
      const contactsList = message.contacts?.map((c: any) => c.name?.formatted_name).join(", ") || "";
      textContent = `[Contact(s) reçu(s): ${contactsList}]`;
      break;

    case "sticker":
      mediaId = message.sticker?.id || null;
      textContent = "[Sticker reçu]";
      break;

    default:
      textContent = `[Message non supporté: ${type}]`;
  }

  return {
    externalId,
    from,
    timestamp,
    type: type || "unknown",
    textContent,
    mediaId,
    contactName,
  };
}