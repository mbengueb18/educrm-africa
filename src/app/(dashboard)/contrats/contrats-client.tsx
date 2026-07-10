"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer, Upload, Download, Loader2, Check, FileCheck2, ShieldCheck, Clock, RefreshCw,
} from "lucide-react";
import type { ContractView } from "@/lib/contracts/template";
import { getSignedContractUrl } from "./actions";

type Contract = {
  id: string; reference: string; plan: string; status: string;
  signedFileName: string | null; signedSize: number | null; signedAt: string | null;
  uploadedByName: string | null; validatedAt: string | null; createdAt: string;
};

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  BROUILLON: { label: "Brouillon", cls: "bg-gray-100 text-gray-600", icon: Clock },
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

/** Champ à compléter, persistant en localStorage (aide au remplissage avant impression). */
function Field({ id, name, placeholder, width, block }: { id: string; name: string; placeholder: string; width?: number; block?: boolean }) {
  const key = `contract:${id}:${name}`;
  const [val, setVal] = useState("");
  useEffect(() => {
    try { const v = localStorage.getItem(key); if (v != null) setVal(v); } catch { /* ignore */ }
  }, [key]);
  return (
    <input
      value={val}
      onChange={(e) => { setVal(e.target.value); try { localStorage.setItem(key, e.target.value); } catch { /* ignore */ } }}
      placeholder={placeholder}
      autoComplete="off"
      className={`contract-field align-baseline bg-brand-50/40 border border-gray-200 rounded px-1.5 py-0.5 text-gray-900 focus:outline-none focus:border-brand-500 ${block ? "block w-full mt-1" : "inline-block"}`}
      style={block ? undefined : { width: (width || 150) + "px", maxWidth: "100%" }}
    />
  );
}

