import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WhatsAppCampaignEditorClient } from "./editor-client";

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

  return (
    <WhatsAppCampaignEditorClient campaign={campaign as any} />
  );
}