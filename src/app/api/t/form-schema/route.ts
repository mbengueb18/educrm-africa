import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";

export const runtime = "nodejs";

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

// Garde-fous pour éviter d'enregistrer n'importe quoi
const MAX_FORMS = 50;
const MAX_FIELDS_PER_FORM = 100;

type IncomingField = { name?: string; type?: string; label?: string };
type IncomingForm = { formId?: string; name?: string; fields?: IncomingField[] };

function sanitizeForms(forms: IncomingForm[]) {
  if (!Array.isArray(forms)) return [];
  return forms.slice(0, MAX_FORMS).map((f) => ({
    formId: String(f.formId || "").slice(0, 200),
    name: String(f.name || "").slice(0, 200),
    fields: Array.isArray(f.fields)
      ? f.fields.slice(0, MAX_FIELDS_PER_FORM).map((fld) => ({
          name: String(fld.name || "").slice(0, 200),
          type: String(fld.type || "").slice(0, 50),
          label: String(fld.label || "").slice(0, 300),
        })).filter((fld) => fld.name)
      : [],
  })).filter((f) => f.formId && f.fields.length > 0);
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
    const incoming = sanitizeForms(body.forms || []);
    if (incoming.length === 0) {
      return corsResponse({ success: true, stored: 0 }, 200);
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings as any) || {};
    const existing: any[] = settings.formSchemas || [];

    // Fusion : on remplace le schéma d'un formulaire par sa nouvelle version (par formId),
    // on conserve les formulaires non revus dans cet envoi.
    const byId: Record<string, any> = {};
    for (const f of existing) {
      if (f && f.formId) byId[f.formId] = f;
    }
    const seenAt = new Date().toISOString();
    for (const f of incoming) {
      const prev = byId[f.formId];
      byId[f.formId] = {
        formId: f.formId,
        name: f.name || prev?.name || f.formId,
        fields: f.fields,
        firstSeen: prev?.firstSeen || seenAt,
        lastSeen: seenAt,
      };
    }

    const merged = Object.values(byId).slice(0, MAX_FORMS);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: { ...settings, formSchemas: merged } },
    });

    return corsResponse({ success: true, stored: incoming.length }, 200);
  } catch (error: any) {
    console.error("[FormSchema]", error);
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