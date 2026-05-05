import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WebAnalyticsClient } from "./web-analytics-client";

export default async function WebAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return <WebAnalyticsClient />;
}