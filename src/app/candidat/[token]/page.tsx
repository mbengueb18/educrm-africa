import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPortalData } from "./actions";
import { CandidatePortalClient } from "./candidate-portal-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Espace candidat",
};

export const dynamic = "force-dynamic";

export default async function CandidatePortalPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getPortalData(token);

  if (!data) notFound();

  return <CandidatePortalClient token={token} data={data as any} />;
}