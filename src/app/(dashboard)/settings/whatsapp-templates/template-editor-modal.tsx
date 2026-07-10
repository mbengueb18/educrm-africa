"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTemplate, updateTemplate } from "./actions";
import { X, Loader2, Save, Tag, Globe, Plus, Trash2, Info } from "lucide-react";

interface Props {
  mode: "create" | "edit";
  template?: any;
  onClose: () => void;
  onSaved: () => void;
}

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "fr_FR", label: "Français (France)" },
  { value: "en", label: "English" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Español" },
  { value: "ar", label: "العربية" },
  { value: "wo", label: "Wolof" },
];

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing", desc: "Promo, newsletter, événements" },
  { value: "UTILITY", label: "Utility", desc: "Confirmations, rappels, mises à jour" },
  { value: "AUTHENTICATION", label: "Authentication", desc: "Codes OTP uniquement" },
];

const AVAILABLE_VARIABLES = [
  { value: "{{lead.firstName}}", label: "Prénom du lead" },
  { value: "{{lead.lastName}}", label: "Nom du lead" },
  { value: "{{lead.email}}", label: "Email du lead" },
  { value: "{{lead.phone}}", label: "Téléphone du lead" },
  { value: "{{lead.city}}", label: "Ville du lead" },
  { value: "{{lead.programName}}", label: "Filière demandée" },
  { value: "{{lead.score}}", label: "Score du lead" },
];

