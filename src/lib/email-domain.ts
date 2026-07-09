import { Resend } from "resend";

// ─── Wrapper autour de l'API Resend Domains ───
// La source de vérité des enregistrements DNS ET de leur statut est Resend.

const apiKey = process.env.RESEND_API_KEY;

export type DnsRecord = {
  purpose: string; // SPF | DKIM | DMARC (champ "record" côté Resend)
  type: string; // TXT | MX | CNAME
  name: string; // hôte
  value: string;
  priority?: number | null;
  status?: string; // not_started | pending | verified | failed
};

export type ResendDomainResult = {
  id: string;
  name: string;
  status: string; // not_started | pending | verified | failed | temporary_failure
  records: DnsRecord[];
};

function client(): Resend {
  if (!apiKey) throw new Error("RESEND_API_KEY manquant — configurez la clé Resend.");
  return new Resend(apiKey);
}

function normalizeRecords(records: any[]): DnsRecord[] {
  return (records || []).map((r: any) => ({
    purpose: r.record || "",
    type: r.type || "",
    name: r.name || "",
    value: r.value || "",
    priority: r.priority ?? null,
    status: r.status || "not_started",
  }));
}

// Sous-domaine dédié au suivi ouvertures/clics (CNAME → links1.resend-dns.com).
// Requis par Resend : les booléens open/click_tracking ne s'activent QUE si un
// sous-domaine de tracking est configuré (et vérifié pour que le suivi soit actif).
export const TRACKING_SUBDOMAIN = "track";

// Statut Resend → statut interne (PENDING | VERIFIED | FAILED)
export function mapStatus(resendStatus: string): "PENDING" | "VERIFIED" | "FAILED" {
  var s = (resendStatus || "").toLowerCase();
  if (s === "verified") return "VERIFIED";
  if (s === "failed" || s === "temporary_failure") return "FAILED";
  return "PENDING";
}

// Statut d'ENVOI d'un domaine. Nuance vs mapStatus : quand on active le suivi
// ouvertures/clics, Resend ajoute un CNAME de tracking et repasse le domaine en
// "partially_verified" tant que ce CNAME n'est pas ajouté au DNS. L'ENVOI reste
// pourtant pleinement fonctionnel (DKIM/SPF vérifiés) → on considère le domaine
// VERIFIED dès que le DKIM est vérifié, le CNAME de tracking pouvant rester en attente.
export function resolveSendingStatus(rd: ResendDomainResult): "PENDING" | "VERIFIED" | "FAILED" {
  const s = (rd.status || "").toLowerCase();
  if (s === "verified") return "VERIFIED";
  if (s === "failed" || s === "temporary_failure") return "FAILED";
  if (s === "partially_verified") {
    const isVer = (st?: string) => (st || "").toLowerCase() === "verified";
    const dkimOk = (rd.records || []).some((r) => r.purpose === "DKIM" && isVer(r.status));
    return dkimOk ? "VERIFIED" : "PENDING";
  }
  return "PENDING";
}

// Active le suivi des OUVERTURES et des CLICS sur un domaine d'ENVOI Resend.
// Sans ça, Resend n'insère ni le pixel de suivi ni la réécriture des liens →
// les campagnes affichent 0 ouverture / 0 clic (les délivrés/rebonds, eux,
// n'en dépendent pas). Le tracking est `false` par défaut à la création Resend,
// il faut donc l'activer explicitement. Best-effort : ne doit jamais casser le
// flux d'ajout/vérification de domaine.
export async function ensureSendingTracking(id: string): Promise<void> {
  try {
    // Le sous-domaine de tracking est obligatoire : sans lui, Resend ignore
    // silencieusement open/click_tracking (les booléens restent false).
    await client().domains.update({
      id,
      openTracking: true,
      clickTracking: true,
      trackingSubdomain: TRACKING_SUBDOMAIN,
    });
  } catch (e) {
    console.error("[email-domain] Activation du tracking Resend échouée pour", id, e);
  }
}

// Cherche un domaine déjà présent dans le compte Resend, sinon le crée.
// `enableTracking` = active le suivi ouvertures/clics (domaines d'ENVOI uniquement ;
// inutile pour le sous-domaine de réception "reply.<domaine>").
export async function findOrCreateResendDomain(domain: string, enableTracking = true): Promise<ResendDomainResult> {
  const resend = client();
  const target = domain.toLowerCase();

  // 1. Lister les domaines existants du compte (cas "déjà vérifié")
  try {
    const list: any = await resend.domains.list();
    const items: any[] = list?.data?.data || list?.data || [];
    const existing = items.find((d: any) => (d.name || "").toLowerCase() === target);
    if (existing?.id) {
      // Domaine déjà présent : on (ré)active le tracking au cas où il aurait été
      // créé avant l'ajout de cette option (auto-réparation des anciens domaines).
      if (enableTracking) await ensureSendingTracking(existing.id);
      return await getResendDomain(existing.id);
    }
  } catch {
    // La liste peut échouer selon les permissions — on tente la création.
  }

  // 2. Créer le domaine → Resend renvoie les enregistrements DNS à ajouter
  const created: any = await resend.domains.create(
    enableTracking
      ? { name: domain, openTracking: true, clickTracking: true, trackingSubdomain: TRACKING_SUBDOMAIN }
      : { name: domain }
  );
  if (created?.error || !created?.data) {
    throw new Error(created?.error?.message || "Création du domaine côté Resend échouée.");
  }
  const d = created.data;
  return {
    id: d.id,
    name: d.name,
    status: d.status || "not_started",
    records: normalizeRecords(d.records),
  };
}

