"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Undo2, Loader2, Lock, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateContract, publishContract, unpublishContract } from "../../../actions";
import type { ContractContent, ContractView } from "@/lib/contracts/template";

type OrgUser = { id: string; name: string; email: string; role: string; isActive: boolean };
type Detail = {
  id: string; reference: string; plan: string; status: string; orgName: string;
  content: ContractContent; view: ContractView; allowedUserIds: string[];
  signedAt: string | null; validatedAt: string | null; users: OrgUser[]; locked: boolean;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-600" },
  A_SIGNER: { label: "Publié — à signer", cls: "bg-amber-50 text-amber-700" },
  SIGNE_RECU: { label: "Signé — reçu", cls: "bg-blue-50 text-blue-700" },
  VALIDE: { label: "Validé", cls: "bg-emerald-50 text-emerald-700" },
};
const PARTY_FIELDS: { key: keyof ContractContent["parties"]; label: string; group: "editor" | "client" }[] = [
  { key: "editorLegal", label: "Raison sociale & forme juridique", group: "editor" },
  { key: "editorRccm", label: "N° RCCM / registre", group: "editor" },
  { key: "editorAddress", label: "Adresse du siège", group: "editor" },
  { key: "editorSignName", label: "Signataire — nom", group: "editor" },
  { key: "editorSignRole", label: "Signataire — qualité", group: "editor" },
  { key: "clientName", label: "Dénomination", group: "client" },
  { key: "clientLegal", label: "Forme juridique", group: "client" },
  { key: "clientRccm", label: "N° RCCM / registre", group: "client" },
  { key: "clientAddress", label: "Adresse du siège", group: "client" },
  { key: "clientSignName", label: "Signataire — nom", group: "client" },
  { key: "clientSignRole", label: "Signataire — qualité", group: "client" },
];

