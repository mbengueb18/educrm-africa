import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";
import { getLeadRouting } from "@/lib/pipeline-routing";
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
  "phone", "téléphone", "tel", "mobile", "portable",
  "email", "e-mail", "mail", "courriel", "email_candidat",
  "whatsapp",
  "city", "ville", "town", "adresse", "address",
  "source", "sourceDetail", "source_detail",
  "programCode", "program_code", "filière", "filière", "formation", "programme",
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
    phone: data.phone || data.téléphone || data.tel || data.mobile || data.portable || "",
    email: data.email || data["e-mail"] || data.mail || data.courriel || data.email_candidat || "",
    whatsapp: data.whatsapp || data.phone || data.téléphone || data.tel || data.portable || "",
    city: data.city || data.ville || data.town || data.adresse || data.address || "",
    source: mapSource(data.source || "WEBSITE"),
    sourceDetail: data.sourceDetail || data.source_detail || data.formName || data.form_name || data.form_id || data.formId || "",
    programCode: data.programCode || data.program_code || data.filière || data.filière || data.formation || data.programme || "",
    campusCity: data.campusCity || data.campus_city || data.campus || data.campus_choix || "",
    message: data.message || data.comments || data.commentaire || data.motivation || "",
    subject: data.subject || data.objet || data.motif || "",
    civility: data.civility || "",
    country: data.country || "SN",
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

// ─── Extract standard-field overrides from configured mappings ───
// Retourne { city: "...", whatsapp: "..." } pour les champs formulaire
// mappés vers une propriété standard du Lead.
var ALLOWED_STANDARD_FIELDS = new Set(["whatsapp", "city", "civility", "country", "message", "subject"]);

// ─── Extract standard-field overrides from standardMappings config ───
// standardMappings = { "input_3": "civility", "input_42": "city", ... }
// Mappe les champs de formulaire vers les colonnes natives du Lead.
function extractStandardOverrides(
  rawData: Record<string, any>,
  standardMappings: Record<string, string>
): Record<string, string> {
  var overrides: Record<string, string> = {};
  if (!standardMappings) return overrides;

  // Index insensible à la casse : "input_3" → "civility"
  var lowerMap: Record<string, string> = {};
  for (var [formField, nativeCol] of Object.entries(standardMappings)) {
    if (nativeCol && ALLOWED_STANDARD_FIELDS.has(nativeCol)) {
      lowerMap[formField.toLowerCase()] = nativeCol;
    }
  }

  for (var [key, value] of Object.entries(rawData)) {
    if (!value || typeof value !== "string" || !value.trim()) continue;
    if (key.startsWith("_")) continue;

    var nativeCol2 = lowerMap[key.toLowerCase()];
    if (nativeCol2) {
      overrides[nativeCol2] = value.trim();
    }
  }

  return overrides;
}

