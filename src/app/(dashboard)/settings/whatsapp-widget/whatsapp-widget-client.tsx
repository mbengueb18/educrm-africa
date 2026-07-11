"use client";

import { useState, useTransition } from "react";
import { updateWhatsAppWidgetConfig } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check,
  Loader2,
  MessageCircle,
  Power,
  Copy,
  AlertTriangle,
  Phone,
} from "lucide-react";

interface WidgetConfig {
  id: string;
  enabled: boolean;
  title: string;
  welcomeMessage: string;
  replyTimeText: string;
  prefilledMessage: string;
  primaryColor: string;
  position: string;
}

export function WhatsAppWidgetClient({
  config,
  orgSlug,
  numberConnected,
  displayPhoneNumber,
  verifiedName,
}: {
  config: WidgetConfig;
  orgSlug: string;
  numberConnected: boolean;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [title, setTitle] = useState(config.title);
  const [welcomeMessage, setWelcomeMessage] = useState(config.welcomeMessage);
  const [replyTimeText, setReplyTimeText] = useState(config.replyTimeText);
  const [prefilledMessage, setPrefilledMessage] = useState(config.prefilledMessage);
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor);
  const [position, setPosition] = useState(config.position);
  const [isPending, startTransition] = useTransition();

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://app.talibcrm.com";
  const snippet = `<!-- Widget WhatsApp TalibCRM — coller avant </body> -->\n<script src="${baseUrl}/api/widget/whatsapp.js?org=${orgSlug || "VOTRE_ORG"}" async></script>`;

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateWhatsAppWidgetConfig({
        enabled,
        title,
        welcomeMessage,
        replyTimeText,
        prefilledMessage,
        primaryColor,
        position,
      });
      if (res.ok) {
        toast.success("Configuration sauvegardée");
      } else {
        toast.error(res.error);
        if (res.error.includes("numéro WhatsApp")) setEnabled(false);
      }
    });
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    toast.success("Snippet copié");
  };

  const agentLabel = verifiedName || "Notre équipe";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageCircle size={24} className="text-emerald-500" /> Widget WhatsApp
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Un bouton flottant sur votre site qui ouvre WhatsApp vers le numéro de l'école.
            Les messages reçus remontent automatiquement dans votre inbox.
          </p>
        </div>
      </div>

      {/* Statut du numéro connecté */}
      {numberConnected ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <Phone size={18} className="text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">
            Numéro connecté : <strong>{displayPhoneNumber}</strong>
            {verifiedName ? ` (${verifiedName})` : ""}. Le widget ouvrira une conversation vers ce numéro.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            Aucun numéro WhatsApp actif n'est connecté. Configurez d'abord{" "}
            <a href="/settings/whatsapp-integration" className="underline font-semibold">
              Paramètres → WhatsApp
            </a>{" "}
            pour pouvoir activer le widget.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Activation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", enabled ? "bg-emerald-50" : "bg-gray-100")}>
                <Power size={20} className={enabled ? "text-emerald-600" : "text-gray-400"} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Activer le widget</p>
                <p className="text-xs text-gray-500">Le bouton apparaîtra sur votre site web</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={!numberConnected}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>
        </div>

        {/* Personnalisation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle size={16} className="text-emerald-500" /> Personnalisation
          </h3>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Entamer une conversation" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Message d'accroche</label>
            <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="input min-h-[70px]" placeholder="👋 Bonjour ! Cliquez ici pour échanger avec nous sur WhatsApp." />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Délai de réponse indiqué</label>
            <input value={replyTimeText} onChange={(e) => setReplyTimeText(e.target.value)} className="input" placeholder="L'équipe répond généralement en quelques minutes." />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Message pré-rempli</label>
            <textarea value={prefilledMessage} onChange={(e) => setPrefilledMessage(e.target.value)} className="input min-h-[60px]" placeholder="Bonjour, je viens de votre site web et j'ai une question." />
            <p className="text-[10px] text-gray-400 mt-1">Texte déjà écrit dans WhatsApp — le visiteur n'a plus qu'à envoyer.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Position</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="input">
                <option value="bottom-right">Bas droite</option>
                <option value="bottom-left">Bas gauche</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Couleur</label>
              <div className="flex gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="input flex-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Aperçu */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Aperçu</h3>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden max-w-sm shadow-lg">
            <div className="px-4 py-4 flex items-start gap-3" style={{ background: primaryColor }}>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <MessageCircle size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{title || "Entamer une conversation"}</p>
                <p className="text-xs text-white/90 mt-1 leading-snug">{welcomeMessage}</p>
              </div>
            </div>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] text-gray-400">{replyTimeText}</p>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-3 hover:bg-gray-50 cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-800 flex-1">{agentLabel}</p>
                <MessageCircle size={18} className="text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={isPending} className="btn-primary py-2 px-4 text-sm">
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Sauvegarde...</> : <><Check size={14} /> Sauvegarder</>}
          </button>
        </div>

        {/* Installation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Installation sur votre site</h3>

          {/* Cas 1 : tracker déjà posé */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <p className="text-xs text-emerald-800">
              <strong>✅ Vous avez déjà le tracker TalibCRM ?</strong> Rien à installer.
              Le bouton apparaît (ou disparaît) automatiquement selon le réglage « Activer le widget » ci-dessus —
              exactement comme le chatbot. Le changement se propage en ~1 minute.
            </p>
          </div>

          {/* Cas 2 : pas de tracker */}
          <p className="text-xs text-gray-600 mb-2">
            <strong>Site sans le tracker TalibCRM ?</strong> Collez ce script juste avant la balise{" "}
            <code className="text-gray-700">&lt;/body&gt;</code> :
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-400">Script autonome (optionnel)</span>
            <button onClick={copySnippet} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <Copy size={13} /> Copier
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
          <p className="text-[11px] text-gray-500 mt-2">
            Le bouton n'apparaît que si le widget est activé ci-dessus. Inutile de poser ce script si le tracker est déjà présent.
          </p>
        </div>
      </div>
    </div>
  );
}
