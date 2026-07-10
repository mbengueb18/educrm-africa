"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Download, ShieldCheck, Clock, FileCheck2, Loader2, FileText } from "lucide-react";
import { getBoContractSignedUrl, validateContract } from "../../actions";

type Contract = {
  id: string; reference: string; plan: string; status: string;
  orgName: string; orgSlug: string;
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
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-600", icon: Clock },
  A_SIGNER: { label: "À signer", cls: "bg-amber-50 text-amber-700", icon: Clock },
  SIGNE_RECU: { label: "Signé — reçu", cls: "bg-blue-50 text-blue-700", icon: FileCheck2 },
  VALIDE: { label: "Validé", cls: "bg-emerald-50 text-emerald-700", icon: ShieldCheck },
};
const FILTERS = [
  { k: "", l: "Tous" },
  { k: "A_SIGNER", l: "À signer" },
  { k: "SIGNE_RECU", l: "À valider" },
  { k: "VALIDE", l: "Validés" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export function ContractsClient({ contracts }: { contracts: Contract[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pending, startTransition] = useTransition();

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
    toSign: contracts.filter((c) => c.status === "A_SIGNER").length,
    toValidate: contracts.filter((c) => c.status === "SIGNE_RECU").length,
    valid: contracts.filter((c) => c.status === "VALIDE").length,
  }), [contracts]);

  const download = (id: string) => startTransition(async () => {
    try { const r = await getBoContractSignedUrl(id); window.open(r.url, "_blank"); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  });
  const validate = (id: string, org: string) => {
    if (!confirm(`Valider le contrat de « ${org} » ? Il sera verrouillé (plus modifiable par le client).`)) return;
    startTransition(async () => {
      try { await validateContract(id); toast.success("Contrat validé"); router.refresh(); }
      catch (e: any) { toast.error(e?.message || "Erreur"); }
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contrats</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Suivi des contrats d'abonnement : génération, réception du signé et validation.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={counts.total} />
        <Stat label="À signer" value={counts.toSign} color="text-amber-600" />
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
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
                {["Organisation", "Référence", "Offre", "Statut", "Signé le", "Validation", ""].map((h, i) => (
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
                const st = STATUS_META[c.status] || STATUS_META.A_SIGNER;
                const StatusIcon = st.icon;
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.orgName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.reference}</td>
                    <td className="px-4 py-3"><span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", plan.cls)}>{plan.label}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", st.cls)}>
                        <StatusIcon size={12} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.signedAt ? (
                        <>{fmtDate(c.signedAt)}{c.uploadedByName ? <div className="text-[11px] text-gray-400">par {c.uploadedByName}{c.signedSize ? ` · ${fmtSize(c.signedSize)}` : ""}</div> : null}</>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.validatedAt ? <>{fmtDate(c.validatedAt)}{c.validatedBy ? <div className="text-[11px] text-gray-400">{c.validatedBy}</div> : null}</> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.hasFile && (
                          <button onClick={() => download(c.id)} disabled={pending} className="btn-secondary py-1.5 px-2.5 text-xs" title="Télécharger le contrat signé">
                            <Download size={13} />
                          </button>
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
    </div>
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
