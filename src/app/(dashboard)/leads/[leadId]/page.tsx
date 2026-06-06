import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLeadDetail } from "@/app/(dashboard)/pipeline/lead-actions";
import { getCurrentPlanInfo } from "@/lib/plans/client-helpers";
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

  // ✅ NOUVEAU : récupérer les infos plan pour la modale WhatsApp
  const planInfo = await getCurrentPlanInfo();
  const canUseWhatsAppAPI = planInfo?.features.WHATSAPP_BUSINESS_API ?? false;
  const currentPlanName = planInfo?.planName ?? "Essentiel";

  return (
    <LeadDetailClient
      lead={lead as any}
      initialTab={tab || "overview"}
      canUseWhatsAppAPI={canUseWhatsAppAPI}
      currentPlanName={currentPlanName}
    />
  );
}