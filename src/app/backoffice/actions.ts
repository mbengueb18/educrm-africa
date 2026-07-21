"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPlanLimits } from "@/lib/plans/config";
import { getBoSession, setBoCookie, clearBoCookie, createToken, type BoSession } from "@/lib/bo-auth";
import { supabaseAdmin } from "@/lib/supabase-storage";
import {
  CONTRACTS_BUCKET,
  buildDefaultContent,
  buildReference,
  isContractablePlan,
  normalizeContent,
  buildContractView,
  type ContractContent,
} from "@/lib/contracts/template";

const VALID_PLANS = ["ESSENTIEL", "CROISSANCE", "PERFORMANCE"] as const;
type PlanKey = (typeof VALID_PLANS)[number];
const BO_ROLES = ["OWNER", "ADMIN", "SUPPORT"] as const;

async function requireBo(): Promise<BoSession> {
  const s = await getBoSession();
  if (!s) throw new Error("Non authentifié");
  return s;
}
async function requireOwner(): Promise<BoSession> {
  const s = await requireBo();
  if (s.role !== "OWNER") throw new Error("Réservé au propriétaire du back-office");
  return s;
}

// ─── Auth ───
export async function boLogin(email: string, password: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: (email || "").trim().toLowerCase() } });
  if (!admin || !admin.isActive) return { success: false, error: "Identifiants invalides" };
  const ok = await bcrypt.compare(password || "", admin.passwordHash);
  if (!ok) return { success: false, error: "Identifiants invalides" };

  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await setBoCookie(createToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role }));
  return { success: true };
}

export async function boLogout() {
  await clearBoCookie();
  return { success: true };
}

// ─── Organisations ───
export async function getOrganizations() {
  await requireBo();
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, plan: true, planLockedUntil: true,
      aiAddonEnabled: true, createdAt: true,
      reportingCustomEnabled: true, reportingAiEnabled: true, chatbotAiEnabled: true,
      _count: { select: { users: true, leads: true } },
    },
  });
  const now = Date.now();
  return orgs.map((o) => {
    const expired = !!(o.planLockedUntil && o.planLockedUntil.getTime() < now);
    const effectivePlan = (expired ? "ESSENTIEL" : o.plan) as PlanKey;
    return {
      id: o.id, name: o.name, slug: o.slug, plan: o.plan, effectivePlan,
      trialUntil: o.planLockedUntil && !expired && o.plan !== "ESSENTIEL" ? o.planLockedUntil : null,
      aiAddonEnabled: o.aiAddonEnabled, createdAt: o.createdAt,
      reportingCustomEnabled: o.reportingCustomEnabled, reportingAiEnabled: o.reportingAiEnabled,
      chatbotAiEnabled: o.chatbotAiEnabled,
      users: o._count.users, maxUsers: getPlanLimits(effectivePlan).maxUsersTotal, leads: o._count.leads,
    };
  });
}

// Active/désactive les fonctionnalités reporting (rapports personnalisés / IA) par org
export async function setOrgReportingFeature(data: { orgId: string; feature: "custom" | "ai"; enabled: boolean }) {
  await requireBo();
  const field = data.feature === "ai" ? "reportingAiEnabled" : "reportingCustomEnabled";
  await prisma.organization.update({
    where: { id: data.orgId },
    data: { [field]: data.enabled },
  });
  return { ok: true };
}

// Active/désactive le chatbot IA (réponses depuis les documents) pour une org.
// Décision 100 % back-office : c'est ici qu'on choisit qui a droit à la feature.
export async function setOrgChatbotAi(data: { orgId: string; enabled: boolean }) {
  await requireBo();
  await prisma.organization.update({
    where: { id: data.orgId },
    data: { chatbotAiEnabled: data.enabled },
  });
  return { ok: true };
}

export async function changePlan(data: { orgId: string; plan: string; temporary?: boolean; durationDays?: number; note?: string }) {
  const s = await requireBo();
  if (!VALID_PLANS.includes(data.plan as PlanKey)) throw new Error("Plan invalide");
  const org = await prisma.organization.findUnique({ where: { id: data.orgId }, select: { plan: true } });
  if (!org) throw new Error("Organisation introuvable");

  const temporary = data.plan !== "ESSENTIEL" && !!data.temporary;
  const days = Math.max(1, Math.min(365, Number(data.durationDays) || 14));
  const until = temporary ? new Date(Date.now() + days * 86_400_000) : null;

  await prisma.organization.update({
    where: { id: data.orgId },
    data: { plan: data.plan as PlanKey, planChangedAt: new Date(), planLockedUntil: until },
  });
  await prisma.planChangeLog.create({
    data: { organizationId: data.orgId, changedById: s.id, fromPlan: org.plan, toPlan: data.plan, temporaryUntil: until, note: (data.note || "").trim() || null },
  });
  revalidatePath("/backoffice");
  return { success: true };
}

