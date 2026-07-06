import { Metadata } from "next";
import { getLibraryDocuments } from "./actions";
import { DocumentsClient } from "./documents-client";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const documents = await getLibraryDocuments();
  return <DocumentsClient documents={documents as any} />;
}
