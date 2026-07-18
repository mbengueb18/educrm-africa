import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CampaignEditorClient } from "./editor-client";
import { getCustomFields } from "@/lib/custom-fields";

export const metadata: Metadata = { title: "Editer campagne" };

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  var { id } = await params;
  var session = await auth();
  if (!session?.user) redirect("/login");

  var campaign = await prisma.emailCampaign.findUnique({
    where: { id: id },
  });
  if (!campaign) redirect("/campaigns");

  var [stages, programs, audiences, users, customFields, org, emailTemplates] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true, code: true },
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
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, settings: true },
    }),
    prisma.messageTemplate.findMany({
      where: { organizationId: session.user.organizationId, channel: "EMAIL" as any },
      select: { id: true, name: true, subject: true, blocks: true, body: true, brandColor: true },
      orderBy: { name: "asc" },
    }),
  ]);

  var s = (org?.settings as Record<string, any>) || {};
  var orgInfo = {
    name: org?.name || "",
    address: s.address || undefined,
    phone: s.contactPhone || undefined,
    email: s.contactEmail || undefined,
    website: s.website || undefined,
  };

  return (
    <CampaignEditorClient
      campaign={campaign as any}
      stages={stages}
      programs={programs}
      audiences={audiences}
      users={users}
      customFields={customFields}
      orgInfo={orgInfo}
      emailTemplates={emailTemplates as any}
    />
  );
}