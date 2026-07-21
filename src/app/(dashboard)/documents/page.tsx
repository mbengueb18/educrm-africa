import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { canAccessFeature } from "@/lib/plans/checks";
import { getLibraryDocuments, getDocumentFolders } from "./actions";
import { DocumentsClient } from "./documents-client";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const session = await auth();
  const [documents, folders, chatbotAi] = await Promise.all([
    getLibraryDocuments(),
    getDocumentFolders(),
    session?.user ? canAccessFeature(session.user.organizationId, "CHATBOT_AI") : Promise.resolve({ allowed: false }),
  ]);
  // Le toggle « Visible par le chatbot » n'a de sens que si l'org a le chatbot IA
  // activé (Back Office). Sinon on ne l'affiche pas (et l'action serveur le refuse).
  return <DocumentsClient documents={documents as any} folders={folders as any} chatbotAiEnabled={chatbotAi.allowed} />;
}
