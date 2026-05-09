import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMetaSignature,
  parseIncomingMessage,
  findLeadByPhone,
  createOrphanLead,
} from "@/lib/whatsapp-webhook";

// ═══════════════════════════════════════════════════════════════
// GET — Verification handshake Meta
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Récupère l'intégration de l'org
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: orgId },
    select: { verifyToken: true },
  });

  if (!integration) {
    console.error(`[WA Webhook] Org ${orgId} not found`);
    return new NextResponse("Not Found", { status: 404 });
  }

  if (integration.verifyToken !== token) {
    console.error(`[WA Webhook] Invalid verify token for org ${orgId}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  console.log(`[WA Webhook] Verification OK for org ${orgId}`);

  // Renvoie le challenge en clair pour valider l'abonnement
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// ═══════════════════════════════════════════════════════════════
// POST — Réception des messages
// ═══════════════════════════════════════════════════════════════

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // 1. Lire le body brut (essentiel pour la signature HMAC)
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  // 2. Récupérer l'intégration
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: orgId },
  });

  if (!integration) {
    console.error(`[WA Webhook] POST: Org ${orgId} not found`);
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!integration.isActive) {
    console.warn(`[WA Webhook] Org ${orgId} integration inactive, ignoring`);
    return new NextResponse("OK", { status: 200 }); // 200 pour que Meta arrête les retries
  }

  // 3. Vérifier la signature HMAC
  const isValid = verifyMetaSignature(rawBody, signatureHeader, integration.appSecret);
  if (!isValid) {
    console.error(`[WA Webhook] Invalid signature for org ${orgId}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 4. Parser le body JSON
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error(`[WA Webhook] Invalid JSON for org ${orgId}`);
    return new NextResponse("Bad Request", { status: 400 });
  }

  // 5. Vérifier le type d'objet
  if (payload.object !== "whatsapp_business_account") {
    return new NextResponse("OK", { status: 200 });
  }

  // 6. Traiter chaque entry
  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        if (!value) continue;

        // Vérifier que le phone_number_id correspond à notre intégration
        const phoneNumberId = value.metadata?.phone_number_id;
        if (phoneNumberId && phoneNumberId !== integration.phoneNumberId) {
          console.warn(`[WA Webhook] Phone number mismatch: ${phoneNumberId} != ${integration.phoneNumberId}`);
          continue;
        }

        const contacts = value.contacts || [];
        const messages = value.messages || [];

        // Traiter chaque message
        for (const msg of messages) {
          await processIncomingMessage(orgId, msg, contacts);
        }
      }
    }
  } catch (e: any) {
    // On loggue mais on retourne quand même 200 pour éviter les retries Meta
    console.error(`[WA Webhook] Processing error for org ${orgId}:`, e);
  }

  // 7. Toujours retourner 200 OK rapidement
  return new NextResponse("OK", { status: 200 });
}

// ═══════════════════════════════════════════════════════════════
// Traitement d'un message individuel
// ═══════════════════════════════════════════════════════════════

async function processIncomingMessage(
  orgId: string,
  rawMessage: any,
  contacts: any[]
) {
  const parsed = parseIncomingMessage(rawMessage, contacts);
  if (!parsed) return;

  // Anti-doublon : si on a déjà reçu ce wamid, on skip
  const existing = await prisma.message.findFirst({
    where: { externalId: parsed.externalId },
    select: { id: true },
  });
  if (existing) {
    console.log(`[WA Webhook] Duplicate message ${parsed.externalId}, skipping`);
    return;
  }

  // Trouver le lead par numéro
  let lead = await findLeadByPhone(orgId, parsed.from);

  // Pas trouvé → créer un lead orphelin
  if (!lead) {
    try {
      lead = await createOrphanLead(orgId, parsed.from, parsed.contactName);
      console.log(`[WA Webhook] Created orphan lead ${lead.id} for ${parsed.from}`);
    } catch (e: any) {
      console.error(`[WA Webhook] Failed to create orphan lead:`, e);
      return; // Sans lead on ne peut pas créer le message
    }
  }

  // Créer le Message INBOUND
  const message = await prisma.message.create({
    data: {
      organizationId: orgId,
      leadId: lead.id,
      channel: "WHATSAPP",
      direction: "INBOUND",
      content: parsed.textContent || "[Message vide]",
      status: "DELIVERED",
      externalId: parsed.externalId,
      sentAt: parsed.timestamp,
      whatsappContactName: parsed.contactName,
      whatsappMediaType: parsed.type !== "text" ? parsed.type : null,
      whatsappMediaId: parsed.mediaId,
    },
  });

  // Créer une Activity
  await prisma.activity.create({
    data: {
      organizationId: orgId,
      leadId: lead.id,
      userId: lead.assignedToId || null,
      type: "MESSAGE_RECEIVED",
      description: `Message WhatsApp reçu de ${lead.firstName} ${lead.lastName}`,
      metadata: {
        channel: "WHATSAPP",
        direction: "INBOUND",
        externalId: parsed.externalId,
        messageType: parsed.type,
      },
    },
  });

  console.log(`[WA Webhook] Message ${message.id} created for lead ${lead.id}`);
}