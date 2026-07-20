"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { blocksToHtml, type EmailBlock } from "@/components/messaging/email-editor";
import { deleteEmailTemplate, duplicateEmailTemplate, createTemplateFolder, renameTemplateFolder, deleteTemplateFolder, moveTemplateToFolder } from "./actions";
import {
  ArrowLeft, Plus, Mail, Copy, Trash2, Edit3, X, Loader2, Check, Search, Folder as FolderIcon, FolderPlus, FolderInput, Pencil,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  blocks: EmailBlock[] | null;
  brandColor: string | null;
  category: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
type FolderT = { id: string; name: string };
const NO_FOLDER = "__none__";

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

export function EmailTemplatesClient({ templates, folders }: { templates: Template[]; folders: FolderT[] }) {
  const [search, setSearch] = useState("");
  const [showStarter, setShowStarter] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string>(""); // "" = tous | id | NO_FOLDER
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [moveMenuId, setMoveMenuId] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const m: Record<string, number> = { "": templates.length, [NO_FOLDER]: 0 };
    templates.forEach((t) => {
      const k = t.folderId || NO_FOLDER;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [templates]);

  const activeFolderName = activeFolder && activeFolder !== NO_FOLDER ? folders.find((f) => f.id === activeFolder)?.name : null;

  const filtered = templates.filter((t) => {
    if (activeFolder === NO_FOLDER && t.folderId) return false;
    if (activeFolder && activeFolder !== NO_FOLDER && t.folderId !== activeFolder) return false;
    if (search && !(t.name.toLowerCase().includes(search.toLowerCase()) || t.subject?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const createFolder = (name: string) => startTransition(async () => {
    try { await createTemplateFolder(name); toast.success("Dossier créé"); setNewFolderOpen(false); router.refresh(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const renameFolder = (id: string) => {
    const name = prompt("Renommer le dossier", activeFolderName || "");
    if (name === null || !name.trim()) return;
    startTransition(async () => {
      try { await renameTemplateFolder(id, name); toast.success("Dossier renommé"); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };
  const removeFolder = (id: string) => {
    if (!confirm("Supprimer ce dossier ? Les templates qu'il contient seront conservés (sans dossier).")) return;
    startTransition(async () => {
      try { await deleteTemplateFolder(id); toast.success("Dossier supprimé"); setActiveFolder(""); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };
  const moveTemplate = (id: string, folderId: string | null) => startTransition(async () => {
    setMoveMenuId(null);
    try { await moveTemplateToFolder(id, folderId); toast.success(folderId ? "Template déplacé" : "Retiré du dossier"); router.refresh(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });

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
    try {
      var starterData = {
        name: starter.name,
        subject: starter.subject,
        body: blocksToHtml(starter.blocks, "#1B4F72"),
        blocks: starter.blocks,
        brandColor: "#1B4F72",
        category: starter.category,
      };
      sessionStorage.setItem("talibcrm_template_starter", JSON.stringify(starterData));
    } catch (e) {}
    router.push("/settings/email-templates/new");
  };

  return (
    <div>
      {/* Header — 2 rows on mobile (title + buttons), 1 row on desktop */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Templates email</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Créez et gérez vos templates d'emails réutilisables</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setShowStarter(true)} className="btn-secondary py-2 px-3 text-xs flex-1 sm:flex-initial">
            <Mail size={13} /> Bibliothèque
          </button>
          <Link href="/settings/email-templates/new" className="btn-primary py-2 px-3 text-xs flex-1 sm:flex-initial">
            <Plus size={13} /> <span className="sm:hidden">Nouveau</span><span className="hidden sm:inline">Nouveau template</span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un template..." className="input pl-9 text-sm" />
      </div>

      {/* Dossiers */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FolderChip label="Tous" count={counts[""] || 0} active={activeFolder === ""} onClick={() => setActiveFolder("")} />
        {folders.map((f) => (
          <FolderChip key={f.id} label={f.name} count={counts[f.id] || 0} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)} withIcon />
        ))}
        {(counts[NO_FOLDER] || 0) > 0 && (
          <FolderChip label="Sans dossier" count={counts[NO_FOLDER] || 0} active={activeFolder === NO_FOLDER} onClick={() => setActiveFolder(NO_FOLDER)} />
        )}
        <button onClick={() => setNewFolderOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-full hover:bg-brand-50 transition-colors">
          <FolderPlus size={14} /> Nouveau dossier
        </button>
        {activeFolderName && (
          <span className="inline-flex items-center gap-1 ml-auto">
            <button onClick={() => renameFolder(activeFolder)} disabled={pending} className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-gray-100" title="Renommer le dossier"><Pencil size={13} /></button>
            <button onClick={() => removeFolder(activeFolder)} disabled={pending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Supprimer le dossier"><Trash2 size={13} /></button>
          </span>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 sm:py-16 px-4 text-center">
          <Mail size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-3">Aucun template</p>
          <button onClick={() => setShowStarter(true)} className="btn-primary py-2 px-4 text-sm">
            <Mail size={14} /> Démarrer avec la bibliothèque
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((t) => {
            const folderName = t.folderId ? folders.find((f) => f.id === t.folderId)?.name : null;
            return (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-card-hover transition-shadow group">
              <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-brand-50 to-violet-50">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{CATEGORY_LABELS[t.category] || t.category}</p>
                  {folderName && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 text-brand-600"><FolderIcon size={9} /> {folderName}</span>}
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                {t.subject && <p className="text-xs text-gray-500 truncate mt-0.5">{t.subject}</p>}
              </div>
              <div className="p-3 flex items-center gap-1.5">
                <Link href={"/settings/email-templates/" + t.id} className="btn-secondary py-1.5 px-2 text-xs flex-1">
                  <Edit3 size={12} /> Modifier
                </Link>
                <div className="relative shrink-0">
                  <button onClick={() => setMoveMenuId(moveMenuId === t.id ? null : t.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title="Déplacer vers un dossier">
                    <FolderInput size={14} />
                  </button>
                  {moveMenuId === t.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setMoveMenuId(null)} />
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1.5 z-30 max-h-64 overflow-auto">
                        <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400">Déplacer vers</p>
                        <button onClick={() => moveTemplate(t.id, null)} disabled={pending} className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between gap-2", !t.folderId && "text-brand-600 font-medium")}>
                          Sans dossier {!t.folderId && <Check size={13} />}
                        </button>
                        {folders.length === 0 && <p className="px-3 py-1.5 text-[11px] text-gray-400">Aucun dossier — créez-en un</p>}
                        {folders.map((f) => (
                          <button key={f.id} onClick={() => moveTemplate(t.id, f.id)} disabled={pending} className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between gap-2", t.folderId === f.id && "text-brand-600 font-medium")}>
                            <span className="inline-flex items-center gap-1.5 truncate"><FolderIcon size={12} className="shrink-0" /> <span className="truncate">{f.name}</span></span>
                            {t.folderId === f.id && <Check size={13} className="shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => handleDuplicate(t.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0" title="Dupliquer">
                  <Copy size={14} />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Starter library modal */}
      {showStarter && (
        <StarterLibraryModal
          starters={STARTER_TEMPLATES}
          onSelect={handleUseStarter}
          onClose={() => setShowStarter(false)}
        />
      )}

      {newFolderOpen && <NewFolderModal onSubmit={createFolder} onClose={() => setNewFolderOpen(false)} pending={pending} />}
    </div>
  );
}

function FolderChip({ label, count, active, onClick, withIcon }: { label: string; count: number; active: boolean; onClick: () => void; withIcon?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors " +
        (active ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600")
      }
    >
      {withIcon && <FolderIcon size={13} />}
      {label}
      <span className={"text-[10px] " + (active ? "text-white/70" : "text-gray-400")}>{count}</span>
    </button>
  );
}

function NewFolderModal({ onSubmit, onClose, pending }: { onSubmit: (name: string) => void; onClose: () => void; pending: boolean }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Nouveau dossier</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du dossier</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSubmit(name); }} className="input text-sm" placeholder="Ex: Relances" />
        </div>
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary py-2 px-3 text-xs" disabled={pending}>Annuler</button>
          <button onClick={() => name.trim() && onSubmit(name)} className="btn-primary py-2 px-4 text-xs" disabled={pending || !name.trim()}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Créer</button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">Bibliothèque de templates</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 truncate">Démarrez rapidement avec un template prêt à l'emploi</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {starters.map((s, i) => (
              <button key={i} onClick={() => onSelect(s)} className="text-left bg-white border border-gray-200 rounded-xl p-3 sm:p-4 hover:border-brand-300 hover:shadow-card-hover transition-all">
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