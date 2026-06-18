import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { TemplateEditorForm } from "../template-editor-form";

export const metadata: Metadata = {
  title: "Nouveau template email",
};

export const dynamic = "force-dynamic";

export default async function NewEmailTemplatePage() {
  const session = await auth();
  if (!session?.user) return null;

  return <TemplateEditorForm template={null} />;
}