"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { canAccessFeature } from "@/lib/plans/checks";
import {
  findOrCreateResendDomain,
  getResendDomain,
  verifyResendDomain,
  removeResendDomain,
  findOrCreateInboundDomain,
  inboundRecords,
  inboundReady,
  mapStatus,
} from "@/lib/email-domain";

const RESERVED_DOMAINS = ["talibcrm.com"];
const DOMAIN_RE = /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    throw new Error("Réservé aux administrateurs");
  }
  return session;
}

// ─── Lecture : config + droit d'accès (plan) ───
export async function getEmailDomain() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const [config, gate, org] = await Promise.all([
    prisma.orgEmailDomain.findUnique({ where: { organizationId: session.user.organizationId } }),
    canAccessFeature(session.user.organizationId, "EMAIL_CUSTOM_DOMAIN"),
    prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { name: true } }),
  ]);

  return {
    config: config as any,
    canUse: gate.allowed,
    upgradeTarget: gate.upgradeTarget || null,
    orgName: org?.name || "",
  };
}

// ─── Ajout / rattachement d'un domaine ───
export async function addEmailDomain(data: { domain: string; fromLocalPart?: string; fromName?: string }) {
  const session = await requireAdmin();
  const organizationId = session.user.organizationId;

  const gate = await canAccessFeature(organizationId, "EMAIL_CUSTOM_DOMAIN");
  if (!gate.allowed) throw new Error("Fonctionnalité non incluse dans votre plan.");

  const domain = (data.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(domain)) throw new Error("Nom de domaine invalide (ex. bemtech.sn).");
  if (RESERVED_DOMAINS.some((r) => domain === r || domain.endsWith("." + r))) {
    throw new Error("Ce domaine est réservé et ne peut pas être utilisé.");
  }

  // Domaine déjà rattaché à une AUTRE organisation ?
  const taken = await prisma.orgEmailDomain.findUnique({ where: { domain } });
  if (taken && taken.organizationId !== organizationId) {
    throw new Error("Ce domaine est déjà utilisé par une autre organisation.");
  }

  const localPart = (data.fromLocalPart || "admission").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") || "admission";
  const fromName = (data.fromName || "").trim() || null;

  // Resend : réutilise si déjà présent (cas "déjà vérifié"), sinon crée
  const rd = await findOrCreateResendDomain(domain);
  const status = mapStatus(rd.status);

  const base = {
    domain,
    fromLocalPart: localPart,
    fromName,
    resendDomainId: rd.id,
    dnsRecords: rd.records as any,
    status,
    verifiedAt: status === "VERIFIED" ? new Date() : null,
  };

  await prisma.orgEmailDomain.upsert({
    where: { organizationId },
    create: { organizationId, ...base },
    update: base,
  });

  revalidatePath("/settings/email-domain");
  return { success: true, status };
}

// ─── Rafraîchir le statut depuis Resend ───
export async function refreshEmailDomainStatus() {
  const session = await requireAdmin();
  const config = await prisma.orgEmailDomain.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (!config?.resendDomainId) throw new Error("Aucun domaine à vérifier.");

  await verifyResendDomain(config.resendDomainId);
  const rd = await getResendDomain(config.resendDomainId);
  const status = mapStatus(rd.status);

  await prisma.orgEmailDomain.update({
    where: { organizationId: session.user.organizationId },
    data: {
      status,
      dnsRecords: rd.records as any,
      verifiedAt: status === "VERIFIED" ? (config.verifiedAt || new Date()) : null,
    },
  });

  revalidatePath("/settings/email-domain");
  return { success: true, status };
}