// ─── Extract custom fields (anything not in CORE_FIELDS, not in standardMappings) ───
function extractCustomFields(
  rawData: Record<string, any>,
  orgCustomFieldsConfig: any[],
  standardMappings: Record<string, string>
): Record<string, any> {
  var custom: Record<string, any> = {};

  // Set des champs de formulaire routés vers une colonne native (à exclure du custom)
  var standardFormFields = new Set<string>();
  if (standardMappings) {
    for (var sf of Object.keys(standardMappings)) {
      standardFormFields.add(sf.toLowerCase());
    }
  }

  for (var [key, value] of Object.entries(rawData)) {
    if (!value || typeof value !== "string" || !value.trim()) continue;
    if (key.startsWith("_")) continue;

    var keyLower = key.toLowerCase();

    if (CORE_FIELDS.has(key) || CORE_FIELDS.has(keyLower)) continue;
    // Si ce champ est mappé vers une colonne native, il ne va PAS en custom
    if (standardFormFields.has(keyLower)) continue;

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

// ─── Crée un Message INBOUND dans l'Inbox si le formulaire contient un message ───
// Le message (champ natif lead.message) devient une conversation entrante visible
// dans l'Inbox, à laquelle le commercial peut répondre. Aligné sur la convention
// des webhooks resend-inbound / brevo-inbound (channel EMAIL, status DELIVERED,
// content JSON {subject, body}, + Activity MESSAGE_RECEIVED).
async function createInboundMessageIfPresent(
  organizationId: string,
  leadId: string,
  leadFirstName: string,
  leadLastName: string,
  message: string | null | undefined,
  subject: string | null | undefined
) {
  if (!message || typeof message !== "string" || !message.trim()) return;

  var subj = (subject && subject.trim()) ? subject.trim() : "Message depuis le formulaire de contact";

  try {
    var newMessage = await prisma.message.create({
      data: {
        organizationId: organizationId,
        leadId: leadId,
        channel: "EMAIL",
        direction: "INBOUND",
        content: JSON.stringify({ subject: subj, body: message.trim() }),
        status: "DELIVERED", // != READ → compté comme non lu dans l'Inbox
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    // Activity (cohérent avec les webhooks inbound)
    await prisma.activity.create({
      data: {
        type: "MESSAGE_RECEIVED" as any,
        description: "Message reçu via formulaire de " + leadFirstName + " " + leadLastName + (subj ? ": " + subj : ""),
        leadId: leadId,
        organizationId: organizationId,
      },
    });
  } catch (e) {
    console.error("[Lead Ingest] Inbound message creation failed", e);
  }
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
        { error: "Clé API invalide ou manquante", code: "UNAUTHORIZED" },
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
        { error: "Données invalides", details: parsed.error.flatten(), code: "VALIDATION_ERROR" },
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
    var standardMappings = orgSettings.standardMappings || {};

    // ─── Extract custom fields ───
    var customFields = extractCustomFields(parsed.data, customFieldsConfig, standardMappings);
    // ─── Champs mappés vers des colonnes natives (ville, whatsapp, civilité, pays) ───
    var standardOverrides = extractStandardOverrides(parsed.data, standardMappings);
    if (standardOverrides.city && !fields.city) fields.city = standardOverrides.city;
    if (standardOverrides.whatsapp) fields.whatsapp = standardOverrides.whatsapp;
    if (standardOverrides.civility) fields.civility = standardOverrides.civility;
    if (standardOverrides.country) fields.country = standardOverrides.country;
    if (standardOverrides.message) fields.message = standardOverrides.message;
    if (standardOverrides.subject) fields.subject = standardOverrides.subject;

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

    // ─── Pipeline routing automatique (après matching program) ───
    var routing = await getLeadRouting(organizationId, programId);
    if (!routing.stageId) {
      return corsResponse(
        { error: "Configuration pipeline manquante", code: "CONFIG_ERROR" },
        500
      );
    }

    // ─── Duplicate check (email exact OU téléphone normalisé, SANS limite de date) ───
    var normalizedPhone = fields.phone ? fields.phone.replace(/\D/g, "") : "";
    var normalizedEmail = fields.email ? fields.email.toLowerCase().trim() : "";

    var existing: any = null;

    // 1. Match par email exact (rapide, en SQL)
    if (normalizedEmail) {
      existing = await prisma.lead.findFirst({
        where: {
          organizationId,
          email: { equals: normalizedEmail, mode: "insensitive" },
        },
        orderBy: { createdAt: "asc" }, // on garde la PREMIÈRE fiche
      });
    }

    // 2. Si pas trouvé par email, match par téléphone normalisé
    if (!existing && normalizedPhone && normalizedPhone.length >= 8) {
      // On récupère les leads ayant un téléphone, puis compare en normalisé
      var phoneCandidates = await prisma.lead.findMany({
        where: {
          organizationId,
          phone: { not: "N/A" },
        },
        select: { id: true, phone: true, whatsapp: true, createdAt: true, customFields: true, email: true, programId: true },
        orderBy: { createdAt: "asc" },
      });
      var match = phoneCandidates.find(function(l) {
        var lp = (l.phone || "").replace(/\D/g, "");
        var lw = (l.whatsapp || "").replace(/\D/g, "");
        return (lp.length >= 8 && lp === normalizedPhone) || (lw.length >= 8 && lw === normalizedPhone);
      });
      if (match) {
        // recharger le lead complet
        existing = await prisma.lead.findUnique({ where: { id: match.id } });
      }
    }

    if (existing) {
      var existingCustom = (existing.customFields as any) || {};

      // Compléter UNIQUEMENT les champs natifs vides (sans écraser l'existant)
      var fillData: any = {};
      if (!existing.email && fields.email) fillData.email = fields.email;
      if ((!existing.whatsapp || existing.whatsapp === "") && fields.whatsapp) fillData.whatsapp = fields.whatsapp;
      if (!existing.city && fields.city) fillData.city = fields.city;
      if (!existing.civility && fields.civility) fillData.civility = fields.civility;
      if ((!existing.phone || existing.phone === "N/A") && fields.phone) fillData.phone = fields.phone;

      // Custom fields : on complète sans écraser ceux déjà présents
      var mergedCustom = { ...allCustomFields, ...existingCustom };

      // Note interne datée pour tracer la nouvelle demande
      var now = new Date();
      var dateStr = now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      var demandeInfo = [];
      if (fields.programCode) demandeInfo.push("Programme : " + fields.programCode);
      if (fields.message) demandeInfo.push("Message : " + fields.message);
      var demandeLabel = demandeInfo.length > 0 ? demandeInfo.join(" — ") : "Nouvelle soumission de formulaire";
      var noteLine = "[" + dateStr + "] Nouvelle demande via formulaire : " + demandeLabel;
      var prevNotes = (existingCustom._notes as string) || "";
      mergedCustom._notes = prevNotes ? (prevNotes + "\n" + noteLine) : noteLine;

      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...fillData,
          customFields: { ...mergedCustom },
          ...(fields.message ? { message: fields.message } : {}),
          ...(fields.subject ? { subject: fields.subject } : {}),
        },
      });

      // Activité dans l'historique : nouvelle demande (avec le programme demandé)
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED" as any,
          description: "Nouvelle soumission de formulaire — " + demandeLabel,
          leadId: existing.id,
          organizationId,
          metadata: {
            source: "form_duplicate",
            programCode: fields.programCode || null,
            submittedAt: now.toISOString(),
          },
        },
      });

      // Nouveau message éventuel → l'ajouter à l'Inbox
      await createInboundMessageIfPresent(organizationId, existing.id, fields.firstName, fields.lastName, fields.message, fields.subject);

      return corsResponse(
        {
          success: true,
          duplicate: true,
          message: "Lead existant mis à jour (doublon détecté, nouvelle demande consignée)",
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
        civility: fields.civility || null,
        country: fields.country || "SN",
        message: fields.message || null,
        subject: fields.subject || null,
        source: fields.source as any,
        sourceDetail: fields.sourceDetail || null,
        stageId: routing.stageId,
        pipelineId: routing.pipelineId,
        programId,
        campusId,
        organizationId,
        customFields: Object.keys(allCustomFields).length > 0 ? allCustomFields : undefined,
      },
    });

    // ─── Link visitor to this lead (retroactive linking) ───
    if (rawData._visitorId) {
      try {
        await prisma.visitor.updateMany({
          where: {
            visitorId: rawData._visitorId,
            organizationId,
            leadId: null,
          },
          data: { leadId: lead.id },
        });
      } catch (e) {
        console.error("[Lead Ingest] Visitor linking failed", e);
      }
    }

    await prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        description: "Lead capturé via " + trafficSource.channel + " (" + trafficSource.source + "): " + fields.firstName + " " + fields.lastName,
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

    await createInboundMessageIfPresent(organizationId, lead.id, fields.firstName, fields.lastName, fields.message, fields.subject);

    return corsResponse(
      {
        success: true,
        leadId: lead.id,
        message: "Lead " + fields.firstName + " " + fields.lastName + " créé avec succes",
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