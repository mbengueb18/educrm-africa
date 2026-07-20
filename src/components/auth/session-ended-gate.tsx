"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * Affiché quand la session serveur est invalide alors qu'un cookie est encore présent
 * (compte désactivé/supprimé, ou session expirée). Fait un signOut() PROPRE — qui efface
 * le cookie via la route /api/auth/signout — puis redirige vers /login.
 *
 * Sans ce gate, un simple redirect("/login") côté serveur boucle : le middleware ne teste
 * que la PRÉSENCE du cookie et renverrait aussitôt vers le dashboard.
 */
export function SessionEndedGate() {
  useEffect(function () {
    signOut({ callbackUrl: "/login", redirect: true }).catch(function () {
      // En dernier recours, on force la navigation.
      window.location.href = "/login";
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-600 p-8 text-center">
      <Loader2 size={22} className="animate-spin text-brand-600" />
      <p className="text-sm">Votre session a pris fin. Redirection vers la connexion…</p>
    </div>
  );
}
