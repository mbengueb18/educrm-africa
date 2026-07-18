"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Filtres sérialisés d'une vue enregistrée (miroir de l'état de la liste des prospects).
export interface LeadViewFilters {
  search?: string;
  stage?: string;
  source?: string;
  assigned?: string;
  program?: string;
  campus?: string;
  mine?: boolean;
  toQualify?: boolean;
  advanced?: any; // FilterGroup
}

export interface LeadViewInput {
  name: string;
  pipelineId?: string | null;
  filters?: LeadViewFilters;
  columns?: string[];
  sortKey?: string | null;
  sortDir?: "asc" | "desc" | null;
  isPinned?: boolean;
}

export interface LeadViewDTO {
  id: string;
  name: string;
  pipelineId: string | null;
  filters: LeadViewFilters;
  columns: string[];
  sortKey: string | null;
  sortDir: "asc" | "desc" | null;
  isPinned: boolean;
}

function toDTO(v: any): LeadViewDTO {
  return {
    id: v.id,
    name: v.name,
    pipelineId: v.pipelineId ?? null,
    filters: (v.filters as LeadViewFilters) || {},
    columns: Array.isArray(v.columns) ? v.columns : [],
    sortKey: v.sortKey ?? null,
    sortDir: (v.sortDir as "asc" | "desc" | null) ?? null,
    isPinned: !!v.isPinned,
  };
}

// Liste les vues de l'utilisateur courant (optionnellement filtrées par pipeline).
export async function listLeadViews(
  pipelineId?: string | null
): Promise<{ ok: true; views: LeadViewDTO[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  try {
    const views = await prisma.leadView.findMany({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        ...(pipelineId ? { OR: [{ pipelineId }, { pipelineId: null }] } : {}),
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });
    return { ok: true, views: views.map(toDTO) };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erreur lors du chargement des vues" };
  }
}

export async function createLeadView(
  input: LeadViewInput
): Promise<{ ok: true; view: LeadViewDTO } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const name = (input.name || "").trim();
  if (!name) return { ok: false, error: "Le nom de la vue est requis" };
  if (name.length > 60) return { ok: false, error: "Nom trop long (60 caractères max)" };

  try {
    const view = await prisma.leadView.create({
      data: {
        name,
        organizationId: session.user.organizationId,
        userId: session.user.id,
        pipelineId: input.pipelineId ?? null,
        filters: (input.filters ?? {}) as any,
        columns: input.columns ?? [],
        sortKey: input.sortKey ?? null,
        sortDir: input.sortDir ?? null,
        isPinned: input.isPinned ?? false,
      },
    });
    return { ok: true, view: toDTO(view) };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erreur lors de la création de la vue" };
  }
}

export async function updateLeadView(
  id: string,
  input: LeadViewInput
): Promise<{ ok: true; view: LeadViewDTO } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  try {
    // Garantit que la vue appartient bien à l'utilisateur courant.
    const existing = await prisma.leadView.findFirst({
      where: { id, organizationId: session.user.organizationId, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Vue introuvable" };

    const name = input.name !== undefined ? (input.name || "").trim() : undefined;
    if (name !== undefined && !name) return { ok: false, error: "Le nom de la vue est requis" };
    if (name !== undefined && name.length > 60) return { ok: false, error: "Nom trop long (60 caractères max)" };

    const view = await prisma.leadView.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(input.pipelineId !== undefined ? { pipelineId: input.pipelineId } : {}),
        ...(input.filters !== undefined ? { filters: input.filters as any } : {}),
        ...(input.columns !== undefined ? { columns: input.columns } : {}),
        ...(input.sortKey !== undefined ? { sortKey: input.sortKey } : {}),
        ...(input.sortDir !== undefined ? { sortDir: input.sortDir } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      },
    });
    return { ok: true, view: toDTO(view) };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erreur lors de la mise à jour de la vue" };
  }
}

export async function deleteLeadView(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  try {
    const result = await prisma.leadView.deleteMany({
      where: { id, organizationId: session.user.organizationId, userId: session.user.id },
    });
    if (result.count === 0) return { ok: false, error: "Vue introuvable" };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erreur lors de la suppression de la vue" };
  }
}

export async function togglePinLeadView(
  id: string,
  isPinned: boolean
): Promise<{ ok: true; view: LeadViewDTO } | { ok: false; error: string }> {
  return updateLeadView(id, { name: undefined as any, isPinned });
}
