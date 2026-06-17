import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature } from "@/lib/whatsapp-webhook"; // réutilisé tel quel

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

  const integration = await prisma.metaLeadsIntegration.findUnique({
    where: { organizationId: orgId },
    select: { verifyToken: true },
  });

  if (!integration) {
    console.error(`[Meta Leads GET] Org ${orgId} not found`);
    return new NextResponse("Not Found", { status: 404 });
  }

  if (integration.verifyToken !== token) {
    console.error(`[Meta Leads GET] Invalid verify token for org ${orgId}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  console.log(`[Meta Leads GET] Verification OK for org ${orgId}`);
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

// ═══════════════════════════════════════════════════════════════
// POST — Réception des leads (étape 1 : vérif signature + log)
// ═══════════════════════════════════════════════════════════════
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  const integration = await prisma.metaLeadsIntegration.findUnique({
    where: { organizationId: orgId },
  });

  if (!integration) {
    console.error(`[Meta Leads] POST: Org ${orgId} not found`);
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!integration.isActive) {
    console.warn(`[Meta Leads] Org ${orgId} inactive, ignoring`);
    return new NextResponse("OK", { status: 200 });
  }

  // Vérifier la signature HMAC (helper réutilisé du WhatsApp)
  const isValid = verifyMetaSignature(rawBody, signatureHeader, integration.appSecret);
  if (!isValid) {
    console.error(`[Meta Leads] Invalid signature for org ${orgId}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error(`[Meta Leads] Invalid JSON for org ${orgId}`);
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Lead Ads : l'objet est "page"
  if (payload.object !== "page") {
    return new NextResponse("OK", { status: 200 });
  }

  // ÉTAPE 1 : on log seulement, sans créer de lead
  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen") continue;
        const value = change.value;
        // value contient : leadgen_id, page_id, form_id, created_time, ad_id...
        console.log(`[Meta Leads] Nouveau lead reçu pour org ${orgId}:`, JSON.stringify(value));
      }
    }
  } catch (e: any) {
    console.error(`[Meta Leads] Processing error for org ${orgId}:`, e);
  }

  return new NextResponse("OK", { status: 200 });
}