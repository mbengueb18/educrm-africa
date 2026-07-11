"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { buildContractView, normalizeContent, CONTRACTS_BUCKET } from "@/lib/contracts/template";
import type { Plan } from "@/lib/plans/types";

// Statuts visibles côté CRM (le BROUILLON reste au back-office).
const CRM_VISIBLE_STATUSES = ["A_SIGNER", "SIGNE_RECU", "VALIDE"];

function serialize(c: {
  id: string; reference: string; plan: Plan; status: string;
  signedFileName: string | null; signedSize: number | null; signedAt: Date | null;
  uploadedByName: string | null; validatedAt: Date | null; createdAt: Date;
}) {
  return {
    id: c.id,
    reference: c.reference,
    plan: c.plan,
    status: c.status,
    signedFileName: c.signedFileName,
    signedSize: c.signedSize,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    uploadedByName: c.uploadedByName,
    validatedAt: c.validatedAt ? c.validatedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Contrat accessible à l'utilisateur courant : publié (statut visible) par le
 * back-office ET l'utilisateur figure parmi les personnes désignées. Sinon null.
 */
export async function getMyContract() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const contract = await prisma.contract.findFirst({
    where: {
      organizationId: session.user.organizationId,
      status: { in: CRM_VISIBLE_STATUSES as any },
      allowedUserIds: { has: session.user.id },
    },
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true } } },
  });

  if (!contract) return { hasAccess: false as const };

  return {
    hasAccess: true as const,
    orgName: contract.organization.name,
    contract: serialize(contract),
    view: buildContractView(contract.plan),
    content: normalizeContent(contract.content, contract.plan, contract.organization.name),
  };
}

/** Pour la sidebar : l'utilisateur a-t-il un contrat accessible ? */
export async function hasAccessibleContract(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const n = await prisma.contract.count({
    where: {
      organizationId: session.user.organizationId,
      status: { in: CRM_VISIBLE_STATUSES as any },
      allowedUserIds: { has: session.user.id },
    },
  });
  return n > 0;
}

/** URL signée (1h) pour télécharger le PDF signé — réservé aux utilisateurs désignés. */
export async function getSignedContractUrl(contractId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (
    !contract ||
    contract.organizationId !== session.user.organizationId ||
    !contract.allowedUserIds.includes(session.user.id)
  ) {
    throw new Error("Contrat introuvable");
  }
  if (!contract.signedPath) throw new Error("Aucun contrat signé n'a encore été déposé");

  const { data, error } = await supabaseAdmin.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(contract.signedPath, 60 * 60, { download: contract.signedFileName || "contrat-signe.pdf" });
  if (error || !data?.signedUrl) throw new Error("Impossible de générer le lien de téléchargement");
  return { url: data.signedUrl };
}
