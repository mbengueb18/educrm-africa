import { Metadata } from "next";
import { getIntegration, getWebhookUrl } from "./actions";
import { IntegrationClient } from "./integration-client";

export const metadata: Metadata = { title: "Intégration WhatsApp" };

export default async function WhatsAppIntegrationPage() {
  const [integration, webhookUrl] = await Promise.all([
    getIntegration(),
    getWebhookUrl(),
  ]);

  return <IntegrationClient integration={integration as any} webhookUrl={webhookUrl} />;
}