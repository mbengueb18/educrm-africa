import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { TemplateEditorForm } from "../template-editor-form";
import { getOrgEmailDefaults } from "../actions";

export const metadata: Metadata = {
  title: "Nouveau template email",
};

export const dynamic = "force-dynamic";

export default async function NewEmailTemplatePage() {
  const session = await auth();
  if (!session?.user) return null;

  const orgInfo = await getOrgEmailDefaults();

  return <TemplateEditorForm template={null} orgInfo={orgInfo} />;
}