import { Metadata } from "next";
import { getSequenceAnalytics, getLeadsInSequence } from "./actions";
import { SequenceAnalyticsClient } from "./sequence-analytics-client";

export const metadata: Metadata = {
  title: "Performance des relances",
};

export const dynamic = "force-dynamic";

export default async function SequenceAnalyticsPage() {
  const [analytics, leads] = await Promise.all([
    getSequenceAnalytics(30),
    getLeadsInSequence(),
  ]);

  return <SequenceAnalyticsClient initialAnalytics={analytics} initialLeads={leads} />;
}