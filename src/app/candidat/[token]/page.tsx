import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPortalData } from "./actions";
import { loadDossier } from "@/lib/dossier-service";
import { CandidatePortalClient, type PortalDossier } from "./candidate-portal-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Espace candidat",
};

export const dynamic = "force-dynamic";

export default async function CandidatePortalPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getPortalData(token);

  if (!data) notFound();

  // Dossier de candidature (sections + checklist des pièces) — même socle que l'onglet CRM.
  let dossier: PortalDossier | null = null;
  const d = await loadDossier(data.leadId, data.organizationId);
  if (d && (d.sections.length || d.checklist.items.length)) {
    dossier = {
      formName: d.formName,
      submittedAt: d.submittedAt,
      sections: d.sections,
      checklist: d.checklist.items.length ? d.checklist : null,
    };
  }

  return <CandidatePortalClient token={token} data={data as any} dossier={dossier} />;
}