// ─── Modifier l'expéditeur (adresse locale + nom) ───
export async function updateEmailSender(data: { fromLocalPart?: string; fromName?: string }) {
  const session = await requireAdmin();
  const localPart = (data.fromLocalPart || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  await prisma.orgEmailDomain.update({
    where: { organizationId: session.user.organizationId },
    data: {
      ...(localPart ? { fromLocalPart: localPart } : {}),
      fromName: (data.fromName || "").trim() || null,
    },
  });
  revalidatePath("/settings/email-domain");
  return { success: true };
}

// ─── Retirer le domaine ───
export async function removeEmailDomain() {
  const session = await requireAdmin();
  const config = await prisma.orgEmailDomain.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (config?.resendDomainId) await removeResendDomain(config.resendDomainId);
  // Retire aussi le domaine de réception associé, le cas échéant.
  if (config?.inboundResendDomainId) await removeResendDomain(config.inboundResendDomainId);
  await prisma.orgEmailDomain.deleteMany({ where: { organizationId: session.user.organizationId } });
  revalidatePath("/settings/email-domain");
  return { success: true };
}

// ─── Réception (Phase 2) ───────────────────────────────────────────────────

// Activer la réception : crée le domaine "reply.<domaine>" côté Resend (réception seule).
export async function enableInbound() {
  const session = await requireAdmin();
  const organizationId = session.user.organizationId;

  const gate = await canAccessFeature(organizationId, "EMAIL_CUSTOM_DOMAIN");
  if (!gate.allowed) throw new Error("Fonctionnalité non incluse dans votre plan.");

  const config = await prisma.orgEmailDomain.findUnique({ where: { organizationId } });
  if (!config) throw new Error("Ajoutez d'abord un domaine d'envoi.");
  if (config.status !== "VERIFIED") throw new Error("Vérifiez d'abord votre domaine d'envoi.");

  const rd = await findOrCreateInboundDomain(config.domain);
  const status = inboundReady(rd.records, rd.status); // prêt quand DKIM + réception (MX) vérifiés

  await prisma.orgEmailDomain.update({
    where: { organizationId },
    data: {
      inboundResendDomainId: rd.id,
      inboundMxRecords: inboundRecords(rd.records) as any, // DKIM + Receiving (le SPF d'envoi n'est pas imposé)
      inboundStatus: status,
      inboundVerifiedAt: status === "VERIFIED" ? new Date() : null,
    },
  });

  revalidatePath("/settings/email-domain");
  return { success: true, status };
}

// Rafraîchir le statut de réception depuis Resend.
export async function refreshInboundStatus() {
  const session = await requireAdmin();
  const config = await prisma.orgEmailDomain.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (!config?.inboundResendDomainId) throw new Error("Réception non configurée.");

  // Lire d'abord l'état STABILISÉ (sans déclencher verify) : un POST /verify remet
  // transitoirement le DKIM en "pending", et une lecture immédiate capterait ce faux
  // "pending" (course de timing → statut bloqué "en attente" à chaque refresh).
  let rd = await getResendDomain(config.inboundResendDomainId);
  if (inboundReady(rd.records, rd.status) !== "VERIFIED") {
    // Pas encore prêt : on relance la vérification, on laisse Resend se stabiliser, puis on relit.
    await verifyResendDomain(config.inboundResendDomainId);
    await new Promise((r) => setTimeout(r, 4000));
    rd = await getResendDomain(config.inboundResendDomainId);
  }
  const status = inboundReady(rd.records, rd.status);

  await prisma.orgEmailDomain.update({
    where: { organizationId: session.user.organizationId },
    data: {
      inboundMxRecords: inboundRecords(rd.records) as any,
      inboundStatus: status,
      inboundVerifiedAt: status === "VERIFIED" ? (config.inboundVerifiedAt || new Date()) : null,
    },
  });

  revalidatePath("/settings/email-domain");
  return { success: true, status };
}

// Désactiver la réception : retire le domaine "reply.<domaine>" côté Resend et remet le repli global.
export async function disableInbound() {
  const session = await requireAdmin();
  const config = await prisma.orgEmailDomain.findUnique({
    where: { organizationId: session.user.organizationId },
  });
  if (config?.inboundResendDomainId) await removeResendDomain(config.inboundResendDomainId);

  await prisma.orgEmailDomain.update({
    where: { organizationId: session.user.organizationId },
    data: {
      inboundResendDomainId: null,
      inboundMxRecords: [] as any,
      inboundStatus: null,
      inboundVerifiedAt: null,
    },
  });

  revalidatePath("/settings/email-domain");
  return { success: true };
}
