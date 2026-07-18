"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { EmailEditor, blocksToHtml, type EmailBlock, type OrgInfo } from "@/components/messaging/email-editor";
import { createEmailTemplate, updateEmailTemplate, sendTestEmailTemplate } from "./actions";
import { ArrowLeft, X, Loader2, Check, Mail, Send, Cloud, CloudOff } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  RECRUITMENT: "Recrutement",
  ENROLLMENT: "Inscription",
  PAYMENT_REMINDER: "Paiement",
  ACADEMIC: "Académique",
  GENERAL: "Général",
};

interface TemplateInput {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  blocks: EmailBlock[] | null;
  brandColor: string | null;
  category: string;
}

export function TemplateEditorForm({ template, orgInfo }: { template: TemplateInput | null; orgInfo?: OrgInfo }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [category, setCategory] = useState(template?.category || "RECRUITMENT");
  const [brandColor, setBrandColor] = useState(template?.brandColor || "#1B4F72");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template?.blocks || []);
  const [html, setHtml] = useState(template?.body || "");
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  // Enregistrement automatique : id courant (null tant que pas créé) + statut
  const [templateId, setTemplateId] = useState<string | null>(template?.id || null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(template ? "saved" : "idle");

  const isEdit = !!templateId;

  // Pré-remplissage depuis un starter (uniquement en création, pas en édition)
  useEffect(function() {
    if (isEdit) return; // en édition, on ne touche pas
    try {
      var raw = sessionStorage.getItem("talibcrm_template_starter");
      if (raw) {
        var s = JSON.parse(raw);
        setName(s.name || "");
        setSubject(s.subject || "");
        setCategory(s.category || "RECRUITMENT");
        setBrandColor(s.brandColor || "#1B4F72");
        setBlocks(s.blocks || []);
        setHtml(s.body || "");
        setEditorKey(function(k) { return k + 1; }); // force le remontage de l'éditeur
        sessionStorage.removeItem("talibcrm_template_starter"); // nettoyage
      }
    } catch (e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enregistre (silencieux = auto-save ; sinon = bouton, avec toast + retour liste)
  const creatingRef = useRef(false);
  const save = async (silent: boolean) => {
    if (!name.trim() || !subject.trim()) {
      if (!silent) toast.error(!name.trim() ? "Nom requis" : "Objet requis");
      return;
    }
    // Empêche une double création concurrente (auto-save pendant la création)
    if (!templateId && creatingRef.current) return;
    if (silent) setSaveStatus("saving"); else setSaving(true);
    try {
      if (templateId) {
        await updateEmailTemplate(templateId, { name, subject, body: html, blocks, brandColor, category });
      } else {
        creatingRef.current = true;
        const res = await createEmailTemplate({ name, subject, body: html, blocks, brandColor, category });
        if (res?.template?.id) setTemplateId(res.template.id);
        creatingRef.current = false;
      }
      setSaveStatus("saved");
      if (!silent) {
        toast.success(templateId ? "Template mis à jour" : "Template créé");
        router.push("/settings/email-templates");
        router.refresh();
      }
    } catch (e: any) {
      creatingRef.current = false;
      setSaveStatus("error");
      if (!silent) toast.error(e.message || "Erreur");
    }
    if (!silent) setSaving(false);
  };

  const handleSave = () => save(false);

  // Régénère le HTML depuis les blocs au montage (met à jour le rendu des icônes
  // sociales vers le nouveau format PNG même sans édition). N'écrit que si ça change.
  useEffect(function() {
    if (blocks && blocks.length) {
      const fresh = blocksToHtml(blocks, brandColor);
      setHtml(function(prev) { return prev === fresh ? prev : fresh; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save : 1,5 s après la dernière modification (ignore le montage initial)
  const firstRun = useRef(true);
  useEffect(function() {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!name.trim() || !subject.trim()) return;
    const t = setTimeout(function() { save(true); }, 1500);
    return function() { clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subject, category, brandColor, html]);

  const handleSendTest = async () => {
    if (!subject.trim()) { toast.error("Renseignez l'objet avant d'envoyer un test"); return; }
    setSendingTest(true);
    try {
      const res = await sendTestEmailTemplate({ subject, html, to: testEmail.trim() || undefined });
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
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/settings/email-templates" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {isEdit ? "Modifier le template" : "Nouveau template"}
          </h1>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
            Variables disponibles : {"{{prenom}}"}, {"{{nom}}"}, {"{{email}}"}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs mr-1 shrink-0">
          {saveStatus === "saving" && <span className="flex items-center gap-1 text-gray-400"><Loader2 size={13} className="animate-spin" /> Enregistrement…</span>}
          {saveStatus === "saved" && <span className="flex items-center gap-1 text-emerald-600"><Cloud size={13} /> Enregistré</span>}
          {saveStatus === "error" && <span className="flex items-center gap-1 text-red-500"><CloudOff size={13} /> Non enregistré</span>}
          {saveStatus === "idle" && <span className="flex items-center gap-1 text-gray-400"><Cloud size={13} /> Brouillon</span>}
        </div>
        <div className="flex gap-2 shrink-0 relative">
          <Link href="/settings/email-templates" className="btn-secondary py-2 px-3 sm:px-4 text-sm">{isEdit ? "Fermer" : "Annuler"}</Link>
          <button
            onClick={() => setTestOpen((o) => !o)}
            className="btn-secondary py-2 px-3 sm:px-4 text-sm hidden lg:inline-flex"
            title="Envoyer un email de test"
          >
            <Send size={14} /> Test
          </button>
          {testOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-4 z-30">
              <p className="text-sm font-semibold text-gray-800 mb-1">Envoyer un test</p>
              <p className="text-[11px] text-gray-500 mb-3">Les variables sont remplacées par des valeurs d'exemple.</p>
              <input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="input text-sm mb-3"
                placeholder="Votre adresse (défaut : la vôtre)"
                type="email"
              />
              <div className="flex gap-2">
                <button onClick={() => setTestOpen(false)} className="btn-secondary py-1.5 px-3 text-xs flex-1">Annuler</button>
                <button onClick={handleSendTest} disabled={sendingTest} className="btn-primary py-1.5 px-3 text-xs flex-1">
                  {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Envoyer
                </button>
              </div>
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-3 sm:px-4 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>

      {/* Mobile blocker — editor is desktop-only */}
      <div className="lg:hidden bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
          <Mail size={40} className="text-brand-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Éditeur réservé au desktop</h2>
        <p className="text-sm text-gray-600 mb-1">
          L'éditeur de template email nécessite un grand écran pour manipuler les blocs et les styles confortablement.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Connectez-vous depuis un ordinateur (1024px minimum) pour créer et modifier vos templates.
        </p>
        <Link href="/settings/email-templates" className="btn-primary text-sm inline-flex">
          <ArrowLeft size={14} /> Retour aux templates
        </Link>
      </div>

      {/* Desktop editor */}
      <div className="hidden lg:block">
        {/* Form fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Nom du template</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="Ex: Bienvenue nouveau lead" />
          </div>
          <div className="md:col-span-4">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Catégorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Couleur principale</label>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-9 h-9 rounded border border-gray-200 cursor-pointer shrink-0" />
              <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="input text-xs font-mono flex-1 min-w-0" />
            </div>
          </div>
          <div className="md:col-span-12">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Objet de l'email</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input text-sm" placeholder="Ex: Bienvenue {{prenom}}, votre demande..." />
          </div>
        </div>

        {/* Editor */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-2 sm:p-4">
          <EmailEditor key={editorKey} initialBlocks={blocks} brandColor={brandColor} orgInfo={orgInfo} onChange={(newBlocks, newHtml) => { setBlocks(newBlocks); setHtml(newHtml); }} />
        </div>
      </div>
    </div>
  );
}