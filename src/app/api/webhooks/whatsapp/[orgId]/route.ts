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

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: orgId },
    select: { verifyToken: true },
  });

  if (!integration) {
    console.error(`[WA Webhook GET] Org ${orgId} not found`);
    return new NextResponse("Not Found", { status: 404 });
  }

  if (integration.verifyToken !== token) {
    console.error(`[WA Webhook GET] Invalid verify token for org ${orgId}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  console.log(`[WA Webhook GET] Verification OK for org ${orgId}`);

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
        const statuses = value.statuses || [];

        // Traiter chaque message entrant
        for (const msg of messages) {
          await processIncomingMessage(orgId, msg, contacts);
        }

        // Traiter chaque statut de message sortant (campagnes WhatsApp)
        for (const status of statuses) {
          await processMessageStatus(orgId, status);
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

// ═══════════════════════════════════════════════════════════════
// Traitement d'un statut de message sortant (campagnes WhatsApp)
// ═══════════════════════════════════════════════════════════════

async function processMessageStatus(orgId: string, status: any) {
  const metaMessageId = status.id; // ex: "wamid.HBgN..."
  const statusType = status.status; // "sent" | "delivered" | "read" | "failed"
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

  if (!metaMessageId || !statusType) return;

  // Chercher le recipient correspondant via metaMessageId
  const recipient = await prisma.whatsAppCampaignRecipient.findUnique({
    where: { metaMessageId: metaMessageId },
    include: {
      campaign: { select: { id: true, organizationId: true } },
    },
  });

  if (!recipient) {
    // Pas trouvé : ce n'est pas un message de campagne (peut-être l'Inbox)
    return;
  }

  // Vérifier que le recipient appartient bien à cette org
  if (recipient.campaign.organizationId !== orgId) {
    console.warn(`[WA Webhook] Status for recipient from another org, skipping`);
    return;
  }

  // Mapper le statut Meta vers notre enum
  const updateData: any = {};

  switch (statusType) {
    case "sent":
      // Si déjà passé à un statut supérieur, on ne régresse pas
      if (recipient.status === "PENDING") {
        updateData.status = "SENT";
        updateData.sentAt = recipient.sentAt || timestamp;
      }
      break;

    case "delivered":
      if (recipient.status === "PENDING" || recipient.status === "SENT") {
        updateData.status = "DELIVERED";
        updateData.deliveredAt = timestamp;
        if (!recipient.sentAt) updateData.sentAt = timestamp;
      }
      break;

    case "read":
      // Toujours mettre à jour readAt même si déjà READ
      if (recipient.status !== "FAILED") {
        updateData.status = "READ";
        updateData.readAt = timestamp;
        if (!recipient.deliveredAt) updateData.deliveredAt = timestamp;
        if (!recipient.sentAt) updateData.sentAt = timestamp;
      }
      break;

    case "failed":
      updateData.status = "FAILED";
      // Récupérer le détail de l'erreur si fourni
      const errors = status.errors || [];
      if (errors.length > 0) {
        updateData.errorCode = errors[0].code?.toString() || "UNKNOWN";
        updateData.errorMessage = errors[0].title || errors[0].message || "Erreur inconnue";
      }
      break;

    default:
      console.log(`[WA Webhook] Unknown status type: ${statusType}`);
      return;
  }

  if (Object.keys(updateData).length === 0) return;

  await prisma.whatsAppCampaignRecipient.update({
    where: { id: recipient.id },
    data: updateData,
  });

  // Recalculer les stats agrégées de la campagne
  await refreshCampaignStats(recipient.campaign.id);

  console.log(`[WA Webhook] Status ${statusType} updated for recipient ${recipient.id}`);
}

// ═══════════════════════════════════════════════════════════════
// Recalcul des stats d'une campagne à partir des recipients
// ═══════════════════════════════════════════════════════════════

async function refreshCampaignStats(campaignId: string) {
  const recipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaignId },
    select: { status: true },
  });

  let sentCount = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;

  for (const r of recipients) {
    if (r.status === "SENT" || r.status === "DELIVERED" || r.status === "READ") sentCount++;
    if (r.status === "DELIVERED" || r.status === "READ") deliveredCount++;
    if (r.status === "READ") readCount++;
    if (r.status === "FAILED") failedCount++;
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
    },
  });
}