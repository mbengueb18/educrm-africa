"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Loader2, Check, History, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { changePlan, setOrgReportingFeature, setOrgChatbotAi, deleteOrganization } from "../actions";

type Org = {
  id: string; name: string; slug: string; plan: string; effectivePlan: string;
  trialUntil: string | Date | null; aiAddonEnabled: boolean; createdAt: string | Date;
  reportingCustomEnabled: boolean; reportingAiEnabled: boolean; chatbotAiEnabled: boolean;
  users: number; maxUsers: number; leads: number;
};
type Log = {
  id: string; fromPlan: string; toPlan: string; temporaryUntil: string | Date | null; note: string | null; createdAt: string | Date;
  organization: { name: string; slug: string }; changedBy: { name: string } | null;
};

const PLAN_META: Record<string, { label: string; cls: string }> = {
  ESSENTIEL: { label: "Essentiel", cls: "bg-gray-100 text-gray-600 border border-gray-200" },
  CROISSANCE: { label: "Croissance", cls: "bg-brand-50 text-brand-700" },
  PERFORMANCE: { label: "Performance", cls: "bg-violet-50 text-violet-700" },
};
const PLANS = [
  { key: "ESSENTIEL", label: "Essentiel", price: "Gratuit" },
  { key: "CROISSANCE", label: "Croissance", price: "45k/mois" },
  { key: "PERFORMANCE", label: "Performance", price: "100k/mois" },
];

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function OrgsClient({ orgs, logs }: { orgs: Org[]; logs: Log[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<Org | null>(null);

  const filtered = useMemo(() => orgs.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      if (!(o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))) return false;
    }
    if (planFilter && o.effectivePlan !== planFilter) return false;
    return true;
  }), [orgs, search, planFilter]);

  const counts = useMemo(() => ({
    total: orgs.length,
    ESSENTIEL: orgs.filter((o) => o.effectivePlan === "ESSENTIEL").length,
    CROISSANCE: orgs.filter((o) => o.effectivePlan === "CROISSANCE").length,
    PERFORMANCE: orgs.filter((o) => o.effectivePlan === "PERFORMANCE").length,
  }), [orgs]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Organisations</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Pilotez toutes les écoles et activez un plan en un clic — idéal pour faire tester une feature à un prospect.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={counts.total} />
        <Stat label="Essentiel" value={counts.ESSENTIEL} />
        <Stat label="Croissance" value={counts.CROISSANCE} color="text-brand-600" />
        <Stat label="Performance" value={counts.PERFORMANCE} color="text-violet-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une organisation..." className="input pl-9 text-sm" />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{ k: "", l: "Tous" }, { k: "ESSENTIEL", l: "Essentiel" }, { k: "CROISSANCE", l: "Croissance" }, { k: "PERFORMANCE", l: "Performance" }].map((f) => (
            <button key={f.k} onClick={() => setPlanFilter(f.k)}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                planFilter === f.k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>{f.l}</button>
          ))}
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} org.</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
                {["Organisation", "Plan", "Utilisateurs", "Leads", "Créée le", "Reporting", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((o) => {
                const meta = PLAN_META[o.effectivePlan] || PLAN_META.ESSENTIEL;
                return (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">{getInitials(o.name)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{o.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">/{o.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", meta.cls)}>{meta.label}</span>
                      {o.trialUntil && <span className="block text-[10px] text-amber-600 font-semibold mt-1">essai jusqu'au {fmtDate(o.trialUntil)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{o.users} / {o.maxUsers}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{o.leads.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3"><ReportingCell org={o} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditOrg(o)} className="btn-secondary py-1.5 px-3 text-xs"><Pencil size={12} /> Changer le plan</button>
                        <button onClick={() => setDeleteOrg(o)} title="Supprimer l'organisation"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Aucune organisation</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><History size={13} /> Derniers changements de plan</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-2.5 flex items-center gap-3 text-xs flex-wrap">
                <span className="text-gray-900 font-medium">{l.organization.name}</span>
                <span className="text-gray-400">
                  {(PLAN_META[l.fromPlan]?.label || l.fromPlan)} → <b className="text-gray-700">{PLAN_META[l.toPlan]?.label || l.toPlan}</b>
                  {l.temporaryUntil && <span className="text-amber-600"> · essai jusqu'au {fmtDate(l.temporaryUntil)}</span>}
                </span>
                {l.note && <span className="text-gray-400 italic truncate">« {l.note} »</span>}
                <span className="ml-auto text-gray-400 shrink-0">{l.changedBy?.name || "—"} · {fmtDate(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editOrg && <ChangePlanModal org={editOrg} onClose={(saved) => { setEditOrg(null); if (saved) router.refresh(); }} />}
      {deleteOrg && <DeleteOrgModal org={deleteOrg} onClose={(deleted) => { setDeleteOrg(null); if (deleted) router.refresh(); }} />}
    </div>
  );
}

function DeleteOrgModal({ org, onClose }: { org: Org; onClose: (deleted?: boolean) => void }) {
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = confirmName.trim() === org.name;

  const doDelete = () => {
    if (!matches) return;
    startTransition(async () => {
      try {
        const res = await deleteOrganization({ orgId: org.id, confirmName });
        if (!res.success) { toast.error(res.error || "Erreur"); return; }
        if (res.warning) toast.warning(res.warning);
        else toast.success(`« ${org.name} » supprimée définitivement`);
        onClose(true);
      } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => !pending && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
            <div>
              <p className="text-sm font-bold text-gray-900">Supprimer l'organisation</p>
              <p className="text-xs text-gray-500 mt-0.5">{org.name} · <span className="font-mono">/{org.slug}</span></p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
              <p className="text-xs text-red-700 leading-relaxed">
                Action <b>irréversible</b>. Toutes les données de cette école seront définitivement effacées :
                <b> {org.users} utilisateur{org.users > 1 ? "s" : ""}</b>, <b>{org.leads.toLocaleString("fr-FR")} lead{org.leads > 1 ? "s" : ""}</b>,
                et l'intégralité des étudiants, paiements, messages, campagnes, tâches, formulaires et documents associés.
              </p>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Note : les documents étudiants stockés hors Supabase (cartes d'identité, diplômes) ne sont pas supprimés automatiquement par cette action.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Pour confirmer, tapez le nom exact : <span className="font-semibold text-gray-900">{org.name}</span>
              </label>
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoFocus
                className="input text-sm" placeholder={org.name} />
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={pending}>Annuler</button>
            <button onClick={doDelete} disabled={!matches || pending}
              className="btn py-2 px-4 text-xs bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer définitivement
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReportingCell({ org }: { org: Org }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = (feature: "custom" | "ai", enabled: boolean) => {
    start(async () => {
      try {
        await setOrgReportingFeature({ orgId: org.id, feature, enabled });
        toast.success(enabled ? "Activé" : "Désactivé");
        router.refresh();
      } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };
  const toggleChatbot = (enabled: boolean) => {
    start(async () => {
      try {
        await setOrgChatbotAi({ orgId: org.id, enabled });
        toast.success(enabled ? "Chatbot IA activé" : "Chatbot IA désactivé");
        router.refresh();
      } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };
  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} disabled={pending}
      className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 whitespace-nowrap",
        on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300")}>
      {label}
    </button>
  );
  return (
    <div className="flex gap-1.5">
      {chip(org.reportingCustomEnabled, "Rapports", () => toggle("custom", !org.reportingCustomEnabled))}
      {chip(org.reportingAiEnabled, "IA", () => toggle("ai", !org.reportingAiEnabled))}
      {chip(org.chatbotAiEnabled, "Chatbot IA", () => toggleChatbot(!org.chatbotAiEnabled))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className={cn("text-xl font-bold tabular-nums", color || "text-gray-800")}>{value}</div>
      <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function ChangePlanModal({ org, onClose }: { org: Org; onClose: (saved?: boolean) => void }) {
  const [plan, setPlan] = useState(org.effectivePlan === "ESSENTIEL" ? "CROISSANCE" : org.effectivePlan);
  const [temporary, setTemporary] = useState(true);
  const [days, setDays] = useState(14);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const isEssentiel = plan === "ESSENTIEL";
  const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const apply = () => {
    startTransition(async () => {
      try {
        await changePlan({ orgId: org.id, plan, temporary: temporary && !isEssentiel, durationDays: days, note });
        toast.success("Plan mis à jour");
        onClose(true);
      } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Changer le plan</p>
            <p className="text-xs text-gray-500 mt-0.5">{org.name} · <span className="font-mono">/{org.slug}</span></p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => (
                  <button key={p.key} onClick={() => setPlan(p.key)}
                    className={cn("border rounded-xl px-2 py-2.5 text-center transition-colors",
                      plan === p.key ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300")}>
                    <div className="text-xs font-bold text-gray-900">{p.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{p.price}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3", isEssentiel && "opacity-50")}>
              <div>
                <p className="text-sm font-medium text-gray-800">Activation temporaire (essai)</p>
                <p className="text-[11px] text-gray-500">Retour auto à Essentiel à l'échéance</p>
              </div>
              <button onClick={() => setTemporary((v) => !v)} disabled={isEssentiel}
                className={cn("w-11 h-6 rounded-full relative transition-colors shrink-0", temporary && !isEssentiel ? "bg-emerald-500" : "bg-gray-300")}>
                <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", temporary && !isEssentiel ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>

            {temporary && !isEssentiel && (
              <div>
                <div className="flex gap-2">
                  {[7, 14, 30].map((d) => (
                    <button key={d} onClick={() => setDays(d)}
                      className={cn("flex-1 border rounded-lg py-2 text-xs font-bold transition-colors",
                        days === d ? "bg-brand-600 text-white border-transparent" : "border-gray-200 text-gray-500 hover:border-gray-300")}>{d} jours</button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 text-center mt-2">Expire le <b className="text-amber-600">{until}</b> → retour Essentiel</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Note (interne)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input text-sm" placeholder="Ex. Démo prospect BEM Dakar" />
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={pending}>Annuler</button>
            <button onClick={apply} className="btn-primary py-2 px-4 text-xs" disabled={pending}>
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Appliquer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
