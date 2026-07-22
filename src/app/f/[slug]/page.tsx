import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/forms";
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

  // Filières : options vivantes du champ « Filière » — on ne charge que celles sélectionnées
  // par le créateur du formulaire, actives, et appartenant bien à l'organisation.
  const fields = (form.fields as FormField[]) || [];
  const programIds = fields.filter((f) => f.type === "program").flatMap((f) => f.programIds || []);
  const programs = programIds.length
    ? await prisma.program.findMany({
        where: { id: { in: programIds }, organizationId: form.organizationId, isActive: true },
        select: { id: true, name: true, diploma: true, level: true },
        orderBy: [{ diploma: "asc" }, { name: "asc" }],
      })
    : [];

  return <PublicFormClient form={form as any} orgName={org?.name || ""} orgLogo={org?.logo || null} embed={embed} preview={preview} programs={programs} />;
}
