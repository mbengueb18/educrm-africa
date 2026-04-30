import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailTemplatesClient } from "./email-templates-client";

export const metadata: Metadata = {
  title: "Templates email",
};

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const templates = await prisma.messageTemplate.findMany({
    where: {
      organizationId: session.user.organizationId,
      channel: "EMAIL",
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      body: true,
      blocks: true,
      brandColor: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return <EmailTemplatesClient templates={templates as any} />;
}