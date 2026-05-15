import { Metadata } from "next";
import { getAudiences } from "./actions";
import { AudiencesClient } from "./audiences-client";

export const metadata: Metadata = {
  title: "Audiences",
};

export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  const audiences = await getAudiences();
  return <AudiencesClient audiences={audiences as any} />;
}