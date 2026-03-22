import { Metadata } from "next";
import { getPipelineData, getPipelineStats } from "./actions";
import { PipelineClient } from "./pipeline-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user) return null;

  const [pipelineData, stats, programs] = await Promise.all([
    getPipelineData(),
    getPipelineStats(),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <PipelineClient
      stages={pipelineData.stages}
      leads={pipelineData.leads}
      users={pipelineData.users}
      stats={stats}
      programs={programs}
    />
  );
}
