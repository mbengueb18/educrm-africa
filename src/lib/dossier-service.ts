// Service serveur du dossier de candidature : chargement de la dernière soumission d'un lead,
// génération du PDF fusionné et dépôt sur Supabase Storage (URL signée).
// Consommé par la route CRM (/api/leads/[leadId]/dossier-pdf) ET la route candidat
// (/api/candidat/[token]/dossier-pdf) — une seule implémentation.

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { buildDossierSections, buildChecklist, type DossierChecklist } from "@/lib/candidature";
import { generateDossierPdf } from "@/lib/candidature-pdf";
import type { FormField } from "@/lib/forms";

const BUCKET = "lead-documents";

// Dernière soumission d'un lead + dossier reconstruit (sections, checklist, noms de filière).
export async function loadDossier(leadId: string, organizationId: string) {
  const submission = await prisma.formSubmission.findFirst({
    where: { leadId, organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, data: true, checklist: true, createdAt: true, form: { select: { name: true, fields: true } } },
  });
  if (!submission?.form) return null;

  const formFields = (submission.form.fields as FormField[]) || [];
  const data = (submission.data as Record<string, any>) || {};

  const programIds = formFields.filter((f) => f.type === "program").map((f) => data[f.name])
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const programNames: Record<string, string> = {};
  if (programIds.length) {
    const progs = await prisma.program.findMany({ where: { id: { in: programIds }, organizationId }, select: { id: true, name: true } });
    progs.forEach((p) => { programNames[p.id] = p.name; });
  }

  const checklist: DossierChecklist = (submission.checklist as DossierChecklist | null) ?? buildChecklist(formFields, data);
  const sections = buildDossierSections(formFields, data, programNames, { excludeFiles: true });

  return {
    submissionId: submission.id,
    formName: submission.form.name,
    formFields,
    data,
    submittedAt: submission.createdAt.toISOString(),
    programNames,
    programName: programIds.length ? programNames[programIds[0]] || null : null,
    sections,
    checklist,
  };
}

// Génère le PDF du dossier, l'upload et renvoie une URL signée de téléchargement (10 min).
export async function generateAndUploadDossierPdf(leadId: string, organizationId: string):
  Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true, firstName: true, lastName: true, program: { select: { name: true } }, organization: { select: { name: true } } },
  });
  if (!lead) return { ok: false, error: "Prospect introuvable", status: 404 };

  const dossier = await loadDossier(leadId, organizationId);
  if (!dossier) return { ok: false, error: "Aucune candidature pour ce prospect", status: 404 };

  const pdfBytes = await generateDossierPdf({
    orgName: lead.organization?.name || "",
    leadName: (lead.firstName + " " + lead.lastName).trim(),
    formName: dossier.formName,
    submittedAt: dossier.submittedAt,
    programName: lead.program?.name || dossier.programName,
    sections: dossier.sections,
    checklist: dossier.checklist,
  });

  const path = `dossiers/${organizationId}/${leadId}/dossier-${Date.now()}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return { ok: false, error: "Dépôt du PDF impossible : " + upErr.message, status: 500 };

  const { data: signed, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 600, {
    download: `Dossier de candidature - ${(lead.firstName + " " + lead.lastName).trim() || "candidat"}.pdf`,
  });
  if (signErr || !signed) return { ok: false, error: "URL de téléchargement impossible", status: 500 };

  return { ok: true, url: signed.signedUrl };
}
