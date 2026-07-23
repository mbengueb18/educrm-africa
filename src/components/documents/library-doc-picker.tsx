"use client";

// Sélecteur de document de la bibliothèque — utilisé par le composer WhatsApp
// (l'éditeur email a déjà son propre sélecteur de pièces jointes).

import { useEffect, useState } from "react";
import { X, FileText, Loader2, Search, Paperclip } from "lucide-react";
import { getLibraryDocuments } from "@/app/(dashboard)/documents/actions";

export type PickedDoc = { id: string; name: string; mimeType: string; size: number };

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

export function LibraryDocPicker({ onSelect, onClose }: {
  onSelect: (doc: PickedDoc) => void;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<{ id: string; name: string; category: string; mimeType: string; size: number }[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getLibraryDocuments().then((d) => setDocs(d as any)).catch(() => setDocs([]));
  }, []);

  const filtered = (docs || []).filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Paperclip size={15} className="text-brand-600" /> Envoyer un document
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document…" className="input pl-9 text-sm w-full" autoFocus />
          </div>
        </div>
        <div className="overflow-y-auto p-2">
          {docs === null ? (
            <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-gray-300 mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center px-4">
              <FileText size={26} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{docs.length === 0 ? "Bibliothèque vide." : "Aucun résultat."}</p>
              {docs.length === 0 && <p className="text-xs text-gray-400 mt-1">Ajoutez vos documents (brochures, plaquettes…) depuis la page Documents.</p>}
            </div>
          ) : (
            filtered.map((d) => (
              <button key={d.id} onClick={() => { onSelect(d); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-50 text-left transition-colors">
                <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><FileText size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 truncate">{d.name}</span>
                  <span className="block text-[11px] text-gray-400">{d.category} · {formatSize(d.size)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
