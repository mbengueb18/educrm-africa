import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmailTemplate } from "../actions";
import { TemplateEditorForm } from "../template-editor-form";

export const metadata: Metadata = {
  title: "Modifier le template email",
};

export const dynamic = "force-dynamic";

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;
  const template = await getEmailTemplate(id);

  if (!template) {
    redirect("/settings/email-templates");
  }

  return <TemplateEditorForm template={template as any} />;
}