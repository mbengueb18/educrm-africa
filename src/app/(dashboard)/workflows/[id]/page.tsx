import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkflow } from "../actions";
import { WorkflowEditorClient } from "./workflow-editor-client";

export const metadata: Metadata = {
  title: "Éditeur de workflow",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowEditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;

  let workflow;
  try {
    workflow = await getWorkflow(id);
  } catch {
    notFound();
  }

  // Load helper data
  const [stages, templates] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.messageTemplate.findMany({
      where: { organizationId: session.user.organizationId, channel: "EMAIL" },
      select: { id: true, name: true, subject: true, body: true, blocks: true, brandColor: true },
    }),
  ]);

  return <WorkflowEditorClient workflow={workflow as any} stages={stages} templates={templates as any} />;
}