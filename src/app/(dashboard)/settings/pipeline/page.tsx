"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, Check, X, Loader2,
  Star, XCircle, Kanban, ArrowUp, ArrowDown,
} from "lucide-react";
import { createStage, updateStage, deleteStage, reorderStages, getStages } from "./actions";

type Stage = {
  id: string; name: string; order: number; color: string;
  isDefault: boolean; isWon: boolean; isLost: boolean;
  _count: { leads: number };
};

var PRESET_COLORS = [
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
  "#EC4899", "#EF4444", "#F59E0B", "#F97316",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#64748B", "#84CC16", "#D946EF", "#0F172A",
];

export default function PipelineSettingsPage() {
  var [stages, setStages] = useState<Stage[]>([]);
  var [loading, setLoading] = useState(true);
  var [showAddForm, setShowAddForm] = useState(false);
  var [editingId, setEditingId] = useState<string | null>(null);
  var [newName, setNewName] = useState("");
  var [newColor, setNewColor] = useState("#3B82F6");
  var [addingSaving, setAddingSaving] = useState(false);

  var loadStages = function() {
    setLoading(true);
    getStages()
      .then(setStages)
      .catch(function() { toast.error("Erreur chargement"); })
      .finally(function() { setLoading(false); });
  };

  useEffect(function() { loadStages(); }, []);

  var handleAdd = async function() {
    if (!newName.trim()) return;
    setAddingSaving(true);
    try {
      await createStage({ name: newName.trim(), color: newColor });
      toast.success("Étape ajoutée");
      setNewName(""); setNewColor("#3B82F6"); setShowAddForm(false);
      loadStages();
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setAddingSaving(false);
  };

  var handleMove = async function(index: number, direction: number) {
    var newStages = [...stages];
    var targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newStages.length) return;
    var temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;
    setStages(newStages);
    try {
      await reorderStages(newStages.map(function(s) { return s.id; }));
      loadStages();
    } catch (err: any) { toast.error(err.message || "Erreur"); loadStages(); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personnalisez les étapes de votre processus de recrutement</p>
        </div>
        <button onClick={function() { setShowAddForm(true); }} className="btn-primary py-2 text-xs"><Plus size={14} /> Ajouter une étape</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><Star size={10} className="text-amber-500" /> Par défaut = étape des nouveaux leads</span>
            <span className="flex items-center gap-1"><XCircle size={10} className="text-red-500" /> Perdu = leads abandonnés</span>
          </div>
          <div className="divide-y divide-gray-50">
            {stages.map(function(stage, index) {
              return <StageRow key={stage.id} stage={stage} index={index} total={stages.length}
                isEditing={editingId === stage.id}
                onEdit={function() { setEditingId(stage.id); }}
                onCancelEdit={function() { setEditingId(null); }}
                onSaved={function() { setEditingId(null); loadStages(); }}
                onMove={handleMove} onDeleted={loadStages} />;
            })}
          </div>
          {showAddForm && (
            <div className="px-6 py-4 bg-brand-50/30 border-t border-brand-100">
              <div className="flex items-center gap-3">
                <ColorPicker value={newColor} onChange={setNewColor} />
                <input type="text" value={newName} onChange={function(e) { setNewName(e.target.value); }}
                  className="input text-sm flex-1" placeholder="Nom de la nouvelle étape..." autoFocus
                  onKeyDown={function(e) { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddForm(false); setNewName(""); } }} />
                <button onClick={handleAdd} disabled={addingSaving || !newName.trim()} className="btn-primary py-2 text-xs">
                  {addingSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ajouter
                </button>
                <button onClick={function() { setShowAddForm(false); setNewName(""); }} className="btn-secondary py-2 text-xs"><X size={13} /></button>
              </div>
            </div>
          )}
          {stages.length === 0 && (
            <div className="py-12 text-center"><Kanban size={32} className="text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-400">Aucune étape configurée</p></div>
          )}
        </div>
      )}
    </div>
  );
}

