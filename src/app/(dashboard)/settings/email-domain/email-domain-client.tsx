"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Globe, ShieldCheck, Loader2, Copy, Check, RefreshCw,
  Trash2, AlertTriangle, Lock, CheckCircle2, Mail, Inbox, Eye,
} from "lucide-react";
import {
  addEmailDomain, refreshEmailDomainStatus, updateEmailSender, removeEmailDomain,
  enableInbound, refreshInboundStatus, disableInbound,
} from "./actions";

type DnsRecord = { purpose: string; type: string; name: string; value: string; priority?: number | null; status?: string };
type Config = {
  domain: string;
  fromLocalPart: string;
  fromName: string | null;
  status: "PENDING" | "VERIFIED" | "FAILED";
  dnsRecords: DnsRecord[] | null;
  verifiedAt: string | Date | null;
  inboundSubdomain?: string;
  inboundStatus?: "PENDING" | "VERIFIED" | "FAILED" | null;
  inboundMxRecords?: DnsRecord[] | null;
  inboundVerifiedAt?: string | Date | null;
} | null;

export function EmailDomainClient({ config, canUse, orgName, upgradeTarget }: {
  config: Config;
  canUse: boolean;
  orgName: string;
  upgradeTarget: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/settings" className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-xs text-gray-400">Paramètres › Domaine email</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Domaine email</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Envoyez vos emails depuis votre propre domaine (ex. <span className="font-medium text-gray-700">admission@votredomaine.sn</span>) au lieu de l'adresse par défaut TalibCRM.
      </p>

      {!canUse ? (
        <UpgradeCard upgradeTarget={upgradeTarget} />
      ) : !config ? (
        <AddDomainForm orgName={orgName} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
      ) : config.status === "VERIFIED" ? (
        <VerifiedCard config={config} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
      ) : (
        <PendingCard config={config} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
      )}

      {/* Priorité expéditeur */}
      <div className="mt-6 bg-brand-50/40 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-brand-700 mb-2 flex items-center gap-1.5">
          <Mail size={13} /> Quel expéditeur est utilisé ?
        </p>
        <ol className="text-xs text-gray-600 space-y-1 list-decimal pl-5">
          <li>Si l'utilisateur a <b>connecté sa boîte Gmail</b> → envoi depuis <b>son</b> adresse.</li>
          <li>Sinon, si le <b>domaine de l'organisation est vérifié</b> → votre adresse personnalisée.</li>
          <li>Sinon → repli <code className="bg-gray-100 px-1 rounded">admission@talibcrm.com</code>.</li>
        </ol>
      </div>
    </div>
  );
}

// ─── Upgrade (plan) ───
function UpgradeCard({ upgradeTarget }: { upgradeTarget: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
        <Lock size={26} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">Domaine personnalisé non inclus</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
        L'envoi depuis votre propre domaine est disponible à partir du plan {upgradeTarget || "Croissance"}.
      </p>
      <Link href="/settings/organization" className="btn-primary py-2 px-4 text-sm mt-4 inline-flex">
        Voir les plans
      </Link>
    </div>
  );
}

