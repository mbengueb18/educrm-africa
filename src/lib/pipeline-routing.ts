import { prisma } from "@/lib/prisma";

/**
 * Détermine le pipeline cible pour un lead à créer.
 * Logique :
 *  - 0 pipeline actif → null (cas edge)
 *  - 1 pipeline actif → ce pipeline (tous les leads y vont)
 *  - 2+ pipelines actifs :
 *      1. Si programId fourni et son pipelineId est actif → ce pipeline
 *      2. Sinon, match par formationType de la filière
 *      3. Sinon, pipeline par défaut actif
 *      4. Sinon, premier pipeline actif (fallback)
 */
export async function determinePipelineForLead(
  organizationId: string,
  programId: string | null
): Promise<string | null> {
  const activePipelines = await prisma.pipeline.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, formationType: true, isDefault: true, order: true },
    orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  if (activePipelines.length === 0) return null;
  if (activePipelines.length === 1) return activePipelines[0].id;

  // 2+ pipelines : on essaie de matcher selon le programId
  if (programId) {
    const program = await prisma.program.findFirst({
      where: { id: programId, organizationId },
      select: { pipelineId: true, formationType: true },
    });

    // 1. pipelineId explicite sur la filière
    if (program?.pipelineId) {
      const matchById = activePipelines.find(function(p) { return p.id === program.pipelineId; });
      if (matchById) return matchById.id;
    }

    // 2. Match par formationType de la filière
    if (program?.formationType) {
      const matchByType = activePipelines.find(function(p) { return p.formationType === program.formationType; });
      if (matchByType) return matchByType.id;
    }
  }

  // 3. Pipeline par défaut (déjà trié en première position par orderBy)
  const defaultPipeline = activePipelines.find(function(p) { return p.isDefault; });
  if (defaultPipeline) return defaultPipeline.id;

  // 4. Fallback ultime : premier pipeline actif
  return activePipelines[0].id;
}

/**
 * Récupère le stageId par défaut d'un pipeline.
 * - Cherche l'étape isDefault=true du pipeline
 * - Sinon prend la 1ère étape (order min)
 */
export async function getDefaultStageForPipeline(
  pipelineId: string,
  organizationId: string
): Promise<string | null> {
  // 1. Essayer l'étape isDefault du pipeline
  const defaultStage = await prisma.pipelineStage.findFirst({
    where: { pipelineId, organizationId, isDefault: true },
    select: { id: true },
  });
  if (defaultStage) return defaultStage.id;

  // 2. Sinon, première étape (order min) du pipeline
  const firstStage = await prisma.pipelineStage.findFirst({
    where: { pipelineId, organizationId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return firstStage?.id || null;
}

/**
 * Helper combiné — retourne le pipelineId et le stageId pour un nouveau lead.
 * Utilise un fallback global si rien ne match (ancien comportement).
 */
export async function getLeadRouting(
  organizationId: string,
  programId: string | null
): Promise<{ pipelineId: string | null; stageId: string | null }> {
  // 1. Déterminer le pipeline cible
  const pipelineId = await determinePipelineForLead(organizationId, programId);

  if (!pipelineId) {
    // Cas edge : aucun pipeline actif
    return { pipelineId: null, stageId: null };
  }

  // 2. Trouver le stage par défaut DE CE PIPELINE
  let stageId = await getDefaultStageForPipeline(pipelineId, organizationId);

  // 3. Si ce pipeline n'a aucun stage (cas anormal), créer/récupérer un stage de fallback
  if (!stageId) {
    // On cherche n'importe quel stage de l'org rattaché à un pipeline actif
    const anyStage = await prisma.pipelineStage.findFirst({
      where: { 
        organizationId, 
        pipelineId: pipelineId,
      },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    stageId = anyStage?.id || null;
  }

  return { pipelineId, stageId };
}