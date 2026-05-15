"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { createAudience, deleteAudience } from "./actions";
import {
  Plus, Users, Filter, Upload, Search, Trash2, Pencil, Eye,
  Loader2, X, Sparkles, FileText, AlertTriangle, Check,
  MoreVertical, ChevronRight,
} from "lucide-react";

interface Audience {
  id: string;
  name: string;
  description: string | null;
  type: "STATIC" | "DYNAMIC" | "IMPORTED";
  color: string | null;
  memberCount: number;
  lastEvaluatedAt: Date | null;
  importMetadata: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
  _count: { members: number };
}

interface AudiencesClientProps {
  audiences: Audience[];
}

const TYPE_LABEL: Record<string, string> = {
  STATIC: "Statique",
  DYNAMIC: "Dynamique",
  IMPORTED: "Import",
};

const TYPE_COLOR: Record<string, string> = {
  STATIC: "bg-blue-50 text-blue-700 border-blue-200",
  DYNAMIC: "bg-violet-50 text-violet-700 border-violet-200",
  IMPORTED: "bg-amber-50 text-amber-700 border-amber-200",
};

const TYPE_ICON: Record<string, typeof Users> = {
  STATIC: Users,
  DYNAMIC: Sparkles,
  IMPORTED: Upload,
};

export function AudiencesClient({ audiences: initialAudiences }: AudiencesClientProps) {
  const router = useRouter();
  const [audiences, setAudiences] = useState(initialAudiences);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtrage
  const filtered = audiences.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchDesc = (a.description || "").toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'audience "${name}" ?\n\nLes leads ne seront pas supprimés.`)) return;
    setDeletingId(id);
    try {
      await deleteAudience(id);
      setAudiences(prev => prev.filter(a => a.id !== id));
      toast.success("Audience supprimée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setDeletingId(null);
  };

  const counts = {
    all: audiences.length,
    STATIC: audiences.filter(a => a.type === "STATIC").length,
    DYNAMIC: audiences.filter(a => a.type === "DYNAMIC").length,
    IMPORTED: audiences.filter(a => a.type === "IMPORTED").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Audiences</h1>
          <p className="text-sm text-gray-500 mt-1">
            Segmentez vos leads pour vos campagnes et workflows
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="btn-primary py-2 px-4 text-sm"
        >
          <Plus size={14} /> Nouvelle audience
        </button>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une audience..."
              className="input pl-9 text-sm py-2 w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {[
            { key: null, label: "Toutes", count: counts.all },
            { key: "STATIC", label: "Statiques", count: counts.STATIC },
            { key: "DYNAMIC", label: "Dynamiques", count: counts.DYNAMIC },
            { key: "IMPORTED", label: "Imports", count: counts.IMPORTED },
          ].map(tab => (
            <button
              key={tab.key || "all"}
              onClick={() => setTypeFilter(tab.key)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5",
                typeFilter === tab.key
                  ? "text-brand-600 border-b-2 border-brand-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  typeFilter === tab.key
                    ? "bg-brand-100 text-brand-700"
                    : "bg-gray-100 text-gray-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {search || typeFilter ? "Aucune audience ne correspond aux filtres" : "Aucune audience créée"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {search || typeFilter
              ? "Essayez de modifier vos critères de recherche."
              : "Créez votre première audience pour segmenter vos leads."}
          </p>
          {!search && !typeFilter && (
            <button
              onClick={() => setCreateOpen(true)}
              className="btn-primary py-2 px-4 text-sm mt-4 mx-auto"
            >
              <Plus size={14} /> Créer une audience
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(audience => {
            const TypeIcon = TYPE_ICON[audience.type] || Users;
            const isDeleting = deletingId === audience.id;
            return (
              <Link
                key={audience.id}
                href={`/audiences/${audience.id}`}
                className={cn(
                  "group bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all relative",
                  isDeleting && "opacity-50 pointer-events-none"
                )}
              >
                {/* Header carte */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
                    TYPE_COLOR[audience.type]
                  )}>
                    <TypeIcon size={18} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      TYPE_COLOR[audience.type]
                    )}>
                      {TYPE_LABEL[audience.type]}
                    </span>
                  </div>
                </div>

                {/* Nom + description */}
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                    {audience.name}
                  </p>
                  {audience.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {audience.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900">
                      {audience.memberCount}
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      lead{audience.memberCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {formatRelative(audience.updatedAt)}
                  </div>
                </div>

                {/* Action delete (visible au hover) */}
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(audience.id, audience.name);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  title="Supprimer"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Modal création */}
      {createOpen && (
        <CreateAudienceModal
          onClose={() => setCreateOpen(false)}
          onCreated={(newAudience) => {
            setAudiences(prev => [newAudience as any, ...prev]);
            setCreateOpen(false);
            router.push(`/audiences/${newAudience.id}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de création ───
function CreateAudienceModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (audience: any) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"STATIC" | "DYNAMIC">("STATIC");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const result = await createAudience({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        // Pour DYNAMIC : on crée vide, l'utilisateur configurera les règles sur la page détail
        rules: type === "DYNAMIC" ? { operator: "AND", rules: [] } : undefined,
      });
      toast.success("Audience créée");
      onCreated(result.audience);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-scale-in">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Nouvelle audience</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Nom */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nom *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Prospects BTS Marketing 2026"
                className="input text-sm py-2 w-full"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description (optionnel)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="À quoi sert cette audience ?"
                className="input text-sm w-full min-h-[60px] resize-y"
                rows={2}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Type d'audience</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("STATIC")}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    type === "STATIC"
                      ? "border-brand-500 bg-brand-50/50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} className="text-blue-600" />
                    <span className="text-xs font-bold text-gray-900">Statique</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Liste figée. Vous ajoutez/retirez les leads manuellement.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setType("DYNAMIC")}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-all",
                    type === "DYNAMIC"
                      ? "border-brand-500 bg-brand-50/50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-violet-600" />
                    <span className="text-xs font-bold text-gray-900">Dynamique</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Liste qui se met à jour automatiquement selon vos règles.
                  </p>
                </button>
              </div>
            </div>

            {type === "DYNAMIC" && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-start gap-2">
                <Sparkles size={13} className="text-violet-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-violet-800">
                  Vous configurerez les règles de filtrage après la création de l'audience.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary py-2 px-4 text-xs" disabled={saving}>
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={saving || !name.trim()} className="btn-primary py-2 px-4 text-xs">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Créer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}