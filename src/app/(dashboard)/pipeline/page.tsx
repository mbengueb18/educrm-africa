import { Metadata } from "next";
import { getPipelineData, getPipelineStats } from "./actions";
import { PipelineClient } from "./pipeline-client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAllFieldProperties } from "@/lib/field-properties";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user) return null;

  const [pipelineData, stats, programs, campuses, fieldProps] = await Promise.all([
    getPipelineData(),
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
  ]);

  return (
    <PipelineClient
      stages={pipelineData.stages}
      leads={pipelineData.leads}
      users={pipelineData.users}
      stats={stats}
      programs={programs}
      campuses={campuses}
      crmFields={fieldProps.fields}
      currentUserId={session.user.id}
    />
  );
}
