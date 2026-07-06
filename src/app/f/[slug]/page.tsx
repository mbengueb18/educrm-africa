import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicFormClient } from "./public-form-client";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; embed?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const preview = sp?.preview === "1";
  const embed = sp?.embed === "1";

  const form = await prisma.form.findFirst({
    where: { slug, ...(preview ? {} : { status: "PUBLISHED" }) },
    select: { id: true, name: true, description: true, fields: true, settings: true, slug: true, status: true, organizationId: true },
  });
  if (!form) notFound();

  const org = await prisma.organization.findUnique({ where: { id: form.organizationId }, select: { name: true, logo: true } });

  return <PublicFormClient form={form as any} orgName={org?.name || ""} orgLogo={org?.logo || null} embed={embed} preview={preview} />;
}
