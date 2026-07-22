// Dépôt cadré d'une pièce du dossier par le candidat (portail, authentifié par token).
// Le candidat ne peut remplir/remplacer QUE les cases nommées de la checklist — pas d'upload libre.
// Verrouillage : dossier complet → dépôts refusés (le conseiller peut rouvrir depuis le CRM).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { buildChecklist, type DossierChecklist } from "@/lib/candidature";
import { isFieldVisible, type FormField } from "@/lib/forms";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await prisma.leadPortalToken.findUnique({
      where: { token },
      select: { id: true, leadId: true, organizationId: true, expiresAt: true },
    });
    if (!t || t.expiresAt < new Date()) return NextResponse.json({ ok: false, error: "Lien invalide ou expiré" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const fieldName = String(form.get("fieldName") || "");
    if (!file || !fieldName) return NextResponse.json({ ok: false, error: "Fichier ou pièce manquant" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ ok: false, error: "Format non accepté (PDF, JPG, PNG ou WebP)" }, { status: 400 });

    const submission = await prisma.formSubmission.findFirst({
      where: { leadId: t.leadId, organizationId: t.organizationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, data: true, checklist: true, form: { select: { fields: true, name: true } } },
    });
    if (!submission?.form) return NextResponse.json({ ok: false, error: "Aucun dossier de candidature" }, { status: 404 });

    const fields = (submission.form.fields as FormField[]) || [];
    const data = (submission.data as Record<string, any>) || {};
    const prev: DossierChecklist = (submission.checklist as DossierChecklist | null) ?? buildChecklist(fields, data);

    if (prev.locked) return NextResponse.json({ ok: false, error: "Dossier complet et verrouillé. Contactez votre conseiller pour le rouvrir." }, { status: 403 });

    // La pièce doit être un champ fichier du formulaire, applicable au candidat.
    const field = fields.find((f) => f.type === "file" && f.name === fieldName);
    if (!field || !isFieldVisible(field, data)) return NextResponse.json({ ok: false, error: "Pièce inconnue pour ce dossier" }, { status: 400 });

    // Upload public (même bucket/chemin que les uploads du formulaire → URLs homogènes pour la checklist et le PDF).
    const clean = (file.name || "piece").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = "form-uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + clean;
    const { error: upErr } = await supabaseAdmin.storage.from("email-assets").upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) return NextResponse.json({ ok: false, error: "Envoi du fichier impossible" }, { status: 500 });
    const { data: pub } = supabaseAdmin.storage.from("email-assets").getPublicUrl(path);
    const url = pub.publicUrl;

    // Mise à jour du dossier : la valeur du champ + la checklist (statut, horodatage, auteur).
    const wasProvided = prev.items.find((i) => i.name === fieldName)?.status === "PROVIDED";
    const newData = { ...data, [fieldName]: url };
    const rebuilt = buildChecklist(fields, newData);
    const items = rebuilt.items.map((it) => {
      const old = prev.items.find((p) => p.name === it.name);
      if (it.name === fieldName) return { ...it, updatedAt: new Date().toISOString(), updatedBy: "candidate" as const };
      return old ? { ...it, updatedAt: old.updatedAt, updatedBy: old.updatedBy } : it;
    });
    const locked = items.length > 0 && items.every((i) => i.status === "PROVIDED");
    const checklist: DossierChecklist = { items, locked, ...(locked ? { lockedAt: new Date().toISOString() } : {}) };

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { data: newData as any, checklist: checklist as any },
    });

    await prisma.activity.create({
      data: {
        type: "DOCUMENT_UPLOADED",
        description: (wasProvided ? "Pièce remplacée via le portail candidat : " : "Pièce déposée via le portail candidat : ") + (field.label || fieldName),
        leadId: t.leadId,
        organizationId: t.organizationId,
        metadata: { source: "portal", piece: field.label || fieldName, replaced: wasProvided } as any,
      },
    }).catch(() => {});

    // Passage à « dossier complet » : trace visible côté conseiller.
    if (locked && !prev.locked) {
      await prisma.activity.create({
        data: {
          type: "NOTE_ADDED",
          description: "Dossier de candidature complet — toutes les pièces sont fournies (verrouillé).",
          leadId: t.leadId,
          organizationId: t.organizationId,
          metadata: { source: "portal", dossierComplete: true } as any,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, locked });
  } catch (e: any) {
    console.error("[Portal piece]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
