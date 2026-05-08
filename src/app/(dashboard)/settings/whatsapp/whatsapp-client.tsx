"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MessageCircle, CheckCircle2, AlertCircle, Loader2, Copy, Eye, EyeOff,
  Trash2, RefreshCw, ExternalLink, ShieldCheck, Info,
} from "lucide-react";
import { saveWhatsAppConfig, testWhatsAppConnection, disconnectWhatsApp } from "./actions";

interface Props {
  integration: {
    id: string;
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
    verifyToken: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    isActive: boolean;
    lastSyncedAt: string | null;
  } | null;
  webhookUrl: string;
}

export function WhatsAppSettingsClient({ integration, webhookUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSecrets, setShowSecrets] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const [form, setForm] = useState({
    phoneNumberId: integration?.phoneNumberId || "",
    whatsappBusinessAccountId: integration?.whatsappBusinessAccountId || "",
    accessToken: "",
    verifyToken: integration?.verifyToken || generateRandomToken(),
    appSecret: "",
  });

  function generateRandomToken() {
    return "talibcrm_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await saveWhatsAppConfig(form);
        toast.success(`Connecté ! Numéro : ${result.displayPhoneNumber}`);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur de connexion");
      }
    });
  };

  const handleTest = () => {
    startTransition(async () => {
      try {
        const result = await testWhatsAppConnection();
        toast.success(`Connexion OK · ${result.displayPhoneNumber} · Quality: ${result.qualityRating || "N/A"}`);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      try {
        await disconnectWhatsApp();
        toast.success("Intégration WhatsApp déconnectée");
        setShowDisconnect(false);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const isConnected = !!integration;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle size={22} className="text-emerald-600" />
          WhatsApp Cloud API
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Envoyez et recevez des messages WhatsApp depuis TalibCRM avec votre propre numéro Meta Business.
        </p>
      </div>

      {/* Statut */}
      {isConnected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-emerald-900">
                {integration.verifiedName || "WhatsApp connecté"}
              </h3>
              <p className="text-sm text-emerald-700 mt-1">
                {integration.displayPhoneNumber || "Numéro vérifié"}
                {integration.lastSyncedAt && (
                  <span className="text-xs text-emerald-600 ml-2">
                    · Vérifié {new Date(integration.lastSyncedAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleTest}
              disabled={pending}
              className="btn-secondary py-1.5 px-3 text-xs shrink-0"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Tester
            </button>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">
          {isConnected ? "Mettre à jour les credentials Meta" : "Connectez votre compte WhatsApp Business"}
        </h3>

        <div className="space-y-3">
          {/* Phone Number ID */}
          <Field label="Phone Number ID" hint="Trouvable dans Meta → WhatsApp → API Setup">
            <input
              type="text"
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="109876543210987"
              className="input"
            />
          </Field>

          {/* WABA ID */}
          <Field label="WhatsApp Business Account ID" hint="Aussi appelé WABA ID">
            <input
              type="text"
              value={form.whatsappBusinessAccountId}
              onChange={(e) => setForm({ ...form, whatsappBusinessAccountId: e.target.value })}
              placeholder="543210987654321"
              className="input"
            />
          </Field>

          {/* Access Token */}
          <Field label="Permanent Access Token" hint="Généré dans Business Settings → System Users">
            <div className="relative">
              <input
                type={showSecrets ? "text" : "password"}
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                placeholder={isConnected ? "•••••••• (laisser vide pour conserver)" : "EAAGm0PX4ZCpsBO..."}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          {/* App Secret */}
          <Field label="App Secret" hint="Trouvable dans Meta App Dashboard → Settings → Basic">
            <input
              type={showSecrets ? "text" : "password"}
              value={form.appSecret}
              onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
              placeholder={isConnected ? "•••••••• (laisser vide pour conserver)" : "abc123..."}
              className="input"
            />
          </Field>

          {/* Verify Token */}
          <Field
            label="Verify Token (webhook)"
            hint="Chaîne secrète que vous saisirez dans Meta lors de la config webhook. Inventez ce que vous voulez."
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={form.verifyToken}
                onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, verifyToken: generateRandomToken() })}
                className="btn-secondary py-1.5 px-3 text-xs shrink-0"
                title="Générer un nouveau"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </Field>

          <button
            onClick={handleSave}
            disabled={pending || !form.phoneNumberId || !form.whatsappBusinessAccountId}
            className="btn-primary mt-4 w-full"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {isConnected ? "Mettre à jour" : "Connecter à Meta"}
          </button>
        </div>
      </div>

      {/* Webhook info */}
      {isConnected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-900 mb-2">
                Configurer le webhook côté Meta
              </h3>
              <p className="text-xs text-blue-800 mb-3">
                Pour recevoir les réponses des leads, configurez ce webhook dans Meta Developer Dashboard → WhatsApp → Configuration → Webhook.
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-blue-900">Callback URL</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-white px-3 py-2 rounded text-xs font-mono text-blue-900 border border-blue-200 break-all">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => copy(webhookUrl, "URL")}
                      className="btn-secondary py-2 px-3 text-xs shrink-0"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-900">Verify Token</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-white px-3 py-2 rounded text-xs font-mono text-blue-900 border border-blue-200 break-all">
                      {integration.verifyToken}
                    </code>
                    <button
                      onClick={() => copy(integration.verifyToken, "Token")}
                      className="btn-secondary py-2 px-3 text-xs shrink-0"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-blue-700 mt-2">
                  ⚠️ N'oubliez pas de souscrire aux champs : <code className="bg-blue-100 px-1 rounded">messages</code> dans la section "Webhook fields".
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect */}
      {isConnected && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Trash2 size={14} className="text-red-500" />
                Déconnecter WhatsApp
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Arrête l'envoi/réception via WhatsApp. Vos messages historiques sont conservés.
              </p>
            </div>
            {!showDisconnect ? (
              <button
                onClick={() => setShowDisconnect(true)}
                className="btn-secondary py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                Déconnecter
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowDisconnect(false)} className="btn-secondary py-1.5 px-3 text-xs">
                  Annuler
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={pending}
                  className="btn-primary py-1.5 px-3 text-xs bg-red-600 hover:bg-red-700"
                >
                  Confirmer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}