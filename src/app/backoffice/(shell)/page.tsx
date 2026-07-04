import { getOrganizations, getPlanChangeLogs } from "../actions";
import { OrgsClient } from "./orgs-client";

export const dynamic = "force-dynamic";

export default async function BoOrgsPage() {
  const [orgs, logs] = await Promise.all([getOrganizations(), getPlanChangeLogs(15)]);
  return <OrgsClient orgs={orgs as any} logs={logs as any} />;
}