export async function getPlanChangeLogs(limit = 15) {
  await requireBo();
  return prisma.planChangeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { organization: { select: { name: true, slug: true } }, changedBy: { select: { name: true } } },
  });
}

// ─── Suppression d'une organisation (OWNER uniquement) — IRRÉVERSIBLE ───

const EMAIL_BUCKET = "email-attachments"; // pièces jointes leads, bibliothèque, PJ messages

// Supprime une liste de chemins d'un bucket, par lots. Best-effort : logge, ne throw pas.
async function removeStoragePaths(bucket: string, paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter((p): p is string => !!p)));
  for (let i = 0; i < clean.length; i += 900) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(clean.slice(i, i + 900));
    if (error) console.error(`[delete-org] remove ${bucket} échoué:`, error.message);
  }
}

// Supprime récursivement tout ce qui est sous un préfixe (ex. les PJ leads sous {orgId}/…).
async function removeStoragePrefix(bucket: string, prefix: string, depth = 0) {
  if (depth > 4) return; // garde-fou anti-récursion
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const files: string[] = [];
  for (const entry of data) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Un "dossier" Supabase n'a pas d'id/metadata → on descend ; sinon c'est un fichier.
    if (entry.id === null) await removeStoragePrefix(bucket, full, depth + 1);
    else files.push(full);
  }
  await removeStoragePaths(bucket, files);
}

/**
 * Supprime définitivement une organisation et TOUTES ses données.
 * - Base : transaction (documents étudiants/leads, formulaires, bibliothèque, notifications
 *   n'ont pas de cascade FK → suppression explicite ; l'org.delete() cascade tout le reste).
 * - Stockage Supabase : best-effort (contrats, bibliothèque, PJ messages, préfixe {orgId}).
 * - NON couvert : les documents étudiants (cartes/diplômes) sont sur Vercel Blob/R2.
 *
 * Sécurité : OWNER uniquement + confirmation par saisie du nom exact de l'org.
 * Retourne { success, error?, warning? } (pas de throw → messages lisibles en prod).
 */
export async function deleteOrganization(data: { orgId: string; confirmName: string }): Promise<{ success: boolean; error?: string; warning?: string }> {
  const s = await getBoSession();
  if (!s) return { success: false, error: "Non authentifié" };
  if (s.role !== "OWNER") return { success: false, error: "Seul le propriétaire du back-office peut supprimer une organisation" };

  const org = await prisma.organization.findUnique({ where: { id: data.orgId }, select: { id: true, name: true } });
  if (!org) return { success: false, error: "Organisation introuvable" };
  if ((data.confirmName || "").trim() !== org.name) {
    return { success: false, error: "Le nom saisi ne correspond pas — suppression annulée" };
  }

  // 1) Collecte des chemins de stockage AVANT de supprimer les lignes qui les portent.
  const [contracts, libDocs, msgAtts] = await Promise.all([
    prisma.contract.findMany({ where: { organizationId: org.id, signedPath: { not: null } }, select: { signedPath: true } }),
    prisma.libraryDocument.findMany({ where: { organizationId: org.id }, select: { path: true } }),
    prisma.messageAttachment.findMany({ where: { storagePath: { not: null }, message: { organizationId: org.id } }, select: { storagePath: true } }),
  ]);

  // 2) Base — transaction. Les 4 modèles sans cascade FK d'abord, puis l'org (cascade le reste).
  try {
    await prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({ where: { OR: [{ lead: { organizationId: org.id } }, { student: { organizationId: org.id } }] } });
      await tx.form.deleteMany({ where: { organizationId: org.id } }); // cascade FormSubmission
      await tx.libraryDocument.deleteMany({ where: { organizationId: org.id } });
      await tx.notification.deleteMany({ where: { organizationId: org.id } });
      await tx.organization.delete({ where: { id: org.id } });
    }, { timeout: 30_000, maxWait: 10_000 });
  } catch (err: any) {
    console.error("[delete-org] échec suppression base:", err?.message);
    return { success: false, error: "La suppression a échoué. Aucune donnée n'a été supprimée." };
  }

  // 3) Stockage Supabase — best-effort, hors transaction, jamais bloquant.
  let warning: string | undefined;
  try {
    await removeStoragePaths(CONTRACTS_BUCKET, contracts.map((c) => c.signedPath));
    await removeStoragePaths(EMAIL_BUCKET, [...libDocs.map((d) => d.path), ...msgAtts.map((a) => a.storagePath)]);
    await removeStoragePrefix(EMAIL_BUCKET, org.id); // PJ leads sous {orgId}/{leadId}/…
  } catch (err: any) {
    console.error("[delete-org] nettoyage stockage:", err?.message);
    warning = "Organisation supprimée, mais le nettoyage de certains fichiers a échoué (voir logs).";
  }

  revalidatePath("/backoffice");
  return { success: true, warning };
}

