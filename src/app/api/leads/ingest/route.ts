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
var CORE_FIELDS = new Set([
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
  // Traffic source fields
  "_referrer", "referrer", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "_utm_source", "_utm_medium", "_utm_campaign",
  "gclid", "fbclid", "msclkid", "ttclid", "dclid", "li_fat_id",
  "_gclid", "_fbclid", "_msclkid", "_ttclid",
]);

var leadSchema = z.object({}).passthrough();

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
  var s = source.toUpperCase().trim();
  var map: Record<string, string> = {
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
  var custom: Record<string, any> = {};

  for (var [key, value] of Object.entries(rawData)) {
    if (!value || typeof value !== "string" || !value.trim()) continue;
    if (key.startsWith("_")) continue;

    var keyLower = key.toLowerCase();

    if (CORE_FIELDS.has(key) || CORE_FIELDS.has(keyLower)) continue;

    var configMatch = orgCustomFieldsConfig.find(function(cf: any) {
      return cf.mappedFormFields.some(function(mf: string) { return mf.toLowerCase() === keyLower; });
    });

    if (configMatch) {
      custom[configMatch.key] = value.trim();
    } else {
      custom[key] = value.trim();
    }
  }

  return custom;
}

// ─── Classify traffic source from referrer, UTMs, click IDs ───
function classifyTrafficSource(data: Record<string, any>): {
  channel: string;
  source: string;
  medium: string;
  detail: string;
} {
  var referrer = (data._referrer || data.referrer || "").toLowerCase();
  var utmSource = (data.utm_source || data._utm_source || "").toLowerCase();
  var utmMedium = (data.utm_medium || data._utm_medium || "").toLowerCase();
  var utmCampaign = data.utm_campaign || data._utm_campaign || "";
  var gclid = data.gclid || data._gclid || "";
  var fbclid = data.fbclid || data._fbclid || "";
  var msclkid = data.msclkid || data._msclkid || "";
  var ttclid = data.ttclid || data._ttclid || "";

  // 1. Paid ads (click IDs take priority)
  if (gclid) {
    return { channel: "SEA", source: "Google Ads", medium: "cpc", detail: utmCampaign || "Google Ads (gclid)" };
  }
  if (msclkid) {
    return { channel: "SEA", source: "Microsoft Ads", medium: "cpc", detail: utmCampaign || "Bing Ads (msclkid)" };
  }
  if (ttclid) {
    return { channel: "SOCIAL_ADS", source: "TikTok Ads", medium: "paid_social", detail: utmCampaign || "TikTok Ads" };
  }

  // 2. UTM-based classification
  if (utmMedium === "cpc" || utmMedium === "ppc" || utmMedium === "paid" || utmMedium === "paid_social") {
    var src = utmSource || "unknown";
    if (src.includes("google")) return { channel: "SEA", source: "Google Ads", medium: utmMedium, detail: utmCampaign || "Google Ads (UTM)" };
    if (src.includes("facebook") || src.includes("fb")) return { channel: "SOCIAL_ADS", source: "Facebook Ads", medium: utmMedium, detail: utmCampaign || "Facebook Ads" };
    if (src.includes("instagram")) return { channel: "SOCIAL_ADS", source: "Instagram Ads", medium: utmMedium, detail: utmCampaign || "Instagram Ads" };
    if (src.includes("linkedin")) return { channel: "SOCIAL_ADS", source: "LinkedIn Ads", medium: utmMedium, detail: utmCampaign || "LinkedIn Ads" };
    if (src.includes("tiktok")) return { channel: "SOCIAL_ADS", source: "TikTok Ads", medium: utmMedium, detail: utmCampaign || "TikTok Ads" };
    return { channel: "SEA", source: src, medium: utmMedium, detail: utmCampaign || "Publicite payante" };
  }

  if (utmMedium === "email" || utmSource === "brevo" || utmSource === "mailchimp" || utmSource === "newsletter") {
    return { channel: "EMAIL", source: utmSource || "email", medium: "email", detail: utmCampaign || "Campagne email" };
  }

  // 3. Facebook click ID without paid UTM = organic social
  if (fbclid) {
    return { channel: "SOCIAL_ORGANIC", source: "Facebook", medium: "organic_social", detail: "Facebook organique (fbclid)" };
  }

  // 4. Referrer-based classification
  if (referrer) {
    // Search engines (SEO)
    var searchEngines = [
      { pattern: "google.", source: "Google" },
      { pattern: "bing.com", source: "Bing" },
      { pattern: "yahoo.com", source: "Yahoo" },
      { pattern: "duckduckgo.com", source: "DuckDuckGo" },
      { pattern: "baidu.com", source: "Baidu" },
      { pattern: "yandex.", source: "Yandex" },
      { pattern: "ecosia.org", source: "Ecosia" },
    ];
    for (var se of searchEngines) {
      if (referrer.includes(se.pattern)) {
        return { channel: "SEO", source: se.source, medium: "organic", detail: "Recherche organique " + se.source };
      }
    }

    // LLM / AI referrals
    var llmSources = [
      { pattern: "chatgpt.com", source: "ChatGPT" },
      { pattern: "chat.openai.com", source: "ChatGPT" },
      { pattern: "claude.ai", source: "Claude" },
      { pattern: "perplexity.ai", source: "Perplexity" },
      { pattern: "gemini.google.com", source: "Gemini" },
      { pattern: "bard.google.com", source: "Gemini" },
      { pattern: "copilot.microsoft.com", source: "Copilot" },
      { pattern: "you.com", source: "You.com" },
      { pattern: "phind.com", source: "Phind" },
    ];
    for (var llm of llmSources) {
      if (referrer.includes(llm.pattern)) {
        return { channel: "LLM", source: llm.source, medium: "ai_referral", detail: "Referral IA " + llm.source };
      }
    }

    // Social media (organic)
    var socialMedia = [
      { pattern: "facebook.com", source: "Facebook" },
      { pattern: "fb.com", source: "Facebook" },
      { pattern: "l.facebook.com", source: "Facebook" },
      { pattern: "instagram.com", source: "Instagram" },
      { pattern: "l.instagram.com", source: "Instagram" },
      { pattern: "linkedin.com", source: "LinkedIn" },
      { pattern: "twitter.com", source: "Twitter/X" },
      { pattern: "x.com", source: "Twitter/X" },
      { pattern: "t.co", source: "Twitter/X" },
      { pattern: "tiktok.com", source: "TikTok" },
      { pattern: "youtube.com", source: "YouTube" },
      { pattern: "youtu.be", source: "YouTube" },
      { pattern: "whatsapp.com", source: "WhatsApp" },
      { pattern: "wa.me", source: "WhatsApp" },
      { pattern: "telegram.org", source: "Telegram" },
      { pattern: "t.me", source: "Telegram" },
      { pattern: "snapchat.com", source: "Snapchat" },
      { pattern: "pinterest.com", source: "Pinterest" },
    ];
    for (var sm of socialMedia) {
      if (referrer.includes(sm.pattern)) {
        return { channel: "SOCIAL_ORGANIC", source: sm.source, medium: "organic_social", detail: sm.source + " organique" };
      }
    }

    // Email providers
    var emailProviders = [
      { pattern: "mail.google.com", source: "Gmail" },
      { pattern: "outlook.", source: "Outlook" },
      { pattern: "mail.yahoo.", source: "Yahoo Mail" },
    ];
    for (var ep of emailProviders) {
      if (referrer.includes(ep.pattern)) {
        return { channel: "EMAIL", source: ep.source, medium: "email", detail: "Ouvert depuis " + ep.source };
      }
    }

    // Other referral
    try {
      var domain = new URL(referrer.startsWith("http") ? referrer : "https://" + referrer).hostname;
      return { channel: "REFERRAL", source: domain, medium: "referral", detail: "Referral depuis " + domain };
    } catch {
      return { channel: "REFERRAL", source: referrer.slice(0, 50), medium: "referral", detail: "Referral" };
    }
  }

  // 5. Direct access
  if (utmSource) {
    return { channel: "OTHER", source: utmSource, medium: utmMedium || "unknown", detail: utmCampaign || utmSource };
  }

  return { channel: "DIRECT", source: "Acces direct", medium: "none", detail: "URL saisie ou favori" };
}

