"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateWhatsAppCampaignDraft,
  getAvailableAudiencesForWhatsAppCampaign,
} from "../../actions";
import { getApprovedTemplates } from "../../../settings/whatsapp-templates/actions";
import {
  ArrowLeft, Save, Loader2, Check, Clock, MessageCircle,
  Users, FileText, Eye, Tag, Globe, CheckCircle, AlertTriangle,
  Sparkles, Plus, Search,
} from "lucide-react";

interface CampaignProps {
  campaign: {
    id: string;
    name: string;
    templateId: string;
    audienceId: string | null;
    segmentRules: any;
    totalRecipients: number;
    status: string;
  };
}

const DEMO_VALUES: Record<string, string> = {
  "lead.firstName": "Fatou",
  "lead.lastName": "Diallo",
  "lead.email": "fatou@example.com",
  "lead.phone": "+221770000000",
  "lead.city": "Dakar",
  "lead.programName": "MBA Marketing Digital",
  "lead.score": "75",
};

export function WhatsAppCampaignEditorClient({ campaign }: CampaignProps) {
  const [name, setName] = useState(campaign.name);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(campaign.templateId);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(campaign.audienceId);
  const [activePanel, setActivePanel] = useState<"content" | "audience">("content");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Templates
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // Audiences
  const [availableAudiences, setAvailableAudiences] = useState<any[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audienceSearch, setAudienceSearch] = useState("");
  const [recipientsCount, setRecipientsCount] = useState<number>(campaign.totalRecipients);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Load templates ───
  useEffect(() => {
    setLoadingTemplates(true);
    getApprovedTemplates()
      .then((data) => setAvailableTemplates(data))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  // ─── Load audiences ───
  useEffect(() => {
    setLoadingAudiences(true);
    getAvailableAudiencesForWhatsAppCampaign()
      .then((data) => setAvailableAudiences(data))
      .catch(() => {})
      .finally(() => setLoadingAudiences(false));
  }, []);

  // ─── Auto-save every 3 seconds ───
  const doSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await updateWhatsAppCampaignDraft(campaign.id, {
        name,
        templateId: selectedTemplateId,
        audienceId: selectedAudienceId,
      });
      setRecipientsCount(result.totalRecipients);
      setLastSaved(new Date());
    } catch (e) {
      // silent fail
    }
    setSaving(false);
  }, [campaign.id, name, selectedTemplateId, selectedAudienceId]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, 3000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [name, selectedTemplateId, selectedAudienceId, doSave]);

  // ─── Selected template object ───
  const selectedTemplate = availableTemplates.find((t: any) => t.id === selectedTemplateId);

  // ─── Filtered lists ───
  const filteredTemplates = availableTemplates.filter((t: any) => {
    if (!templateSearch.trim()) return true;
    const q = templateSearch.toLowerCase();
    return t.metaName.toLowerCase().includes(q) || t.bodyText.toLowerCase().includes(q);
  });

  const filteredAudiences = availableAudiences.filter((a: any) => {
    if (!audienceSearch.trim()) return true;
    const q = audienceSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q);
  });

  // ─── Render template body with demo values ───
  const renderTemplateText = (text: string) => {
    if (!text) return "";
    return text.replace(/\{\{(lead|custom|audience)\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, prefix, field) => {
      const key = `${prefix}.${field}`;
      return DEMO_VALUES[key] || `[${field}]`;
    });
  };

  return (
    <>
      {/* Mobile/tablet blocker */}
      <div className="lg:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
          <MessageCircle size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Éditeur réservé au desktop</h1>
        <p className="text-sm text-gray-600 max-w-xs mb-6">
          L'éditeur de campagne WhatsApp nécessite un grand écran. Connectez-vous depuis un ordinateur.
        </p>
        <Link href="/whatsapp-campaigns" className="btn-primary text-sm">
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>

      {/* Desktop editor */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-var(--header-height))]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/whatsapp-campaigns" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <ArrowLeft size={18} />
            </Link>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-bold text-gray-900 border-none outline-none bg-transparent focus:ring-0 w-64"
              placeholder="Nom de la campagne"
            />
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Sauvegarde...
                </>
              ) : lastSaved ? (
                <>
                  <Check size={12} className="text-emerald-500" /> Sauvegarde auto
                </>
              ) : (
                <>
                  <Clock size={12} /> Brouillon
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                doSave();
                toast.success("Sauvegarde");
              }}
              className="btn-secondary py-1.5 text-xs"
            >
              <Save size={13} /> Sauvegarder
            </button>
            <Link href="/whatsapp-campaigns" className="btn-primary py-1.5 text-xs">
              <ArrowLeft size={13} /> Retour
            </Link>
          </div>
        </div>

        {/* Panel tabs */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          <button
            onClick={() => setActivePanel("content")}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium text-center",
              activePanel === "content"
                ? "text-emerald-600 border-b-2 border-emerald-500"
                : "text-gray-500"
            )}
          >
            Contenu (template)
          </button>
          <button
            onClick={() => setActivePanel("audience")}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium text-center",
              activePanel === "audience"
                ? "text-emerald-600 border-b-2 border-emerald-500"
                : "text-gray-500"
            )}
          >
            Audience ({recipientsCount} destinataires)
          </button>
        </div>

        {activePanel === "content" ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: template selector */}
            <div className="w-[380px] bg-gray-50 border-r border-gray-200 overflow-y-auto shrink-0 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Choisir un template</h3>
                <p className="text-xs text-gray-500">
                  Templates Meta-approuvés.{" "}
                  <Link
                    href="/settings/whatsapp-templates"
                    className="text-emerald-600 hover:underline"
                  >
                    Gérer →
                  </Link>
                </p>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="input text-sm pl-9 py-2 w-full"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
              </div>

              {/* Templates list */}
              <div className="space-y-2">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 size={14} className="animate-spin mr-2" />
                    <span className="text-xs">Chargement...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="bg-white rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                    <AlertTriangle size={20} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-xs text-amber-800 mb-3">
                      {availableTemplates.length === 0
                        ? "Aucun template approuvé"
                        : "Aucun template ne correspond"}
                    </p>
                    {availableTemplates.length === 0 && (
                      <Link
                        href="/settings/whatsapp-templates"
                        className="btn-primary py-1 px-2 text-[10px] inline-flex"
                      >
                        <Plus size={10} /> Créer un template
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredTemplates.map((tpl: any) => {
                    const isSelected = tpl.id === selectedTemplateId;
                    return (
                      <label
                        key={tpl.id}
                        className={cn(
                          "flex items-start gap-2 p-3 rounded-lg cursor-pointer transition-colors border",
                          isSelected
                            ? "bg-emerald-50 border-emerald-300"
                            : "bg-white border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <input
                          type="radio"
                          name="template"
                          checked={isSelected}
                          onChange={() => setSelectedTemplateId(tpl.id)}
                          className="mt-1 text-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <p className="text-xs font-semibold text-gray-900 font-mono truncate">
                              {tpl.metaName}
                            </p>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {tpl.category}
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                              {tpl.language.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-2">{tpl.bodyText}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Center: preview */}
            <div className="flex-1 bg-gray-100 overflow-y-auto p-6">
              <div className="max-w-md mx-auto">
                <p className="text-xs text-gray-500 mb-3 text-center">Aperçu du message</p>

                {selectedTemplate ? (
                  <>
                    {/* WhatsApp-style preview */}
                    <div className="bg-gradient-to-br from-[#e5ddd5] to-[#e5ddd5]/70 rounded-2xl p-6 shadow-inner">
                      <div className="max-w-[280px] ml-auto bg-[#dcf8c6] rounded-lg shadow-sm overflow-hidden">
                        {selectedTemplate.headerText && (
                          <div className="px-3 pt-2 font-bold text-sm text-gray-900">
                            {renderTemplateText(selectedTemplate.headerText)}
                          </div>
                        )}
                        <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                          {renderTemplateText(selectedTemplate.bodyText)}
                        </div>
                        {selectedTemplate.footerText && (
                          <div className="px-3 pb-2 text-xs text-gray-500">
                            {renderTemplateText(selectedTemplate.footerText)}
                          </div>
                        )}
                        <div className="px-3 pb-1 text-right">
                          <span className="text-[10px] text-gray-500">10:30 ✓✓</span>
                        </div>
                      </div>

                      {selectedTemplate.buttons &&
                        Array.isArray(selectedTemplate.buttons) &&
                        selectedTemplate.buttons.length > 0 && (
                          <div className="max-w-[280px] ml-auto mt-1 space-y-1">
                            {selectedTemplate.buttons.map((btn: any, i: number) => (
                              <div
                                key={i}
                                className="bg-white rounded-lg px-3 py-2 text-center text-sm text-blue-600 font-medium shadow-sm"
                              >
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Info box */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                      <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-blue-800">
                        <p className="font-medium mb-0.5">Aperçu avec valeurs de démo</p>
                        <p>
                          Les variables comme <code className="bg-white px-1 rounded font-mono">{"{{lead.firstName}}"}</code> seront remplacées par les vraies données du lead lors de l'envoi.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
                    <FileText size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-1">Sélectionnez un template</p>
                    <p className="text-xs text-gray-400">L'aperçu apparaîtra ici</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Audience panel */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Choisir une audience</h3>
                <p className="text-xs text-gray-500">
                  Seules les audiences statiques et import sont disponibles.{" "}
                  <Link href="/audiences" className="text-emerald-600 hover:underline">
                    Gérer les audiences →
                  </Link>
                </p>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher une audience..."
                  className="input text-sm pl-9 py-2 w-full"
                  value={audienceSearch}
                  onChange={(e) => setAudienceSearch(e.target.value)}
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 max-h-[500px] overflow-y-auto">
                {loadingAudiences ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 size={16} className="animate-spin mr-2" />
                    <span className="text-xs">Chargement...</span>
                  </div>
                ) : filteredAudiences.length === 0 ? (
                  <div className="py-12 text-center px-6">
                    <Users size={28} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600 mb-1">Aucune audience disponible</p>
                    <p className="text-xs text-gray-400 mb-4">
                      Créez une audience pour cibler vos campagnes WhatsApp.
                    </p>
                    <Link href="/audiences" className="btn-primary py-1.5 px-3 text-xs">
                      <Plus size={12} /> Créer une audience
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredAudiences.map((aud: any) => {
                      const isSelected = aud.id === selectedAudienceId;
                      const typeLabel = aud.type === "STATIC" ? "Statique" : "Import CSV";
                      return (
                        <label
                          key={aud.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                            isSelected ? "bg-emerald-50/50" : "hover:bg-gray-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="audience"
                            checked={isSelected}
                            onChange={() => setSelectedAudienceId(aud.id)}
                            className="text-emerald-600"
                          />
                          <div
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                              aud.type === "STATIC"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            <Users size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 truncate">{aud.name}</p>
                              <span
                                className={cn(
                                  "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                                  aud.type === "STATIC"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}
                              >
                                {typeLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                              <span>
                                <strong className="text-gray-700">{aud.withWhatsApp}</strong> avec WhatsApp
                              </span>
                              {aud.withoutWhatsApp > 0 && (
                                <span className="text-amber-600">
                                  ⚠ {aud.withoutWhatsApp} sans WhatsApp
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recap selected audience */}
              {selectedAudienceId && (() => {
                const aud = availableAudiences.find((a: any) => a.id === selectedAudienceId);
                if (!aud) return null;
                return (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-900">
                          Audience sélectionnée : {aud.name}
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          <strong>{aud.withWhatsApp}</strong> destinataire
                          {aud.withWhatsApp > 1 ? "s" : ""} avec WhatsApp
                          {aud.withoutWhatsApp > 0 && (
                            <span className="text-amber-700">
                              {" "}
                              · {aud.withoutWhatsApp} sans WhatsApp (ignoré
                              {aud.withoutWhatsApp > 1 ? "s" : ""})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}