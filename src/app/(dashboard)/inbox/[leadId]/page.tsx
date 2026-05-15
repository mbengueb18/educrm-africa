import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConversation } from "../actions";
import { ConversationClient } from "./conversation-client";

export const metadata: Metadata = {
  title: "Conversation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ leadId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { leadId } = await params;
  
  try {
    const data = await getConversation(leadId);
    return <ConversationClient lead={data.lead as any} messages={data.messages as any} />;
  } catch {
    notFound();
  }
}