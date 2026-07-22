import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { getCurrentPlanInfo } from "@/lib/plans/client-helpers";
import { getCustomFields } from "@/lib/custom-fields";
import { buildDossierSections, buildChecklist, type DossierChecklist } from "@/lib/candidature";
import { isInputField, type FormField } from "@/lib/forms";
import { LeadDetailClient } from "./lead-detail-client";

export const metadata: Metadata = {
  title: "Fiche lead",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const { leadId } = await params;
  const { tab } = await searchParams;

  let lead;
  try {
    lead = await getLeadDetail(leadId);
  } catch {
    notFound();
  }

  if (!lead) notFound();

  // ✅ NOUVEAU : récupérer les infos plan pour la modale WhatsApp
  const planInfo = await getCurrentPlanInfo();
  const canUseWhatsAppAPI = planInfo?.features.WHATSAPP_BUSINESS_API ?? false;
  const currentPlanName = planInfo?.planName ?? "Essentiel";

  // Étapes du pipeline du lead (pour changer le statut depuis la fiche)
  const [stages, customFields, submission] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: lead.pipelineId
        ? { pipelineId: lead.pipelineId, organizationId: session.user.organizationId }
        : { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getCustomFields(),
    // Dernière soumission de formulaire rattachée à ce lead → onglet Candidature
    prisma.formSubmission.findFirst({
      where: { leadId, organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      select: { data: true, checklist: true, createdAt: true, form: { select: { name: true, fields: true } } },
    }),
  ]);

  // Dossier de candidature : sections rejouées depuis le formulaire d'origine.
  let candidature = null;
  if (submission?.form) {
    const formFields = (submission.form.fields as FormField[]) || [];
    const data = (submission.data as Record<string, any>) || {};
    // Résolution des noms de filière (le champ « program » stocke l'id du Program)
    const programIds = formFields
      .filter((f) => f.type === "program")
      .map((f) => data[f.name])
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const programNames: Record<string, string> = {};
    if (programIds.length) {
      const progs = await prisma.program.findMany({
        where: { id: { in: programIds }, organizationId: session.user.organizationId },
        select: { id: true, name: true },
      });
      progs.forEach((p) => { programNames[p.id] = p.name; });
    }
    // Checklist des pièces : snapshot de la soumission, ou recalcul pour les anciennes soumissions.
    const checklist: DossierChecklist = (submission.checklist as DossierChecklist | null) ?? buildChecklist(formFields, data);
    // Les fichiers sont portés par la carte checklist → exclus des sections (pas de doublon).
    const sections = buildDossierSections(formFields, data, programNames, { excludeFiles: checklist.items.length > 0 });
    if (sections.length || checklist.items.length) {
      candidature = {
        formName: submission.form.name,
        submittedAt: submission.createdAt.toISOString(),
        sections,
        checklist: checklist.items.length ? checklist : null,
        // Libellés des champs du formulaire : masqués de « Informations complémentaires »
        // (ils sont désormais présentés, structurés, dans l'onglet Candidature).
        fieldLabels: formFields.filter((f) => isInputField(f.type)).map((f) => f.label || f.name),
      };
    }
  }

  return (
    <LeadDetailClient
      lead={lead as any}
      initialTab={tab || "overview"}
      canUseWhatsAppAPI={canUseWhatsAppAPI}
      currentPlanName={currentPlanName}
      stages={stages}
      customFields={customFields}
      candidature={candidature}
    />
  );
}