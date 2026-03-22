import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";
import { z } from "zod";

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

// Known EduCRM core field names — everything else is a custom field
const CORE_FIELDS = new Set([
  "firstName", "first_name", "prenom", "prénom", "fname",
  "lastName", "last_name", "nom", "lname", "surname", "nom_famille",
  "name", "fullname", "full_name", "nom_complet",
  "phone", "telephone", "tel", "mobile", "portable",
  "email", "e-mail", "mail", "courriel", "email_candidat",
  "whatsapp",
  "city", "ville", "town", "adresse", "address",
  "source", "sourceDetail", "source_detail",
  "programCode", "program_code", "filiere", "filière", "formation", "programme",
  "campusCity", "campus_city", "campus", "campus_choix",
  "message", "comments", "commentaire", "motivation",
  "formId", "form_id", "formName", "form_name",
  // Internal tracking fields
  "_capturedBy", "_pageUrl", "_raw", "_formId", "_pageTitle",
]);

const leadSchema = z.object({}).passthrough();

function normalizeFields(data: Record<string, any>) {
  return {
    firstName: data.firstName || data.first_name || data.prenom || data.prénom || data.fname || "",
    lastName: data.lastName || data.last_name || data.nom || data.lname || data.surname || data.nom_famille || "",
    phone: data.phone || data.telephone || data.tel || data.mobile || data.portable || "",
    email: data.email || data["e-mail"] || data.mail || data.courriel || data.email_candidat || "",
    whatsapp: data.whatsapp || data.phone || data.telephone || data.tel || data.portable || "",
    city: data.city || data.ville || data.town || data.adresse || data.address || "",
    source: mapSource(data.source || "WEBSITE"),
    sourceDetail: data.sourceDetail || data.source_detail || data.formName || data.form_name || data.form_id || data.formId || "",
    programCode: data.programCode || data.program_code || data.filiere || data.filière || data.formation || data.programme || "",
    campusCity: data.campusCity || data.campus_city || data.campus || data.campus_choix || "",
    message: data.message || data.comments || data.commentaire || data.motivation || "",
  };
}

function mapSource(source: string): string {
  const s = source.toUpperCase().trim();
  const map: Record<string, string> = {
    WEBSITE: "WEBSITE", WEB: "WEBSITE", SITE: "WEBSITE", "SITE WEB": "WEBSITE",
    FACEBOOK: "FACEBOOK", FB: "FACEBOOK",
    INSTAGRAM: "INSTAGRAM", INSTA: "INSTAGRAM",
    WHATSAPP: "WHATSAPP", WA: "WHATSAPP",
    PHONE: "PHONE_CALL", APPEL: "PHONE_CALL", TELEPHONE: "PHONE_CALL",
    WALK_IN: "WALK_IN", VISITE: "WALK_IN",
    REFERRAL: "REFERRAL", PARRAINAGE: "REFERRAL",
    SALON: "SALON", FORUM: "SALON",
    RADIO: "RADIO", TV: "TV",
    PARTNER: "PARTNER", PARTENAIRE: "PARTNER",
  };
  return map[s] || "WEBSITE";
}

