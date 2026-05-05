import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";

export const runtime = "nodejs";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min d'inactivité = nouvelle session
const HEARTBEAT_MAX_DELTA_MS = 30 * 1000; // un heartbeat valable apporte au max 30s d'engagement

function corsResponse(data: any, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      request.nextUrl.searchParams.get("key") ||
      "";

    const organizationId = await validateApiKey(apiKey);
    if (!organizationId) return corsResponse({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const {
      eventType, // "pageview" | "heartbeat"
      visitorId,
      sessionId, // ID généré côté navigateur
      url,
      path,
      title,
      referrer,
      engagedDeltaMs, // pour heartbeat : temps engagé depuis le dernier ping
      // Source data
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      gclid,
      fbclid,
      // Fingerprint
      userAgent,
      language,
      screenSize,
      timezone,
    } = body;

    if (!visitorId || !sessionId) {
      return corsResponse({ error: "visitorId and sessionId required" }, 400);
    }

    // ─── 1. Visitor (cookie permanent) ───
    let visitor = await prisma.visitor.findFirst({
      where: { visitorId, organizationId },
    });
    if (!visitor) {
      visitor = await prisma.visitor.create({
        data: {
          visitorId,
          organizationId,
          userAgent: userAgent || null,
          language: language || null,
          screenSize: screenSize || null,
          timezone: timezone || null,
        },
      });
    } else {
      await prisma.visitor.update({
        where: { id: visitor.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // ─── 2. Session (avec logique GA4 30min idle = nouvelle session) ───
    let session = await prisma.session.findUnique({
      where: { sessionId },
    });

    const now = new Date();

    if (!session) {
      // Refuser de créer une session sur un heartbeat (bug : sessionStorage vidé entre 2 events)
      if (eventType !== "pageview") {
        return corsResponse({ error: "No session for this heartbeat", expired: true }, 409);
      }
      // Nouvelle session sur pageview uniquement
      session = await prisma.session.create({
        data: {
          sessionId,
          visitorDbId: visitor.id,
          organizationId,
          referrer: referrer || null,
          utmSource: utm_source || null,
          utmMedium: utm_medium || null,
          utmCampaign: utm_campaign || null,
          utmContent: utm_content || null,
          utmTerm: utm_term || null,
          gclid: gclid || null,
          fbclid: fbclid || null,
        },
      });
    } else {
      // Vérifier l'inactivité — si > 30min, refuser et signaler que c'est une session expirée
      const idleMs = now.getTime() - session.lastActivityAt.getTime();
      if (idleMs > SESSION_TIMEOUT_MS) {
        // La session côté serveur est expirée. Le client devrait avoir détecté ça aussi
        // mais on protège en marquant la session comme terminée.
        if (!session.endedAt) {
          await prisma.session.update({
            where: { id: session.id },
            data: { endedAt: session.lastActivityAt },
          });
        }
        return corsResponse(
          { error: "Session expired", expired: true, lastActivityAt: session.lastActivityAt },
          409
        );
      }
    }

    // ─── 3. Traitement selon le type d'event ───
    if (eventType === "pageview") {
      if (!url) return corsResponse({ error: "url required" }, 400);

      let pathOnly = path || "/";
      try { pathOnly = new URL(url).pathname || "/"; } catch {}

      await prisma.pageView.create({
        data: {
          sessionDbId: session.id,
          url: url.substring(0, 2000),
          path: pathOnly.substring(0, 500),
          title: (title || "").substring(0, 500),
          organizationId,
        },
      });

      await prisma.session.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now,
          pageviewCount: { increment: 1 },
        },
      });

      return corsResponse({ success: true, sessionId: session.sessionId, isNew: session.startedAt.getTime() === session.lastActivityAt.getTime() }, 200);
    }

    if (eventType === "heartbeat") {
      // Capper le delta pour éviter qu'un onglet inactif gonfle l'engagement
      const safeDelta = Math.min(Math.max(engagedDeltaMs || 0, 0), HEARTBEAT_MAX_DELTA_MS);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now,
          engagedTimeMs: { increment: safeDelta },
        },
      });

      // Mettre à jour aussi le temps de la dernière pageview
      const lastPv = await prisma.pageView.findFirst({
        where: { sessionDbId: session.id },
        orderBy: { viewedAt: "desc" },
      });
      if (lastPv) {
        await prisma.pageView.update({
          where: { id: lastPv.id },
          data: { engagedTimeMs: { increment: safeDelta } },
        });
      }

      return corsResponse({ success: true }, 200);
    }

    return corsResponse({ error: "Unknown eventType" }, 400);
  } catch (error: any) {
    console.error("[Pageview]", error);
    return corsResponse({ error: error.message || "Server error" }, 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}