function StageRow({ stage, index, total, isEditing, onEdit, onCancelEdit, onSaved, onMove, onDeleted }: {
  stage: Stage; index: number; total: number; isEditing: boolean;
  onEdit: () => void; onCancelEdit: () => void; onSaved: () => void;
  onMove: (i: number, d: number) => void; onDeleted: () => void;
}) {
  var [editName, setEditName] = useState(stage.name);
  var [editColor, setEditColor] = useState(stage.color);
  var [saving, setSaving] = useState(false);
  var [deleting, setDeleting] = useState(false);
  var [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  var handleSave = async function() {
    if (!editName.trim()) return;
    setSaving(true);
    try { await updateStage(stage.id, { name: editName.trim(), color: editColor }); toast.success("Étape mise à jour"); onSaved(); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  var handleSetDefault = async function() {
    try { await updateStage(stage.id, { isDefault: true }); toast.success("Étape par défaut mise à jour"); onSaved(); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
  };

  var handleToggleLost = async function() {
    try { await updateStage(stage.id, { isLost: !stage.isLost }); toast.success(stage.isLost ? "Étape restaurée" : "Étape marquée comme 'Perdu'"); onSaved(); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
  };

  var handleDelete = async function() {
    setDeleting(true);
    try { await deleteStage(stage.id); toast.success("Étape supprimée"); onDeleted(); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
    setDeleting(false); setShowDeleteConfirm(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-3 px-6 py-3 bg-brand-50/20">
        <ColorPicker value={editColor} onChange={setEditColor} />
        <input type="text" value={editName} onChange={function(e) { setEditName(e.target.value); }}
          className="input text-sm flex-1" autoFocus
          onKeyDown={function(e) { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancelEdit(); }} />
        <button onClick={handleSave} disabled={saving || !editName.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Sauvegarder</button>
        <button onClick={onCancelEdit} className="btn-secondary py-1.5 px-3 text-xs"><X size={12} /></button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-4 px-6 py-3 group hover:bg-gray-50/50 transition-colors", showDeleteConfirm && "bg-red-50/30")}>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={function() { onMove(index, -1); }} disabled={index === 0} className={cn("p-0.5 rounded hover:bg-gray-200", index === 0 && "opacity-30 cursor-not-allowed")}><ArrowUp size={12} className="text-gray-400" /></button>
        <button onClick={function() { onMove(index, 1); }} disabled={index === total - 1} className={cn("p-0.5 rounded hover:bg-gray-200", index === total - 1 && "opacity-30 cursor-not-allowed")}><ArrowDown size={12} className="text-gray-400" /></button>
      </div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-medium text-gray-900">{stage.name}</span>
        {stage.isDefault && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1"><Star size={9} /> Par défaut</span>}
        {stage.isLost && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 flex items-center gap-1"><XCircle size={9} /> Perdu</span>}
      </div>
      <span className="text-xs text-gray-400 shrink-0">{stage._count.leads} lead{stage._count.leads > 1 ? "s" : ""}</span>
      {!showDeleteConfirm ? (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!stage.isDefault && <button onClick={handleSetDefault} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500" title="Par défaut"><Star size={14} /></button>}
          <button onClick={handleToggleLost} className={cn("p-1.5 rounded-lg", stage.isLost ? "bg-red-50 text-red-500" : "hover:bg-red-50 text-gray-400 hover:text-red-500")} title={stage.isLost ? "Restaurer" : "Perdu"}><XCircle size={14} /></button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Modifier"><Pencil size={14} /></button>
          <button onClick={function() { setShowDeleteConfirm(true); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Supprimer"><Trash2 size={14} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-red-600 font-medium">Supprimer ?</span>
          <button onClick={handleDelete} disabled={deleting} className="px-2.5 py-1 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-1">
            {deleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />} Oui</button>
          <button onClick={function() { setShowDeleteConfirm(false); }} className="px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">Non</button>
        </div>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  var [show, setShow] = useState(false);
  var [pos, setPos] = useState({ top: 0, left: 0 });
  var btnRef = useRef<HTMLButtonElement>(null);

  var handleOpen = function() {
    if (btnRef.current) {
      var rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
    setShow(!show);
  };

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen}
        className="w-8 h-8 rounded-lg border-2 border-white shadow-sm hover:shadow-md shrink-0" style={{ backgroundColor: value }} />
      {show && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={function() { setShow(false); }} />
          <div className="fixed z-[70] bg-white rounded-xl shadow-lg border border-gray-200 p-3 animate-scale-in"
            style={{ top: pos.top, left: pos.left }}>
            <div className="grid grid-cols-4 gap-1.5" style={{ width: 140 }}>
              {PRESET_COLORS.map(function(c) {
                return <button key={c} onClick={function() { onChange(c); setShow(false); }}
                  className={cn("w-7 h-7 rounded-lg hover:scale-110 transition-transform", value === c && "ring-2 ring-offset-2 ring-brand-500")} style={{ backgroundColor: c }} />;
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <input type="color" value={value} onChange={function(e) { onChange(e.target.value); }} className="w-full h-7 rounded cursor-pointer" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}