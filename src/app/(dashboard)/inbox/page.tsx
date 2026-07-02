import { Metadata } from "next";
import { getInboxMessages, getInboxUsers } from "./actions";
import { InboxClient } from "./inbox-client";

export const metadata: Metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [conversations, users] = await Promise.all([
    getInboxMessages(),
    getInboxUsers(),
  ]);
  return <InboxClient conversations={conversations as any} users={users} />;
}