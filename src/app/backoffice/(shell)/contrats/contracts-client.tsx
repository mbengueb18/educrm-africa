"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Download, ShieldCheck, Clock, FileCheck2, Loader2, FileText, Plus, X, Pencil, FileEdit } from "lucide-react";
import { getBoContractSignedUrl, validateContract, getContractableOrgs, createContractForOrg } from "../../actions";

type Contract = {
  id: string; reference: string; plan: string; status: string;
  orgName: string; orgSlug: string; allowedCount: number;
  signedFileName: string | null; signedSize: number | null; signedAt: string | null;
  uploadedByName: string | null; validatedAt: string | null; validatedBy: string | null;
  hasFile: boolean; createdAt: string;
};

const PLAN_META: Record<string, { label: string; cls: string }> = {
  CROISSANCE: { label: "Croissance", cls: "bg-brand-50 text-brand-700" },
  PERFORMANCE: { label: "Performance", cls: "bg-violet-50 text-violet-700" },
  ESSENTIEL: { label: "Essentiel", cls: "bg-gray-100 text-gray-600" },
};
const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-600", icon: FileEdit },
  A_SIGNER: { label: "Publié — à signer", cls: "bg-amber-50 text-amber-700", icon: Clock },
  SIGNE_RECU: { label: "Signé — reçu", cls: "bg-blue-50 text-blue-700", icon: FileCheck2 },
  VALIDE: { label: "Validé", cls: "bg-emerald-50 text-emerald-700", icon: ShieldCheck },
};
const FILTERS = [
  { k: "", l: "Tous" },
  { k: "BROUILLON", l: "Brouillons" },
  { k: "A_SIGNER", l: "Publiés" },
  { k: "SIGNE_RECU", l: "À valider" },
  { k: "VALIDE", l: "Validés" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function ContractsClient({ contracts }: { contracts: Contract[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => contracts.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(c.orgName.toLowerCase().includes(q) || c.reference.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [contracts, search, statusFilter]);

  const counts = useMemo(() => ({
    total: contracts.length,
    draft: contracts.filter((c) => c.status === "BROUILLON").length,
    toValidate: contracts.filter((c) => c.status === "SIGNE_RECU").length,
    valid: contracts.filter((c) => c.status === "VALIDE").length,
  }), [contracts]);

  const download = (id: string) => startTransition(async () => {
    try { const r = await getBoContractSignedUrl(id); window.open(r.url, "_blank"); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  });
  const validate = (id: string, org: string) => {
    if (!confirm(`Valider le contrat de « ${org} » ? Il sera verrouillé (plus modifiable).`)) return;
    startTransition(async () => {
      try { await validateContract(id); toast.success("Contrat validé"); router.refresh(); }
      catch (e: any) { toast.error(e?.message || "Erreur"); }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contrats</h1>
        <button onClick={() => setNewOpen(true)} className="btn-primary py-2 px-4 text-sm"><Plus size={15} /> Nouveau contrat</button>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-5">Rédigez le contrat, désignez les utilisateurs autorisés, publiez-le vers le CRM, puis validez le signé reçu.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={counts.total} />
        <Stat label="Brouillons" value={counts.draft} color="text-gray-600" />
        <Stat label="À valider" value={counts.toValidate} color="text-blue-600" />
        <Stat label="Validés" value={counts.valid} color="text-emerald-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (organisation, réf.)…" className="input pl-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button key={f.k} onClick={() => setStatusFilter(f.k)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === f.k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>{f.l}</button>
          ))}
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} contrat(s)</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
                {["Organisation", "Référence", "Offre", "Statut", "Accès", "Signé le", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-14 text-center text-gray-400">
                  <FileText size={34} className="mx-auto mb-2 text-gray-300" /> Aucun contrat
                </td></tr>
              ) : filtered.map((c) => {
                const plan = PLAN_META[c.plan] || { label: c.plan, cls: "bg-gray-100 text-gray-600" };
                const stt = STATUS_META[c.status] || STATUS_META.BROUILLON;
                const StatusIcon = stt.icon;
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/contrats/${c.id}`} className="hover:text-brand-700 hover:underline">{c.orgName}</Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.reference}</td>
                    <td className="px-4 py-3"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", plan.cls)}>{plan.label}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", stt.cls)}>
                        <StatusIcon size={12} /> {stt.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.allowedCount} utilisateur(s)</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.signedAt ? <>{fmtDate(c.signedAt)}{c.uploadedByName ? <div className="text-[11px] text-gray-400">par {c.uploadedByName}</div> : null}</> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/contrats/${c.id}`} className="btn-secondary py-1.5 px-2.5 text-xs" title="Éditer / publier"><Pencil size={13} /></Link>
                        {c.hasFile && (
                          <button onClick={() => download(c.id)} disabled={pending} className="btn-secondary py-1.5 px-2.5 text-xs" title="Télécharger le signé"><Download size={13} /></button>
                        )}
                        {c.status === "SIGNE_RECU" && (
                          <button onClick={() => validate(c.id, c.orgName)} disabled={pending} className="btn-primary py-1.5 px-3 text-xs">
                            {pending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Valider
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {newOpen && <NewContractModal onClose={(id) => { setNewOpen(false); if (id) router.push(`/contrats/${id}`); }} />}
    </div>
  );
}

function NewContractModal({ onClose }: { onClose: (createdId?: string) => void }) {
  const [orgs, setOrgs] = useState<{ id: string; name: string; plan: string; contractCount: number }[] | null>(null);
  const [orgId, setOrgId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getContractableOrgs().then(setOrgs).catch(() => setOrgs([]));
  }, []);

  const submit = async () => {
    if (!orgId) { toast.error("Choisissez une organisation"); return; }
    setSaving(true);
    try {
      const r = await createContractForOrg(orgId);
      toast.success("Contrat créé (brouillon)");
      onClose(r.id);
    } catch (e: any) { toast.error(e?.message || "Erreur"); setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Nouveau contrat</p>
            <button onClick={() => onClose()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-gray-500">Sélectionnez une organisation sur une offre payante. Le contrat est pré-rempli, puis éditable.</p>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="input text-sm" disabled={!orgs}>
              <option value="">{orgs ? "— Choisir une organisation —" : "Chargement…"}</option>
              {orgs?.map((o) => (
                <option key={o.id} value={o.id}>{o.name} · {o.plan === "PERFORMANCE" ? "Performance" : "Croissance"}{o.contractCount ? ` (${o.contractCount} existant)` : ""}</option>
              ))}
            </select>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={saving}>Annuler</button>
            <button onClick={submit} className="btn-primary py-2 px-4 text-xs" disabled={saving || !orgId}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer</button>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={cn("text-2xl font-bold mt-0.5", color || "text-gray-900")}>{value}</p>
    </div>
  );
}
