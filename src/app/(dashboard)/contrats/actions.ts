"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { buildContractView, buildReference, isContractablePlan, CONTRACTS_BUCKET } from "@/lib/contracts/template";
import type { Plan } from "@/lib/plans/types";

// ── Accès à l'espace Contrats ────────────────────────────────────────────────
// Point unique de contrôle : seuls ces rôles peuvent consulter / générer /
// uploader un contrat. (Choix à figer plus tard côté back-office.)
const CONTRACT_ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

function canManageContracts(role: string): boolean {
  return (CONTRACT_ADMIN_ROLES as readonly string[]).includes(role);
}

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
 * Récupère (ou crée) le contrat de l'organisation courante pour son plan actif.
 * Retourne aussi la vue d'affichage (tarifs / limites) issue de config.ts.
 */
export async function getOrCreateContract() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (!canManageContracts(session.user.role)) {
    return { allowed: false as const };
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { id: true, name: true, plan: true, billingCycle: true },
  });
  if (!org) throw new Error("Organisation introuvable");

  if (!isContractablePlan(org.plan)) {
    return { allowed: true as const, contractable: false as const, orgName: org.name, plan: org.plan };
  }

  let contract = await prisma.contract.findFirst({
    where: { organizationId: org.id, plan: org.plan },
    orderBy: { createdAt: "desc" },
  });

  if (!contract) {
    const seq = (await prisma.contract.count({ where: { plan: org.plan } })) + 1;
    try {
      contract = await prisma.contract.create({
        data: {
          organizationId: org.id,
          plan: org.plan,
          billingCycle: org.billingCycle,
          reference: buildReference(org.plan, seq),
          status: "A_SIGNER",
        },
      });
    } catch {
      // Collision de référence (rare, création concurrente) → on relit.
      contract = await prisma.contract.findFirst({
        where: { organizationId: org.id, plan: org.plan },
        orderBy: { createdAt: "desc" },
      });
      if (!contract) throw new Error("Impossible de générer le contrat");
    }
  }

  return {
    allowed: true as const,
    contractable: true as const,
    orgName: org.name,
    contract: serialize(contract),
    view: buildContractView(org.plan),
  };
}

/** URL signée (1h) pour télécharger le PDF signé de l'org courante. */
export async function getSignedContractUrl(contractId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (!canManageContracts(session.user.role)) throw new Error("Accès refusé");

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract || contract.organizationId !== session.user.organizationId) {
    throw new Error("Contrat introuvable");
  }
  if (!contract.signedPath) throw new Error("Aucun contrat signé n'a encore été déposé");

  const { data, error } = await supabaseAdmin.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(contract.signedPath, 60 * 60, { download: contract.signedFileName || "contrat-signe.pdf" });
  if (error || !data?.signedUrl) throw new Error("Impossible de générer le lien de téléchargement");
  return { url: data.signedUrl };
}
