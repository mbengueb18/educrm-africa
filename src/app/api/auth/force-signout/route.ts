import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Déconnexion FORCÉE, robuste à une session cassée.
 *
 * Le `signOut()` côté client (next-auth) échoue parfois quand le JWT est déjà invalide
 * (le POST CSRF part en erreur) → le cookie n'est PAS effacé → le middleware, qui ne teste
 * que la présence du cookie, renvoie /login vers /pipeline → BOUCLE DE REDIRECTION INFINIE.
 *
 * Ici on efface le cookie de session côté SERVEUR (Set-Cookie expiré) puis on 302 vers /login.
 * Le middleware exclut /api → aucun rebond. Une fois le cookie parti, /login ne boucle plus.
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));

  // Toutes les variantes possibles du cookie de session next-auth :
  // sécurisé (prod https), non sécurisé (dev), chunké (.0/.1 si le JWT est gros), legacy.
  const names = new Set<string>([
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]);
  for (const c of request.cookies.getAll()) {
    if (c.name.includes("authjs.session-token") || c.name.includes("next-auth.session-token")) {
      names.add(c.name);
    }
  }

  for (const name of names) {
    res.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      // Le préfixe __Secure- exige l'attribut Secure pour être (ré)écrit/supprimé.
      secure: name.startsWith("__Secure-") || name.startsWith("__Host-"),
    });
  }

  return res;
}
