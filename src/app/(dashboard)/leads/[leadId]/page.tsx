import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { getCurrentPlanInfo } from "@/lib/plans/client-helpers";
import { getCustomFields } from "@/lib/custom-fields";
import { buildDossierSections, buildChecklist, normalizeLabel, LEGACY_PROGRAM_KEYS, type DossierChecklist } from "@/lib/candidature";
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
  const [stages, customFields, submissions] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: lead.pipelineId
        ? { pipelineId: lead.pipelineId, organizationId: session.user.organizationId }
        : { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getCustomFields(),
    // Soumissions de formulaire rattachées à ce lead (la plus récente alimente l'onglet
    // Candidature ; les formulaires de TOUTES servent à masquer leurs libellés de l'Aperçu).
    prisma.formSubmission.findMany({
      where: { leadId, organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { data: true, checklist: true, createdAt: true, form: { select: { name: true, fields: true } } },
    }),
  ]);

  // Dossier de candidature : sections rejouées depuis le formulaire d'origine.
  const submission = submissions[0] || null;
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
        // Libellés (normalisés) des champs de TOUS les formulaires soumis par ce lead :
        // masqués de « Informations complémentaires » — y compris les clés héritées
        // d'anciennes versions du formulaire (libellés modifiés, accents, casse…).
        fieldLabels: Array.from(new Set([
          ...LEGACY_PROGRAM_KEYS,
          ...submissions.flatMap((s) => ((s.form?.fields as FormField[]) || [])
            .filter((f) => isInputField(f.type))
            .flatMap((f) => [normalizeLabel(f.label || ""), normalizeLabel(f.name || "")])
            .filter(Boolean)),
        ])),
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