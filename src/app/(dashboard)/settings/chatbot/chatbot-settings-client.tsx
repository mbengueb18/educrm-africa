"use client";

import { useState, useTransition } from "react";
import { updateChatbotConfig } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bot, Check, Loader2, Palette, MessageCircle, Power } from "lucide-react";

interface ChatbotConfig {
  id: string;
  enabled: boolean;
  agentName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: string;
}

export function ChatbotSettingsClient({ config }: { config: ChatbotConfig }) {
  const [enabled, setEnabled] = useState(config.enabled);
  const [agentName, setAgentName] = useState(config.agentName);
  const [welcomeMessage, setWelcomeMessage] = useState(config.welcomeMessage);
  const [primaryColor, setPrimaryColor] = useState(config.primaryColor);
  const [position, setPosition] = useState(config.position);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateChatbotConfig({ enabled, agentName, welcomeMessage, primaryColor, position });
        toast.success("Configuration sauvegardée");
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Bot size={24} className="text-brand-500" /> Chatbot site web
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurez le chatbot qui s'affichera sur votre site web pour qualifier les visiteurs.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Activation */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", enabled ? "bg-emerald-50" : "bg-gray-100")}>
                <Power size={20} className={enabled ? "text-emerald-600" : "text-gray-400"} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Activer le chatbot</p>
                <p className="text-xs text-gray-500">Le chatbot apparaîtra sur votre site web</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>
        </div>

        {/* Agent settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle size={16} className="text-brand-500" /> Personnalisation
          </h3>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Nom du conseiller</label>
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="input" placeholder="Aïcha" />
            <p className="text-[10px] text-gray-400 mt-1">Affiché dans l'en-tête du chatbot</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Message de bienvenue</label>
            <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="input min-h-[80px]" placeholder="Bonjour ! Comment puis-je vous aider ?" />
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
              <label className="text-xs font-medium text-gray-700 mb-1 block">Couleur principale</label>
              <div className="flex gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="input flex-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Aperçu</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm">
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: primaryColor }}>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                {agentName[0]?.toUpperCase() || "A"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{agentName}</p>
                <p className="text-[10px] text-white/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span> En ligne
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 min-h-[120px]">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[10px] font-bold" style={{ background: primaryColor }}>
                  {agentName[0]?.toUpperCase() || "A"}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                  <p className="text-xs text-gray-700">{welcomeMessage}</p>
                </div>
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

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700">
            <strong>💡 Astuce :</strong> Le chatbot utilise le même script de tracking que vous avez déjà installé.
            Aucune modification du code de votre site n'est nécessaire — il suffit d'activer le chatbot ici et il apparaîtra automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}