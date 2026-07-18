import { Metadata } from "next";
import { getPipelineData, getPipelineStats, getOrgPipelines } from "./actions";
import { listLeadViews } from "./view-actions";
import { PipelineClient } from "./pipeline-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAllFieldProperties } from "@/lib/field-properties";
import { getCustomFields } from "@/lib/custom-fields";

export const metadata: Metadata = {
  title: "Pipeline",
};

interface PageProps {
  searchParams: Promise<{ pipeline?: string }>;
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const pipelineIdFromUrl = params.pipeline;

  const [pipelineData, stats, programs, campuses, fieldProps, pipelines, customFields] = await Promise.all([
    getPipelineData(pipelineIdFromUrl),
    getPipelineStats(),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
    getAllFieldProperties(),
    getOrgPipelines(),
    getCustomFields(),
  ]);

  // Vues enregistrées du conseiller pour le pipeline courant (chargées côté serveur
  // pour éviter un aller-retour client au montage).
  const viewsRes = await listLeadViews(pipelineData.currentPipelineId || null);
  const initialViews = viewsRes.ok ? viewsRes.views : [];

  return (
    <PipelineClient
      initialViews={initialViews}
      stages={pipelineData.stages}
      leads={pipelineData.leads}
      users={pipelineData.users}
      stats={stats}
      programs={programs}
      campuses={campuses}
      crmFields={fieldProps.fields}
      customFields={customFields}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
      pipelines={pipelines}
      currentPipelineId={pipelineData.currentPipelineId}
    />
  );
}