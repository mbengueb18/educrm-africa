"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { syncTemplatesFromMeta, deleteTemplate, submitTemplate } from "./actions";
import { TemplateEditorModal } from "./template-editor-modal";
import {
  Plus, MessageSquare, RefreshCw, Loader2, Trash2, Pencil,
  CheckCircle, Clock, XCircle, AlertTriangle, FileText, Eye,
  Send, Tag, Globe, Search,
} from "lucide-react";

interface Template {
  id: string;
  metaName: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  headerText: string | null;
  footerText: string | null;
  buttons: any;
  variableMapping: any;
  rejectionReason: string | null;
  source: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  createdBy: { name: string } | null;
  _count: { campaigns: number };
}

interface Props {
  templates: Template[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  DRAFT: { label: "Brouillon", color: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  PENDING: { label: "En attente Meta", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  APPROVED: { label: "Approuvé", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  REJECTED: { label: "Rejeté", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  DISABLED: { label: "Désactivé", color: "bg-gray-50 text-gray-500 border-gray-200", icon: AlertTriangle },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  MARKETING: { label: "Marketing", color: "bg-purple-50 text-purple-700 border-purple-200" },
  UTILITY: { label: "Utility", color: "bg-blue-50 text-blue-700 border-blue-200" },
  AUTHENTICATION: { label: "Auth", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function TemplatesClient({ templates }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // ─── Filtered templates ───
  const filtered = templates.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.metaName.toLowerCase().includes(q) || t.bodyText.toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Status counts ───
  const statusCounts: Record<string, number> = {};
  for (const t of templates) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  // ─── Handlers ───
  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncTemplatesFromMeta();
      if (!result.ok) { toast.error(result.error || "Sync échoué"); }
      else { toast.success(`${result.created} créé(s), ${result.updated} mis à jour`); router.refresh(); }
    } catch {
      toast.error("Une erreur inattendue est survenue.");
    }
    setSyncing(false);
  };

  const handleDelete = (template: Template) => {
    if (!confirm(`Supprimer le template "${template.metaName}" ?`)) return;
    startTransition(async () => {
      try {
        const result = await deleteTemplate(template.id);
        if (!result.ok) { toast.error(result.error || "Suppression impossible"); return; }
        toast.success("Template supprimé");
        router.refresh();
      } catch {
        toast.error("Une erreur inattendue est survenue.");
      }
    });
  };

  const handleSubmit = (template: Template) => {
    if (!confirm(`Soumettre "${template.metaName}" à Meta pour approbation ? Le template sera verrouillé.`)) return;
    startTransition(async () => {
      try {
        const result = await submitTemplate(template.id);
        if (!result.ok) { toast.error(result.error || "Soumission échouée", { duration: 8000 }); return; }
        if (result.status === "REJECTED") {
          toast.error(
            result.rejectionReason
              ? `Refusé par Meta : ${result.rejectionReason}`
              : "Refusé par Meta. Ouvrez WhatsApp Manager → le template pour voir le motif exact.",
            { duration: 12000 }
          );
        } else {
          toast.success(`Soumis à Meta (statut : ${result.status})`);
        }
        router.refresh();
      } catch {
        toast.error("Une erreur inattendue est survenue.");
      }
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Templates WhatsApp</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Modèles de messages approuvés par Meta pour vos campagnes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span className="hidden sm:inline">Sync Meta</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nouveau template</span>
            <span className="sm:hidden">Nouveau</span>
          </button>
        </div>
      </div>

      {/* Stats + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilterStatus("")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            !filterStatus ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          )}
        >
          Tous ({templates.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                filterStatus === key ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un template..."
          className="input text-sm pl-9 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} onSync={handleSync} syncing={syncing} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Aucun template ne correspond à votre recherche</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => handleDelete(template)}
              onSubmit={() => handleSubmit(template)}
              onPreview={() => setPreviewTemplate(template)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <TemplateEditorModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {editingTemplate && (
        <TemplateEditorModal
          mode="edit"
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null);
            router.refresh();
          }}
        />
      )}

      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}

// ─── Empty state ───
function EmptyState({ onCreate, onSync, syncing }: { onCreate: () => void; onSync: () => void; syncing: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <MessageSquare size={32} className="text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun template</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Créez des templates WhatsApp pour vos campagnes. Les templates doivent être approuvés par Meta avant utilisation.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button onClick={onSync} disabled={syncing} className="btn-secondary text-sm">
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync depuis Meta
        </button>
        <button onClick={onCreate} className="btn-primary text-sm">
          <Plus size={14} /> Créer un template
        </button>
      </div>
    </div>
  );
}

// ─── Template card ───
function TemplateCard({
  template,
  onEdit,
  onDelete,
  onSubmit,
  onPreview,
  isPending,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit: () => void;
  onPreview: () => void;
  isPending: boolean;
}) {
  const statusStyle = STATUS_CONFIG[template.status] || STATUS_CONFIG.DRAFT;
  const categoryStyle = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.MARKETING;
  const StatusIcon = statusStyle.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-card-hover transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 font-mono truncate">{template.metaName}</h3>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", statusStyle.color)}>
              <StatusIcon size={10} />
              {statusStyle.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", categoryStyle.color)}>
              <Tag size={9} />
              {categoryStyle.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
              <Globe size={9} />
              {template.language.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
            {template.bodyText}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
            <span>
              {template.source === "meta_sync" ? "📥 Sync Meta" : "✏️ Créé localement"}
            </span>
            <span>·</span>
            <span>{template._count.campaigns} campagne{template._count.campaigns !== 1 ? "s" : ""}</span>
            {template.createdBy && (
              <>
                <span>·</span>
                <span>Par {template.createdBy.name}</span>
              </>
            )}
            <span>·</span>
            <span>Créé le {formatDate(template.createdAt)}</span>
          </div>
          {template.status === "REJECTED" && template.rejectionReason && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
              <strong>Raison du rejet :</strong> {template.rejectionReason}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          <button onClick={onPreview} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Aperçu">
            <Eye size={15} />
          </button>
          {template.status === "DRAFT" && (
            <>
              <button onClick={onEdit} disabled={isPending} className="btn-secondary py-1.5 px-3 text-xs">
                <Pencil size={12} /> Modifier
              </button>
              <button onClick={onSubmit} disabled={isPending} className="btn-primary py-1.5 px-3 text-xs">
                <Send size={12} /> Soumettre Meta
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            disabled={isPending || template._count.campaigns > 0}
            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
            title={template._count.campaigns > 0 ? "Impossible de supprimer : campagnes liées" : "Supprimer"}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview modal ───
function TemplatePreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  // Remplacer les {{lead.X}} par des valeurs de démo pour l'aperçu
  const demoValues: Record<string, string> = {
    "lead.firstName": "Fatou",
    "lead.lastName": "Diallo",
    "lead.email": "fatou@example.com",
    "lead.phone": "+221770000000",
    "lead.city": "Dakar",
    "lead.programName": "MBA Marketing Digital",
    "lead.score": "75",
  };

  const renderText = (text: string) => {
    return text.replace(/\{\{(lead|custom|audience)\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, prefix, field) => {
      const key = `${prefix}.${field}`;
      return demoValues[key] || `[${field}]`;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Aperçu du template</h3>
          <p className="text-xs text-gray-500 mt-0.5 font-mono">{template.metaName}</p>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#e5ddd5] to-[#e5ddd5]/60">
          {/* WhatsApp message bubble */}
          <div className="max-w-[280px] ml-auto bg-[#dcf8c6] rounded-lg shadow-sm overflow-hidden">
            {template.headerText && (
              <div className="px-3 pt-2 font-bold text-sm text-gray-900">
                {renderText(template.headerText)}
              </div>
            )}
            <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
              {renderText(template.bodyText)}
            </div>
            {template.footerText && (
              <div className="px-3 pb-2 text-xs text-gray-500">
                {renderText(template.footerText)}
              </div>
            )}
            <div className="px-3 pb-1 text-right">
              <span className="text-[10px] text-gray-500">10:30 ✓✓</span>
            </div>
          </div>

          {/* Buttons */}
          {template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0 && (
            <div className="max-w-[280px] ml-auto mt-1 space-y-1">
              {template.buttons.map((btn: any, i: number) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2 text-center text-sm text-blue-600 font-medium shadow-sm">
                  {btn.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[11px] text-gray-500">
            ℹ️ Les variables comme <code className="bg-white px-1 rounded font-mono">{"{{lead.firstName}}"}</code> sont remplacées par des valeurs de démo dans cet aperçu.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary py-1.5 px-4 text-xs">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}