"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStages() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.pipelineStage.findMany({
    where: { organizationId: session.user.organizationId },
    include: { _count: { select: { leads: true } } },
    orderBy: { order: "asc" },
  });
}

export async function createStage(data: { name: string; color: string }) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  var orgId = session.user.organizationId;

  var maxStage = await prisma.pipelineStage.findFirst({
    where: { organizationId: orgId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.pipelineStage.create({
    data: {
      name: data.name.trim(),
      color: data.color,
      order: (maxStage?.order || 0) + 1,
      isDefault: false, isWon: false, isLost: false,
      organizationId: orgId,
    },
  });

  revalidatePath("/settings/pipeline");
  revalidatePath("/pipeline");
  return { success: true };
}

export async function updateStage(stageId: string, data: {
  name?: string; color?: string; isDefault?: boolean; isLost?: boolean;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  var orgId = session.user.organizationId;
  var updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.color !== undefined) updateData.color = data.color;

  if (data.isDefault === true) {
    await prisma.pipelineStage.updateMany({
      where: { organizationId: orgId, isDefault: true },
      data: { isDefault: false },
    });
    updateData.isDefault = true;
  }

  if (data.isLost === true) {
    await prisma.pipelineStage.updateMany({
      where: { organizationId: orgId, isLost: true },
      data: { isLost: false },
    });
    updateData.isLost = true;
    updateData.isDefault = false;
  }
  if (data.isLost === false) updateData.isLost = false;

  await prisma.pipelineStage.update({ where: { id: stageId }, data: updateData });

  revalidatePath("/settings/pipeline");
  revalidatePath("/pipeline");
  return { success: true };
}

export async function deleteStage(stageId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  var orgId = session.user.organizationId;

  var stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, organizationId: orgId },
    include: { _count: { select: { leads: true } } },
  });

  if (!stage) throw new Error("Étape introuvable");
  if (stage._count.leads > 0) throw new Error("Impossible de supprimer : " + stage._count.leads + " lead(s) dans cette étape. Déplacez-les d'abord.");
  if (stage.isDefault) throw new Error("Impossible de supprimer l'étape par défaut.");

  await prisma.pipelineStage.delete({ where: { id: stageId } });

  var remaining = await prisma.pipelineStage.findMany({
    where: { organizationId: orgId },
    orderBy: { order: "asc" },
  });
  for (var i = 0; i < remaining.length; i++) {
    if (remaining[i].order !== i + 1) {
      await prisma.pipelineStage.update({ where: { id: remaining[i].id }, data: { order: i + 1 } });
    }
  }

  revalidatePath("/settings/pipeline");
  revalidatePath("/pipeline");
  return { success: true };
}

export async function reorderStages(stageIds: string[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  for (var i = 0; i < stageIds.length; i++) {
    await prisma.pipelineStage.update({ where: { id: stageIds[i] }, data: { order: i + 1 } });
  }

  revalidatePath("/settings/pipeline");
  revalidatePath("/pipeline");
  return { success: true };
}