import { prisma } from "@/lib/prisma";
import { buildLeadWhere } from "@/lib/lead-filters";

// Construit le filtre Prisma des leads d'une campagne (audience figée ou règles).
// Partagé entre les server actions et le cron (promotion des campagnes programmées).
export async function getCampaignLeadsQuery(
  organizationId: string,
  audienceId: string | null,
  rules: any
): Promise<{ where: any; fromAudience: boolean; audienceName?: string }> {
  // Mode AUDIENCE : leadIds depuis AudienceMember
  if (audienceId) {
    var audience = await prisma.audience.findFirst({
      where: { id: audienceId, organizationId: organizationId },
      select: { id: true, name: true, type: true },
    });
    if (!audience) throw new Error("Audience introuvable");
    if (audience.type === "DYNAMIC") {
      throw new Error("Les audiences dynamiques ne peuvent pas être utilisées pour les campagnes");
    }

    var members = await prisma.audienceMember.findMany({
      where: { audienceId: audienceId },
      select: { leadId: true },
    });
    var leadIds = members.map(function(m) { return m.leadId; });

    return {
      where: {
        organizationId: organizationId,
        id: { in: leadIds.length > 0 ? leadIds : ["__NO_LEADS__"] },
        isConverted: false,
      },
      fromAudience: true,
      audienceName: audience.name,
    };
  }

  // Mode RÈGLES (moteur récursif, rétrocompatible)
  var where = await buildLeadWhere(rules, organizationId);
  return { where: where, fromAudience: false };
}
