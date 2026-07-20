"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateCampaignDraft, previewSegment, getAvailableAudiencesForCampaign, sendCampaign, scheduleCampaign, getCampaignRecipientStats, sendTestCampaignEmail, type SegmentRule } from "../../actions";
import { SendConfirmModal } from "@/components/campaigns/send-confirm-modal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Eye, Send, Users, Plus, X, Loader2,
  Check, Clock, LayoutGrid, Mail, Filter, CheckCircle, FileText, FolderOpen, Search,
  Monitor, Smartphone
} from "lucide-react";
import { getLibraryDocuments } from "@/app/(dashboard)/documents/actions";
import { EmailEditor, blocksToHtml, type EmailBlock, type OrgInfo } from "@/components/messaging/email-editor";
import { injectSignature } from "@/lib/email-slots";
import { getMyEmailSignature } from "@/app/(dashboard)/profile/actions";
import { FilterGroupBuilder, type FilterGroup } from "@/components/campaigns/filter-group-builder";
import type { CustomFieldConfig } from "@/lib/custom-fields";

interface CampaignEditorClientProps {
  campaign: {
    id: string;
    name: string;
    subject: string;
    body: string;
    status: string;
    segmentRules: any;
    totalRecipients: number;
    audienceId: string | null;
  };
  stages: { id: string; name: string; color: string }[];
  programs: { id: string; name: string; code: string | null }[];
  audiences: { id: string; name: string; type: string }[];
  users: { id: string; name: string }[];
  customFields: CustomFieldConfig[];
  orgInfo?: OrgInfo;
  emailTemplates: { id: string; name: string; subject: string | null; blocks: any; body: string; brandColor: string | null }[];
}

var SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" }, { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" }, { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SALON", label: "Salon" }, { value: "REFERRAL", label: "Parrainage" },
];

var BRAND_COLOR = "#1B4F72";

