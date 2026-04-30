import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { OrientationClient } from "./orientation-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: org ? `Test d'orientation — ${org.name}` : "Test d'orientation",
  };
}

export const dynamic = "force-dynamic";

export default async function OrientationPage({ params }: PageProps) {
  const { slug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, logo: true },
  });

  if (!org) notFound();

  return <OrientationClient slug={slug} organization={org} />;
}