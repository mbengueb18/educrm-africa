import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getDashboardData } from "./actions";
import { getReportingAccess } from "./access";
import { getGoalWithProgress } from "./goals";
import { listCustomReports } from "./custom-reports";
import { getProgramFunnel } from "./program-funnel";
import { AnalyticsClient } from "./analytics-client";

export var metadata: Metadata = {
  title: "Reporting",
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [data, access, goalData, customReports, programFunnel] = await Promise.all([
    getDashboardData(),
    getReportingAccess(),
    getGoalWithProgress(),
    listCustomReports(),
    getProgramFunnel(),
  ]);

  if (!access) return null;

  return (
    <AnalyticsClient
      data={data}
      userName={session.user.name}
      currentUserId={session.user.id}
      access={access}
      goalData={goalData}
      customReports={customReports}
      programFunnel={programFunnel}
    />
  );
}