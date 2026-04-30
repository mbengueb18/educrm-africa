"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmailEditor, blocksToHtml, type EmailBlock } from "@/components/messaging/email-editor";
import { createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, duplicateEmailTemplate } from "./actions";
import {
  ArrowLeft, Plus, Mail, Copy, Trash2, Edit3, X, Loader2, Check, Search,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  blocks: EmailBlock[] | null;
  brandColor: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const CATEGORY_LABELS: Record<string, string> = {
  RECRUITMENT: "Recrutement",
  ENROLLMENT: "Inscription",
  PAYMENT_REMINDER: "Paiement",
  ACADEMIC: "Académique",
  GENERAL: "Général",
};

const STARTER_TEMPLATES = [
  {
    name: "Bienvenue nouveau lead",
    subject: "Bienvenue {{prenom}}, votre demande a bien été reçue",
    category: "RECRUITMENT",
    blocks: [
      { id: "1", type: "heading", content: "Bienvenue {{prenom}} 👋", styles: { fontSize: "24px", color: "#1B4F72", textAlign: "left" } },
      { id: "2", type: "text", content: "Merci pour votre intérêt pour notre établissement.\n\nNous avons bien reçu votre demande de renseignements et un membre de notre équipe d'admission vous contactera très prochainement.", styles: { fontSize: "15px", color: "#555", textAlign: "left" } },
      { id: "3", type: "spacer", content: "", styles: { height: "16px" } },
      { id: "4", type: "button", content: "Découvrir nos filières", styles: { bgColor: "#1B4F72", color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" } },
      { id: "5", type: "spacer", content: "", styles: { height: "24px" } },
      { id: "6", type: "text", content: "Cordialement,\nL'équipe d'admission", styles: { fontSize: "15px", color: "#555", textAlign: "left" } },
    ] as EmailBlock[],
  },
  {
    name: "Relance dossier incomplet",
    subject: "{{prenom}}, complétez votre dossier de candidature",
    category: "ENROLLMENT",
    blocks: [
      { id: "1", type: "heading", content: "Votre dossier {{prenom}}", styles: { fontSize: "22px", color: "#1B4F72", textAlign: "left" } },
      { id: "2", type: "text", content: "Bonjour {{prenom}},\n\nNous avons remarqué que votre dossier de candidature n'est pas encore complet.\n\nMerci de nous transmettre les pièces manquantes pour que nous puissions traiter votre demande dans les meilleurs délais.", styles: { fontSize: "15px", color: "#555", textAlign: "left" } },
      { id: "3", type: "divider", content: "", styles: { color: "#e5e7eb", borderWidth: "1px", borderStyle: "solid" } },
      { id: "4", type: "text", content: "📋 Documents généralement demandés :\n• Photo d'identité\n• Copie du dernier diplôme\n• Lettre de motivation", styles: { fontSize: "14px", color: "#555", textAlign: "left" } },
      { id: "5", type: "button", content: "Accéder à mon espace", styles: { bgColor: "#27AE60", color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" } },
    ] as EmailBlock[],
  },
  {
    name: "Invitation portes ouvertes",
    subject: "Invitation : Journée portes ouvertes",
    category: "RECRUITMENT",
    blocks: [
      { id: "1", type: "heading", content: "🎓 Journée Portes Ouvertes", styles: { fontSize: "26px", color: "#1B4F72", textAlign: "center" } },
      { id: "2", type: "text", content: "Bonjour {{prenom}},\n\nNous avons le plaisir de vous convier à notre prochaine journée portes ouvertes.", styles: { fontSize: "15px", color: "#555", textAlign: "left" } },
      { id: "3", type: "spacer", content: "", styles: { height: "16px" } },
      { id: "4", type: "text", content: "📅 Samedi 15 juin 2026\n🕐 9h00 - 17h00\n📍 Campus principal", styles: { fontSize: "16px", color: "#1B4F72", textAlign: "center" } },
      { id: "5", type: "spacer", content: "", styles: { height: "16px" } },
      { id: "6", type: "text", content: "Au programme :\n✓ Présentation des filières\n✓ Rencontre avec les enseignants\n✓ Témoignages d'anciens étudiants\n✓ Visite du campus", styles: { fontSize: "14px", color: "#555", textAlign: "left" } },
      { id: "7", type: "button", content: "Je m'inscris", styles: { bgColor: "#E67E22", color: "#ffffff", textAlign: "center", borderRadius: "20px", href: "#" } },
    ] as EmailBlock[],
  },
  {
    name: "Admission acceptée",
    subject: "🎉 Félicitations {{prenom}}, votre admission est validée !",
    category: "ENROLLMENT",
    blocks: [
      { id: "1", type: "heading", content: "🎉 Félicitations !", styles: { fontSize: "28px", color: "#27AE60", textAlign: "center" } },
      { id: "2", type: "text", content: "Bonjour {{prenom}},\n\nNous avons le plaisir de vous informer que votre candidature a été acceptée.\n\nBienvenue dans notre établissement !", styles: { fontSize: "16px", color: "#555", textAlign: "center" } },
      { id: "3", type: "divider", content: "", styles: { color: "#e5e7eb", borderWidth: "1px", borderStyle: "solid" } },
      { id: "4", type: "text", content: "📋 Prochaines étapes :\n1. Régler les frais d'inscription\n2. Transmettre les documents officiels\n3. Recevoir votre convocation de rentrée", styles: { fontSize: "14px", color: "#555", textAlign: "left" } },
      { id: "5", type: "button", content: "Finaliser mon inscription", styles: { bgColor: "#27AE60", color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" } },
    ] as EmailBlock[],
  },
  {
    name: "Rappel paiement",
    subject: "Rappel : Échéance de paiement à venir",
    category: "PAYMENT_REMINDER",
    blocks: [
      { id: "1", type: "heading", content: "Rappel de paiement", styles: { fontSize: "22px", color: "#E67E22", textAlign: "left" } },
      { id: "2", type: "text", content: "Bonjour {{prenom}},\n\nNous vous rappelons qu'une échéance de paiement arrive bientôt.\n\nPour éviter tout désagrément, nous vous invitons à régulariser votre situation au plus tôt.", styles: { fontSize: "15px", color: "#555", textAlign: "left" } },
      { id: "3", type: "spacer", content: "", styles: { height: "16px" } },
      { id: "4", type: "button", content: "Payer maintenant", styles: { bgColor: "#E67E22", color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" } },
      { id: "5", type: "text", content: "Pour toute question, contactez notre service comptabilité.", styles: { fontSize: "13px", color: "#888", textAlign: "left" } },
    ] as EmailBlock[],
  },
];

export function EmailTemplatesClient({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [showStarter, setShowStarter] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const filtered = templates.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    try {
      await deleteEmailTemplate(id);
      toast.success("Template supprimé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateEmailTemplate(id);
      toast.success("Template dupliqué");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleUseStarter = (starter: typeof STARTER_TEMPLATES[0]) => {
    setShowStarter(false);
    setEditing({
      id: "",
      name: starter.name,
      subject: starter.subject,
      body: blocksToHtml(starter.blocks, "#1B4F72"),
      blocks: starter.blocks,
      brandColor: "#1B4F72",
      category: starter.category,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Templates email</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créez et gérez vos templates d'emails réutilisables</p>
        </div>
        <button onClick={() => setShowStarter(true)} className="btn-secondary py-2 px-3 text-xs">
          <Mail size={13} /> Bibliothèque
        </button>
        <button onClick={() => setCreating(true)} className="btn-primary py-2 px-3 text-xs">
          <Plus size={13} /> Nouveau template
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un template..." className="input pl-9 text-sm" />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Mail size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-3">Aucun template</p>
          <button onClick={() => setShowStarter(true)} className="btn-primary py-2 px-4 text-sm">
            <Mail size={14} /> Démarrer avec la bibliothèque
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-card-hover transition-shadow group">
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-brand-50 to-violet-50">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{CATEGORY_LABELS[t.category] || t.category}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                {t.subject && <p className="text-xs text-gray-500 truncate mt-0.5">{t.subject}</p>}
              </div>
              <div className="p-3 flex items-center gap-1.5">
                <button onClick={() => setEditing(t)} className="btn-secondary py-1.5 px-2 text-xs flex-1">
                  <Edit3 size={12} /> Modifier
                </button>
                <button onClick={() => handleDuplicate(t.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title="Dupliquer">
                  <Copy size={14} />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      {(editing || creating) && (
        <TemplateEditorModal
          template={editing}
          onClose={() => { setEditing(null); setCreating(false); router.refresh(); }}
        />
      )}

      {/* Starter library modal */}
      {showStarter && (
        <StarterLibraryModal
          starters={STARTER_TEMPLATES}
          onSelect={handleUseStarter}
          onClose={() => setShowStarter(false)}
        />
      )}
    </div>
  );
}

// ─── Template editor modal ───
function TemplateEditorModal({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [category, setCategory] = useState(template?.category || "RECRUITMENT");
  const [brandColor, setBrandColor] = useState(template?.brandColor || "#1B4F72");
  const [blocks, setBlocks] = useState<EmailBlock[]>(template?.blocks || []);
  const [html, setHtml] = useState(template?.body || "");
  const [saving, setSaving] = useState(false);

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
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Modifier le template" : "Nouveau template"}</h2>
            <p className="text-xs text-gray-500">Utilisez les variables {"{{prenom}}"}, {"{{nom}}"}, {"{{email}}"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Form fields */}
        <div className="px-6 py-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-3">
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
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-9 h-9 rounded border border-gray-200 cursor-pointer" />
              <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="input text-xs font-mono flex-1" />
            </div>
          </div>
          <div className="md:col-span-12">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Objet de l'email</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input text-sm" placeholder="Ex: Bienvenue {{prenom}}, votre demande..." />
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <EmailEditor initialBlocks={blocks} brandColor={brandColor} onChange={(newBlocks, newHtml) => { setBlocks(newBlocks); setHtml(newHtml); }} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary py-2 px-4 text-sm">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-4 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Starter library modal ───
function StarterLibraryModal({ starters, onSelect, onClose }: {
  starters: typeof STARTER_TEMPLATES;
  onSelect: (s: typeof STARTER_TEMPLATES[0]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bibliothèque de templates</h2>
            <p className="text-xs text-gray-500">Démarrez rapidement avec un template prêt à l'emploi</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {starters.map((s, i) => (
              <button key={i} onClick={() => onSelect(s)} className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-card-hover transition-all">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{CATEGORY_LABELS[s.category] || s.category}</p>
                <p className="text-sm font-semibold text-gray-900 mb-1">{s.name}</p>
                <p className="text-xs text-gray-500 truncate">{s.subject}</p>
                <p className="text-[10px] text-brand-600 mt-2">{s.blocks.length} blocs prêts</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}