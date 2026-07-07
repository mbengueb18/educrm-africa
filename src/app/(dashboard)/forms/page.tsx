import { redirect } from "next/navigation";

// La liste des formulaires a été déplacée dans Réglages → Formulaires.
// (L'éditeur /forms/[id]/edit et les soumissions restent à leur emplacement.)
export default function FormsPage() {
  redirect("/settings/forms");
}