// ─── Formulaire d'ajout ───
function AddDomainForm({ orgName, pending, startTransition, onDone }: any) {
  const [domain, setDomain] = useState("");
  const [localPart, setLocalPart] = useState("admission");
  const [fromName, setFromName] = useState(orgName || "");

  const submit = () => {
    if (!domain.trim()) { toast.error("Saisissez un domaine"); return; }
    startTransition(async () => {
      try {
        const res = await addEmailDomain({ domain, fromLocalPart: localPart, fromName });
        toast.success(res.status === "VERIFIED" ? "Domaine déjà vérifié — rattaché !" : "Domaine ajouté — ajoutez les enregistrements DNS");
        onDone();
      } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900">Configurer un domaine</p>
          <p className="text-xs text-gray-500 mt-0.5">Ajoutez le domaine depuis lequel envoyer vos emails.</p>
        </div>
        <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5"><ShieldCheck size={13} /> Plan Croissance / Performance</span>
      </div>
      <div className="p-5">
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Domaine</label>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} className="input text-sm" placeholder="bemtech.sn" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Adresse d'expéditeur</label>
            <div className="flex">
              <input value={localPart} onChange={(e) => setLocalPart(e.target.value)} className="input text-sm rounded-r-none border-r-0" />
              <span className="flex items-center px-3 bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500 font-mono">@{domain || "domaine"}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nom affiché</label>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="input text-sm" placeholder={orgName} />
            <p className="text-[10px] text-gray-400 mt-1">Par défaut : le nom de votre organisation.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={submit} disabled={pending} className="btn-primary py-2 px-4 text-sm">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Vérifier le domaine
          </button>
          <span className="text-[11px] text-gray-400">Nous générerons les enregistrements DNS à ajouter chez votre hébergeur.</span>
        </div>
      </div>
    </div>
  );
}

// ─── En attente / échec (table DNS) ───
function PendingCard({ config, pending, startTransition, onDone }: any) {
  const failed = config.status === "FAILED";
  const records: DnsRecord[] = config.dnsRecords || [];

  const refresh = () => startTransition(async () => {
    try {
      const res = await refreshEmailDomainStatus();
      toast[res.status === "VERIFIED" ? "success" : "message"](res.status === "VERIFIED" ? "Domaine vérifié ✓" : "Toujours en attente — la propagation DNS peut prendre du temps");
      onDone();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  });

  const remove = () => {
    if (!confirm("Retirer ce domaine ?")) return;
    startTransition(async () => {
      try { await removeEmailDomain(); toast.success("Domaine retiré"); onDone(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Globe size={15} className="text-gray-400" /> {config.domain}</p>
          <p className="text-xs text-gray-500 mt-0.5">{config.fromLocalPart}@{config.domain}{config.fromName ? " · " + config.fromName : ""}</p>
        </div>
        <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5", failed ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" /> {failed ? "Échec de vérification" : "En attente de vérification"}
        </span>
      </div>
      <div className="p-5">
        <div className={cn("rounded-xl p-3 text-xs flex gap-2.5 mb-4", failed ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-900")}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>Ajoutez ces enregistrements dans la zone <b>DNS</b> de votre domaine (chez votre hébergeur), puis cliquez sur <b>Rafraîchir</b>. La propagation prend de quelques minutes à quelques heures.</div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Type</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Nom / Hôte</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Valeur</th>
                <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Aucun enregistrement — rafraîchissez.</td></tr>
              ) : records.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2.5 align-top">
                    <span className="font-mono text-[11px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{r.type}</span>
                    <div className="text-[10px] text-gray-400 mt-1">{r.purpose}{r.priority != null ? " · prio " + r.priority : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 align-top"><CopyCell text={r.name} /></td>
                  <td className="px-3 py-2.5 align-top"><CopyCell text={r.value} /></td>
                  <td className="px-3 py-2.5 align-top">
                    <span className={cn("text-[10px] font-bold", (r.status || "").toLowerCase() === "verified" ? "text-emerald-600" : "text-amber-600")}>
                      {(r.status || "").toLowerCase() === "verified" ? "✓ Détecté" : "… En attente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <button onClick={refresh} disabled={pending} className="btn-primary py-2 px-4 text-sm">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Rafraîchir le statut
          </button>
          <button onClick={remove} disabled={pending} className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5">
            <Trash2 size={13} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vérifié ───
function VerifiedCard({ config, pending, startTransition, onDone }: any) {
  const [editing, setEditing] = useState(false);
  const [localPart, setLocalPart] = useState(config.fromLocalPart);
  const [fromName, setFromName] = useState(config.fromName || "");

  const save = () => startTransition(async () => {
    try { await updateEmailSender({ fromLocalPart: localPart, fromName }); toast.success("Expéditeur mis à jour"); setEditing(false); onDone(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const reverify = () => startTransition(async () => {
    try { await refreshEmailDomainStatus(); toast.success("Statut vérifié"); onDone(); } catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const remove = () => {
    if (!confirm("Retirer ce domaine ? Les emails repartiront depuis talibcrm.com.")) return;
    startTransition(async () => {
      try { await removeEmailDomain(); toast.success("Domaine retiré"); onDone(); } catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  const verifiedDate = config.verifiedAt ? new Date(config.verifiedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  // Suivi ouvertures/clics : actif dès que le CNAME de tracking est vérifié côté Resend.
  const trackingRecords: DnsRecord[] = config.dnsRecords || [];
  const trackingActive = trackingRecords.some(
    (r) => (r.purpose || "").toLowerCase() === "tracking" && (r.status || "").toLowerCase() === "verified"
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Globe size={15} className="text-gray-400" /> {config.domain}</p>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current" /> Vérifié
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"><CheckCircle2 size={20} /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Vos emails partent depuis {config.fromLocalPart}@{config.domain}</p>
            <p className="text-xs text-gray-500 mt-0.5">Inbox, fiche prospect, campagnes et séquences utilisent désormais votre domaine.</p>
          </div>
        </div>

        {/* Suivi ouvertures / clics des campagnes */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {trackingActive ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 inline-flex items-center gap-1.5">
              <Eye size={13} /> Suivi ouvertures &amp; clics : actif
            </span>
          ) : (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 inline-flex items-center gap-1.5"
              title="Cliquez sur « Re-vérifier » pour générer l'enregistrement DNS de suivi (CNAME), à ajouter chez votre hébergeur."
            >
              <Eye size={13} /> Suivi ouvertures &amp; clics : non activé
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Adresse d'expéditeur</label>
                <div className="flex">
                  <input value={localPart} onChange={(e) => setLocalPart(e.target.value)} className="input text-sm rounded-r-none border-r-0" />
                  <span className="flex items-center px-3 bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-500 font-mono">@{config.domain}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nom affiché</label>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="input text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={pending} className="btn-primary py-1.5 px-3 text-xs">{pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer</button>
              <button onClick={() => setEditing(false)} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm">
              <Row k="Domaine" v={config.domain} mono />
              <Row k="Expéditeur" v={`${config.fromLocalPart}@${config.domain}`} mono />
              <Row k="Nom affiché" v={config.fromName || "—"} />
              <Row k="Vérifié le" v={verifiedDate} />
            </div>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 px-3 text-xs">Modifier l'expéditeur</button>
              <button onClick={reverify} disabled={pending} className="btn-secondary py-1.5 px-3 text-xs">{pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-vérifier</button>
              <button onClick={remove} disabled={pending} className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5"><Trash2 size={13} /> Retirer le domaine</button>
            </div>
          </>
        )}
      </div>

      {/* Réception (Phase 2) */}
      <ReceptionSection config={config} pending={pending} startTransition={startTransition} onDone={onDone} />
    </div>
  );
}

// ─── Réception : recevoir les réponses sur reply.<domaine> ───
function ReceptionSection({ config, pending, startTransition, onDone }: any) {
  const status: string | null = config.inboundStatus || null;
  const replyDomain = (config.inboundSubdomain || "reply") + "." + config.domain;
  const records: DnsRecord[] = config.inboundMxRecords || [];

  const enable = () => startTransition(async () => {
    try { const r = await enableInbound(); toast.success(r.status === "VERIFIED" ? "Réception active ✓" : "Réception configurée — ajoutez l'enregistrement MX"); onDone(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const refresh = () => startTransition(async () => {
    try { const r = await refreshInboundStatus(); toast[r.status === "VERIFIED" ? "success" : "message"](r.status === "VERIFIED" ? "Réception vérifiée ✓" : "Toujours en attente — la propagation DNS peut prendre du temps"); onDone(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const disable = () => {
    if (!confirm("Désactiver la réception ? Les réponses repartiront via l'adresse technique TalibCRM.")) return;
    startTransition(async () => {
      try { await disableInbound(); toast.success("Réception désactivée"); onDone(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  const inboundDate = config.inboundVerifiedAt ? new Date(config.inboundVerifiedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <div className="border-t border-dashed border-gray-200 bg-gray-50/50 px-5 py-5">
      {/* ── État 1 : à activer ── */}
      {!status && (
        <>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Inbox size={17} /></div>
            <div>
              <p className="text-sm font-bold text-gray-900">Recevoir les réponses sur votre domaine</p>
              <p className="text-xs text-gray-500 mt-0.5 max-w-lg">
                Aujourd'hui, quand un prospect répond, le message revient via l'adresse technique de TalibCRM. Activez la réception pour recevoir les réponses sur <b>{replyDomain}</b>, à votre image.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={enable} disabled={pending} className="btn-primary py-2 px-4 text-sm">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Inbox size={15} />} Activer la réception
            </button>
            <span className="text-[11px] text-gray-400">Quelques enregistrements DNS à ajouter sur un sous-domaine dédié. Sans risque pour votre messagerie existante.</span>
          </div>
        </>
      )}

      {/* ── État 2 : en attente / échec (MX à ajouter) ── */}
      {status && status !== "VERIFIED" && (
        <>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Inbox size={17} /></div>
            <div>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Réception
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", status === "FAILED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
                  {status === "FAILED" ? "Échec" : "En attente DNS"}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Ajoutez les <b>enregistrements DNS</b> ci-dessous sur <b>{replyDomain}</b>, puis rafraîchissez.</p>
            </div>
          </div>

          <div className="rounded-xl p-3 text-xs flex gap-2.5 mb-4 bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>Ajoutez ces enregistrements <b>uniquement sur le sous-domaine <code className="bg-white/60 px-1 rounded">{config.inboundSubdomain || "reply"}</code></b> — le MX de votre domaine racine (votre messagerie actuelle) n'est pas touché.</div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Type</th>
                  <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Nom / Hôte</th>
                  <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Valeur</th>
                  <th className="text-left px-3 py-2 font-semibold uppercase text-[10px] tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Aucun enregistrement — rafraîchissez.</td></tr>
                ) : records.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2.5 align-top">
                      <span className="font-mono text-[11px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{r.type}</span>
                      <div className="text-[10px] text-gray-400 mt-1">{r.purpose || "Réception"}{r.priority != null ? " · prio " + r.priority : ""}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top"><CopyCell text={r.name} /></td>
                    <td className="px-3 py-2.5 align-top"><CopyCell text={r.value} /></td>
                    <td className="px-3 py-2.5 align-top">
                      <span className={cn("text-[10px] font-bold", (r.status || "").toLowerCase() === "verified" ? "text-emerald-600" : "text-amber-600")}>
                        {(r.status || "").toLowerCase() === "verified" ? "✓ Détecté" : "… En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={refresh} disabled={pending} className="btn-primary py-2 px-4 text-sm">
              {pending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Rafraîchir le statut
            </button>
            <button onClick={disable} disabled={pending} className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5">
              <Trash2 size={13} /> Désactiver la réception
            </button>
          </div>
        </>
      )}

      {/* ── État 3 : réception active ── */}
      {status === "VERIFIED" && (
        <>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Inbox size={17} /></div>
            <div>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Réception <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">Active</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Les réponses de vos prospects arrivent sur votre domaine et remontent dans la boîte de réception du bon prospect.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Les réponses arrivent via {replyDomain}</p>
              <p className="text-xs text-gray-500 mt-0.5">Chaque réponse est rattachée automatiquement au bon prospect.</p>
            </div>
          </div>

          <div className="text-sm">
            <Row k="Adresse de réponse" v={`reply+{prospect}@${replyDomain}`} mono />
            <Row k="Enregistrement MX" v="✓ Détecté" />
            <Row k="Activée le" v={inboundDate} />
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={refresh} disabled={pending} className="btn-secondary py-1.5 px-3 text-xs">{pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-vérifier</button>
            <button onClick={disable} disabled={pending} className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1.5"><Trash2 size={13} /> Désactiver la réception</button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="w-32 shrink-0 text-gray-500">{k}</span>
      <span className={cn("text-gray-900 font-medium break-all", mono && "font-mono text-[13px]")}>{v}</span>
    </div>
  );
}

function CopyCell({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  };
  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[11px] text-gray-800 break-all">{text}</span>
      <button onClick={copy} className="shrink-0 border border-gray-200 rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-800 hover:border-gray-300 inline-flex items-center gap-1">
        {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
