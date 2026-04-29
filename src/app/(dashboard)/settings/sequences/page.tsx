import { Metadata } from "next";
import { getSequenceConfig } from "./actions";
import { SequencesSettingsClient } from "./sequences-settings-client";

export const metadata: Metadata = {
  title: "Relances automatiques",
};

export const dynamic = "force-dynamic";

export default async function SequencesSettingsPage() {
  const config = await getSequenceConfig();
  return <SequencesSettingsClient config={config} />;
}