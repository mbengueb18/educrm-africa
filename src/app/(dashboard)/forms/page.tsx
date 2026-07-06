import { Metadata } from "next";
import { getForms } from "./actions";
import { FormsClient } from "./forms-client";

export const metadata: Metadata = { title: "Formulaires" };

export default async function FormsPage() {
  const forms = await getForms();
  return <FormsClient forms={forms as any} />;
}
