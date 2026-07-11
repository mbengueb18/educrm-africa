import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WhatsAppWidgetClient } from "./whatsapp-widget-client";

export const metadata: Metadata = {
  title: "Widget WhatsApp",
};

export default async function WhatsAppWidgetPage() {
  const session = await auth();
  if (!session?.user) return null;

  const orgId = session.user.organizationId;

  let config = await prisma.whatsAppWidgetConfig.findUnique({
    where: { organizationId: orgId },
  });

  if (!config) {
    config = await prisma.whatsAppWidgetConfig.create({
      data: { organizationId: orgId },
    });
  }

  const [org, integration] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    }),
    prisma.whatsAppIntegration.findUnique({
      where: { organizationId: orgId },
      select: { isActive: true, displayPhoneNumber: true, verifiedName: true },
    }),
  ]);

  const numberConnected =
    !!integration?.isActive && !!integration?.displayPhoneNumber;

  return (
    <WhatsAppWidgetClient
      config={config}
      orgSlug={org?.slug || ""}
      numberConnected={numberConnected}
      displayPhoneNumber={integration?.displayPhoneNumber || null}
      verifiedName={integration?.verifiedName || null}
    />
  );
}
