"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── LIMITES PAR PLAN ───
const PIPELINE_LIMITS: Record<string, number> = {
  FREE: 1,
  STARTER: 2,
  PRO: 5,
  ENTERPRISE: Number.MAX_SAFE_INTEGER,
};

function getPipelineLimit(plan: string): number {
  return PIPELINE_LIMITS[plan] || 1;
}

// ─── GET ALL PIPELINES + STAGES ───
export async function getPipelinesData() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });

  const pipelines = await prisma.pipeline.findMany({
    where: { organizationId: orgId },
    orderBy: [
      { isActive: "desc" },
      { isDefault: "desc" }, 
      { order: "asc" }, 
      { createdAt: "asc" }
    ],
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { leads: true } },
        },
      },
      _count: { select: { leads: true, programs: true } },
    },
  });

  const limit = getPipelineLimit(org?.plan || "STARTER");
  
  return {
    pipelines,
    plan: org?.plan || "STARTER",
    limit,
    canCreateMore: pipelines.length < limit,
  };
}

// ─── CREATE PIPELINE ───
export async function createPipeline(input: {
  name: string;
  description?: string;
  formationType?: "INITIAL" | "CONTINUE" | null;
  color?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  // Vérif limite plan
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const existingCount = await prisma.pipeline.count({ where: { organizationId: orgId } });
  const limit = getPipelineLimit(org?.plan || "STARTER");
  
  if (existingCount >= limit) {
    throw new Error(
      `Limite atteinte : votre plan ${org?.plan} autorise max ${limit} pipeline(s). ` +
      `Passez à un plan supérieur pour en créer davantage.`
    );
  }

  // Vérif nom unique
  const existing = await prisma.pipeline.findFirst({
    where: { organizationId: orgId, name: input.name.trim() },
  });
  if (existing) throw new Error("Un pipeline avec ce nom existe déjà");

  // Création
  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      formationType: input.formationType || null,
      color: input.color || "#3B82F6",
      order: existingCount,
      isDefault: existingCount === 0, // 1er pipeline = défaut auto
    },
  });

  // Créer les 5 étapes par défaut pour ce nouveau pipeline
  const defaultStages = [
    { name: "Nouveau", order: 1, color: "#3B82F6", isDefault: true, isWon: false, isLost: false },
    { name: "Contacté", order: 2, color: "#8B5CF6", isDefault: false, isWon: false, isLost: false },
    { name: "Qualifié", order: 3, color: "#F59E0B", isDefault: false, isWon: false, isLost: false },
    { name: "Inscrit", order: 4, color: "#10B981", isDefault: false, isWon: true, isLost: false },
    { name: "Perdu", order: 5, color: "#EF4444", isDefault: false, isWon: false, isLost: true },
  ];

  // Le @@unique([organizationId, order]) sur PipelineStage va nous gêner.
  // On utilise un offset pour le order qui prend en compte les stages existantes.
  const existingMaxOrder = await prisma.pipelineStage.findFirst({
    where: { organizationId: orgId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const offset = (existingMaxOrder?.order || 0);

  for (const stage of defaultStages) {
    await prisma.pipelineStage.create({
      data: {
        organizationId: orgId,
        pipelineId: pipeline.id,
        name: stage.name,
        order: offset + stage.order,
        color: stage.color,
        isDefault: stage.isDefault,
        isWon: stage.isWon,
        isLost: stage.isLost,
      },
    });
  }

  revalidatePath("/settings/pipelines");
  return { success: true, pipelineId: pipeline.id };
}

// ─── UPDATE PIPELINE ───
export async function updatePipeline(
  pipelineId: string,
  input: {
    name?: string;
    description?: string;
    formationType?: "INITIAL" | "CONTINUE" | null;
    color?: string;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId: session.user.organizationId },
  });
  if (!pipeline) throw new Error("Pipeline introuvable");

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.description !== undefined) updateData.description = input.description?.trim() || null;
  if (input.formationType !== undefined) updateData.formationType = input.formationType;
  if (input.color !== undefined) updateData.color = input.color;

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: updateData,
  });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

// ─── SET DEFAULT ───
export async function setDefaultPipeline(pipelineId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  // Démarque tous les pipelines comme non-défaut
  await prisma.pipeline.updateMany({
    where: { organizationId: orgId, isDefault: true },
    data: { isDefault: false },
  });

  // Marque celui-ci comme défaut
  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { isDefault: true },
  });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