function mapSocialToSource(social: string): string {
  var map: Record<string, string> = {
    "Facebook": "FACEBOOK",
    "Instagram": "INSTAGRAM",
    "WhatsApp": "WHATSAPP",
    "Twitter/X": "OTHER",
    "LinkedIn": "OTHER",
    "TikTok": "OTHER",
    "YouTube": "OTHER",
  };
  return map[social] || "WEBSITE";
}

// ─── POST: Ingest lead ───
export async function POST(request: NextRequest) {
  try {
    var apiKey =
      request.headers.get("x-api-key") ||
      request.headers.get("authorization")?.replace("Bearer ", "") ||
      "";

    var organizationId = await validateApiKey(apiKey);
    if (!organizationId) {
      return corsResponse(
        { error: "Cle API invalide ou manquante", code: "UNAUTHORIZED" },
        401
      );
    }

    var rawData: Record<string, any>;
    var contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      rawData = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      var formData = await request.formData();
      rawData = Object.fromEntries(formData.entries());
    } else {
      rawData = await request.json().catch(function() { return {}; });
    }

    var parsed = leadSchema.safeParse(rawData);
    if (!parsed.success) {
      return corsResponse(
        { error: "Donnees invalides", details: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        400
      );
    }

    var fields = normalizeFields(parsed.data);

    // Handle full name split
    if (!fields.firstName && !fields.lastName) {
      var fullName = rawData.name || rawData.fullname || rawData.full_name || rawData.nom_complet || "";
      if (fullName) {
        var parts = fullName.trim().split(/\s+/);
        fields.firstName = parts[0] || "";
        fields.lastName = parts.slice(1).join(" ") || parts[0] || "";
      }
    }

    if (!fields.firstName || !fields.lastName) {
      return corsResponse(
        { error: "Prenom et nom sont requis", code: "MISSING_FIELDS" },
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
    var org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    var orgSettings = (org?.settings as any) || {};
    var customFieldsConfig = orgSettings.customFields || [];

    // ─── Extract custom fields ───
    var customFields = extractCustomFields(parsed.data, customFieldsConfig);

    // ─── Classify traffic source ───
    var trafficSource = classifyTrafficSource(parsed.data);

    // Override source if WEBSITE with more specific info
    if (fields.source === "WEBSITE" || !fields.source) {
      var channelToSource: Record<string, string> = {
        "SEA": "WEBSITE", "SEO": "WEBSITE", "LLM": "WEBSITE",
        "SOCIAL_ORGANIC": mapSocialToSource(trafficSource.source),
        "SOCIAL_ADS": mapSocialToSource(trafficSource.source),
        "EMAIL": "WEBSITE", "REFERRAL": "WEBSITE", "DIRECT": "WEBSITE", "OTHER": "WEBSITE",
      };
      fields.source = channelToSource[trafficSource.channel] || "WEBSITE";
      fields.sourceDetail = trafficSource.detail + (fields.sourceDetail ? " | " + fields.sourceDetail : "");
    }

    // Store traffic data in custom fields
    var trafficCustom: Record<string, string> = {
      _trafficChannel: trafficSource.channel,
      _trafficSource: trafficSource.source,
      _trafficMedium: trafficSource.medium,
      _trafficDetail: trafficSource.detail,
    };
    if (parsed.data._referrer) trafficCustom._referrer = String(parsed.data._referrer).slice(0, 500);
    if (parsed.data.utm_source) trafficCustom._utmSource = String(parsed.data.utm_source);
    if (parsed.data.utm_medium) trafficCustom._utmMedium = String(parsed.data.utm_medium);
    if (parsed.data.utm_campaign) trafficCustom._utmCampaign = String(parsed.data.utm_campaign);

    var allCustomFields = { ...customFields, ...trafficCustom };

    // ─── Find default pipeline stage ───
    var defaultStage = await prisma.pipelineStage.findFirst({
      where: { organizationId, isDefault: true },
    });
    if (!defaultStage) {
      return corsResponse(
        { error: "Configuration pipeline manquante", code: "CONFIG_ERROR" },
        500
      );
    }

    // ─── Match program ───
    var programId: string | null = null;
    if (fields.programCode) {
      var program = await prisma.program.findFirst({
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
    var campusId: string | null = null;
    if (fields.campusCity) {
      var campus = await prisma.campus.findFirst({
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
    var oneDayAgo = new Date(Date.now() - 86_400_000);
    var existing = await prisma.lead.findFirst({
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
      if (Object.keys(allCustomFields).length > 0) {
        var existingCustom = (existing.customFields as any) || {};
        await prisma.lead.update({
          where: { id: existing.id },
          data: { customFields: { ...existingCustom, ...allCustomFields } },
        });
      }

      return corsResponse(
        {
          success: true,
          duplicate: true,
          message: "Lead existant mis a jour avec les champs supplementaires",
          leadId: existing.id,
          trafficSource: trafficSource,
        },
        200
      );
    }

    // ─── Create lead ───
    var lead = await prisma.lead.create({
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
        customFields: Object.keys(allCustomFields).length > 0 ? allCustomFields : undefined,
      },
    });

    await prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        description: "Lead capture via " + trafficSource.channel + " (" + trafficSource.source + "): " + fields.firstName + " " + fields.lastName,
        leadId: lead.id,
        organizationId,
        metadata: {
          source: "api",
          formName: rawData.formName || rawData.form_name || null,
          customFieldsCaptured: Object.keys(customFields),
          trafficSource: trafficSource,
        },
      },
    });

    return corsResponse(
      {
        success: true,
        leadId: lead.id,
        message: "Lead " + fields.firstName + " " + fields.lastName + " cree avec succes",
        customFieldsCaptured: Object.keys(customFields),
        trafficSource: trafficSource,
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