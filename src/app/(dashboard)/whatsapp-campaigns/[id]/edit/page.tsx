import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WhatsAppCampaignEditorClient } from "./editor-client";
import { getCustomFields } from "@/lib/custom-fields";

export const metadata: Metadata = { title: "Éditer campagne WhatsApp" };

export default async function WhatsAppCampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  if (!campaign) redirect("/whatsapp-campaigns");

  // Données du builder de règles ad-hoc (même jeu que l'éditeur email)
  const [stages, programs, audiences, users, customFields] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.audience.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCustomFields(),
  ]);

  return (
    <WhatsAppCampaignEditorClient
      campaign={campaign as any}
      stages={stages}
      programs={programs}
      audiences={audiences}
      users={users}
      customFields={customFields}
    />
  );
}