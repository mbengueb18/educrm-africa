"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { X, MessageCircle, Loader2, Send, Info } from "lucide-react";
import { sendWhatsAppToLead } from "@/app/(dashboard)/leads/[leadId]/whatsapp-actions";
import { getApprovedTemplates } from "@/app/(dashboard)/settings/whatsapp-templates/actions";

interface Props {
  leadId: string;
  leadName: string;
  leadPhone: string;
  open: boolean;
  onClose: () => void;
}

export function SendWhatsAppModal({ leadId, leadName, leadPhone, open, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"template" | "text">("template");
  const [text, setText] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selected, setSelected] = useState<string>("hello_world");

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    getApprovedTemplates()
      .then((tpls) => setTemplates(tpls || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  if (!open) return null;

  const selectedTpl = templates.find((t) => t.id === selected);

  const handleSend = () => {
    startTransition(async () => {
      try {
        if (mode === "template") {
          if (selected === "hello_world") {
            await sendWhatsAppToLead({ leadId, templateName: "hello_world", languageCode: "en_US", parameters: [] });
          } else {
            await sendWhatsAppToLead({ leadId, templateId: selected });
          }
        } else {
          if (!text.trim()) {
            toast.error("Le message ne peut pas être vide");
            return;
          }
          await sendWhatsAppToLead({ leadId, text });
        }
        toast.success(`Message envoyé à ${leadName}`);
        setText("");
        onClose();
      } catch (e: any) {
        toast.error(e.message || "Erreur d'envoi");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Envoyer WhatsApp</h3>
              <p className="text-xs text-gray-500">À {leadName} · {leadPhone}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode("template")}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
              mode === "template"
                ? "text-emerald-600 border-b-2 border-emerald-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Template (1er contact)
          </button>
          <button
            onClick={() => setMode("text")}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
              mode === "text"
                ? "text-emerald-600 border-b-2 border-emerald-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Texte libre (fenêtre 24h)
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {mode === "template" ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    Pour un premier contact, WhatsApp impose un template approuvé par Meta. Choisissez l'un de vos templates ci-dessous.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Template</label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                    <Loader2 size={12} className="animate-spin" /> Chargement des templates…
                  </div>
                ) : (
                  <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input">
                    <option value="hello_world">hello_world — modèle de test (English)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.metaName} · {t.language}
                      </option>
                    ))}
                  </select>
                )}
                {!loadingTemplates && templates.length === 0 && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Aucun template approuvé pour l'instant. Créez-en dans{" "}
                    <a href="/settings/whatsapp-templates" className="text-emerald-600 font-medium underline">Paramètres → Templates WhatsApp</a>.
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] text-gray-600 mb-1 font-semibold">Aperçu :</p>
                <p className="text-xs text-gray-800 whitespace-pre-wrap">
                  {selected === "hello_world" ? "Hello World 👋" : (selectedTpl?.bodyText || "—")}
                </p>
                {selectedTpl?.variableMapping && Object.keys(selectedTpl.variableMapping).length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-2">
                    Les variables ({"{{…}}"}) seront remplacées automatiquement par les infos du lead.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    L'envoi de texte libre n'est possible que si le lead vous a écrit dans les{" "}
                    <strong>24 dernières heures</strong>. Sinon, utilisez un template.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="input"
                  placeholder="Bonjour, votre dossier d'inscription a bien été reçu..."
                />
                <p className="text-[10px] text-gray-500 mt-1">{text.length} / 4096 caractères</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary py-1.5 px-3 text-xs">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={pending}
            className="btn-primary py-1.5 px-3 text-xs bg-emerald-500 hover:bg-emerald-600"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}