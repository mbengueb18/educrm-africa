"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  saveIntegration,
  toggleIntegrationActive,
  deleteIntegration,
  testConnection,
} from "./actions";
import { OnboardingWizard } from "./onboarding-wizard";
import {
  MessageCircle, Save, Loader2, Eye, EyeOff, CheckCircle, AlertCircle,
  Copy, Check, Trash2, BookOpen, ExternalLink, AlertTriangle, Power, Zap,
} from "lucide-react";

interface Integration {
  id: string;
  organizationId: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  isActive: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  integration: Integration | null;
  webhookUrl: string;
}

export function IntegrationClient({ integration, webhookUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [phoneNumberId, setPhoneNumberId] = useState(integration?.phoneNumberId || "");
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState(
    integration?.whatsappBusinessAccountId || ""
  );
  const [accessToken, setAccessToken] = useState(integration?.accessToken || "");
  const [verifyToken, setVerifyToken] = useState(integration?.verifyToken || "");
  const [appSecret, setAppSecret] = useState(integration?.appSecret || "");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(integration?.displayPhoneNumber || "");
  const [verifiedName, setVerifiedName] = useState(integration?.verifiedName || "");

  // UI state
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  // ─── Generate random verify token ───
  const generateVerifyToken = () => {
    const random =
      "talibcrm_" +
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    setVerifyToken(random);
  };

  // ─── Copy to clipboard ───
  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success("Copié");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ─── Save ───
  const handleSave = () => {
    if (!phoneNumberId.trim() || !whatsappBusinessAccountId.trim() || !accessToken.trim() || !verifyToken.trim() || !appSecret.trim()) {
      toast.error("Tous les champs marqués * sont requis");
      return;
    }
    startTransition(async () => {
      try {
        await saveIntegration({
          phoneNumberId,
          whatsappBusinessAccountId,
          accessToken,
          verifyToken,
          appSecret,
          displayPhoneNumber: displayPhoneNumber || undefined,
          verifiedName: verifiedName || undefined,
        });
        toast.success("Intégration sauvegardée");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  // ─── Toggle active ───
  const handleToggleActive = () => {
    if (!integration) return;
    startTransition(async () => {
      try {
        await toggleIntegrationActive(!integration.isActive);
        toast.success(integration.isActive ? "Intégration désactivée" : "Intégration réactivée");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  // ─── Test connexion ───
  const handleTestConnection = () => {
    startTransition(async () => {
      try {
        const result = await testConnection();
        toast.success(
          `Connexion OK : ${result.verifiedName || "Numéro vérifié"} (${result.displayPhoneNumber || ""})${result.qualityRating ? ` · Qualité : ${result.qualityRating}` : ""}`,
          { duration: 6000 }
        );
        router.refresh();
      } catch (e: any) {
        toast.error(e.message, { duration: 6000 });
      }
    });
  };

  // ─── Delete ───
  const handleDelete = () => {
    if (!confirm("Supprimer l'intégration WhatsApp ? Vous ne pourrez plus envoyer de campagnes ni recevoir de messages tant que vous ne la reconfigurez pas.")) return;
    startTransition(async () => {
      try {
        await deleteIntegration();
        toast.success("Intégration supprimée");
        // Réinitialiser le form
        setPhoneNumberId("");
        setWhatsappBusinessAccountId("");
        setAccessToken("");
        setVerifyToken("");
        setAppSecret("");
        setDisplayPhoneNumber("");
        setVerifiedName("");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const isConfigured = integration !== null;
  const isActive = integration?.isActive ?? false;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Intégration WhatsApp
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configurez votre compte WhatsApp Business pour envoyer et recevoir des messages
          </p>
        </div>
        <Link
          href="/settings/whatsapp-integration/guide"
          className="btn-secondary text-sm"
        >
          <BookOpen size={14} />
          Guide d'installation
        </Link>
      </div>

      {/* Status banner */}
      <div className={cn(
        "rounded-xl border-2 p-4 mb-6 flex items-start gap-3",
        isConfigured && isActive
          ? "bg-emerald-50 border-emerald-200"
          : isConfigured && !isActive
          ? "bg-amber-50 border-amber-200"
          : "bg-gray-50 border-gray-200"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          isConfigured && isActive
            ? "bg-emerald-100 text-emerald-700"
            : isConfigured && !isActive
            ? "bg-amber-100 text-amber-700"
            : "bg-gray-100 text-gray-500"
        )}>
          {isConfigured && isActive ? (
            <CheckCircle size={20} />
          ) : isConfigured && !isActive ? (
            <AlertCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">
            {isConfigured && isActive
              ? "WhatsApp est actif"
              : isConfigured && !isActive
              ? "WhatsApp est désactivé"
              : "WhatsApp n'est pas configuré"}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {isConfigured && isActive
              ? `Numéro : ${integration?.displayPhoneNumber || "—"} · ${integration?.verifiedName || "—"}`
              : isConfigured && !isActive
              ? "Vos campagnes WhatsApp et la réception de messages sont en pause."
              : "Saisissez vos credentials Meta pour activer les campagnes WhatsApp."}
          </p>
        </div>
        {isConfigured && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTestConnection}
              disabled={isPending || !isActive}
              className="btn-secondary py-1.5 px-3 text-xs"
              title={!isActive ? "Activez d'abord l'intégration" : "Tester la connexion Meta"}
            >
              <Zap size={12} />
              Tester
            </button>
            <button
              onClick={handleToggleActive}
              disabled={isPending}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <Power size={12} />
              {isActive ? "Désactiver" : "Activer"}
            </button>
          </div>
        )}
      </div>

      {/* Wizard d'onboarding guidé (première configuration) */}
      {!isConfigured && (
        <div className="mb-6">
          <OnboardingWizard webhookUrl={webhookUrl} onDone={() => router.refresh()} />
          <div className="mt-3 text-center">
            <button
              onClick={() => setShowManual((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {showManual ? "Masquer la configuration manuelle" : "Configuration manuelle avancée"}
            </button>
          </div>
        </div>
      )}

      {/* Sections manuelles : visibles si déjà configuré (édition) ou repli expert */}
      {(isConfigured || showManual) && (
        <>
      {/* Webhook URL section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-1">URL Webhook (à configurer côté Meta)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Copiez cette URL dans Meta Developer Console → WhatsApp → Webhooks → Callback URL
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">
            {webhookUrl}
          </code>
          <button
            onClick={() => copyToClipboard(webhookUrl, "webhook")}
            className="btn-secondary py-2 px-3 text-xs shrink-0"
          >
            {copiedField === "webhook" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copiedField === "webhook" ? "Copié" : "Copier"}
          </button>
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-[11px] text-blue-800">
            ℹ️ Dans Meta Console, vous devrez aussi saisir le <strong>Verify Token</strong> (champ ci-dessous) et vous abonner aux événements <code className="bg-white px-1 rounded">messages</code>.
          </p>
        </div>
      </div>

      {/* Form section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-1">Credentials Meta</h2>
        <p className="text-xs text-gray-500 mb-5">
          Tous ces identifiants se trouvent dans votre App Meta sur{" "}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
          >
            developers.facebook.com <ExternalLink size={9} />
          </a>
        </p>

        <div className="space-y-4">
          {/* Phone Number ID */}
          <Field
            label="Phone Number ID"
            required
            help="ID du numéro de téléphone WhatsApp (chiffres uniquement)"
            value={phoneNumberId}
            onChange={setPhoneNumberId}
            placeholder="123456789012345"
          />

          {/* WABA ID */}
          <Field
            label="WhatsApp Business Account ID"
            required
            help="ID du WhatsApp Business Account (visible dans Meta Business Manager)"
            value={whatsappBusinessAccountId}
            onChange={setWhatsappBusinessAccountId}
            placeholder="987654321098765"
          />

          {/* Access Token (secret) */}
          <SecretField
            label="Access Token (permanent)"
            required
            help="Token permanent généré via un System User dans Meta Business Manager"
            value={accessToken}
            onChange={setAccessToken}
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            visible={showAccessToken}
            onToggleVisibility={() => setShowAccessToken(!showAccessToken)}
          />

          {/* App Secret (secret) */}
          <SecretField
            label="App Secret"
            required
            help="Secret de l'app Meta (utilisé pour vérifier la signature des webhooks)"
            value={appSecret}
            onChange={setAppSecret}
            placeholder="abc123def456..."
            visible={showAppSecret}
            onToggleVisibility={() => setShowAppSecret(!showAppSecret)}
          />

          {/* Verify Token */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">
                Verify Token <span className="text-red-500">*</span>
              </label>
              <button
                onClick={generateVerifyToken}
                className="text-[10px] text-emerald-600 hover:underline"
                type="button"
              >
                Générer un token aléatoire
              </button>
            </div>
            <input
              type="text"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              className="input text-sm font-mono"
              placeholder="talibcrm_xxxxxxxxxxxxxx"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Token de votre choix. Vous devez le reporter exactement à l'identique dans Meta Console → Webhooks.
            </p>
          </div>

          {/* Display info (optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <Field
              label="Numéro affiché (optionnel)"
              value={displayPhoneNumber}
              onChange={setDisplayPhoneNumber}
              placeholder="+221 77 123 45 67"
              help="Pour affichage uniquement dans TalibCRM"
            />
            <Field
              label="Nom vérifié (optionnel)"
              value={verifiedName}
              onChange={setVerifiedName}
              placeholder="Performance Digitale"
              help="Nom affiché côté WhatsApp"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
          {isConfigured && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="btn-secondary py-1.5 px-4 text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 size={12} />
              Supprimer l'intégration
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn-primary py-1.5 px-4 text-xs"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isConfigured ? "Enregistrer les modifications" : "Configurer WhatsApp"}
          </button>
        </div>
      </div>

      {/* Help banner */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <BookOpen size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Première configuration ?</p>
            <p className="text-xs text-amber-800 mt-1">
              Configurer WhatsApp Business demande quelques étapes côté Meta Business Manager.{" "}
              <Link href="/settings/whatsapp-integration/guide" className="font-semibold underline">
                Consultez le guide d'installation
              </Link>{" "}
              pour un tutoriel pas-à-pas.
            </p>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ─── Field component ───
function Field({
  label,
  required,
  help,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-sm font-mono"
        placeholder={placeholder}
      />
      {help && <p className="text-[10px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

// ─── Secret field with show/hide ───
function SecretField({
  label,
  required,
  help,
  value,
  onChange,
  placeholder,
  visible,
  onToggleVisibility,
}: {
  label: string;
  required?: boolean;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input text-sm font-mono pr-10"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {help && <p className="text-[10px] text-gray-400 mt-1">{help}</p>}
    </div>
  );
}