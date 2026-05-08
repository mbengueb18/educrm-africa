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

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp/${session.user.organizationId}`;

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