import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getOrganizationBySlug } from "./actions";
import { InscriptionClient } from "./inscription-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) return { title: "Inscription" };
  return {
    title: `Inscription en ligne — ${org.name}`,
    description: `Candidatez en ligne pour rejoindre ${org.name}.`,
  };
}

export default async function InscriptionPage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);

  if (!org) notFound();

  return <InscriptionClient slug={slug} organization={org} />;
}