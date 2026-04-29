import { Metadata } from "next";
import { getSequenceAnalytics, getLeadsInSequence, getCohortAnalysis, getSequenceImpact } from "./actions";
import { SequenceAnalyticsClient } from "./sequence-analytics-client";

export const metadata: Metadata = {
  title: "Performance des relances",
};

export const dynamic = "force-dynamic";

export default async function SequenceAnalyticsPage() {
  const [analytics, leads, cohorts, impact] = await Promise.all([
    getSequenceAnalytics(30),
    getLeadsInSequence(),
    getCohortAnalysis(3),
    getSequenceImpact(90),
  ]);

  return (
    <SequenceAnalyticsClient
      initialAnalytics={analytics}
      initialLeads={leads}
      initialCohorts={cohorts}
      initialImpact={impact}
    />
  );
}