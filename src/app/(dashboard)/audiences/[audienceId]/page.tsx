import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAudience, getAudienceLeads } from "../actions";
import { AudienceDetailClient } from "./audience-detail-client";

export const metadata: Metadata = {
  title: "Audience",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ audienceId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function AudienceDetailPage({ params, searchParams }: PageProps) {
  const { audienceId } = await params;
  const { page } = await searchParams;
  const pageNum = page ? parseInt(page, 10) || 1 : 1;

  const session = await auth();
  if (!session?.user) notFound();

  try {
    const [audience, leadsData, users] = await Promise.all([
      getAudience(audienceId),
      getAudienceLeads(audienceId, pageNum, 25),
      prisma.user.findMany({
        where: { organizationId: session.user.organizationId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return (
      <AudienceDetailClient
        audience={audience as any}
        leads={leadsData.leads as any}
        total={leadsData.total}
        page={leadsData.page}
        pageSize={leadsData.pageSize}
        users={users}
        currentUserRole={session.user.role}
      />
    );
  } catch {
    notFound();
  }
}