import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CampaignEditorClient } from "./editor-client";

export const metadata: Metadata = { title: "Editer campagne" };

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  var { id } = await params;
  var session = await auth();
  if (!session?.user) redirect("/login");

  var campaign = await prisma.emailCampaign.findUnique({
    where: { id: id },
  });

  if (!campaign) redirect("/campaigns");

  var [stages, programs] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <CampaignEditorClient
      campaign={campaign as any}
      stages={stages}
      programs={programs}
    />
  );
}
