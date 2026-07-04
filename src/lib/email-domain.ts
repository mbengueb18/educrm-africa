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