export function CampaignEditorClient({ campaign, stages, programs, audiences, users, customFields, orgInfo, emailTemplates }: CampaignEditorClientProps) {
  var router = useRouter();
  // Global selection tracking — saves selection continuously



  // Parse existing data
  var initialBlocks: EmailBlock[] = [];
  try {
    var parsed = JSON.parse(campaign.body);
    if (Array.isArray(parsed)) initialBlocks = parsed;
  } catch {
    if (campaign.body) {
      initialBlocks = [{ id: "1", type: "text", content: campaign.body, styles: { fontSize: "15px", color: "#555555" } }];
    }
  }

  var initialGroup: FilterGroup = { operator: "AND", rules: [] };
  try {
    if (campaign.segmentRules) {
      var sr = campaign.segmentRules;
      if (Array.isArray(sr)) {
        // Ancien format plat → groupe AND
        initialGroup = { operator: "AND", rules: sr };
      } else if (sr && typeof sr === "object" && Array.isArray(sr.rules)) {
        // Nouveau format FilterGroup
        initialGroup = sr as FilterGroup;
      }
    }
  } catch {}
  var initialHasRules = initialGroup.rules.length > 0;

  var [name, setName] = useState(campaign.name);
  var [subject, setSubject] = useState(campaign.subject);
  var [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks.length > 0 ? initialBlocks : []);
  var [filterGroup, setFilterGroup] = useState<FilterGroup>(initialGroup);
  var [editorKey, setEditorKey] = useState(0);
  var [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  var [activePanel, setActivePanel] = useState<"content" | "audience">("content");
  var [saving, setSaving] = useState(false);
  var [lastSaved, setLastSaved] = useState<Date | null>(null);
  var [previewData, setPreviewData] = useState<{ count: number; withoutEmail?: number; totalMatching?: number } | null>(
    campaign.totalRecipients > 0 ? { count: campaign.totalRecipients } : null
  );
  // Mode audience vs règles ad-hoc — par défaut sur "audience" (recommandé)
  var [audienceMode, setAudienceMode] = useState<"audience" | "rules">(
    campaign.audienceId ? "audience" : (initialHasRules ? "rules" : "audience")
  );
  var [selectedAudienceId, setSelectedAudienceId] = useState<string | null>(campaign.audienceId);
  var [availableAudiences, setAvailableAudiences] = useState<any[]>([]);
  var [audienceSearch, setAudienceSearch] = useState("");
  var [loadingAudiences, setLoadingAudiences] = useState(false);
  var [attachments, setAttachments] = useState<any[]>((campaign as any).attachments || []);
  var [uploadingAttachment, setUploadingAttachment] = useState(false);
  var [includeSignature, setIncludeSignature] = useState<boolean>((campaign as any).includeSignature !== false);
  // Copies CC (visible) / CCI (cachée) ajoutées à CHAQUE email de la campagne
  var [cc, setCc] = useState<string>((campaign as any).cc || "");
  var [bcc, setBcc] = useState<string>((campaign as any).bcc || "");
  var [showCc, setShowCc] = useState<boolean>(!!((campaign as any).cc || (campaign as any).bcc));
  // Bibliothèque de documents (pièce jointe sans ré-upload)
  var [libraryOpen, setLibraryOpen] = useState(false);
  var [libraryDocs, setLibraryDocs] = useState<any[]>([]);
  var [libraryLoading, setLibraryLoading] = useState(false);
  var [librarySearch, setLibrarySearch] = useState("");

  var openLibrary = function() {
    setLibraryOpen(true);
    if (libraryDocs.length === 0) {
      setLibraryLoading(true);
      getLibraryDocuments().then(function(d) { setLibraryDocs(d as any); }).catch(function() {}).finally(function() { setLibraryLoading(false); });
    }
  };
  var addFromLibrary = function(doc: any) {
    setAttachments(function(prev: any[]) {
      if (prev.some(function(a) { return a.path === doc.path; })) return prev;
      return prev.concat([{ path: doc.path, filename: doc.name, contentType: doc.mimeType, size: doc.size }]);
    });
    toast.success("« " + doc.name + " » joint");
    setLibraryOpen(false);
  };
  var [previewLoading, setPreviewLoading] = useState(false);
  var [sending, setSending] = useState(false);
  var [confirmOpen, setConfirmOpen] = useState(false);
  var [confirmStats, setConfirmStats] = useState<any>(null);
  var [loadingStats, setLoadingStats] = useState(false);
  var [scheduleOpen, setScheduleOpen] = useState(false);
  var [scheduleValue, setScheduleValue] = useState("");
  var [scheduling, setScheduling] = useState(false);
  var [testOpen, setTestOpen] = useState(false);
  var [testEmail, setTestEmail] = useState("");
  var [sendingTest, setSendingTest] = useState(false);
  var [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  var [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  var [sigHtml, setSigHtml] = useState("");
  var [sigEnabled, setSigEnabled] = useState(false);

  // Applique un template d'email à la campagne
  var applyTemplate = function(t: { subject: string | null; blocks: any }) {
    setSubject(t.subject || subject);
    var tb = Array.isArray(t.blocks) ? t.blocks : [];
    setBlocks(tb);
    setEditorKey(function(k) { return k + 1; });
    setTemplatePickerOpen(false);
    toast.success("Template appliqué");
  };

  // ─── Auto-save every 5 seconds ───
  var saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  var doSave = useCallback(async function() {
    setSaving(true);
    try {
      await updateCampaignDraft(campaign.id, {
        name: name,
        subject: subject,
        body: JSON.stringify(blocks),
        segmentRules: audienceMode === "rules" ? filterGroup : [],
        audienceId: audienceMode === "audience" ? selectedAudienceId : null,
        attachments: attachments,
        includeSignature: includeSignature,
        cc: cc,
        bcc: bcc,
      });
      setLastSaved(new Date());
    } catch (e) {
      // silent fail for auto-save
    }
    setSaving(false);
  }, [campaign.id, name, subject, blocks, filterGroup, audienceMode, selectedAudienceId, attachments, includeSignature, cc, bcc]);

  // ─── Envoi de la campagne depuis l'éditeur (même flow que la liste : modal + stats) ───
  var handleSend = function() {
    if (!subject.trim()) { setActivePanel("content"); toast.error("Ajoutez un objet à l'email avant d'envoyer."); return; }
    if (blocks.length === 0) { setActivePanel("content"); toast.error("Le contenu de l'email est vide."); return; }
    var hasAudience = (audienceMode === "audience" && !!selectedAudienceId) || audienceMode === "rules";
    if (!hasAudience) { setActivePanel("audience"); toast.error("Définissez l'audience de la campagne."); return; }
    setConfirmOpen(true);
    setLoadingStats(true);
    setConfirmStats(null);
    (async function() {
      try {
        await doSave(); // persiste l'audience/le contenu avant de calculer les destinataires
        var stats = await getCampaignRecipientStats(campaign.id);
        setConfirmStats(stats);
      } catch (e: any) {
        toast.error(e.message || "Impossible de charger les destinataires");
        setConfirmOpen(false);
      }
      setLoadingStats(false);
    })();
  };

  var confirmSend = function() {
    setSending(true);
    (async function() {
      try {
        var result = await sendCampaign(campaign.id);
        toast.success("Campagne lancée — " + result.queued + " email" + (result.queued > 1 ? "s" : "") + " en cours d'envoi");
        window.location.href = "/campaigns";
      } catch (e: any) {
        toast.error(e.message || "Erreur lors de l'envoi");
        setSending(false);
        setConfirmOpen(false);
      }
    })();
  };

  // ─── Programmer l'envoi ───
  var openSchedule = function() {
    if (!subject.trim()) { setActivePanel("content"); toast.error("Ajoutez un objet à l'email avant de programmer."); return; }
    if (blocks.length === 0) { setActivePanel("content"); toast.error("Le contenu de l'email est vide."); return; }
    var hasAudience = (audienceMode === "audience" && !!selectedAudienceId) || audienceMode === "rules";
    if (!hasAudience) { setActivePanel("audience"); toast.error("Définissez l'audience de la campagne."); return; }
    var d = new Date(Date.now() + 60 * 60 * 1000); // défaut : dans 1 h
    var pad = function(n: number) { return String(n).padStart(2, "0"); };
    setScheduleValue(d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()));
    setScheduleOpen(true);
  };

  var confirmSchedule = function() {
    if (!scheduleValue) { toast.error("Choisissez une date et une heure."); return; }
    var when = new Date(scheduleValue);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 60 * 1000) { toast.error("Choisissez une date/heure au moins 1 minute dans le futur."); return; }
    setScheduling(true);
    (async function() {
      try {
        await doSave();
        await scheduleCampaign(campaign.id, when.toISOString());
        toast.success("Campagne programmée pour le " + when.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }));
        window.location.href = "/campaigns";
      } catch (e: any) {
        toast.error(e.message || "Erreur lors de la programmation");
        setScheduling(false);
      }
    })();
  };

  // ─── Envoi d'un email de test ───
  var handleSendTest = function() {
    if (!subject.trim()) { setActivePanel("content"); toast.error("Ajoutez un objet avant d'envoyer un test."); return; }
    if (blocks.length === 0) { setActivePanel("content"); toast.error("Le contenu de l'email est vide."); return; }
    setSendingTest(true);
    (async function() {
      try {
        await doSave(); // persiste le contenu courant avant le rendu du test
        var res = await sendTestCampaignEmail(campaign.id, testEmail.trim() || undefined);
        if (res.ok) {
          toast.success("Email de test envoyé" + (testEmail.trim() ? " à " + testEmail.trim() : ""));
          setTestOpen(false);
        } else {
          toast.error(res.error || "Échec de l'envoi");
        }
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
      setSendingTest(false);
    })();
  };

  // Charge la signature de l'utilisateur (pour l'aperçu complet)
  useEffect(function() {
    getMyEmailSignature().then(function(d: any) {
      setSigHtml(d?.signature || "");
      setSigEnabled(d?.enabled !== false);
    }).catch(function() {});
  }, []);

  // Construit le HTML complet de l'email (contenu + signature au bon endroit)
  var buildFullPreview = function(): string {
    var contentHtml = blocksToHtml(blocks, BRAND_COLOR);
    var sig = (includeSignature && sigEnabled && sigHtml.trim())
      ? '<br><br><div style="color:#555555;font-size:13px;line-height:1.5">' + sigHtml + "</div>"
      : "";
    return injectSignature(contentHtml, sig);
  };

  useEffect(function() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, 3000);
    return function() {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [name, subject, blocks, filterGroup, audienceMode, selectedAudienceId, doSave, attachments, includeSignature, cc, bcc]);

  // Aperçu live des destinataires (debounce 600ms)
  useEffect(function() {
    if (audienceMode !== "rules") return;
    setPreviewLoading(true);
    var t = setTimeout(function() {
      previewSegment(filterGroup as any).then(function(data) {
        setPreviewData(data);
        setPreviewLoading(false);
      }).catch(function() {
        setPreviewLoading(false);
      });
    }, 600);
    return function() { clearTimeout(t); };
  }, [filterGroup, audienceMode]);

  // Charger les audiences disponibles au montage
  useEffect(function() {
    setLoadingAudiences(true);
    getAvailableAudiencesForCampaign()
      .then(function(data) { setAvailableAudiences(data); })
      .catch(function() {})
      .finally(function() { setLoadingAudiences(false); });
  }, []);

  var FIELD_OPTIONS = [
    { value: "stageId", label: "Étape", type: "select", options: stages.map(function(s) { return { value: s.id, label: s.name }; }) },
    { value: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
    { value: "programId", label: "Filière", type: "select", options: programs.map(function(p) { return { value: p.id, label: p.name }; }) },
    { value: "score", label: "Score", type: "number", options: [] },
    { value: "city", label: "Ville", type: "text", options: [] },
  ];

  return (
    <>
      {/* Mobile/tablet blocker — editor is desktop-only */}
      <div className="lg:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-5">
          <Mail size={40} className="text-brand-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Éditeur réservé au desktop</h1>
        <p className="text-sm text-gray-600 max-w-xs mb-1">
          L'éditeur de campagne email nécessite un grand écran pour être utilisable confortablement.
        </p>
        <p className="text-xs text-gray-400 max-w-xs mb-6">
          Connectez-vous depuis un ordinateur (1024px minimum) pour créer et modifier vos campagnes.
        </p>
        <Link href="/campaigns" className="btn-primary text-sm">
          <ArrowLeft size={14} /> Retour aux campagnes
        </Link>
      </div>

      {/* Desktop editor */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <input
            value={name}
            onChange={function(e) { setName(e.target.value); }}
            className="text-lg font-bold text-gray-900 border-none outline-none bg-transparent focus:ring-0 w-64"
            placeholder="Nom de la campagne"
          />
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {saving ? (
              <><Loader2 size={12} className="animate-spin" /> Sauvegarde...</>
            ) : lastSaved ? (
              <><Check size={12} className="text-emerald-500" /> Sauvegarde auto</>
            ) : (
              <><Clock size={12} /> Brouillon</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={"/campaigns"} className="btn-secondary py-1.5 text-xs">
            <ArrowLeft size={13} /> Campagnes
          </Link>
          <button onClick={function() { doSave(); toast.success("Sauvegardé"); }} className="btn-secondary py-1.5 text-xs">
            <Save size={13} /> Sauvegarder
          </button>
          <div className="relative">
            <button onClick={function() { setTestOpen(!testOpen); }} disabled={sending || scheduling} className="btn-secondary py-1.5 text-xs" title="Envoyer un email de test">
              <Send size={13} /> Test
            </button>
            {testOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={function() { setTestOpen(false); }} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-4 z-50">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Envoyer un test</p>
                  <p className="text-[11px] text-gray-500 mb-3">Les variables sont remplacées par des valeurs d'exemple.</p>
                  <input
                    value={testEmail}
                    onChange={function(e) { setTestEmail(e.target.value); }}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm mb-3 outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Votre adresse (défaut : la vôtre)"
                    type="email"
                  />
                  <div className="flex gap-2">
                    <button onClick={function() { setTestOpen(false); }} className="btn-secondary py-1.5 px-3 text-xs flex-1">Annuler</button>
                    <button onClick={handleSendTest} disabled={sendingTest} className="btn-primary py-1.5 px-3 text-xs flex-1">
                      {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={openSchedule} disabled={sending || scheduling} className="btn-secondary py-1.5 text-xs">
            <Clock size={13} /> Programmer
          </button>
          <button onClick={handleSend} disabled={sending || scheduling} className="btn-primary py-1.5 text-xs">
            {sending ? <><Loader2 size={13} className="animate-spin" /> Envoi...</> : <><Send size={13} /> Envoyer</>}
          </button>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={function() { setActivePanel("content"); }}
          className={cn("flex-1 py-2.5 text-xs font-medium text-center", activePanel === "content" ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}
        >
          Contenu de l'email
        </button>
        <button
          onClick={function() { setActivePanel("audience"); }}
          className={cn("flex-1 py-2.5 text-xs font-medium text-center", activePanel === "audience" ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}
        >
          Audience {(function() {
            if (audienceMode === "audience" && selectedAudienceId) {
              var aud = availableAudiences.find(function(a: any) { return a.id === selectedAudienceId; });
              if (aud) return "(" + aud.withEmail + " destinataires)";
            }
            if (audienceMode === "rules" && previewData) {
              return "(" + previewData.count + " destinataires)";
            }
            return "(non définie)";
          })()}
        </button>
      </div>

      {activePanel === "content" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[900px] mx-auto space-y-4">
            {/* Barre d'actions : sélecteur de template */}
            <div className="relative flex justify-end gap-2">
              <button type="button" onClick={function() { if (blocks.length === 0) { toast.error("Le contenu de l'email est vide."); return; } setFullPreviewOpen(true); }} className="btn-secondary py-1.5 text-xs">
                <Eye size={13} /> Visualiser
              </button>
              <button type="button" onClick={function() { setTemplatePickerOpen(!templatePickerOpen); }} className="btn-secondary py-1.5 text-xs">
                <LayoutGrid size={13} /> Utiliser un template
              </button>
              {templatePickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={function() { setTemplatePickerOpen(false); }} />
                  <div className="absolute right-0 top-9 z-50 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">Modèles d'email</div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {emailTemplates.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-gray-400 text-center">Aucun template disponible. Créez-en dans « Modèles d'email ».</p>
                      ) : (
                        emailTemplates.map(function(t) {
                          return (
                            <button key={t.id} type="button" onClick={function() { applyTemplate(t); }} className="w-full text-left flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50">
                              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={15} /></div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                                {t.subject && <p className="text-[11px] text-gray-400 truncate">{t.subject}</p>}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 block">Objet de l'email</label>
                {!showCc && (
                  <button type="button" onClick={function() { setShowCc(true); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    + Cc / Cci
                  </button>
                )}
              </div>
              <input
                value={subject}
                onChange={function(e) { setSubject(e.target.value); }}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Objet de votre email..."
              />
            </div>

            {/* Cc / Cci — adresses fixes ajoutées à CHAQUE email de la campagne */}
            {showCc && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cc <span className="text-gray-400">(copie visible du destinataire)</span></label>
                  <input
                    value={cc}
                    onChange={function(e) { setCc(e.target.value); }}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="superviseur@ecole.com, archive@ecole.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cci <span className="text-gray-400">(copie cachée)</span></label>
                  <input
                    value={bcc}
                    onChange={function(e) { setBcc(e.target.value); }}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    placeholder="direction@ecole.com"
                  />
                </div>
                <p className="text-[11px] text-gray-400">Ces adresses reçoivent une copie de <strong>chaque</strong> email envoyé. Séparez plusieurs adresses par des virgules.</p>
              </div>
            )}

            {/* Éditeur d'email avancé (composant partagé) */}
            <EmailEditor key={editorKey} initialBlocks={blocks} brandColor={BRAND_COLOR} orgInfo={orgInfo} onChange={function(b) { setBlocks(b); }} />

            {/* Pièces jointes */}
            <div className="mt-2 mb-2 bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FileText size={14} className="text-gray-400" /> Pièces jointes</h3>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={openLibrary} className="btn-secondary py-1 px-2 text-xs"><FolderOpen size={12} /> Bibliothèque</button>
                  <label className="btn-secondary py-1 px-2 text-xs cursor-pointer">
                    {uploadingAttachment ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Fichier
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploadingAttachment}
                      onChange={async function(e) {
                        var file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 25 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 25 Mo)"); return; }
                        setUploadingAttachment(true);
                        try {
                          var fd = new FormData();
                          fd.append("file", file);
                          fd.append("campaignId", campaign.id);
                          var res = await fetch("/api/campaigns/attachments/upload", { method: "POST", body: fd });
                          var data = await res.json();
                          if (data.success) {
                            setAttachments([...attachments, { path: data.path, filename: data.filename, contentType: data.contentType, size: data.size }]);
                            toast.success("Fichier ajouté");
                          } else {
                            toast.error(data.error || "Erreur upload");
                          }
                        } catch { toast.error("Erreur upload"); }
                        setUploadingAttachment(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-gray-400">Aucune pièce jointe. Les fichiers seront envoyés avec chaque email de la campagne.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(function(att, idx) {
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{att.filename}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{((att.size || 0) / 1024 / 1024).toFixed(1)} Mo</span>
                        <button onClick={function() { setAttachments(attachments.filter(function(_, i) { return i !== idx; })); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"><X size={13} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <label className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={includeSignature} onChange={function(e) { setIncludeSignature(e.target.checked); }} className="rounded border-gray-300 text-brand-600" />
                Ajouter ma signature en bas de chaque email
              </label>
            </div>
          </div>
        </div>
      ) : (
        /* Audience panel */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Toggle Audience / Règles ad-hoc */}
            <div className="bg-white rounded-xl border border-gray-200 p-1 flex items-center">
              <button
                onClick={function() { setAudienceMode("audience"); }}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  audienceMode === "audience"
                    ? "bg-brand-50 text-brand-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Users size={14} /> Choisir une audience
              </button>
              <button
                onClick={function() { setAudienceMode("rules"); }}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  audienceMode === "rules"
                    ? "bg-brand-50 text-brand-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Filter size={14} /> Règles ad-hoc
              </button>
            </div>

            {audienceMode === "audience" ? (
              /* ─── Mode AUDIENCE ─── */
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Choisir une audience</h3>
                  <p className="text-xs text-gray-500">
                    Seules les audiences statiques et import sont disponibles pour les campagnes.{" "}
                    <Link href="/audiences" className="text-brand-600 hover:underline">Gérer les audiences →</Link>
                  </p>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Rechercher une audience..."
                    className="input text-sm pl-9 py-2 w-full"
                    value={audienceSearch}
                    onChange={function(e) { setAudienceSearch(e.target.value); }}
                  />
                  <Eye size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {/* Liste des audiences */}
                <div className="bg-white rounded-xl border border-gray-200 max-h-[400px] overflow-y-auto">
                  {loadingAudiences ? (
                    <div className="flex items-center justify-center py-8 text-gray-400">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      <span className="text-xs">Chargement...</span>
                    </div>
                  ) : availableAudiences.length === 0 ? (
                    <div className="py-12 text-center px-6">
                      <Users size={28} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">Aucune audience disponible</p>
                      <p className="text-xs text-gray-400 mb-4">
                        Créez une audience statique ou importez des leads pour pouvoir cibler une campagne.
                      </p>
                      <Link href="/audiences" className="btn-primary py-1.5 px-3 text-xs">
                        <Plus size={12} /> Créer une audience
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {availableAudiences
                        .filter(function(aud: any) {
                          if (!audienceSearch.trim()) return true;
                          var q = audienceSearch.toLowerCase();
                          return aud.name.toLowerCase().includes(q) ||
                            (aud.description || "").toLowerCase().includes(q);
                        })
                        .map(function(aud: any) {
                          var isSelected = aud.id === selectedAudienceId;
                          var typeLabel = aud.type === "STATIC" ? "Statique" : "Import CSV";
                          return (
                            <label
                              key={aud.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                                isSelected ? "bg-brand-50/50" : "hover:bg-gray-50"
                              )}
                            >
                              <input
                                type="radio"
                                name="audience"
                                checked={isSelected}
                                onChange={function() { setSelectedAudienceId(aud.id); }}
                                className="text-brand-600"
                              />
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                                aud.type === "STATIC"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                <Users size={15} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{aud.name}</p>
                                  <span className={cn(
                                    "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                                    aud.type === "STATIC"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  )}>
                                    {typeLabel}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                                  <span><strong className="text-gray-700">{aud.withEmail}</strong> avec email</span>
                                  {aud.withoutEmail > 0 && (
                                    <span className="text-amber-600">⚠ {aud.withoutEmail} sans email</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Récap de l'audience sélectionnée */}
                {selectedAudienceId && (function() {
                  var aud = availableAudiences.find(function(a: any) { return a.id === selectedAudienceId; });
                  if (!aud) return null;
                  return (
                    <div className="mt-4 p-4 bg-brand-50 border border-brand-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <CheckCircle size={18} className="text-brand-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-brand-900">Audience sélectionnée : {aud.name}</p>
                          <p className="text-xs text-brand-700 mt-1">
                            <strong>{aud.withEmail}</strong> destinataire{aud.withEmail > 1 ? "s" : ""} avec email
                            {aud.withoutEmail > 0 && (
                              <span className="text-amber-700"> · {aud.withoutEmail} sans email (ignoré{aud.withoutEmail > 1 ? "s" : ""})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* ─── Mode RÈGLES ad-hoc (nouveau builder) ─── */
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Critères de segmentation</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Combinez des critères (étape, source, champs personnalisés, activité, audience) avec des groupes ET/OU.
                  </p>
                </div>

                <FilterGroupBuilder
                  group={filterGroup}
                  onChange={setFilterGroup}
                  stages={stages}
                  programs={programs}
                  audiences={audiences}
                  users={users}
                  customFields={customFields}
                  emptyHint="Aucun critère — tous les prospects avec email seront inclus"
                />

                {/* Aperçu live */}
                {previewData && (
                  <div className="bg-brand-50 rounded-xl p-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-brand-600" />
                      <span className="text-sm font-semibold text-brand-800">
                        {previewData.count} destinataire{previewData.count > 1 ? "s" : ""}
                      </span>
                      {previewLoading && <Loader2 size={13} className="animate-spin text-brand-400" />}
                    </div>
                    {(previewData.withoutEmail ?? 0) > 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2">
                        {previewData.withoutEmail} prospect{(previewData.withoutEmail ?? 0) > 1 ? "s" : ""} sans email {(previewData.withoutEmail ?? 0) > 1 ? "sont exclus" : "est exclu"} de l'envoi (sur {previewData.totalMatching} correspondant{(previewData.totalMatching ?? 0) > 1 ? "s" : ""} aux filtres).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* (Pièces jointes déplacées vers l'onglet « Contenu ») */}
          </div>
        </div>
      )}
       </div>

      {/* Sélecteur : joindre un document de la bibliothèque */}
      {libraryOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={function() { setLibraryOpen(false); }} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={16} className="text-brand-600" /> Joindre depuis la bibliothèque</p>
                <button onClick={function() { setLibraryOpen(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={librarySearch} onChange={function(e) { setLibrarySearch(e.target.value); }} placeholder="Rechercher un document…" className="input pl-9 text-sm" />
                </div>
              </div>
              <div className="overflow-y-auto p-2">
                {libraryLoading ? (
                  <div className="py-10 text-center"><Loader2 size={22} className="animate-spin text-brand-500 mx-auto" /></div>
                ) : (
                  (function() {
                    var q = librarySearch.trim().toLowerCase();
                    var list = libraryDocs.filter(function(d) { return !q || (d.name + " " + (d.category || "")).toLowerCase().includes(q); });
                    if (list.length === 0) return <p className="py-10 text-center text-sm text-gray-400">{libraryDocs.length === 0 ? "Aucun document dans la bibliothèque." : "Aucun résultat."}</p>;
                    return list.map(function(d) {
                      return (
                        <button key={d.id} type="button" onClick={function() { addFromLibrary(d); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                            <p className="text-[11px] text-gray-400">{d.category || "Autre"}</p>
                          </div>
                          <Check size={15} className="text-gray-300 shrink-0" />
                        </button>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation d'envoi (même modal que la liste des campagnes) */}
      {confirmOpen && (
        <SendConfirmModal
          campaign={{ name: name }}
          stats={confirmStats}
          loading={loadingStats}
          isPending={sending}
          onCancel={function() { if (!sending) { setConfirmOpen(false); setConfirmStats(null); } }}
          onConfirm={confirmSend}
        />
      )}

      {/* Programmer l'envoi */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={function() { if (!scheduling) setScheduleOpen(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0"><Clock size={18} /></div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Programmer l'envoi</h3>
                <p className="text-xs text-gray-500 mt-0.5">La campagne partira automatiquement à la date choisie.</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Date et heure d'envoi</label>
              <input type="datetime-local" value={scheduleValue} onChange={function(e) { setScheduleValue(e.target.value); }} className="input text-sm" />
              <p className="text-[11px] text-gray-400 mt-2">Les destinataires seront calculés au moment de l'envoi, selon l'audience à jour.</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
              <button onClick={function() { setScheduleOpen(false); }} disabled={scheduling} className="btn-secondary py-1.5 px-4 text-xs">Annuler</button>
              <button onClick={confirmSchedule} disabled={scheduling} className="btn-primary py-1.5 px-4 text-xs">
                {scheduling ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />} Programmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualisation du mail complet (contenu + signature) */}
      {fullPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={function() { setFullPreviewOpen(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col animate-scale-in overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Eye size={16} className="text-brand-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Aperçu de l'email</p>
                  <p className="text-xs text-gray-400 truncate">{subject || "(sans objet)"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={function() { setPreviewDevice("desktop"); }} title="Ordinateur"
                    className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs", previewDevice === "desktop" ? "bg-white text-brand-600 shadow-sm" : "text-gray-500")}>
                    <Monitor size={13} />
                  </button>
                  <button onClick={function() { setPreviewDevice("mobile"); }} title="Mobile"
                    className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs", previewDevice === "mobile" ? "bg-white text-brand-600 shadow-sm" : "text-gray-500")}>
                    <Smartphone size={13} />
                  </button>
                </div>
                <button onClick={function() { setFullPreviewOpen(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
              <iframe title="Aperçu email" srcDoc={buildFullPreview()} className="bg-white transition-all"
                style={{ border: "none", width: previewDevice === "mobile" ? 380 : "100%", maxWidth: "100%", height: "100%", minHeight: "60vh" }} />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
              <p className="text-[11px] text-gray-400">{"Les variables ({{prenom}}…) seront remplacées à l'envoi."}</p>
              <button onClick={function() { setFullPreviewOpen(false); }} className="btn-secondary py-1.5 px-4 text-xs">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
