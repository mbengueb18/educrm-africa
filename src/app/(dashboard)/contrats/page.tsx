import { getOrCreateContract } from "./actions";
import { ContratsClient } from "./contrats-client";
import { FileLock2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContratsPage() {
  const data = await getOrCreateContract();

  if (!data.allowed) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-4">
          <FileLock2 size={22} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Accès réservé</h1>
        <p className="text-sm text-gray-500 mt-1">
          La gestion du contrat d'abonnement est réservée aux administrateurs de votre organisation.
        </p>
      </div>
    );
  }

  if (!data.contractable) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
          <FileLock2 size={22} />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Offre gratuite — pas de contrat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Votre organisation est sur l'offre <b>Essentiel</b> (gratuite), encadrée par les Conditions Générales
          d'Utilisation. Un contrat d'abonnement est généré automatiquement dès le passage à une offre payante
          (Croissance ou Performance).
        </p>
      </div>
    );
  }

  return <ContratsClient orgName={data.orgName} contract={data.contract} view={data.view} />;
}
