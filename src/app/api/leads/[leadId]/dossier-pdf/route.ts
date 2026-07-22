// Génère le dossier de candidature PDF d'un lead (synthèse + pièces concaténées),
// le dépose sur Supabase Storage et renvoie une URL signée de téléchargement.
// (Le PDF peut dépasser la limite de réponse Vercel → jamais renvoyé inline.)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { buildDossierSections, buildChecklist, type DossierChecklist } from "@/lib/candidature";
import { generateDossierPdf } from "@/lib/candidature-pdf";
import type { FormField } from "@/lib/forms";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "lead-documents";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
    const orgId = session.user.organizationId;
    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, program: { select: { name: true } }, organization: { select: { name: true } } },
    });
    if (!lead) return NextResponse.json({ ok: false, error: "Prospect introuvable" }, { status: 404 });

    const submission = await prisma.formSubmission.findFirst({
      where: { leadId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: { data: true, checklist: true, createdAt: true, form: { select: { name: true, fields: true } } },
    });
    if (!submission?.form) return NextResponse.json({ ok: false, error: "Aucune candidature pour ce prospect" }, { status: 404 });

    const formFields = (submission.form.fields as FormField[]) || [];
    const data = (submission.data as Record<string, any>) || {};

    // Résolution des noms de filière (champ program = id)
    const programIds = formFields.filter((f) => f.type === "program").map((f) => data[f.name])
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const programNames: Record<string, string> = {};
    if (programIds.length) {
      const progs = await prisma.program.findMany({ where: { id: { in: programIds }, organizationId: orgId }, select: { id: true, name: true } });
      progs.forEach((p) => { programNames[p.id] = p.name; });
    }

    const checklist: DossierChecklist = (submission.checklist as DossierChecklist | null) ?? buildChecklist(formFields, data);
    const sections = buildDossierSections(formFields, data, programNames, { excludeFiles: true });

    const pdfBytes = await generateDossierPdf({
      orgName: lead.organization?.name || "",
      leadName: (lead.firstName + " " + lead.lastName).trim(),
      formName: submission.form.name,
      submittedAt: submission.createdAt.toISOString(),
      programName: lead.program?.name || (programIds.length ? programNames[programIds[0]] : null),
      sections,
      checklist,
    });

    const path = `dossiers/${orgId}/${leadId}/dossier-${Date.now()}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return NextResponse.json({ ok: false, error: "Dépôt du PDF impossible : " + upErr.message }, { status: 500 });

    const { data: signed, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 600, {
      download: `Dossier de candidature - ${(lead.firstName + " " + lead.lastName).trim() || "candidat"}.pdf`,
    });
    if (signErr || !signed) return NextResponse.json({ ok: false, error: "URL de téléchargement impossible" }, { status: 500 });

    return NextResponse.json({ ok: true, url: signed.signedUrl });
  } catch (e: any) {
    console.error("[Dossier PDF]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
