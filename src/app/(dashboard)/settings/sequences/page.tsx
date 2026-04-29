import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SequencesSettingsClient } from "./sequences-settings-client";

export const metadata: Metadata = {
  title: "Relances automatiques",
};

export default async function SequencesSettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  let config = await prisma.organizationSequenceConfig.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  if (!config) {
    config = await prisma.organizationSequenceConfig.create({
      data: { organizationId: session.user.organizationId },
    });
  }

  return <SequencesSettingsClient config={config} />;
}