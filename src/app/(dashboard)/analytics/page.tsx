import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getDashboardData } from "./actions";
import { AnalyticsClient } from "./analytics-client";

export var metadata: Metadata = {
  title: "Dashboard",
};

export default async function AnalyticsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var data = await getDashboardData();

  return (
    <AnalyticsClient
      data={data}
      userName={session.user.name}
    />
  );
}