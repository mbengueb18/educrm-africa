import { Metadata } from "next";
import { getCampaignDetail } from "../actions";
import { CampaignDetailClient } from "./campaign-detail-client";

export const metadata: Metadata = { title: "Detail campagne" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  var { id } = await params;
  var campaign = await getCampaignDetail(id);
  return <CampaignDetailClient campaign={campaign as any} />;
}
