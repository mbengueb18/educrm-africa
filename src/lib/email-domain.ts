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

// Statut Resend → statut interne (PENDING | VERIFIED | FAILED)
export function mapStatus(resendStatus: string): "PENDING" | "VERIFIED" | "FAILED" {
  var s = (resendStatus || "").toLowerCase();
  if (s === "verified") return "VERIFIED";
  if (s === "failed" || s === "temporary_failure") return "FAILED";
  return "PENDING";
}

// Cherche un domaine déjà présent dans le compte Resend, sinon le crée.
export async function findOrCreateResendDomain(domain: string): Promise<ResendDomainResult> {
  const resend = client();
  const target = domain.toLowerCase();

  // 1. Lister les domaines existants du compte (cas "déjà vérifié")
  try {
    const list: any = await resend.domains.list();
    const items: any[] = list?.data?.data || list?.data || [];
    const existing = items.find((d: any) => (d.name || "").toLowerCase() === target);
    if (existing?.id) {
      return await getResendDomain(existing.id);
    }
  } catch {
    // La liste peut échouer selon les permissions — on tente la création.
  }

  // 2. Créer le domaine → Resend renvoie les enregistrements DNS à ajouter
  const created: any = await resend.domains.create({ name: domain });
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

// Ne garde que les enregistrements MX (réception) parmi les records renvoyés.
export function mxOnly(records: DnsRecord[]): DnsRecord[] {
  return (records || []).filter((r) => (r.type || "").toUpperCase() === "MX");
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

// Crée (ou réutilise) le domaine "reply.<domaine>" côté Resend, en mode réception seule.
export async function findOrCreateInboundDomain(domain: string): Promise<ResendDomainResult> {
  const replyDomain = inboundDomainFor(domain);
  const rd = await findOrCreateResendDomain(replyDomain);
  // Réception seule : un seul MX requis, pas de SPF/DKIM (pas d'envoi depuis ce sous-domaine).
  await setResendCapabilities(rd.id, { sending: "disabled", receiving: "enabled" });
  // Relire pour récupérer les enregistrements de réception (MX) générés.
  return await getResendDomain(rd.id);
}
