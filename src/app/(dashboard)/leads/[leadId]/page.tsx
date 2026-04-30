import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { LeadDetailClient } from "./lead-detail-client";

export const metadata: Metadata = {
  title: "Fiche lead",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) return null;

  const { leadId } = await params;
  const { tab } = await searchParams;

  let lead;
  try {
    lead = await getLeadDetail(leadId);
  } catch {
    notFound();
  }

  if (!lead) notFound();

  return <LeadDetailClient lead={lead as any} initialTab={tab || "overview"} />;
}