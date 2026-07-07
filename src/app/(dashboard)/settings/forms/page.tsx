import { Metadata } from "next";
import { getForms } from "@/app/(dashboard)/forms/actions";
import { FormsSettingsClient } from "./forms-settings-client";

export const metadata: Metadata = { title: "Formulaires" };

export default async function FormsSettingsPage() {
  // Formulaires créés dans TalibCRM (builder). Les formulaires « du site » sont
  // chargés côté client dans l'onglet dédié.
  const builderForms = await getForms();
  return <FormsSettingsClient builderForms={builderForms as any} />;
}
