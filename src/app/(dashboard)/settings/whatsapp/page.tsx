import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WhatsAppSettingsClient } from "./whatsapp-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      phoneNumberId: true,
      whatsappBusinessAccountId: true,
      verifyToken: true,
      displayPhoneNumber: true,
      verifiedName: true,
      isActive: true,
      lastSyncedAt: true,
    },
  });

  // Détermine l'URL de base selon l'environnement
  function getBaseUrl(): string {
    // 1. Variable explicite (prod)
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    
    // 2. URL Vercel auto (preview/staging)
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    
    // 3. Fallback localhost
    return "http://localhost:3000";
  }

  const webhookUrl = `${getBaseUrl()}/api/webhooks/whatsapp/${session.user.organizationId}`;

  return (
    <WhatsAppSettingsClient
      integration={integration ? {
        ...integration,
        lastSyncedAt: integration.lastSyncedAt?.toISOString() || null,
      } : null}
      webhookUrl={webhookUrl}
    />
  );
}