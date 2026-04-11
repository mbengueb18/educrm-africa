"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <ShieldX size={32} className="text-red-400" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Accès refusé</h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {message || "Vous n'avez pas les permissions nécessaires pour accéder à cette page."}
      </p>
      <Link href="/analytics" className="btn-primary py-2 text-sm">
        Retour au dashboard
      </Link>
    </div>
  );
}