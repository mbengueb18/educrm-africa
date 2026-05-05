import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WebTrackingClient } from "./web-tracking-client";

export const dynamic = "force-dynamic";

export default async function WebTrackingSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      webTrackingEnabled: true,
    },
  });

  if (!org) redirect("/dashboard");

  return (
    <WebTrackingClient
      organization={org}
      baseUrl={process.env.NEXT_PUBLIC_APP_URL || ""}
    />
  );
}