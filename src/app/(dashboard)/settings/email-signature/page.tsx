import { Metadata } from "next";
import { getMyEmailSignature } from "./actions";
import { SignatureClient } from "./signature-client";

export const metadata: Metadata = { title: "Signature email" };

export default async function EmailSignaturePage() {
  const data = await getMyEmailSignature();
  return <SignatureClient data={data as any} />;
}