export async function getResendDomain(id: string): Promise<ResendDomainResult> {
  const resend = client();
  const res: any = await resend.domains.get(id);
  if (res?.error || !res?.data) {
    throw new Error(res?.error?.message || "Domaine Resend introuvable.");
  }
  const d = res.data;
  return {
    id: d.id,
    name: d.name,
    status: d.status || "not_started",
    records: normalizeRecords(d.records),
  };
}

export async function verifyResendDomain(id: string): Promise<void> {
  const resend = client();
  try {
    await resend.domains.verify(id);
  } catch {
    // La vérification est asynchrone côté Resend — on relira le statut via getResendDomain.
  }
}

export async function removeResendDomain(id: string): Promise<void> {
  const resend = client();
  try {
    await resend.domains.remove(id);
  } catch {
    // best-effort
  }
}

// ─── Réception (Phase 2) ──────────────────────────────────────────────────
// La réception passe par un domaine Resend DISTINCT "reply.<domaine>" : on
// isole ainsi l'enregistrement MX sur le sous-domaine, sans jamais toucher au
// MX du domaine racine (messagerie existante de l'école préservée).

export const INBOUND_SUBDOMAIN = "reply";

export function inboundDomainFor(domain: string): string {
  return INBOUND_SUBDOMAIN + "." + domain.toLowerCase();
}

// Enregistrements à faire ajouter pour la réception : DKIM (vérification de propriété)
// + Receiving (MX). Le SPF ne concerne que l'envoi depuis ce sous-domaine, qu'on n'utilise
// pas → on ne l'impose pas à l'utilisateur.
export function inboundRecords(records: DnsRecord[]): DnsRecord[] {
  return (records || []).filter((r) => r.purpose === "DKIM" || r.purpose === "Receiving");
}

// Réception prête quand la PROPRIÉTÉ (DKIM) ET la RÉCEPTION (MX) sont vérifiées,
// indépendamment du SPF. Important : le `sending` doit rester ACTIVÉ côté Resend, sinon
// le DKIM n'est jamais vérifié (c'est un mécanisme de signature d'envoi) et tout le
// routage inbound reste bloqué.
export function inboundReady(records: DnsRecord[], domainStatus: string): "PENDING" | "VERIFIED" | "FAILED" {
  const isVer = (s?: string) => (s || "").toLowerCase() === "verified";
  const dkimOk = (records || []).some((r) => r.purpose === "DKIM" && isVer(r.status));
  const recvOk = (records || []).some((r) => r.purpose === "Receiving" && isVer(r.status));
  if (dkimOk && recvOk) return "VERIFIED";
  if ((domainStatus || "").toLowerCase() === "failed") return "FAILED";
  return "PENDING";
}

// Active la réception (et coupe l'envoi) sur un domaine Resend.
// `capabilities` n'est pas typé dans le SDK → appel REST direct pour garantir l'envoi du champ.
async function setResendCapabilities(id: string, capabilities: { sending?: "enabled" | "disabled"; receiving?: "enabled" | "disabled" }): Promise<void> {
  if (!apiKey) throw new Error("RESEND_API_KEY manquant — configurez la clé Resend.");
  const res = await fetch("https://api.resend.com/domains/" + id, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ capabilities }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error("Activation de la réception côté Resend échouée. " + detail);
  }
}

// Crée (ou réutilise) le domaine "reply.<domaine>" côté Resend, avec réception activée.
export async function findOrCreateInboundDomain(domain: string): Promise<ResendDomainResult> {
  const replyDomain = inboundDomainFor(domain);
  const rd = await findOrCreateResendDomain(replyDomain, false); // réception : pas de tracking
  // On active À LA FOIS l'envoi et la réception : le sending doit rester activé pour que
  // Resend vérifie le DKIM (preuve de propriété), sans quoi le domaine n'est jamais vérifié
  // et le routage inbound est bloqué. On n'envoie pas réellement depuis ce sous-domaine.
  await setResendCapabilities(rd.id, { sending: "enabled", receiving: "enabled" });
  // Relire pour récupérer les enregistrements générés (DKIM + Receiving).
  return await getResendDomain(rd.id);
}
