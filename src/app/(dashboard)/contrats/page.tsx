import { getMyContract } from "./actions";
import { ContratsClient } from "./contrats-client";
import { FileLock2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContratsPage() {
  const data = await getMyContract();

  if (!data.hasAccess) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
          <FileLock2 size={22} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Aucun contrat à afficher</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aucun contrat ne vous est actuellement destiné. Dès que notre équipe met un contrat à votre disposition,
          il apparaîtra ici.
        </p>
      </div>
    );
  }

  return <ContratsClient orgName={data.orgName} contract={data.contract} view={data.view} content={data.content} />;
}
