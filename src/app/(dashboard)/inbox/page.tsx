import { Metadata } from "next";
import { getInboxMessages } from "./actions";
import { InboxClient } from "./inbox-client";

export const metadata: Metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const conversations = await getInboxMessages();
  return <InboxClient conversations={conversations as any} />;
}