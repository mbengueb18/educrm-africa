"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { discoverPhoneNumbers, saveIntegration, testConnection } from "./actions";
import {
  MessageCircle, Loader2, Eye, EyeOff, Copy, Check, ExternalLink,
  ChevronRight, ChevronLeft, CheckCircle2, Phone, ShieldCheck, Zap,
  Search, BookOpen, HelpCircle, ChevronDown,
} from "lucide-react";

interface DiscoveredNumber {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating: string | null;
  codeVerificationStatus: string | null;
}

interface Props {
  webhookUrl: string;
  onDone: () => void;
}

const STEPS = ["Prérequis", "Connexion Meta", "Webhook", "Activation"];

// Verify token pré-généré (l'école n'a plus à l'inventer)
function makeVerifyToken() {
  return (
    "talibcrm_" +
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
  );
}

export function OnboardingWizard({ webhookUrl, onDone }: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  // Étape 0 — prérequis
  const [prereqs, setPrereqs] = useState({ number: false, business: false, verified: false });

  // Étape 1 — credentials + découverte
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [numbers, setNumbers] = useState<DiscoveredNumber[] | null>(null);
  const [selectedId, setSelectedId] = useState("");

  // Étape 2 — webhook
  const [verifyToken] = useState(makeVerifyToken);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [webhookConfirmed, setWebhookConfirmed] = useState(false);

  const selected = numbers?.find((n) => n.id === selectedId) || null;

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copié");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Étape 1 : découverte des numéros ───
  const handleDiscover = () => {
    if (!wabaId.trim() || !accessToken.trim() || !appSecret.trim()) {
      toast.error("Renseignez les 3 champs avant de continuer");
      return;
    }
    startTransition(async () => {
      try {
        const res = await discoverPhoneNumbers({
          whatsappBusinessAccountId: wabaId,
          accessToken,
        });
        setNumbers(res.numbers);
        // Auto-sélection si un seul numéro
        if (res.numbers.length === 1) setSelectedId(res.numbers[0].id);
        toast.success(
          res.numbers.length === 1
            ? "Numéro détecté automatiquement ✓"
            : `${res.numbers.length} numéros détectés`
        );
      } catch (e: any) {
        setNumbers(null);
        toast.error(e.message);
      }
    });
  };

  // ─── Étape finale : enregistrer + tester ───
  const handleFinish = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await saveIntegration({
          phoneNumberId: selected.id,
          whatsappBusinessAccountId: wabaId,
          accessToken,
          verifyToken,
          appSecret,
          displayPhoneNumber: selected.displayPhoneNumber || undefined,
          verifiedName: selected.verifiedName || undefined,
        });
        // Test non bloquant : si le webhook n'est pas encore validé côté Meta, l'envoi marche quand même
        try {
          await testConnection();
        } catch {
          /* le test peut échouer sans que la config soit invalide */
        }
        toast.success("WhatsApp est configuré et actif 🎉", { duration: 6000 });
        onDone();
      } catch (e: any) {
        toast.error(e.message, { duration: 6000 });
      }
    });
  };

  // ─── Navigation ───
  const canNext =
    step === 0
      ? prereqs.number && prereqs.business && prereqs.verified
      : step === 1
      ? !!selected
      : step === 2
      ? webhookConfirmed
      : true;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header + stepper */}
      <div className="bg-gradient-to-br from-emerald-50 to-white border-b border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Connexion guidée de WhatsApp</h2>
            <p className="text-xs text-gray-500">Quelques minutes, sans compétence technique.</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                  i < step ? "bg-emerald-500 text-white" : i === step ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300" : "bg-gray-100 text-gray-400"
                )}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={cn(
                  "text-[11px] font-medium truncate hidden sm:block",
                  i === step ? "text-gray-900" : "text-gray-400"
                )}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 flex-1 mx-2 rounded", i < step ? "bg-emerald-400" : "bg-gray-100")} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* ─── Étape 0 : Prérequis ─── */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Avant de commencer, assurez-vous d'avoir ces 3 éléments. Cochez pour continuer.
            </p>
            <div className="space-y-2">
              <PrereqItem
                checked={prereqs.number}
                onToggle={() => setPrereqs((p) => ({ ...p, number: !p.number }))}
                icon={Phone}
                title="Un numéro de téléphone dédié"
                desc="Non utilisé sur un WhatsApp personnel (il sera lié à WhatsApp Business)."
              />
              <PrereqItem
                checked={prereqs.business}
                onToggle={() => setPrereqs((p) => ({ ...p, business: !p.business }))}
                icon={ShieldCheck}
                title="Un compte Meta Business Manager"
                desc="Avec un WhatsApp Business Account (WABA) et une App Meta créés."
              />
              <PrereqItem
                checked={prereqs.verified}
                onToggle={() => setPrereqs((p) => ({ ...p, verified: !p.verified }))}
                icon={CheckCircle2}
                title="Business vérifié par Meta"
                desc="La vérification Meta peut prendre 1 à 7 jours (à faire en amont)."
              />
            </div>
            <HelpBox title="Je n'ai pas encore de compte Meta Business Manager">
              <ol className="list-decimal list-inside space-y-1">
                <li>Créez-le gratuitement sur <ExtLink href="https://business.facebook.com">business.facebook.com</ExtLink>.</li>
                <li>Prévoyez une carte bancaire pour la facturation Meta (les 1000 premiers messages/mois sont gratuits).</li>
                <li>Lancez la <strong>vérification de votre business</strong> dans Meta (délai 1 à 7 jours) — à faire tôt.</li>
              </ol>
            </HelpBox>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <BookOpen size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Vous préférez qu'on s'en occupe ? Notre équipe configure WhatsApp <strong>à votre place</strong> (inclus dans votre plan) —{" "}
                <a href="mailto:support@talibcrm.com" className="font-semibold underline">contactez le support</a>. Le{" "}
                <Link href="/settings/whatsapp-integration/guide" className="font-semibold underline">guide complet</Link> reste aussi disponible.
              </p>
            </div>
          </div>
        )}

        {/* ─── Étape 1 : Connexion Meta + découverte du numéro ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Copiez ces 3 identifiants depuis votre App Meta sur{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
                className="text-emerald-600 hover:underline inline-flex items-center gap-0.5">
                developers.facebook.com <ExternalLink size={9} />
              </a>. Nous détecterons votre numéro automatiquement.
            </p>

            <div className="space-y-2">
              <HelpBox title="Étape préalable : créer votre WABA et votre App Meta">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Sur <ExtLink href="https://business.facebook.com">business.facebook.com</ExtLink> → Paramètres → <strong>Comptes WhatsApp Business</strong> → Ajouter → créez un WABA et ajoutez votre numéro (vérification par SMS ou appel).</li>
                  <li>Sur <ExtLink href="https://developers.facebook.com/apps">developers.facebook.com/apps</ExtLink> → <strong>Create App</strong> → type « Business » → sélectionnez votre Business Manager → <strong>Add Product</strong> → <strong>WhatsApp</strong>.</li>
                </ol>
              </HelpBox>

              <HelpBox title="Générer l'Access Token permanent (le point le plus technique)">
                <p className="text-[11px] text-gray-500">Un token temporaire expire en 24 h. Pour un fonctionnement continu, générez un token permanent via un « System User » :</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Sur <ExtLink href="https://business.facebook.com/settings/system-users">business.facebook.com/settings/system-users</ExtLink> → <strong>Add</strong> → créez un System User avec le rôle <strong>Admin</strong>.</li>
                  <li><strong>Add Assets</strong> → ajoutez votre WABA <em>et</em> votre App Meta avec <strong>contrôle total</strong>.</li>
                  <li><strong>Generate New Token</strong> → sélectionnez votre app → cochez <code className="bg-gray-100 px-1 rounded">whatsapp_business_management</code>, <code className="bg-gray-100 px-1 rounded">whatsapp_business_messaging</code>, <code className="bg-gray-100 px-1 rounded">business_management</code>.</li>
                  <li>Expiration : <strong>Never</strong> → <strong>Generate Token</strong> → <strong>copiez-le immédiatement</strong> (il ne sera plus affiché).</li>
                </ol>
              </HelpBox>

              <HelpBox title="Où trouver le WABA ID et l'App Secret ?">
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>WABA ID</strong> : App Meta → WhatsApp → <strong>API Setup</strong>, en haut (« WhatsApp Business Account ID »).</li>
                  <li><strong>App Secret</strong> : App Meta → Settings → <strong>Basic</strong> → champ « App Secret » (cliquez sur « Show »).</li>
                  <li className="text-emerald-700"><strong>Phone Number ID</strong> : plus besoin de le chercher — on le détecte pour vous. 🎉</li>
                </ul>
              </HelpBox>
            </div>

            <WizardField
              label="WhatsApp Business Account ID (WABA ID)"
              value={wabaId}
              onChange={(v) => { setWabaId(v); setNumbers(null); setSelectedId(""); }}
              placeholder="987654321098765"
              help="Visible dans Meta Business Manager → Comptes WhatsApp."
            />
            <WizardSecret
              label="Access Token (permanent)"
              value={accessToken}
              onChange={(v) => { setAccessToken(v); setNumbers(null); setSelectedId(""); }}
              placeholder="EAAxxxxxxxxxxxxxxxxxxxxx"
              visible={showToken}
              onToggle={() => setShowToken(!showToken)}
              help="Généré via un System User (rôle Admin, permissions WhatsApp)."
            />
            <WizardSecret
              label="App Secret"
              value={appSecret}
              onChange={setAppSecret}
              placeholder="abc123def456..."
              visible={showSecret}
              onToggle={() => setShowSecret(!showSecret)}
              help="App Meta → Paramètres → Général. Sert à sécuriser la réception des messages."
            />

            <button
              onClick={handleDiscover}
              disabled={isPending}
              className="btn-secondary py-2 px-4 text-xs w-full sm:w-auto"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Vérifier et détecter mes numéros
            </button>

            {/* Résultat de la découverte */}
            {numbers && numbers.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  {numbers.length === 1 ? "Numéro détecté :" : "Choisissez le numéro à connecter :"}
                </p>
                <div className="space-y-2">
                  {numbers.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors",
                        selectedId === n.id ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        selectedId === n.id ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"
                      )}>
                        {selectedId === n.id ? <Check size={15} /> : <Phone size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {n.displayPhoneNumber || "Numéro"} {n.verifiedName && <span className="text-gray-500 font-normal">· {n.verifiedName}</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">ID : {n.id}</p>
                      </div>
                      {n.qualityRating && (
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{n.qualityRating}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Étape 2 : Webhook ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Dernière étape côté Meta : connectez le webhook pour <strong>recevoir</strong> les messages.
              Dans Meta Console → WhatsApp → Configuration → Webhooks, collez ces deux valeurs, cliquez
              « Vérifier et enregistrer », puis abonnez-vous à l'événement <code className="bg-gray-100 px-1 rounded text-[11px]">messages</code>.
            </p>

            <CopyRow label="Callback URL" value={webhookUrl} field="url" copiedField={copiedField} onCopy={copy} />
            <CopyRow label="Verify Token (pré-généré pour vous)" value={verifyToken} field="vt" copiedField={copiedField} onCopy={copy} />

            <HelpBox title="Comment coller ça dans Meta, étape par étape">
              <ol className="list-decimal list-inside space-y-1">
                <li>App Meta → WhatsApp → <strong>Configuration</strong> → section <strong>Webhook</strong> → <strong>Edit</strong>.</li>
                <li><strong>Callback URL</strong> : collez la 1ʳᵉ valeur ci-dessus.</li>
                <li><strong>Verify Token</strong> : collez la 2ᵉ valeur ci-dessus (à l'identique).</li>
                <li><strong>Verify and Save</strong>.</li>
                <li>Dans <strong>Webhook fields</strong>, abonnez-vous à l'événement <code className="bg-gray-100 px-1 rounded">messages</code> (« Subscribe »).</li>
              </ol>
              <p className="text-[11px] text-amber-700">⚠️ Si « The URL couldn't be validated » : ce n'est pas bloquant, réessayez plus tard. L'envoi de messages fonctionnera dès l'activation.</p>
            </HelpBox>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-gray-200 p-3 hover:border-emerald-300">
              <input
                type="checkbox"
                checked={webhookConfirmed}
                onChange={(e) => setWebhookConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 mt-0.5"
              />
              <span className="text-sm text-gray-700">
                J'ai collé ces valeurs dans Meta et abonné mon app à l'événement <strong>messages</strong>.
              </span>
            </label>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-[11px] text-blue-800">
                💡 Pas grave si le webhook n'est pas parfait du premier coup : vous pourrez le revérifier à tout moment. L'<strong>envoi</strong> de messages fonctionnera dès l'activation.
              </p>
            </div>
          </div>
        )}

        {/* ─── Étape 3 : Activation ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} /> Prêt à activer
              </p>
              <dl className="space-y-1.5 text-sm">
                <SummaryRow label="Numéro" value={selected ? `${selected.displayPhoneNumber || "—"}${selected.verifiedName ? " · " + selected.verifiedName : ""}` : "—"} />
                <SummaryRow label="WABA ID" value={wabaId} mono />
                <SummaryRow label="Webhook" value={webhookConfirmed ? "Configuré ✓" : "À vérifier"} />
              </dl>
            </div>
            <p className="text-xs text-gray-500">
              En cliquant sur « Activer WhatsApp », nous validons une dernière fois vos identifiants auprès de Meta,
              puis l'intégration devient active pour l'envoi et la réception.
            </p>
            <button
              onClick={handleFinish}
              disabled={isPending || !selected}
              className="btn-primary py-2.5 px-5 text-sm w-full sm:w-auto"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              Activer WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      {step < 3 && (
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={back}
            disabled={step === 0}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
          >
            <ChevronLeft size={13} /> Retour
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="btn-primary py-1.5 px-4 text-xs disabled:opacity-40"
            title={!canNext ? "Complétez cette étape pour continuer" : ""}
          >
            Continuer <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composants ───
function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-emerald-600 hover:underline inline-flex items-center gap-0.5">
      {children} <ExternalLink size={9} />
    </a>
  );
}

// Bloc d'aide dépliable — replie les instructions Meta directement dans l'étape
function HelpBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-gray-200 bg-gray-50/60">
      <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs font-semibold text-gray-700 hover:text-emerald-600 select-none list-none [&::-webkit-details-marker]:hidden">
        <HelpCircle size={13} className="text-gray-400 shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronDown size={13} className="text-gray-400 group-open:rotate-180 transition-transform shrink-0" />
      </summary>
      <div className="px-3 pb-3 pt-1 text-xs text-gray-600 leading-relaxed space-y-2">
        {children}
      </div>
    </details>
  );
}

function PrereqItem({ checked, onToggle, icon: Icon, title, desc }: any) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors",
        checked ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5",
        checked ? "bg-emerald-500 text-white" : "border-2 border-gray-300"
      )}>
        {checked && <Check size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Icon size={13} className="text-gray-400" /> {title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function CopyRow({ label, value, field, copiedField, onCopy }: {
  label: string; value: string; field: string; copiedField: string | null; onCopy: (t: string, f: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">{value}</code>
        <button onClick={() => onCopy(value, field)} className="btn-secondary py-2 px-3 text-xs shrink-0">
          {copiedField === field ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copiedField === field ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-emerald-700">{label}</dt>
      <dd className={cn("text-sm text-gray-900 truncate max-w-[60%]", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function WizardField({ label, value, onChange, placeholder, help }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; help?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label} <span className="text-red-500">*</span></label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm font-mono" placeholder={placeholder} />
      {help && <p className="text-[10px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

function WizardSecret({ label, value, onChange, placeholder, visible, onToggle, help }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; visible: boolean; onToggle: () => void; help?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label} <span className="text-red-500">*</span></label>
      <div className="relative">
        <input type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="input text-sm font-mono pr-10" placeholder={placeholder} />
        <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {help && <p className="text-[10px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}
