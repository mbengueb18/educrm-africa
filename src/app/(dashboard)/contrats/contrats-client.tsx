"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, Upload, Download, Loader2, FileCheck2, ShieldCheck, Clock, RefreshCw } from "lucide-react";
import type { ContractView, ContractContent } from "@/lib/contracts/template";
import { getSignedContractUrl } from "./actions";

type Contract = {
  id: string; reference: string; plan: string; status: string;
  signedFileName: string | null; signedSize: number | null; signedAt: string | null;
  uploadedByName: string | null; validatedAt: string | null; createdAt: string;
};

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  A_SIGNER: { label: "À signer", cls: "bg-amber-50 text-amber-700 border border-amber-200", icon: Clock },
  SIGNE_RECU: { label: "Signé — reçu", cls: "bg-brand-50 text-brand-700 border border-brand-200", icon: FileCheck2 },
  VALIDE: { label: "Validé", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: ShieldCheck },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}
/** Valeur de champ « partie » ou trait de remplissage si vide (rempli à la main sur le papier). */
function val(s: string | undefined | null) {
  return s && s.trim() ? <span className="text-gray-900">{s}</span> : <span className="text-gray-400">…………………………</span>;
}

export function ContratsClient({ orgName, contract, view, content }: { orgName: string; contract: Contract; view: ContractView; content: ContractContent }) {
  const router = useRouter();
  const st = STATUS_META[contract.status] || STATUS_META.A_SIGNER;
  const StatusIcon = st.icon;
  const isSigned = contract.status === "SIGNE_RECU" || contract.status === "VALIDE";
  const p = content.parties;
  const clauses = [...content.clauses].sort((a, b) => a.n - b.n);

  const [pending, startTransition] = useTransition();
  const download = () => startTransition(async () => {
    try { const r = await getSignedContractUrl(contract.id); window.open(r.url, "_blank"); }
    catch (e: any) { toast.error(e?.message || "Erreur"); }
  });

  return (
    <div className="contract-root max-w-4xl mx-auto pb-24">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .contract-print, .contract-print * { visibility: visible !important; }
          .contract-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; box-shadow: none !important; border: 0 !important; }
          @page { size: A4; margin: 16mm 14mm; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contrat d'abonnement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Réf. <span className="font-mono font-semibold text-gray-700">{contract.reference}</span> · Offre {view.planName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>
            <StatusIcon size={13} /> {st.label}
          </span>
          <button onClick={() => window.print()} className="btn-primary py-2 px-4 text-sm"><Printer size={15} /> Imprimer / PDF</button>
        </div>
      </div>

      <div className="no-print bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-sm text-blue-900 flex items-start gap-2.5">
        <span className="mt-0.5">ℹ️</span>
        <p><b>Imprimez le contrat en PDF</b>, faites-le signer par les deux parties, puis <b>redéposez-le signé ci-dessous</b>. Une copie part automatiquement à contact@talibcrm.com et notre équipe le valide.</p>
      </div>

      {/* ── Feuille contrat (imprimable) ── */}
      <div className="contract-print bg-white rounded-xl border border-gray-200 shadow-sm px-8 sm:px-12 py-10">
        <div className="flex items-start justify-between gap-6 pb-5 border-b-2 border-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600 text-white font-extrabold text-lg flex items-center justify-center">T</div>
            <div>
              <div className="text-lg font-extrabold text-gray-900 leading-none">TalibCRM</div>
              <div className="text-[11px] text-gray-500 mt-1">CRM pour établissements d'enseignement et de formation</div>
            </div>
          </div>
          <div className="text-right text-[11px] text-gray-500 leading-relaxed">
            <div>Réf. contrat : <b className="text-gray-800 font-mono">{contract.reference}</b></div>
            <div>Version : <b className="text-gray-800">1.0</b></div>
            <div>Établi le : <b className="text-gray-800">{fmtDate(contract.createdAt)}</b></div>
          </div>
        </div>

        <div className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Contrat d'abonnement au Service</div>
          <h2 className="font-serif text-[26px] leading-tight text-gray-900 mt-2 font-bold">Contrat d'abonnement TalibCRM — Offre {view.planName}</h2>
          <span className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-200">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600" /> Plan {view.planName} · {view.tagline}
          </span>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 mt-7 border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">L'Éditeur</div>
            <p className="text-[12.5px] leading-relaxed text-gray-700">
              <b>TalibCRM</b>, {val(p.editorLegal)}, immatriculée sous le {val(p.editorRccm)}, dont le siège est situé {val(p.editorAddress)}, représentée par {val(p.editorSignName)}, {val(p.editorSignRole)}. Contact : contact@talibcrm.com.
            </p>
          </div>
          <div className="p-4 border-t sm:border-t-0 sm:border-l border-gray-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">Le Client</div>
            <p className="text-[12.5px] leading-relaxed text-gray-700">
              <b>{p.clientName || orgName}</b>, {val(p.clientLegal)}, immatriculée sous le {val(p.clientRccm)}, dont le siège est situé {val(p.clientAddress)}, représentée par {val(p.clientSignName)}, {val(p.clientSignRole)}.
            </p>
          </div>
        </div>

        <p className="font-serif italic text-[13px] text-gray-600 mt-5">
          Ci-après désignés ensemble « les Parties » et individuellement « une Partie ». Il a été convenu et arrêté ce qui suit.
        </p>

        {/* Clauses (rendu depuis le contenu éditable) */}
        {clauses.map((cl) => (
          <div key={cl.n}>
            <article className="mt-6">
              <h3 className="flex items-baseline gap-2.5 text-sm font-bold text-gray-900 pb-1.5 mb-2 border-b border-gray-200">
                <span className="text-[11.5px] font-extrabold text-brand-600 tabular-nums">Art. {cl.n}</span> {cl.title}
              </h3>
              <div className="font-serif text-[13.5px] leading-relaxed text-gray-700 whitespace-pre-line">{cl.body}</div>
            </article>

            {/* Après l'art. 3 : Conditions Particulières (auto depuis la grille tarifaire) */}
            {cl.n === 3 && (
              <div className="mt-3 border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-brand-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-700 border-b border-gray-200">
                  Conditions Particulières — Offre « {view.planName} »
                </div>
                <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <th className="text-left align-top font-medium text-gray-500 px-4 py-2.5 w-[44%]">Prix de l'abonnement</th>
                      <td className="px-4 py-2.5 text-gray-900">
                        <span className="text-[16px] font-extrabold text-brand-700">{view.priceMonthly} HT / mois</span> en mensuel<br />
                        ou <b>{view.priceYearlyEq} HT / mois</b> en engagement annuel — soit <b>{view.priceYearlyTotal} HT / an</b>.
                      </td>
                    </tr>
                    {view.rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <th className="text-left align-top font-medium text-gray-500 px-4 py-2.5">{r.label}</th>
                        <td className="px-4 py-2.5 text-gray-800">
                          {r.badge === "inc" && <span className="inline-block text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded px-1.5 mr-1.5">Inclus</span>}
                          {r.badge === "opt" && <span className="inline-block text-[10px] font-bold text-gray-500 border border-gray-300 rounded px-1.5 mr-1.5">En option</span>}
                          {r.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}

            {/* Après l'art. 6 : grilles crédits IA + services (auto) */}
            {cl.n === 6 && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-sans text-[12px] font-bold text-gray-900 mb-1">Crédits IA supplémentaires</p>
                  <div className="overflow-x-auto"><table className="w-full text-[12px] border-collapse">
                    <thead><tr className="bg-brand-50 text-brand-700"><Th>Pack</Th><Th>Actions IA</Th><Th>Prix (FCFA HT)</Th></tr></thead>
                    <tbody>
                      <tr><Td>Pack 1</Td><Td right>1 000</Td><Td right>10 000</Td></tr>
                      <tr><Td>Pack 2</Td><Td right>5 000</Td><Td right>40 000</Td></tr>
                      <tr><Td>Pack 3</Td><Td right>20 000</Td><Td right>120 000</Td></tr>
                    </tbody>
                  </table></div>
                </div>
                <div>
                  <p className="font-sans text-[12px] font-bold text-gray-900 mb-1">Services ponctuels (one-shot)</p>
                  <div className="overflow-x-auto"><table className="w-full text-[12px] border-collapse">
                    <thead><tr className="bg-brand-50 text-brand-700"><Th>Prestation</Th><Th>Prix (FCFA HT)</Th></tr></thead>
                    <tbody>
                      <tr><Td>Formation de l'équipe sur site à Dakar (1 journée)</Td><Td right>250 000</Td></tr>
                      <tr><Td>Formation de l'équipe en ligne (1 journée)</Td><Td right>200 000</Td></tr>
                      <tr><Td>Migration depuis HubSpot / Pipedrive / Salesforce</Td><Td right>150 000</Td></tr>
                    </tbody>
                  </table></div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Signatures */}
        <div className="mt-9" style={{ pageBreakInside: "avoid" }}>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Signatures</h3>
          <p className="font-serif text-[13px] text-gray-700 mb-4">Fait à …………………, le ……/……/………, en deux (2) exemplaires originaux.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SignBox who="Pour l'Éditeur — TalibCRM" name={p.editorSignName} role={p.editorSignRole} closing="Bon pour accord" />
            <SignBox who="Pour le Client" name={p.clientSignName} role={p.clientSignRole} closing="Lu et approuvé" />
          </div>
        </div>

        <p className="mt-8 pt-4 border-t border-gray-200 text-[10.5px] leading-relaxed text-gray-500">
          <b>Modèle indicatif.</b> Tarifs et limites : grille TalibCRM V1.0, hors taxes. TalibCRM · contact@talibcrm.com
        </p>
      </div>

      {/* ── Upload / statut (écran) ── */}
      <div className="no-print mt-6">
        {isSigned ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1"><FileCheck2 size={18} /> Contrat signé reçu</div>
            <p className="text-sm text-gray-500">
              Déposé le {fmtDate(contract.signedAt)}{contract.uploadedByName ? ` par ${contract.uploadedByName}` : ""}
              {contract.signedFileName ? ` · ${contract.signedFileName}` : ""}{contract.signedSize ? ` (${fmtSize(contract.signedSize)})` : ""}.
              {contract.status === "VALIDE" && contract.validatedAt && (
                <span className="text-emerald-700 font-medium"> Validé par TalibCRM le {fmtDate(contract.validatedAt)}.</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={download} disabled={pending} className="btn-secondary py-2 px-3 text-sm"><Download size={14} /> Télécharger le signé</button>
              {contract.status !== "VALIDE" && <UploadButton contractId={contract.id} label="Remplacer" icon="replace" onDone={() => router.refresh()} />}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-1"><Upload size={18} className="text-brand-600" /> Déposer le contrat signé</div>
            <p className="text-sm text-gray-500 mb-3">Une fois le contrat imprimé et signé par les deux parties, redéposez-le ici (PDF ou photo, max 15 Mo). Il sera archivé et envoyé à notre équipe.</p>
            <UploadButton contractId={contract.id} label="Choisir le fichier signé" icon="upload" onDone={() => router.refresh()} />
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-bold border border-gray-200 px-3 py-1.5">{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`border border-gray-200 px-3 py-1.5 text-gray-700 ${right ? "text-right tabular-nums font-semibold" : ""}`}>{children}</td>;
}

function SignBox({ who, name, role, closing }: { who: string; name: string; role: string; closing: string }) {
  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-3">{who}</div>
      <div className="text-[12px] text-gray-600 leading-loose">
        Nom : {name && name.trim() ? <span className="text-gray-900 font-medium">{name}</span> : <span className="text-gray-400">………………………</span>}<br />
        Qualité : {role && role.trim() ? <span className="text-gray-900 font-medium">{role}</span> : <span className="text-gray-400">………………………</span>}
      </div>
      <div className="mt-3 h-16 border-t border-dashed border-gray-300 pt-1.5 text-[10.5px] italic text-gray-400">Signature &amp; cachet — « {closing} »</div>
    </div>
  );
}

function UploadButton({ contractId, label, icon, onDone }: { contractId: string; label: string; icon: "upload" | "replace"; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 15 Mo)"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/upload`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Téléversement échoué");
      toast.success("Contrat signé reçu — envoyé à notre équipe");
      onDone();
    } catch (e: any) { toast.error(e?.message || "Erreur"); setBusy(false); }
  };

  return (
    <>
      <button onClick={() => inputRef.current?.click()} disabled={busy} className={icon === "upload" ? "btn-primary py-2 px-4 text-sm" : "btn-secondary py-2 px-3 text-sm"}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : icon === "upload" ? <Upload size={14} /> : <RefreshCw size={14} />} {label}
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) submit(f); e.target.value = ""; }} />
    </>
  );
}
