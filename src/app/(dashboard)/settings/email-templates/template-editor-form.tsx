"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { EmailEditor, type EmailBlock } from "@/components/messaging/email-editor";
import { createEmailTemplate, updateEmailTemplate } from "./actions";
import { ArrowLeft, X, Loader2, Check, Mail } from "lucide-react";

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

export function TemplateEditorForm({ template }: { template: TemplateInput | null }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [category, setCategory] = useState(template?.category || "RECRUITMENT");
  const [brandColor, setBrandColor] = useState(template?.brandColor || "#1B4F72");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template?.blocks || []);
  const [html, setHtml] = useState(template?.body || "");
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
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

  const isEdit = template && template.id;

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    if (!subject.trim()) { toast.error("Objet requis"); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateEmailTemplate(template!.id, { name, subject, body: html, blocks, brandColor, category });
        toast.success("Template mis à jour");
      } else {
        await createEmailTemplate({ name, subject, body: html, blocks, brandColor, category });
        toast.success("Template créé");
      }
      router.push("/settings/email-templates");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
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
        <div className="flex gap-2 shrink-0">
          <Link href="/settings/email-templates" className="btn-secondary py-2 px-3 sm:px-4 text-sm">Annuler</Link>
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
          <EmailEditor key={editorKey} initialBlocks={blocks} brandColor={brandColor} onChange={(newBlocks, newHtml) => { setBlocks(newBlocks); setHtml(newHtml); }} />
        </div>
      </div>
    </div>
  );
}