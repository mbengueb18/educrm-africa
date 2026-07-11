import { getContracts } from "../../actions";
import { ContractsClient } from "./contracts-client";

export const dynamic = "force-dynamic";

export default async function BoContractsPage() {
  const contracts = await getContracts();
  return <ContractsClient contracts={contracts as any} />;
}
