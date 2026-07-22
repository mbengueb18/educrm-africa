import { Metadata } from "next";
import { getInboxMessages, getInboxUsers } from "./actions";
import { InboxClient } from "./inbox-client";

export const metadata: Metadata = {
  title: "Inbox",
};

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [inbox, users] = await Promise.all([
    getInboxMessages(),
    getInboxUsers(),
  ]);
  return (
    <InboxClient
      conversations={inbox.conversations as any}
      total={inbox.total}
      users={users}
    />
  );
}