export function ContratsClient({ orgName, contract, view }: { orgName: string; contract: Contract; view: ContractView }) {
  const router = useRouter();
  const st = STATUS_META[contract.status] || STATUS_META.A_SIGNER;
  const StatusIcon = st.icon;
  const isSigned = contract.status === "SIGNE_RECU" || contract.status === "VALIDE";

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
          .contract-field { border: 0 !important; background: transparent !important; }
          @page { size: A4; margin: 16mm 14mm; }
        }
      `}</style>

      {/* En-tête écran + actions */}
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
        <p>
          Complétez les champs à compléter, <b>imprimez le contrat en PDF</b>, faites-le signer, puis
          <b> redéposez-le signé ci-dessous</b>. Une copie part automatiquement à contact@talibcrm.com et notre
          équipe le valide.
        </p>
      </div>

      {/* ── Feuille contrat (imprimable) ── */}
      <div className="contract-print bg-white rounded-xl border border-gray-200 shadow-sm px-8 sm:px-12 py-10">
        {/* Entête */}
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
            <div>Version du modèle : <b className="text-gray-800">1.0</b></div>
            <div>Établi le : <b className="text-gray-800">{fmtDate(contract.createdAt)}</b></div>
          </div>
        </div>

        {/* Titre */}
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
              <b>TalibCRM</b>, <Field id={contract.id} name="ed_raison" placeholder="raison sociale et forme juridique" width={210} />, immatriculée sous le <Field id={contract.id} name="ed_rccm" placeholder="n° RCCM / registre" width={150} />, dont le siège est situé <Field id={contract.id} name="ed_adresse" placeholder="adresse du siège" block />
              représentée par <Field id={contract.id} name="ed_signnom" placeholder="nom du signataire" width={160} />, <Field id={contract.id} name="ed_signqual" placeholder="qualité" width={110} />. Contact : contact@talibcrm.com.
            </p>
          </div>
          <div className="p-4 border-t sm:border-t-0 sm:border-l border-gray-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-2">Le Client</div>
            <p className="text-[12.5px] leading-relaxed text-gray-700">
              <b>{orgName}</b>, <Field id={contract.id} name="cl_forme" placeholder="forme juridique" width={140} />, immatriculée sous le <Field id={contract.id} name="cl_rccm" placeholder="n° RCCM / registre" width={150} />, dont le siège est situé <Field id={contract.id} name="cl_adresse" placeholder="adresse du siège" block />
              représentée par <Field id={contract.id} name="cl_signnom" placeholder="nom du signataire" width={160} />, <Field id={contract.id} name="cl_signqual" placeholder="qualité" width={110} />.
            </p>
          </div>
        </div>

        <p className="font-serif italic text-[13px] text-gray-600 mt-5">
          Ci-après désignés ensemble « les Parties » et individuellement « une Partie ». Il a été convenu et arrêté ce qui suit.
        </p>

        {/* Articles */}
        <Clause n="1" title="Objet du contrat">
          Le présent contrat a pour objet de définir les conditions dans lesquelles l'Éditeur met à la disposition du
          Client, en mode logiciel-service (SaaS) accessible en ligne, la plateforme TalibCRM (« le Service »), un
          logiciel de gestion de la relation prospects et étudiants destiné aux établissements d'enseignement et de
          formation, au titre de l'offre « {view.planName} » décrite à l'article 3.
        </Clause>

        <Clause n="2" title="Documents contractuels">
          Le contrat est formé du présent document, de ses Conditions Particulières (article 3) et, par renvoi, des
          Conditions Générales d'Utilisation et de la Politique de confidentialité publiées sur talibcrm.com, que le
          Client déclare avoir lues et acceptées. En cas de contradiction, les stipulations du présent contrat et de ses
          Conditions Particulières prévalent sur les documents généraux.
        </Clause>

        <Clause n="3" title="Description de l'offre souscrite">
          Le Client souscrit à l'offre « {view.planName} », dont le périmètre fonctionnel et les limites d'usage sont
          détaillés dans les Conditions Particulières ci-dessous. Les fonctionnalités non listées relèvent, le cas
          échéant, d'une offre supérieure ou d'options facturées séparément (article 6).
          <div className="mt-3 border border-gray-300 rounded-lg overflow-hidden not-prose">
            <div className="bg-brand-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-700 border-b border-gray-200">
              Conditions Particulières — Offre « {view.planName} »
            </div>
            <table className="w-full text-[12.5px]">
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
            </table>
          </div>
        </Clause>

        <Clause n="4" title="Durée, prise d'effet et reconduction">
          Le contrat prend effet à la date d'activation de l'abonnement. Il est conclu pour la période d'engagement
          choisie par le Client — mensuelle ou annuelle — telle que retenue à l'article 5. À l'échéance, il se reconduit
          tacitement par périodes successives de même durée, sauf résiliation par l'une des Parties dans les conditions
          de l'article 13.
        </Clause>

        <Clause n="5" title="Prix et modalités de paiement">
          Le prix de l'abonnement est fixé, selon la formule retenue par le Client, à :
          <ul className="list-disc pl-5 my-2 space-y-1">
            <li><b>Facturation mensuelle</b> — {view.priceMonthly} HT par mois ;</li>
            <li><b>Engagement annuel</b> — {view.priceYearlyEq} HT par mois, facturés en une fois pour un total de {view.priceYearlyTotal} HT par an.</li>
          </ul>
          <div className="not-prose flex flex-wrap items-center gap-4 my-2 text-[12.5px] text-gray-800">
            Formule retenue :
            <label className="inline-flex items-center gap-1.5">☐ Mensuelle</label>
            <label className="inline-flex items-center gap-1.5">☐ Annuelle</label>
          </div>
          Les prix s'entendent hors taxes ; les taxes applicables sont ajoutées le cas échéant. Les factures sont
          payables à réception. Tout retard de paiement peut entraîner, après mise en demeure restée sans effet, la
          suspension du Service (article 13). Les tarifs peuvent être révisés à chaque reconduction, moyennant un
          préavis d'au moins trente (30) jours.
        </Clause>

        <Clause n="6" title="Options et services complémentaires">
          Le Client peut souscrire, en cours de contrat, les options et prestations suivantes, facturées en sus :
          <p className="font-sans text-[12.5px] font-bold text-gray-900 mt-3 mb-1">Utilisateurs supplémentaires</p>
          Au-delà des {view.usersIncluded} utilisateurs inclus et dans la limite de {view.usersMax}, chaque utilisateur
          supplémentaire est facturé {view.extraUser} HT par mois.
          <p className="font-sans text-[12.5px] font-bold text-gray-900 mt-3 mb-1">Crédits IA supplémentaires</p>
          En cas de dépassement du quota d'actions IA, des packs de crédits sont disponibles :
          <table className="not-prose w-full text-[12px] border-collapse my-2">
            <thead><tr className="bg-brand-50 text-brand-700"><Th>Pack</Th><Th>Actions IA</Th><Th>Prix (FCFA HT)</Th></tr></thead>
            <tbody>
              <tr><Td>Pack 1</Td><Td right>1 000</Td><Td right>10 000</Td></tr>
              <tr><Td>Pack 2</Td><Td right>5 000</Td><Td right>40 000</Td></tr>
              <tr><Td>Pack 3</Td><Td right>20 000</Td><Td right>120 000</Td></tr>
            </tbody>
          </table>
          {!view.iaIncluded && view.iaAddonPrice && (
            <span>L'assistant IA peut aussi être activé en add-on mensuel à {view.iaAddonPrice} HT/mois.</span>
          )}
          <p className="font-sans text-[12.5px] font-bold text-gray-900 mt-3 mb-1">Services ponctuels (one-shot)</p>
          <table className="not-prose w-full text-[12px] border-collapse my-1">
            <thead><tr className="bg-brand-50 text-brand-700"><Th>Prestation</Th><Th>Prix (FCFA HT)</Th></tr></thead>
            <tbody>
              <tr><Td>Formation de l'équipe sur site à Dakar (1 journée)</Td><Td right>250 000</Td></tr>
              <tr><Td>Formation de l'équipe en ligne (1 journée)</Td><Td right>200 000</Td></tr>
              <tr><Td>Migration depuis HubSpot / Pipedrive / Salesforce</Td><Td right>150 000</Td></tr>
            </tbody>
          </table>
        </Clause>

        <Clause n="7" title="Obligations et engagement de service de l'Éditeur">
          L'Éditeur s'engage à fournir le Service conformément aux Conditions Particulières et à mettre en œuvre les
          moyens raisonnables pour en assurer la continuité et la sécurité. Il vise un taux de disponibilité mensuel de
          <b> {view.slaPercent}</b>, hors interruptions planifiées de maintenance notifiées à l'avance et hors force
          majeure (article 15).{" "}
          {view.compensation
            ? `En cas de non-respect caractérisé de ce taux sur un mois donné, le Client bénéficie, sur demande, d'un (1) mois d'abonnement offert à titre de compensation forfaitaire, à l'exclusion de toute autre indemnité.`
            : `Le présent plan ne prévoit pas de compensation financière au titre du SLA ; l'Éditeur s'engage sur des moyens raisonnables pour rétablir le Service dans les meilleurs délais.`}
          <br />Le support est assuré selon les modalités suivantes : {view.supportText}
        </Clause>

        <Clause n="8" title="Obligations du Client">
          Le Client s'engage à utiliser le Service conformément aux lois applicables et aux Conditions Générales
          d'Utilisation. Il s'interdit notamment :
          <ul className="list-disc pl-5 my-2 space-y-1">
            <li>d'envoyer des messages non sollicités (spam) ou frauduleux, par email ou WhatsApp ;</li>
            <li>d'importer ou de traiter des données personnelles sans base légale ni consentement approprié ;</li>
            <li>de tenter de compromettre la sécurité ou l'intégrité de la plateforme ;</li>
            <li>de céder ou partager ses accès en dehors du nombre d'utilisateurs souscrits.</li>
          </ul>
          Le Client est responsable de l'exactitude des données qu'il importe, de la gestion des accès de ses
          utilisateurs et du respect des règles propres aux canaux utilisés (notamment les politiques de Meta pour
          WhatsApp).
        </Clause>

        <Clause n="9" title="Données personnelles">
          Dans le cadre du Service, l'Éditeur agit en qualité de sous-traitant des données personnelles traitées pour le
          compte du Client, responsable de traitement. L'Éditeur traite ces données sur instruction du Client, dans le
          seul but de fournir le Service, et met en œuvre des mesures techniques et organisationnelles appropriées pour
          en assurer la sécurité. Les modalités détaillées figurent dans la Politique de confidentialité, qui vaut annexe.
        </Clause>

        <Clause n="10" title="Propriété intellectuelle">
          L'Éditeur demeure titulaire de l'ensemble des droits de propriété intellectuelle relatifs à la plateforme
          TalibCRM. Le présent contrat confère au Client un simple droit d'usage personnel, non exclusif et non cessible
          du Service pendant sa durée. Le Client conserve la pleine propriété des données et contenus qu'il importe.
        </Clause>

        <Clause n="11" title="Confidentialité">
          Chaque Partie s'engage à préserver la confidentialité des informations non publiques communiquées par l'autre
          Partie à l'occasion du contrat, et à ne les utiliser que pour les besoins de son exécution. Cet engagement
          demeure en vigueur pendant toute la durée du contrat et deux (2) ans après son terme.
        </Clause>

        <Clause n="12" title="Responsabilité">
          L'Éditeur est tenu d'une obligation de moyens. Sa responsabilité ne saurait être engagée pour les dommages
          indirects (notamment perte de chiffre d'affaires, de clientèle ou de données imputable au Client). En tout état
          de cause, la responsabilité de l'Éditeur, toutes causes confondues, est plafonnée au montant des sommes
          effectivement versées par le Client au titre des douze (12) mois précédant le fait générateur.
        </Clause>

        <Clause n="13" title="Suspension et résiliation">
          Chaque Partie peut résilier le contrat à l'échéance de la période d'engagement en cours, moyennant un préavis
          de trente (30) jours. En cas de manquement grave d'une Partie non réparé dans un délai de quinze (15) jours
          après mise en demeure, l'autre Partie peut résilier de plein droit. L'Éditeur peut suspendre l'accès au Service
          en cas de défaut de paiement ou d'abus avéré, après information du Client sauf urgence.
        </Clause>

        <Clause n="14" title="Réversibilité des données">
          À tout moment pendant le contrat et pendant trente (30) jours après son terme, le Client peut exporter ses
          données dans un format standard exploitable (CSV/Excel). Passé ce délai, l'Éditeur procède à la suppression des
          données du Client, sous réserve des obligations légales de conservation.
        </Clause>

        <Clause n="15" title="Force majeure">
          Aucune Partie ne pourra être tenue responsable d'un manquement résultant d'un cas de force majeure, tel que
          défini par la loi et la jurisprudence, y compris les défaillances des réseaux, hébergeurs ou fournisseurs tiers
          (notamment Meta pour WhatsApp) échappant à son contrôle raisonnable.
        </Clause>

        <Clause n="16" title="Modifications">
          L'Éditeur peut faire évoluer les fonctionnalités du Service et mettre à jour les documents généraux. Toute
          modification substantielle affectant les conditions essentielles du présent contrat est notifiée au Client, qui
          pourra, s'il la refuse, résilier sans pénalité avant sa prise d'effet.
        </Clause>

        <Clause n="17" title="Droit applicable et règlement des litiges">
          Le présent contrat est régi par le droit applicable au siège de l'Éditeur. En cas de différend, les Parties
          s'efforceront de trouver une solution amiable ; à défaut, le litige sera porté devant les juridictions
          compétentes du ressort du siège de l'Éditeur, sous réserve des dispositions légales impératives.
        </Clause>

        {/* Signatures */}
        <div className="mt-9" style={{ pageBreakInside: "avoid" }}>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Signatures</h3>
          <p className="font-serif text-[13px] text-gray-700 mb-4">
            Fait à <Field id={contract.id} name="lieu" placeholder="ville" width={120} />, le <Field id={contract.id} name="datefait" placeholder="jj/mm/aaaa" width={110} />, en deux (2) exemplaires originaux.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SignBox id={contract.id} party="ed" who="Pour l'Éditeur — TalibCRM" closing="Bon pour accord" />
            <SignBox id={contract.id} party="cl" who="Pour le Client" closing="Lu et approuvé" />
          </div>
        </div>

        <p className="mt-8 pt-4 border-t border-gray-200 text-[10.5px] leading-relaxed text-gray-500">
          <b>Modèle indicatif.</b> Document à compléter puis à faire valider par un conseil juridique avant signature.
          Tarifs et limites : grille TalibCRM V1.0, hors taxes. TalibCRM · contact@talibcrm.com
        </p>
      </div>

      {/* ── Zone d'upload / statut (écran) ── */}
      <div className="no-print mt-6">
        {isSigned ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
              <FileCheck2 size={18} /> Contrat signé reçu
            </div>
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
            <div className="flex items-center gap-2 text-gray-900 font-semibold text-sm mb-1">
              <Upload size={18} className="text-brand-600" /> Déposer le contrat signé
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Une fois le contrat imprimé et signé par les deux parties, redéposez-le ici (PDF ou photo, max 15 Mo).
              Il sera archivé et envoyé à notre équipe.
            </p>
            <UploadButton contractId={contract.id} label="Choisir le fichier signé" icon="upload" onDone={() => router.refresh()} />
          </div>
        )}
      </div>
    </div>
  );
}

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <article className="mt-6">
      <h3 className="flex items-baseline gap-2.5 text-sm font-bold text-gray-900 pb-1.5 mb-2 border-b border-gray-200">
        <span className="text-[11.5px] font-extrabold text-brand-600 tabular-nums">Art. {n}</span> {title}
      </h3>
      <div className="font-serif text-[13.5px] leading-relaxed text-gray-700">{children}</div>
    </article>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-bold border border-gray-200 px-3 py-1.5">{children}</th>;
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`border border-gray-200 px-3 py-1.5 text-gray-700 ${right ? "text-right tabular-nums font-semibold" : ""}`}>{children}</td>;
}

function SignBox({ id, party, who, closing }: { id: string; party: string; who: string; closing: string }) {
  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 mb-3">{who}</div>
      <div className="text-[12px] text-gray-500 leading-loose">
        Nom : <Field id={id} name={`${party}_signnom`} placeholder="nom du signataire" width={170} /><br />
        Qualité : <Field id={id} name={`${party}_signqual`} placeholder="fonction" width={170} />
      </div>
      <div className="mt-3 h-16 border-t border-dashed border-gray-300 pt-1.5 text-[10.5px] italic text-gray-400">
        Signature &amp; cachet — « {closing} »
      </div>
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
