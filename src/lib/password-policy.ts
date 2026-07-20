// Politique de mot de passe partagée (signup + reset).
// Approche NIST 800-63B : on mise sur la LONGUEUR + une blocklist des mots de passe
// les plus courants, plutôt que des règles de complexité (majuscule/chiffre/symbole)
// qui poussent aux mots de passe faibles et prévisibles.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200; // borne haute (bcrypt ignore au-delà de 72 octets)

// Mots de passe trop courants / évidents (comparaison en minuscules).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "motdepasse", "motdepasse1",
  "12345678", "123456789", "1234567890", "0123456789", "azertyuiop", "qwertyuiop",
  "azerty123", "qwerty123", "azertyui", "qwertyui", "11111111", "00000000",
  "iloveyou", "admin123", "administrator", "welcome1", "welcome123", "letmein1",
  "changeme", "changeme1", "talibcrm", "talibcrm1", "talibcrm123", "abcd1234",
  "aaaaaaaa", "football", "sunshine", "princess", "dragon123", "monkey12",
]);

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/** Valide un mot de passe côté serveur (source de vérité). */
export function validatePassword(password: string | null | undefined): PasswordCheck {
  const pw = password || "";
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` };
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "Le mot de passe est trop long" };
  }
  const normalized = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return { ok: false, error: "Ce mot de passe est trop courant. Choisissez-en un moins prévisible." };
  }
  // Rejette les suites triviales d'un seul caractère répété (ex : "aaaaaaaa").
  if (/^(.)\1+$/.test(pw)) {
    return { ok: false, error: "Ce mot de passe est trop simple." };
  }
  return { ok: true };
}
