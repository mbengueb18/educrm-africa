"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Affiché quand la session serveur est invalide alors qu'un cookie est encore présent
 * (compte désactivé/supprimé, ou session expirée).
 *
 * On redirige vers /api/auth/force-signout : une route SERVEUR qui efface le cookie de
 * session (Set-Cookie expiré) puis 302 vers /login. Le middleware exclut /api, donc aucun
 * rebond possible.
 *
 * ⚠️ On n'utilise PLUS le signOut() client de next-auth ici : quand le JWT est déjà invalide,
 * son POST CSRF échoue, le cookie n'est pas effacé, et le middleware (qui ne teste que la
 * présence du cookie) renvoie /login → /pipeline → BOUCLE DE REDIRECTION INFINIE.
 */
export function SessionEndedGate() {
  useEffect(function () {
    window.location.replace("/api/auth/force-signout");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-600 p-8 text-center">
      <Loader2 size={22} className="animate-spin text-brand-600" />
      <p className="text-sm">Votre session a pris fin. Redirection vers la connexion…</p>
    </div>
  );
}
