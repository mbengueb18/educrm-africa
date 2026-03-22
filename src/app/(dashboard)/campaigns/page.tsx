import { Metadata } from "next";
import { getCampaigns } from "./actions";
import { CampaignsClient } from "./campaigns-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Campagnes" };

export default async function CampaignsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [campaigns, stages, programs] = await Promise.all([
    getCampaigns(),
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

  return <CampaignsClient campaigns={campaigns as any} stages={stages} programs={programs} />;
}