// ─── Gestion des admins du back-office (OWNER uniquement) ───
export async function getPlatformAdmins() {
  await requireBo();
  return prisma.platformAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

export async function createPlatformAdmin(data: { email: string; name: string; role: string; password: string }) {
  await requireOwner();
  const email = (data.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email invalide");
  if (!data.name?.trim()) throw new Error("Nom requis");
  if (!BO_ROLES.includes(data.role as any)) throw new Error("Rôle invalide");
  if (!data.password || data.password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");

  const exists = await prisma.platformAdmin.findUnique({ where: { email } });
  if (exists) throw new Error("Un admin avec cet email existe déjà");

  await prisma.platformAdmin.create({
    data: { email, name: data.name.trim(), role: data.role, passwordHash: await bcrypt.hash(data.password, 10) },
  });
  revalidatePath("/backoffice/admins");
  return { success: true };
}

export async function updatePlatformAdmin(id: string, data: { role?: string; isActive?: boolean; name?: string }) {
  const s = await requireOwner();
  const target = await prisma.platformAdmin.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new Error("Admin introuvable");

  // Ne pas se rétrograder/désactiver soi-même s'il ne reste qu'un OWNER actif
  if (id === s.id && (data.role && data.role !== "OWNER" || data.isActive === false)) {
    const owners = await prisma.platformAdmin.count({ where: { role: "OWNER", isActive: true } });
    if (owners <= 1) throw new Error("Impossible : vous êtes le dernier propriétaire actif");
  }
  if (data.role && !BO_ROLES.includes(data.role as any)) throw new Error("Rôle invalide");

  await prisma.platformAdmin.update({
    where: { id },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    },
  });
  revalidatePath("/backoffice/admins");
  return { success: true };
}

export async function resetPlatformAdminPassword(id: string, password: string) {
  await requireOwner();
  if (!password || password.length < 8) throw new Error("Mot de passe : 8 caractères minimum");
  await prisma.platformAdmin.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { success: true };
}

export async function deletePlatformAdmin(id: string) {
  const s = await requireOwner();
  if (id === s.id) throw new Error("Vous ne pouvez pas vous supprimer vous-même");
  await prisma.platformAdmin.delete({ where: { id } });
  revalidatePath("/backoffice/admins");
  return { success: true };
}

// ─── Contrats ───
export async function getContracts() {
  await requireBo();
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true, slug: true } } },
  });
  return contracts.map((c) => ({
    id: c.id,
    reference: c.reference,
    plan: c.plan,
    status: c.status,
    orgName: c.organization.name,
    orgSlug: c.organization.slug,
    allowedCount: c.allowedUserIds.length,
    signedFileName: c.signedFileName,
    signedSize: c.signedSize,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    uploadedByName: c.uploadedByName,
    validatedAt: c.validatedAt ? c.validatedAt.toISOString() : null,
    validatedBy: c.validatedBy,
    hasFile: !!c.signedPath,
    createdAt: c.createdAt.toISOString(),
  }));
}

/** Organisations éligibles à un contrat (offres payantes), avec indicateur d'existant. */
export async function getContractableOrgs() {
  await requireBo();
  const orgs = await prisma.organization.findMany({
    where: { plan: { in: ["CROISSANCE", "PERFORMANCE"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, plan: true, _count: { select: { contracts: true } } },
  });
  return orgs.map((o) => ({ id: o.id, name: o.name, plan: o.plan, contractCount: o._count.contracts }));
}

/** Crée un contrat BROUILLON pour une org, pré-rempli depuis le template. */
export async function createContractForOrg(orgId: string) {
  await requireBo();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, plan: true, billingCycle: true },
  });
  if (!org) throw new Error("Organisation introuvable");
  if (!isContractablePlan(org.plan)) throw new Error("Cette organisation n'est pas sur une offre payante");

  const seq = (await prisma.contract.count({ where: { plan: org.plan } })) + 1;
  const content = buildDefaultContent(org.plan, org.name);
  const created = await prisma.contract.create({
    data: {
      organizationId: org.id,
      plan: org.plan,
      billingCycle: org.billingCycle,
      reference: buildReference(org.plan, seq),
      status: "BROUILLON",
      content: content as any,
    },
  });
  revalidatePath("/backoffice/contrats");
  return { id: created.id };
}

