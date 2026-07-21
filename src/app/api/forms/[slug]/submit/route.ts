import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeadRouting } from "@/lib/pipeline-routing";
import { sendEmail } from "@/lib/email";
import { isInputField, type FormField, type FormRouting, type FormSettings } from "@/lib/forms";
import { computeLeadScore } from "@/lib/lead-score";
import { triggerFormSubmittedWorkflows } from "@/lib/workflows/engine";
import { normalizePhoneNumber } from "@/lib/whatsapp-webhook";

export const runtime = "nodejs";

function cors(data: any, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function OPTIONS() { return cors({}, 204); }

const STD = new Set(["firstName", "lastName", "email", "phone", "whatsapp", "city", "message"]);

// Rate-limit basique en mémoire (par IP) : max 6 soumissions / minute.
const RL = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  RL.set(ip, arr);
  return arr.length > 6;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) return cors({ error: "Trop de soumissions. Réessayez dans un instant." }, 429);

    const body = await request.json().catch(() => ({}));
    const values: Record<string, any> = body.values || {};
    if (body.hp) return cors({ success: true }, 200); // honeypot rempli → bot, ignoré silencieusement
    // Time-trap : soumission en moins de 2s après ouverture → probablement un bot.
    // Exception : saisie restaurée d'un brouillon (formulaire multi-étapes). Dans ce cas mountTs
    // est réinitialisé au rechargement alors que l'utilisateur a déjà passé du temps sur une visite
    // précédente ; sans cette exception un envoi légitime « instantané » serait jeté silencieusement.
    const elapsed = Number(body._t);
    if (!body.restored && Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2000) return cors({ success: true }, 200);

    const form = await prisma.form.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true, name: true, organizationId: true, fields: true, routing: true, settings: true },
    });
    if (!form) return cors({ error: "Formulaire introuvable ou non publié" }, 404);

    const fields = (form.fields as FormField[]) || [];
    const routing = (form.routing as FormRouting) || {};
    const settings = (form.settings as FormSettings) || {};

    // Champs standards + personnalisés
    const g = (n: string) => (typeof values[n] === "string" ? values[n].trim() : values[n]);
    const firstName = g("firstName") || (g("email") ? String(g("email")).split("@")[0] : "") || "Contact";
    const lastName = g("lastName") || "";
    const email = g("email") || null;
    const phone = g("phone") || g("tel") || "N/A";
    const whatsapp = g("whatsapp") || null;
    const city = g("city") || null;
    const message = g("message") || null;

    const customFields: Record<string, any> = {};
    for (const f of fields) {
      if (!isInputField(f.type)) continue;
      if (STD.has(f.name)) continue;
      const v = values[f.name];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      customFields[f.label || f.name] = Array.isArray(v) ? v.join(", ") : (f.type === "consent" ? "Oui" : String(v));
    }
    if (routing.tags && routing.tags.length) customFields["Tags"] = routing.tags.join(", ");
    const utm = body.utm || {};
    if (utm.utm_campaign) customFields["Campagne UTM"] = utm.utm_campaign;

    // Routage : étape/pipeline
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    if (routing.pipelineStageId) {
      const st = await prisma.pipelineStage.findFirst({ where: { id: routing.pipelineStageId, organizationId: form.organizationId }, select: { id: true, pipelineId: true } });
      if (st) { stageId = st.id; pipelineId = st.pipelineId; }
    }
    if (!stageId) { const r = await getLeadRouting(form.organizationId, null); pipelineId = r.pipelineId; stageId = r.stageId; }
    if (!stageId) return cors({ error: "Aucun pipeline configuré pour cette organisation." }, 500);

    // ── Déduplication : rapprocher un prospect existant (même email ou téléphone) ──
    // Match par email (insensible à la casse) puis, à défaut, par les 9 derniers chiffres
    // du téléphone/WhatsApp (indicatif ignoré : « +221 77 532 03 55 » == « 775320355 »).
    // Sur match : on enrichit la fiche existante (on ne dégrade jamais un champ déjà rempli
    // ni l'étape), l'intégralité de la soumission restant conservée dans FormSubmission.
    const emailKey = email ? String(email).toLowerCase().trim() : "";
    const phoneSuffix = phone && phone !== "N/A" ? normalizePhoneNumber(phone).slice(-9) : "";
    const waSuffix = whatsapp ? normalizePhoneNumber(whatsapp).slice(-9) : "";

    type ExistingLead = { id: string; email: string | null; phone: string; whatsapp: string | null; city: string | null; message: string | null; customFields: any };
    let existing: ExistingLead | null = null;
    if (emailKey) {
      existing = await prisma.lead.findFirst({
        where: { organizationId: form.organizationId, email: { equals: emailKey, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, phone: true, whatsapp: true, city: true, message: true, customFields: true },
      });
    }
    if (!existing) {
      const suffixes = [phoneSuffix, waSuffix].filter((s) => s && s.length >= 8);
      if (suffixes.length) {
        existing = await prisma.lead.findFirst({
          where: {
            organizationId: form.organizationId,
            OR: suffixes.flatMap((s) => [{ phone: { contains: s } }, { whatsapp: { contains: s } }]),
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, email: true, phone: true, whatsapp: true, city: true, message: true, customFields: true },
        });
      }
    }

    const isDuplicate = !!existing;
    let leadId: string;

    if (existing) {
      const existingCustom = (existing.customFields as Record<string, any>) || {};
      const mergedCustom: Record<string, any> = { ...customFields, ...existingCustom }; // l'existant l'emporte
      const prevNotes = Array.isArray(existingCustom._notes) ? existingCustom._notes : [];
      mergedCustom._notes = [...prevNotes, { at: new Date().toISOString(), text: "Nouvelle soumission via « " + form.name + " »" }];
      const emptyNative = (v: string | null | undefined) => !v || v === "N/A";
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          email: existing.email || email || undefined,
          phone: emptyNative(existing.phone) && phone !== "N/A" ? phone : undefined,
          whatsapp: existing.whatsapp || whatsapp || undefined,
          city: existing.city || city || undefined,
          message: existing.message || message || undefined,
          customFields: mergedCustom,
        },
      });
      leadId = existing.id;
    } else {
      const lead = await prisma.lead.create({
        data: {
          firstName, lastName,
          phone, whatsapp, email, city, message,
          source: "WEBSITE" as any,
          sourceDetail: form.name,
          stageId: stageId,
          pipelineId: pipelineId ?? undefined,
          assignedToId: routing.assignToId ?? undefined,
          organizationId: form.organizationId,
          score: computeLeadScore({ source: "WEBSITE", email, whatsapp }),
          customFields: Object.keys(customFields).length ? customFields : undefined,
        },
        select: { id: true },
      });
      leadId = lead.id;
    }

    await prisma.formSubmission.create({
      data: { formId: form.id, organizationId: form.organizationId, leadId: leadId, data: values as any },
    });
    await prisma.form.update({ where: { id: form.id }, data: { submissionsCount: { increment: 1 } } });

    // Déclencher les workflows « soumission de formulaire » (sans bloquer la réponse)
    triggerFormSubmittedWorkflows(form.organizationId, leadId, form.id).catch((e) =>
      console.error("[FORM_SUBMITTED workflow]", e),
    );

    // Notification email (si configurée)
    const notify = (settings.notifyEmail || "").trim();
    if (notify && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(notify)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talibcrm.com";
      const rows = fields
        .filter((f) => isInputField(f.type) && f.type !== "hidden" && values[f.name] != null && values[f.name] !== "")
        .map((f) => "<li style=\"margin:2px 0\"><b>" + f.label + "</b> : " + (Array.isArray(values[f.name]) ? values[f.name].join(", ") : String(values[f.name])) + "</li>")
        .join("");
      const html =
        '<div style="font-family:Arial,sans-serif;font-size:14px;color:#2C3E50">' +
        "<p>" + (isDuplicate ? "Nouvelle soumission d'un prospect existant" : "Nouvelle soumission") + " du formulaire <b>" + form.name + "</b> :</p>" +
        '<ul style="padding-left:18px">' + rows + "</ul>" +
        '<p><a href="' + appUrl + "/leads/" + leadId + '" style="color:#2471A3">Voir la fiche du prospect →</a></p>' +
        "</div>";
      sendEmail({
        to: notify,
        subject: (isDuplicate ? "Nouvelle soumission (prospect existant) — " : "Nouvelle soumission — ") + form.name,
        body: html,
        isHtml: true,
        organizationId: form.organizationId,
        includeSignature: false,
      }).catch(() => {});
    }

    await prisma.activity.create({
      data: {
        type: isDuplicate ? "NOTE_ADDED" : "LEAD_CREATED",
        description: (isDuplicate ? "Nouvelle soumission via le formulaire « " : "Lead capturé via le formulaire « ") + form.name + " » : " + firstName + " " + lastName,
        leadId: leadId,
        organizationId: form.organizationId,
        metadata: { source: "form", formSlug: slug, duplicate: isDuplicate } as any,
      },
    }).catch(() => {});

    return cors({ success: true }, 200);
  } catch (e: any) {
    console.error("[Form submit]", e);
    return cors({ error: e.message || "Erreur serveur" }, 500);
  }
}
