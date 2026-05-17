import { Metadata } from "next";
import { getWhatsAppCampaigns } from "./actions";
import { WhatsAppCampaignsClient } from "./whatsapp-campaigns-client";

export const metadata: Metadata = { title: "Campagnes WhatsApp" };

export default async function WhatsAppCampaignsPage() {
  const campaigns = await getWhatsAppCampaigns();
  return <WhatsAppCampaignsClient campaigns={campaigns as any} />;
}