/** Détail d'un contrat pour l'éditeur BO : contenu + utilisateurs de l'org. */
export async function getContractDetail(id: string) {
  await requireBo();
  const c = await prisma.contract.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });
  if (!c) throw new Error("Contrat introuvable");

  const users = await prisma.user.findMany({
    where: { organizationId: c.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return {
    id: c.id,
    reference: c.reference,
    plan: c.plan,
    status: c.status,
    orgName: c.organization.name,
    content: normalizeContent(c.content, c.plan, c.organization.name),
    view: buildContractView(c.plan),
    allowedUserIds: c.allowedUserIds,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    validatedAt: c.validatedAt ? c.validatedAt.toISOString() : null,
    users,
    locked: c.status === "SIGNE_RECU" || c.status === "VALIDE",
  };
}

/** Enregistre le contenu et/ou les utilisateurs désignés (tant que non signé). */
export async function updateContract(id: string, data: { content?: ContractContent; allowedUserIds?: string[] }) {
  await requireBo();
  const c = await prisma.contract.findUnique({ where: { id }, select: { status: true } });
  if (!c) throw new Error("Contrat introuvable");
  if (c.status === "SIGNE_RECU" || c.status === "VALIDE") {
    throw new Error("Contrat signé : contenu et accès ne sont plus modifiables");
  }
  await prisma.contract.update({
    where: { id },
    data: {
      ...(data.content !== undefined ? { content: data.content as any } : {}),
      ...(data.allowedUserIds !== undefined ? { allowedUserIds: data.allowedUserIds } : {}),
    },
  });
  revalidatePath("/backoffice/contrats");
  return { success: true };
}

/** Publie le contrat : BROUILLON → A_SIGNER (visible dans le CRM des désignés). */
export async function publishContract(id: string) {
  await requireBo();
  const c = await prisma.contract.findUnique({ where: { id }, select: { status: true, allowedUserIds: true } });
  if (!c) throw new Error("Contrat introuvable");
  if (c.status !== "BROUILLON") throw new Error("Seul un brouillon peut être publié");
  if (c.allowedUserIds.length === 0) throw new Error("Désignez au moins un utilisateur avant de publier");
  await prisma.contract.update({ where: { id }, data: { status: "A_SIGNER" } });
  revalidatePath("/backoffice/contrats");
  return { success: true };
}

/** Repasse en brouillon (retire du CRM), tant que le contrat n'est pas signé. */
export async function unpublishContract(id: string) {
  await requireBo();
  const c = await prisma.contract.findUnique({ where: { id }, select: { status: true } });
  if (!c) throw new Error("Contrat introuvable");
  if (c.status !== "A_SIGNER") throw new Error("Ce contrat ne peut plus repasser en brouillon");
  await prisma.contract.update({ where: { id }, data: { status: "BROUILLON" } });
  revalidatePath("/backoffice/contrats");
  return { success: true };
}

export async function getBoContractSignedUrl(id: string) {
  await requireBo();
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new Error("Contrat introuvable");
  if (!contract.signedPath) throw new Error("Aucun contrat signé n'a encore été déposé");
  const { data, error } = await supabaseAdmin.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(contract.signedPath, 60 * 60, { download: contract.signedFileName || `${contract.reference}.pdf` });
  if (error || !data?.signedUrl) throw new Error("Impossible de générer le lien");
  return { url: data.signedUrl };
}

export async function validateContract(id: string) {
  const s = await requireBo();
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) throw new Error("Contrat introuvable");
  if (contract.status !== "SIGNE_RECU") throw new Error("Seul un contrat signé et reçu peut être validé");
  await prisma.contract.update({
    where: { id },
    data: { status: "VALIDE", validatedAt: new Date(), validatedBy: s.name || s.email },
  });
  revalidatePath("/backoffice/contrats");
  return { success: true };
}
