import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide ou expiré</h1>
        <p className="text-sm text-gray-500 mb-4">
          Ce lien d'accès n'est plus valide. Veuillez contacter l'établissement pour obtenir un nouveau lien.
        </p>
      </div>
    </div>
  );
}