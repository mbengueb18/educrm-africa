import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeadRouting } from "@/lib/pipeline-routing";
import { sendEmail } from "@/lib/email";
import { isInputField, type FormField, type FormRouting, type FormSettings } from "@/lib/forms";
import { computeLeadScore } from "@/lib/lead-score";
import { triggerFormSubmittedWorkflows } from "@/lib/workflows/engine";
import { normalizePhoneNumber } from "@/lib/whatsapp-webhook";
import { buildChecklist } from "@/lib/candidature";

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

// Rate-limit basique en mémoire (par IP) : protection du serveur contre les rafales
// automatisées uniquement — volontairement large pour ne jamais bloquer un groupe
// d'utilisateurs réels derrière la même IP (wifi campus, cybercafé).
const RL = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  RL.set(ip, arr);
  return arr.length > 30;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) return cors({ error: "Trop de soumissions. Réessayez dans un instant." }, 429);

    const body = await request.json().catch(() => ({}));
    const values: Record<string, any> = body.values || {};
    // Pas de filtre anti-bot (honeypot/time-trap supprimés volontairement) : ces formulaires
    // sont diffusés à des demandeurs identifiés — on capture TOUT, les conseillers trient.
    // Perdre un vrai candidat coûte bien plus cher qu'un spam à supprimer.

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

    // ── Filière : résout la valeur soumise vers un Program de l'organisation ──
    // Champ natif « program » → valeur = id du Program. Rétro-compat : ancien champ
    // select/radio nommé « programId »/« filiere » (ou libellé « Programme(s) ») → match
    // exact par nom. Résultat : qualification native (Lead.programId) + routage pipeline.
    let programResolved: { id: string; name: string } | null = null;
    const programField = fields.find((f) => f.type === "program");
    const legacyProgramField = !programField
      ? fields.find((f) => (f.type === "select" || f.type === "radio") &&
          (/^(programid|program|filiere)s?$/i.test(f.name) || /programme|fili[eè]re/i.test(f.label || "")))
      : null;
    const rawProgram = (programField && values[programField.name]) || (legacyProgramField && values[legacyProgramField.name]) || null;
    if (typeof rawProgram === "string" && rawProgram.trim()) {
      const v = rawProgram.trim();
      programResolved = programField
        ? await prisma.program.findFirst({ where: { id: v, organizationId: form.organizationId }, select: { id: true, name: true } })
        : await prisma.program.findFirst({ where: { organizationId: form.organizationId, name: { equals: v, mode: "insensitive" } }, select: { id: true, name: true } });
    }

    const customFields: Record<string, any> = {};
    for (const f of fields) {
      if (!isInputField(f.type)) continue;
      if (STD.has(f.name)) continue;
      if (f.type === "program" && programResolved) continue; // porté nativement par Lead.programId
      if (f.type === "file") continue; // pièces portées par la checklist de la soumission, jamais par customFields
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
    let targetStage: { id: string; pipelineId: string | null; order: number; name: string } | null = null;
    if (routing.pipelineStageId) {
      const st = await prisma.pipelineStage.findFirst({ where: { id: routing.pipelineStageId, organizationId: form.organizationId }, select: { id: true, pipelineId: true, order: true, name: true } });
      if (st) { stageId = st.id; pipelineId = st.pipelineId; targetStage = st; }
    }
    if (!stageId) { const r = await getLeadRouting(form.organizationId, programResolved?.id ?? null); pipelineId = r.pipelineId; stageId = r.stageId; }
    if (!stageId) return cors({ error: "Aucun pipeline configuré pour cette organisation." }, 500);

    // ── Déduplication : rapprocher un prospect existant (même email ou téléphone) ──
    // Match par email (insensible à la casse) puis, à défaut, par les 9 derniers chiffres
    // du téléphone/WhatsApp (indicatif ignoré : « +221 77 532 03 55 » == « 775320355 »).
    // Sur match : on enrichit la fiche existante (on ne dégrade jamais un champ déjà rempli),
    // l'intégralité de la soumission restant conservée dans FormSubmission.
    const emailKey = email ? String(email).toLowerCase().trim() : "";
    const phoneSuffix = phone && phone !== "N/A" ? normalizePhoneNumber(phone).slice(-9) : "";
    const waSuffix = whatsapp ? normalizePhoneNumber(whatsapp).slice(-9) : "";

    const EXISTING_SELECT = {
      id: true, email: true, phone: true, whatsapp: true, city: true, message: true, customFields: true,
      stageId: true, stage: { select: { order: true, pipelineId: true, name: true } },
    } as const;
    type ExistingLead = {
      id: string; email: string | null; phone: string; whatsapp: string | null; city: string | null; message: string | null; customFields: any;
      stageId: string; stage: { order: number; pipelineId: string | null; name: string } | null;
    };
    let existing: ExistingLead | null = null;
    if (emailKey) {
      existing = await prisma.lead.findFirst({
        where: { organizationId: form.organizationId, email: { equals: emailKey, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: EXISTING_SELECT,
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
          select: EXISTING_SELECT,
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

      // Progression d'étape : si le formulaire cible explicitement une étape (ex. « Dossier reçu »),
      // on y déplace le prospect existant — uniquement vers l'avant, jamais de retour en arrière
      // (un lead déjà « Entretien » ou « Admis » n'est pas rétrogradé).
      const cur = existing.stage;
      const moveStage = !!targetStage && existing.stageId !== targetStage.id &&
        (!cur || cur.pipelineId !== targetStage.pipelineId || targetStage.order > cur.order);

      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          email: existing.email || email || undefined,
          phone: emptyNative(existing.phone) && phone !== "N/A" ? phone : undefined,
          whatsapp: existing.whatsapp || whatsapp || undefined,
          city: existing.city || city || undefined,
          message: existing.message || message || undefined,
          // La filière choisie dans la candidature reflète le souhait actuel du candidat → on la met à jour.
          programId: programResolved?.id ?? undefined,
          customFields: mergedCustom,
          ...(moveStage && targetStage ? { stageId: targetStage.id, pipelineId: targetStage.pipelineId } : {}),
        },
      });
      leadId = existing.id;

      if (moveStage && targetStage) {
        await prisma.activity.create({
          data: {
            type: "LEAD_STAGE_CHANGED",
            description: "Lead déplacé vers « " + targetStage.name + " » suite à la soumission du formulaire « " + form.name + " »",
            leadId: existing.id,
            organizationId: form.organizationId,
            metadata: { source: "form", formSlug: slug, fromStage: cur?.name || null, toStage: targetStage.name } as any,
          },
        }).catch(() => {});
      }
    } else {
      const lead = await prisma.lead.create({
        data: {
          firstName, lastName,
          phone, whatsapp, email, city, message,
          source: "WEBSITE" as any,
          sourceDetail: form.name,
          programId: programResolved?.id ?? undefined,
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

    // Snapshot des pièces du dossier (champs fichier applicables : fourni / manquant).
    // Figé à la soumission — base du dépôt cadré sur le portail candidat.
    const checklist = buildChecklist(fields, values);
    await prisma.formSubmission.create({
      data: {
        formId: form.id, organizationId: form.organizationId, leadId: leadId, data: values as any,
        checklist: checklist.items.length ? (checklist as any) : undefined,
      },
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
      const displayValue = (f: FormField) => {
        if (f.type === "program" && programResolved) return programResolved.name; // nom lisible, pas l'id
        const v = values[f.name];
        return Array.isArray(v) ? v.join(", ") : String(v);
      };
      const rows = fields
        .filter((f) => isInputField(f.type) && f.type !== "hidden" && values[f.name] != null && values[f.name] !== "")
        .map((f) => "<li style=\"margin:2px 0\"><b>" + f.label + "</b> : " + displayValue(f) + "</li>")
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