export function TemplateEditorModal({ mode, template, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();

  const [metaName, setMetaName] = useState(template?.metaName || "");
  const [language, setLanguage] = useState(template?.language || "fr");
  const [category, setCategory] = useState(template?.category || "MARKETING");
  const [bodyText, setBodyText] = useState(template?.bodyText || "");
  const [headerText, setHeaderText] = useState(template?.headerText || "");
  const [footerText, setFooterText] = useState(template?.footerText || "");
  const [buttons, setButtons] = useState<any[]>(template?.buttons || []);

  // ─── Insert variable at cursor ───
  const insertVariable = (variable: string) => {
    setBodyText((prev: string) => prev + " " + variable);
  };

  // ─── Add button ───
  const addButton = () => {
    if (buttons.length >= 3) {
      toast.error("Maximum 3 boutons par template");
      return;
    }
    setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
  };

  const updateButton = (idx: number, updates: any) => {
    setButtons(buttons.map((b, i) => (i === idx ? { ...b, ...updates } : b)));
  };

  const removeButton = (idx: number) => {
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  // ─── Save ───
  const handleSave = () => {
    if (!metaName.trim()) {
      toast.error("Le nom du template est obligatoire");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(metaName)) {
      toast.error("Le nom doit contenir uniquement des lettres minuscules, chiffres et underscores (ex: rentree_2026_fr)");
      return;
    }
    if (!bodyText.trim()) {
      toast.error("Le corps du message est obligatoire");
      return;
    }

    startTransition(async () => {
      try {
        const result = mode === "create"
          ? await createTemplate({
              metaName: metaName.trim(),
              language,
              category: category as any,
              bodyText: bodyText.trim(),
              headerText: headerText.trim() || undefined,
              footerText: footerText.trim() || undefined,
              buttons: buttons.length > 0 ? buttons : undefined,
            })
          : await updateTemplate(template.id, {
              metaName: metaName.trim(),
              language,
              category: category as any,
              bodyText: bodyText.trim(),
              headerText: headerText.trim() || null,
              footerText: footerText.trim() || null,
              buttons: buttons.length > 0 ? buttons : null,
            });

        if (!result.ok) {
          toast.error(result.error || "Échec de l'enregistrement", { duration: 7000 });
          return;
        }
        toast.success(mode === "create" ? "Template créé" : "Template modifié");
        onSaved();
      } catch {
        toast.error("Une erreur inattendue est survenue.");
      }
    });
  };

  // Count variables used
  const variablesUsed = (bodyText.match(/\{\{(lead|custom|audience)\.[a-zA-Z_][a-zA-Z0-9_]*\}\}/g) || []).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {mode === "create" ? "Nouveau template WhatsApp" : "Modifier le template"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "create"
                ? "Brouillon local. Vous pourrez le soumettre à Meta ensuite."
                : "Une fois soumis à Meta, le template ne pourra plus être modifié."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name + Language + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Nom Meta <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={metaName}
                onChange={(e) => setMetaName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                className="input text-sm font-mono"
                placeholder="rentree_2026_fr"
                disabled={mode === "edit" && template?.status !== "DRAFT"}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {mode === "edit" && template?.status !== "DRAFT"
                  ? "Nom verrouillé (template déjà soumis à Meta)"
                  : "lowercase, chiffres, underscores"}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                <Globe size={11} className="inline" /> Langue
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input text-sm"
              >
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                <Tag size={11} className="inline" /> Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                {CATEGORIES.find(c => c.value === category)?.desc}
              </p>
            </div>
          </div>

          {/* Header (optional) */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              En-tête (optionnel)
            </label>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              className="input text-sm"
              placeholder="Bienvenue chez Performance Digitale"
              maxLength={60}
            />
            <p className="text-[10px] text-gray-400 mt-1">{headerText.length}/60 caractères</p>
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">
                Corps du message <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-gray-400">
                {bodyText.length}/1024 caractères · {variablesUsed} variable{variablesUsed !== 1 ? "s" : ""}
              </span>
            </div>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="input text-sm font-mono min-h-[120px]"
              placeholder="Bonjour {{lead.firstName}}, les inscriptions pour la rentrée 2026 sont ouvertes..."
              maxLength={1024}
            />

            {/* Variables panel */}
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info size={12} className="text-blue-600" />
                <p className="text-[11px] font-medium text-blue-800">
                  Insérer une variable dynamique
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARIABLES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => insertVariable(v.value)}
                    className="text-[10px] px-2 py-1 bg-white text-blue-700 rounded font-mono border border-blue-200 hover:bg-blue-50"
                    title={v.label}
                  >
                    {v.value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer (optional) */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Pied de page (optionnel)
            </label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              className="input text-sm"
              placeholder="Performance Digitale · Dakar"
              maxLength={60}
            />
            <p className="text-[10px] text-gray-400 mt-1">{footerText.length}/60 caractères</p>
          </div>

          {/* Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">
                Boutons (max 3, optionnel)
              </label>
              <button onClick={addButton} className="btn-secondary py-1 px-2 text-[11px]">
                <Plus size={11} /> Ajouter
              </button>
            </div>
            {buttons.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[11px] text-gray-400">Aucun bouton (vous pouvez en ajouter jusqu'à 3)</p>
              </div>
            ) : (
              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <select
                      value={btn.type}
                      onChange={(e) => updateButton(idx, { type: e.target.value })}
                      className="input text-xs py-1.5 w-32"
                    >
                      <option value="QUICK_REPLY">Réponse rapide</option>
                      <option value="URL">Lien URL</option>
                      <option value="PHONE_NUMBER">Téléphone</option>
                    </select>
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => updateButton(idx, { text: e.target.value })}
                      className="input text-xs py-1.5 flex-1"
                      placeholder="Texte du bouton"
                      maxLength={25}
                    />
                    {btn.type === "URL" && (
                      <input
                        type="url"
                        value={btn.url || ""}
                        onChange={(e) => updateButton(idx, { url: e.target.value })}
                        className="input text-xs py-1.5 flex-1"
                        placeholder="https://..."
                      />
                    )}
                    {btn.type === "PHONE_NUMBER" && (
                      <input
                        type="tel"
                        value={btn.phone_number || ""}
                        onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                        className="input text-xs py-1.5 flex-1"
                        placeholder="+221770000000"
                      />
                    )}
                    <button
                      onClick={() => removeButton(idx)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="btn-secondary py-1.5 px-4 text-xs">
            Annuler
          </button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary py-1.5 px-4 text-xs">
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {mode === "create" ? "Créer le brouillon" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}