// ─── DELETE PIPELINE ───
export async function deletePipeline(pipelineId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  // Garde : ne pas supprimer le seul pipeline restant
  const totalCount = await prisma.pipeline.count({ where: { organizationId: orgId } });
  if (totalCount <= 1) {
    throw new Error("Impossible de supprimer le dernier pipeline. Créez-en un autre d'abord.");
  }

  // Garde : pas supprimer s'il est référencé
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId: orgId },
    include: {
      _count: { select: { leads: true, programs: true } },
    },
  });
  if (!pipeline) throw new Error("Pipeline introuvable");

  if (pipeline._count.leads > 0 || pipeline._count.programs > 0) {
    throw new Error(
      `Impossible de supprimer : ${pipeline._count.leads} lead(s) et ${pipeline._count.programs} filière(s) sont rattachés à ce pipeline. ` +
      `Migrez-les vers un autre pipeline avant de supprimer.`
    );
  }

  // Si c'était le défaut, désigner un autre pipeline comme défaut
  if (pipeline.isDefault) {
    const other = await prisma.pipeline.findFirst({
      where: { organizationId: orgId, id: { not: pipelineId } },
      orderBy: { order: "asc" },
    });
    if (other) {
      await prisma.pipeline.update({
        where: { id: other.id },
        data: { isDefault: true },
      });
    }
  }

  // Suppression (les stages cascadent)
  await prisma.pipeline.delete({ where: { id: pipelineId } });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

// ─── STAGES CRUD (réutilisation logique existante) ───
export async function createStage(
  pipelineId: string,
  input: { name: string; color?: string; isWon?: boolean; isLost?: boolean }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId: orgId },
  });
  if (!pipeline) throw new Error("Pipeline introuvable");

  // Trouver le order max global de l'org
  const maxOrder = await prisma.pipelineStage.findFirst({
    where: { organizationId: orgId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (maxOrder?.order || 0) + 1;

  await prisma.pipelineStage.create({
    data: {
      organizationId: orgId,
      pipelineId: pipelineId,
      name: input.name.trim(),
      order: nextOrder,
      color: input.color || "#3B82F6",
      isWon: input.isWon || false,
      isLost: input.isLost || false,
      isDefault: false,
    },
  });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

export async function updateStage(
  stageId: string,
  input: { name?: string; color?: string; isWon?: boolean; isLost?: boolean }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId: session.user.organizationId },
  });
  if (!stage) throw new Error("Étape introuvable");

  const updateData: any = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.color !== undefined) updateData.color = input.color;
  if (input.isWon !== undefined) updateData.isWon = input.isWon;
  if (input.isLost !== undefined) updateData.isLost = input.isLost;

  await prisma.pipelineStage.update({
    where: { id: stageId },
    data: updateData,
  });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

export async function deleteStage(stageId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId: session.user.organizationId },
    include: { _count: { select: { leads: true } } },
  });
  if (!stage) throw new Error("Étape introuvable");
  if (stage._count.leads > 0) {
    throw new Error(`Impossible : ${stage._count.leads} lead(s) lié(s) à cette étape`);
  }

  await prisma.pipelineStage.delete({ where: { id: stageId } });

  revalidatePath("/settings/pipelines");
  return { success: true };
}

// ─── RÉORDONNER LES ÉTAPES ───
export async function reorderStages(pipelineId: string, stageIds: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  // Vérif que le pipeline appartient à l'org
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId: orgId },
  });
  if (!pipeline) throw new Error("Pipeline introuvable");

  // Trouver le order minimum existant pour le réutiliser comme base
  const allStages = await prisma.pipelineStage.findMany({
    where: { organizationId: orgId },
    orderBy: { order: "asc" },
  });
  const minOrder = allStages[0]?.order || 1;

  // Étape 1 : on déplace temporairement les stages cibles dans des orders négatifs
  // pour éviter le conflit avec @@unique([organizationId, order])
  for (let i = 0; i < stageIds.length; i++) {
    await prisma.pipelineStage.update({
      where: { id: stageIds[i] },
      data: { order: -1000 - i },
    });
  }

  // Étape 2 : on remet les bonnes valeurs
  // On utilise un offset pour préserver l'unicité de order entre pipelines
  const otherStagesMaxOrder = await prisma.pipelineStage.findFirst({
    where: { 
      organizationId: orgId,
      pipelineId: { not: pipelineId },
    },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const offset = (otherStagesMaxOrder?.order || 0) + 1;

  for (let i = 0; i < stageIds.length; i++) {
    await prisma.pipelineStage.update({
      where: { id: stageIds[i] },
      data: { order: offset + i },
    });
  }

  revalidatePath("/settings/pipelines");
  return { success: true };
}

// ─── TOGGLE ACTIVE ───
export async function toggleActivePipeline(pipelineId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  const orgId = session.user.organizationId;

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, organizationId: orgId },
  });
  if (!pipeline) throw new Error("Pipeline introuvable");

  // Garde : ne pas désactiver le pipeline par défaut
  if (pipeline.isDefault && pipeline.isActive) {
    throw new Error(
      "Impossible de désactiver le pipeline par défaut. Définissez d'abord un autre pipeline comme défaut."
    );
  }

  // Garde : ne pas désactiver le dernier pipeline actif
  if (pipeline.isActive) {
    const activeCount = await prisma.pipeline.count({
      where: { organizationId: orgId, isActive: true },
    });
    if (activeCount <= 1) {
      throw new Error(
        "Impossible de désactiver le dernier pipeline actif. Créez ou activez un autre pipeline d'abord."
      );
    }
  }

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { isActive: !pipeline.isActive },
  });

  revalidatePath("/settings/pipelines");
  revalidatePath("/pipeline");
  return { success: true };
}