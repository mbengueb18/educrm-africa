import { Metadata } from "next";
import { listTemplates } from "./actions";
import { TemplatesClient } from "./templates-client";

export const metadata: Metadata = { title: "Templates WhatsApp" };

export default async function WhatsAppTemplatesPage() {
  const templates = await listTemplates();
  return <TemplatesClient templates={templates as any} />;
}