// ─── Extract custom fields (anything not in CORE_FIELDS) ───
function extractCustomFields(
  rawData: Record<string, any>,
  orgCustomFieldsConfig: any[]
): Record<string, any> {
  const custom: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawData)) {
    if (!value || typeof value !== "string" || !value.trim()) continue;
    if (key.startsWith("_")) continue;

    const keyLower = key.toLowerCase();

    // Skip core fields
    if (CORE_FIELDS.has(key) || CORE_FIELDS.has(keyLower)) continue;

    // Check if this field is mapped in org config
    const configMatch = orgCustomFieldsConfig.find((cf: any) =>
      cf.mappedFormFields.some((mf: string) => mf.toLowerCase() === keyLower)
    );

    if (configMatch) {
      // Store with the configured key
      custom[configMatch.key] = value.trim();
    } else {
      // Store with original key (will show as unmapped in CRM)
      custom[key] = value.trim();
    }
  }

  return custom;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      "";

    const organizationId = await validateApiKey(apiKey);
    if (!organizationId) {
      return corsResponse(
        { error: "Clé API invalide ou manquante", code: "UNAUTHORIZED" },
        401
      );
    }

    let rawData: Record<string, any>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      rawData = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      rawData = Object.fromEntries(formData.entries());
    } else {
      rawData = await request.json().catch(() => ({}));
    }

    const parsed = leadSchema.safeParse(rawData);
    if (!parsed.success) {
      return corsResponse(
        { error: "Données invalides", details: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        400
      );
    }

    const fields = normalizeFields(parsed.data);

    // Handle full name split
    if (!fields.firstName && !fields.lastName) {
      const fullName = rawData.name || rawData.fullname || rawData.full_name || rawData.nom_complet || "";
      if (fullName) {
        const parts = fullName.trim().split(/\s+/);
        fields.firstName = parts[0] || "";
        fields.lastName = parts.slice(1).join(" ") || parts[0] || "";
      }
    }

    if (!fields.firstName || !fields.lastName) {
      return corsResponse(
        { error: "Prénom et nom sont requis", code: "MISSING_FIELDS" },
        400
      );
    }
    if (!fields.phone && !fields.email) {
      return corsResponse(
        { error: "Au moins un moyen de contact requis (phone ou email)", code: "MISSING_CONTACT" },
        400
      );
    }

    // ─── Get org config for custom field mappings ───
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const orgSettings = (org?.settings as any) || {};
    const customFieldsConfig = orgSettings.customFields || [];

    // ─── Extract custom fields ───
    const customFields = extractCustomFields(parsed.data, customFieldsConfig);

    // ─── Find default pipeline stage ───
    const defaultStage = await prisma.pipelineStage.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!defaultStage) {
      return corsResponse(
        { error: "Configuration pipeline manquante", code: "CONFIG_ERROR" },
        500
      );
    }

    // ─── Match program ───
    let programId: string | null = null;
    if (fields.programCode) {
      const program = await prisma.program.findFirst({
        where: {
          organizationId,
          OR: [
            { code: { equals: fields.programCode, mode: "insensitive" } },
            { name: { contains: fields.programCode, mode: "insensitive" } },
          ],
        },
      });
      programId = program?.id || null;
    }

    // ─── Match campus ───
    let campusId: string | null = null;
    if (fields.campusCity) {
      const campus = await prisma.campus.findFirst({
        where: {
          organizationId,
          OR: [
            { city: { equals: fields.campusCity, mode: "insensitive" } },
            { name: { contains: fields.campusCity, mode: "insensitive" } },
          ],
        },
      });
      campusId = campus?.id || null;
    }

    // ─── Duplicate check ───
    const oneDayAgo = new Date(Date.now() - 86_400_000);
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId,
        createdAt: { gte: oneDayAgo },
        OR: [
          ...(fields.phone ? [{ phone: fields.phone }] : []),
          ...(fields.email ? [{ email: fields.email }] : []),
        ],
      },
    });

    if (existing) {
      // Update custom fields on existing lead if new data
      if (Object.keys(customFields).length > 0) {
        const existingCustom = (existing.customFields as any) || {};
        await prisma.lead.update({
          where: { id: existing.id },
          data: { customFields: { ...existingCustom, ...customFields } },
        });
      }

      return corsResponse(
        {
          success: true,
          duplicate: true,
          message: "Lead existant mis à jour avec les champs supplémentaires",
          leadId: existing.id,
        },
        200
      );
    }

    // ─── Create lead ───
    const lead = await prisma.lead.create({
      data: {
        firstName: fields.firstName,
        lastName: fields.lastName,
        phone: fields.phone || "N/A",
        whatsapp: fields.whatsapp || null,
        email: fields.email || null,
        city: fields.city || null,
        source: fields.source as any,
        sourceDetail: fields.sourceDetail || null,
        stageId: defaultStage.id,
        programId,
        campusId,
        organizationId,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      },
    });

    await prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        description: `Lead capturé via formulaire web: ${fields.firstName} ${fields.lastName}`,
        leadId: lead.id,
        organizationId,
        metadata: {
          source: "api",
          formName: rawData.formName || rawData.form_name || null,
          customFieldsCaptured: Object.keys(customFields),
        },
      },
    });

    return corsResponse(
      {
        success: true,
        leadId: lead.id,
        message: `Lead ${fields.firstName} ${fields.lastName} créé avec succès`,
        customFieldsCaptured: Object.keys(customFields),
      },
      201
    );
  } catch (error: any) {
    console.error("[Lead Ingest API]", error);
    return corsResponse(
      { error: "Erreur serveur", code: "SERVER_ERROR" },
      500
    );
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
