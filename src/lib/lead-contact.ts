import { prisma } from "@/lib/prisma";

/**
 * Met à jour `Lead.lastContactAt = max(valeur actuelle, date)`.
 *
 * Champ dénormalisé : évite de recalculer le dernier contact (3 groupBy + scan)
 * à chaque chargement du pipeline. À appeler après chaque contact sortant
 * (appel, message OUTBOUND, RDV programmé/confirmé/terminé). Best-effort : ne doit
 * jamais faire échouer l'action métier appelante. Le cron `lead-scores` réconcilie
 * la valeur exacte quotidiennement (couvre les envois automatisés non instrumentés).
 *
 * `GREATEST` de Postgres ignore les NULL, donc fonctionne aussi quand la colonne est nulle.
 */
export async function touchLeadLastContact(leadId: string | null | undefined, date: Date): Promise<void> {
  if (!leadId) return;
  try {
    await prisma.$executeRaw`
      UPDATE "leads"
      SET "lastContactAt" = GREATEST("lastContactAt", ${date})
      WHERE "id" = ${leadId}
    `;
  } catch {
    // best-effort : la dénormalisation ne doit pas casser l'envoi/log de contact
  }
}
