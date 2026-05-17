import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WhatsAppCampaignDetailClient } from "./detail-client";

export const metadata: Metadata = { title: "Détail campagne WhatsApp" };

export default async function WhatsAppCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
    include: {
      createdBy: { select: { name: true } },
      template: { select: { metaName: true, language: true, category: true, bodyText: true, status: true } },
      audience: { select: { id: true, name: true, type: true } },
      recipients: {
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, whatsapp: true, email: true } },
        },
      },
    },
  });

  if (!campaign) redirect("/whatsapp-campaigns");

  return <WhatsAppCampaignDetailClient campaign={campaign as any} />;
}