// Calcul du score d'un lead (0-100), règles partagées entre la création/import
// (score de base immédiat) et le recalcul complet (cron / à la demande).

export const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 20, WALK_IN: 20, WEBSITE: 15, PHONE_CALL: 15,
  FACEBOOK: 10, INSTAGRAM: 10, WHATSAPP: 10,
  SALON: 10, PARTNER: 10, RADIO: 5, TV: 5, IMPORT: 5, OTHER: 5,
};

export type LeadScoreInput = {
  source?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  programId?: string | null;
  campusId?: string | null;
  calls?: number;         // nb d'appels (0 à la création)
  messages?: number;      // nb de messages
  appointments?: number;  // nb de RDV
  lastContact?: Date | null; // dernier contact (appel/message) — bonus de récence
  now?: Date;
};

export function computeLeadScore(input: LeadScoreInput): number {
  const now = input.now ?? new Date();
  let score = 0;

  // Source (max 20)
  score += SOURCE_SCORES[input.source ?? ""] ?? 5;

  // Complétude du profil (max 25)
  if (input.email) score += 5;
  if (input.whatsapp) score += 5;
  if (input.programId) score += 10;
  if (input.campusId) score += 5;

  // Interactions (max 55)
  score += Math.min((input.calls ?? 0) * 5, 20);
  score += Math.min((input.messages ?? 0) * 3, 15);
  score += Math.min((input.appointments ?? 0) * 10, 20);

  // Bonus de récence (max 15)
  if (input.lastContact) {
    const days = Math.floor((now.getTime() - input.lastContact.getTime()) / 86_400_000);
    if (days <= 3) score += 15;
    else if (days <= 7) score += 10;
    else if (days <= 14) score += 5;
  }

  return Math.min(score, 100);
}
