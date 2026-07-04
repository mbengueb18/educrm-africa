import { getPlatformAdmins } from "../../actions";
import { getBoSession } from "@/lib/bo-auth";
import { AdminsClient } from "./admins-client";

export const dynamic = "force-dynamic";

export default async function BoAdminsPage() {
  const [admins, session] = await Promise.all([getPlatformAdmins(), getBoSession()]);
  return <AdminsClient admins={admins as any} currentId={session?.id || ""} isOwner={session?.role === "OWNER"} />;
}