export function ContractEditor({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [content, setContent] = useState<ContractContent>(detail.content);
  const [allowed, setAllowed] = useState<string[]>(detail.allowedUserIds);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const locked = detail.locked;
  const st = STATUS_LABEL[detail.status] || STATUS_LABEL.BROUILLON;

  const setParty = (key: keyof ContractContent["parties"], v: string) => {
    setContent((c) => ({ ...c, parties: { ...c.parties, [key]: v } }));
    setDirty(true);
  };
  const setClause = (idx: number, patch: { title?: string; body?: string }) => {
    setContent((c) => ({ ...c, clauses: c.clauses.map((cl, i) => (i === idx ? { ...cl, ...patch } : cl)) }));
    setDirty(true);
  };
  const toggleUser = (id: string) => {
    setAllowed((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    setDirty(true);
  };

  const save = () =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          await updateContract(detail.id, { content, allowedUserIds: allowed });
          setDirty(false);
          toast.success("Enregistré");
          resolve(true);
        } catch (e: any) { toast.error(e?.message || "Erreur"); resolve(false); }
      });
    });

  const publish = () => {
    if (allowed.length === 0) { toast.error("Désignez au moins un utilisateur avant de publier"); return; }
    startTransition(async () => {
      try {
        if (dirty) await updateContract(detail.id, { content, allowedUserIds: allowed });
        await publishContract(detail.id);
        setDirty(false);
        toast.success("Contrat publié — visible dans le CRM des utilisateurs désignés");
        router.refresh();
      } catch (e: any) { toast.error(e?.message || "Erreur"); }
    });
  };
  const unpublish = () => {
    startTransition(async () => {
      try { await unpublishContract(detail.id); toast.success("Repassé en brouillon"); router.refresh(); }
      catch (e: any) { toast.error(e?.message || "Erreur"); }
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Barre du haut */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/contrats" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate">{detail.orgName}</h1>
            <p className="text-xs text-gray-500">Réf. <span className="font-mono">{detail.reference}</span> · Offre {detail.view.planName}</p>
          </div>
          <span className={cn("shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span>
        </div>
        {!locked && (
          <div className="flex items-center gap-2">
            <button onClick={() => save()} disabled={pending || !dirty} className="btn-secondary py-2 px-3 text-sm">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
            </button>
            {detail.status === "BROUILLON" ? (
              <button onClick={publish} disabled={pending} className="btn-primary py-2 px-4 text-sm"><Send size={14} /> Publier vers le CRM</button>
            ) : detail.status === "A_SIGNER" ? (
              <button onClick={unpublish} disabled={pending} className="btn-secondary py-2 px-3 text-sm"><Undo2 size={14} /> Dépublier</button>
            ) : null}
          </div>
        )}
      </div>

      {locked && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-900 flex items-center gap-2">
          <Lock size={16} /> Contrat signé — le contenu et les accès sont verrouillés (lecture seule).
          {detail.status === "SIGNE_RECU" && <span className="ml-1">Validez-le depuis la liste des contrats.</span>}
        </div>
      )}

      {/* Accès */}
      <Section icon={Users} title="Utilisateurs autorisés" subtitle="Ces personnes verront le contrat dans leur CRM une fois publié.">
        {detail.users.length === 0 ? (
          <p className="text-sm text-gray-400">Cette organisation n'a aucun utilisateur.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {detail.users.map((u) => {
              const checked = allowed.includes(u.id);
              return (
                <label key={u.id} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                  checked ? "border-brand-300 bg-brand-50/50" : "border-gray-200 hover:bg-gray-50", locked && "opacity-60 cursor-not-allowed")}>
                  <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleUser(u.id)} className="accent-brand-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name} {!u.isActive && <span className="text-[10px] text-gray-400">(inactif)</span>}</p>
                    <p className="text-[11px] text-gray-500 truncate">{u.email} · {u.role}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">{allowed.length} utilisateur(s) désigné(s).</p>
      </Section>

      {/* Parties */}
      <Section icon={ShieldCheck} title="Parties au contrat" subtitle="Identité juridique de l'Éditeur et du Client (affichée en tête du contrat et au bloc signatures).">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <PartyGroup title="L'Éditeur — TalibCRM">
            {PARTY_FIELDS.filter((f) => f.group === "editor").map((f) => (
              <FieldRow key={f.key} label={f.label} value={content.parties[f.key]} onChange={(v) => setParty(f.key, v)} disabled={locked} />
            ))}
          </PartyGroup>
          <PartyGroup title="Le Client">
            {PARTY_FIELDS.filter((f) => f.group === "client").map((f) => (
              <FieldRow key={f.key} label={f.label} value={content.parties[f.key]} onChange={(v) => setParty(f.key, v)} disabled={locked} />
            ))}
          </PartyGroup>
        </div>
      </Section>

      {/* Clauses */}
      <Section title="Clauses du contrat" subtitle="Le tableau des Conditions Particulières (tarifs, limites) et les grilles de prix restent générés automatiquement et n'apparaissent pas ici.">
        <div className="space-y-4">
          {content.clauses.map((cl, idx) => (
            <div key={cl.n} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-100">
                <span className="text-[11px] font-extrabold text-brand-600 tabular-nums shrink-0">Art. {cl.n}</span>
                <input value={cl.title} disabled={locked} onChange={(e) => setClause(idx, { title: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none disabled:opacity-70" />
              </div>
              <textarea value={cl.body} disabled={locked} onChange={(e) => setClause(idx, { body: e.target.value })} rows={Math.max(3, Math.ceil(cl.body.length / 90))}
                className="w-full px-3 py-2.5 text-[13px] leading-relaxed text-gray-700 font-serif resize-y focus:outline-none disabled:opacity-70" />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon?: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      <div className="flex items-start gap-2 mb-3">
        {Icon && <Icon size={17} className="text-brand-600 mt-0.5 shrink-0" />}
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
function PartyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function FieldRow({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-gray-500 mb-0.5 block">{label}</label>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="input text-sm" />
    </div>
  );
}
