import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans/checks";
import { OrientationShareClient } from "./orientation-share-client";

export const metadata: Metadata = { title: "Test d'orientation IA" };

export default async function OrientationSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const aiCheck = await canAccessFeature(session.user.organizationId, "AI_ASSISTANT");

  return (
    <OrientationShareClient
      slug={session.user.organizationSlug}
      aiActive={aiCheck.allowed}
    />
  );
}
