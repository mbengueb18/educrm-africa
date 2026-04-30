import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
      <p className="text-lg font-semibold text-gray-900 mb-2">Lead introuvable</p>
      <p className="text-sm text-gray-500 mb-4">Ce lead n'existe pas ou vous n'y avez pas accès.</p>
      <Link href="/pipeline" className="btn-primary">Retour au pipeline</Link>
    </div>
  );
}