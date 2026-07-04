import { Metadata } from "next";
import { getEmailDomain } from "./actions";
import { EmailDomainClient } from "./email-domain-client";

export const metadata: Metadata = {
  title: "Domaine email",
};

export const dynamic = "force-dynamic";

export default async function EmailDomainPage() {
  const data = await getEmailDomain();
  return (
    <EmailDomainClient
      config={data.config}
      canUse={data.canUse}
      orgName={data.orgName}
      upgradeTarget={data.upgradeTarget}
    />
  );
}
