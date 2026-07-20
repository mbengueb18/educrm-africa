import { Metadata } from "next";
import { getLibraryDocuments, getDocumentFolders } from "./actions";
import { DocumentsClient } from "./documents-client";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const [documents, folders] = await Promise.all([getLibraryDocuments(), getDocumentFolders()]);
  return <DocumentsClient documents={documents as any} folders={folders as any} />;
}
