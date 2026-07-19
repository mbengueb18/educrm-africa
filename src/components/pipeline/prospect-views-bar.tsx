"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Pin, PinOff, Save, MoreHorizontal, Pencil, Trash2,
  Check, X, Loader2, Star, Columns3,
} from "lucide-react";
import { type CustomFieldConfig } from "@/lib/custom-fields";
import { ALL_COLUMNS, DEFAULT_COLUMNS } from "./lead-list-view";
import type { LeadViewDTO } from "@/app/(dashboard)/pipeline/view-actions";

interface ProspectViewsBarProps {
  views: LeadViewDTO[];
  activeViewId: string | null;
  isDirty: boolean;
  currentColumns: string[];
  customFields?: CustomFieldConfig[];
  loading?: boolean;
  onSelectView: (id: string | null) => void;
  onCreateView: (payload: { name: string; columns: string[]; isPinned: boolean }) => Promise<void> | void;
  onSaveActive: () => Promise<void> | void;
  onRenameView: (id: string, name: string) => Promise<void> | void;
  onTogglePin: (id: string, pinned: boolean) => Promise<void> | void;
  onDeleteView: (id: string) => Promise<void> | void;
}

export function ProspectViewsBar({
  views,
  activeViewId,
  isDirty,
  currentColumns,
  customFields = [],
  loading,
  onSelectView,
  onCreateView,
  onSaveActive,
  onRenameView,
  onTogglePin,
  onDeleteView,
}: ProspectViewsBarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingActive, setSavingActive] = useState(false);

  const activeView = views.find((v) => v.id === activeViewId) || null;

  // Vues épinglées en tête, puis les autres.
  const sorted = [...views].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return 0;
  });

  const handleSaveActive = async () => {
    setSavingActive(true);
    try {
      await onSaveActive();
    } finally {
      setSavingActive(false);
    }
  };

  const startRename = (v: LeadViewDTO) => {
    setMenuFor(null);
    setRenamingId(v.id);
    setRenameValue(v.name);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await onRenameView(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 flex-wrap border-b border-gray-200 pb-2">
        {/* Vue par défaut : tous les prospects (aucune vue enregistrée) */}
        <button
          onClick={() => onSelectView(null)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            activeViewId === null
              ? "bg-brand-50 text-brand-700 border-brand-200"
              : "bg-white text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-700"
          )}
        >
          Tous les prospects
        </button>

        {sorted.map((v) => {
          const isActive = v.id === activeViewId;
          if (renamingId === v.id) {
            return (
              <div key={v.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-300 bg-white">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                  maxLength={60}
                  className="text-xs w-32 outline-none"
                />
                <button onClick={commitRename} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded">
                  <Check size={13} />
                </button>
                <button onClick={() => setRenamingId(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                  <X size={13} />
                </button>
              </div>
            );
          }
          return (
            <div key={v.id} className="relative inline-flex items-center">
              <button
                onClick={() => onSelectView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  isActive
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-white text-gray-600 border-transparent hover:bg-gray-50"
                )}
              >
                {v.isPinned && <Pin size={11} className="text-brand-500 fill-brand-500" />}
                <span className="max-w-[160px] truncate">{v.name}</span>
                {isActive && isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Modifications non enregistrées" />
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === v.id ? null : v.id); }}
                  className="p-0.5 rounded hover:bg-black/5 text-gray-400"
                >
                  <MoreHorizontal size={13} />
                </span>
              </button>

              {menuFor === v.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                  <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-48 animate-scale-in">
                    <button onClick={() => startRename(v)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Pencil size={13} /> Renommer
                    </button>
                    <button onClick={() => { setMenuFor(null); onTogglePin(v.id, !v.isPinned); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      {v.isPinned ? <><PinOff size={13} /> Désépingler</> : <><Pin size={13} /> Épingler</>}
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={() => { setMenuFor(null); if (confirm("Supprimer la vue « " + v.name + " » ?")) onDeleteView(v.id); }}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {loading && <Loader2 size={14} className="animate-spin text-gray-300 ml-1" />}

        {/* Enregistrer les modifications de la vue active */}
        {activeView && isDirty && (
          <button
            onClick={handleSaveActive}
            disabled={savingActive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors ml-1"
          >
            {savingActive ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Enregistrer
          </button>
        )}

        {/* Nouvelle vue */}
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-brand-700 hover:bg-brand-50 transition-colors ml-auto"
          title="Créer une vue à partir des filtres et colonnes actuels"
        >
          <Plus size={13} /> Nouvelle vue
        </button>
      </div>

      {createOpen && (
        <CreateViewModal
          seedColumns={currentColumns.length ? currentColumns : DEFAULT_COLUMNS}
          customFields={customFields}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            await onCreateView(payload);
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateViewModal({
  seedColumns,
  customFields,
  onClose,
  onCreate,
}: {
  seedColumns: string[];
  customFields: CustomFieldConfig[];
  onClose: () => void;
  onCreate: (payload: { name: string; columns: string[]; isPinned: boolean }) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [columns, setColumns] = useState<string[]>(seedColumns);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Colonnes custom depuis la prop (chargée côté serveur) — plus de fetch au montage
  const customCols = customFields
    .filter((cf) => cf.showInList)
    .map((cf) => ({ key: "custom_" + cf.key, label: cf.label, group: "Personnalisés" }));

  const allColumns = [...ALL_COLUMNS, ...customCols];

  const toggleColumn = (key: string) => {
    setColumns((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), columns, isPinned });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Nouvelle vue</h2>
            <p className="text-xs text-gray-500 mt-0.5">Enregistre les filtres actuels et les colonnes choisies.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom de la vue</label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              maxLength={60}
              placeholder="Ex : Mes prospects chauds à relancer"
              className="input text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
            <span className="text-xs text-gray-700 flex items-center gap-1"><Pin size={12} className="text-brand-500" /> Épingler cette vue</span>
          </label>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Columns3 size={14} className="text-gray-400" />
              <label className="text-xs font-medium text-gray-600">Colonnes affichées</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {allColumns.map((col) => {
                const isActive = columns.includes(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      isActive ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {isActive && <Check size={11} />}
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}>Annuler</button>
          <button onClick={handleCreate} disabled={saving || !name.trim()} className="btn-primary py-1.5 px-3 text-xs">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
            Créer la vue
          </button>
        </div>
      </div>
    </>
  );
}
