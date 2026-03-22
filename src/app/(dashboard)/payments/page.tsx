import { Metadata } from "next";
import { CreditCard, Plus, Search, Filter, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Paiements" };

export default function PaymentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Paiements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des frais de scolarité et échéanciers
          </p>
        </div>
        <button className="btn-primary py-2 text-xs">
          <Plus size={16} />
          Enregistrer un paiement
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Encaissé ce mois</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">0 FCFA</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Attendu ce mois</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">0 FCFA</p>
        </div>
        <div className="stat-card border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-danger-500" />
            <p className="text-sm text-gray-500">Impayés</p>
          </div>
          <p className="text-2xl font-bold text-danger-500 mt-1">0 FCFA</p>
        </div>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-4">
          <CreditCard size={32} className="text-accent-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Aucun paiement enregistré
        </h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
          Les échéanciers de paiement seront créés automatiquement lors de
          l&apos;inscription des étudiants. Vous pourrez aussi enregistrer des
          paiements manuellement.
        </p>
        <button className="btn-primary">
          <Plus size={16} />
          Enregistrer un paiement
        </button>
      </div>
    </div>
  );
}
