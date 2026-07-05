"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, Download, Link2, Trash2, Search, Plus, Loader2, X, Check, FolderOpen, Image as ImageIcon } from "lucide-react";
import { deleteLibraryDocument, getLibraryDocumentUrl } from "./actions";

type Doc = {
  id: string; name: string; description: string | null; category: string;
  path: string; mimeType: string; size: number; uploadedByName: string; createdAt: string | Date;
};

const CATEGORIES = ["Brochure", "Programme", "Formulaire", "Tarifs", "Autre"];

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}
function fileIcon(mime: string) {
  return (mime || "").startsWith("image/") ? ImageIcon : FileText;
}

export function DocumentsClient({ documents }: { documents: Doc[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cats = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => set.add(d.category || "Autre"));
    return Array.from(set).sort();
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (filterCat && (d.category || "Autre") !== filterCat) return false;
      if (q && !((d.name + " " + (d.description || "")).toLowerCase().includes(q))) return false;
      return true;
    });
  }, [documents, search, filterCat]);

  const download = (id: string) => startTransition(async () => {
    try { const r = await getLibraryDocumentUrl(id, false); window.open(r.url, "_blank"); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const copyLink = (id: string) => startTransition(async () => {
    try {
      const r = await getLibraryDocumentUrl(id, true);
      await navigator.clipboard.writeText(r.url);
      toast.success("Lien copié — valable 30 jours");
    } catch (e: any) { toast.error(e.message || "Lien : échec de copie"); }
  });
  const del = (id: string, name: string) => {
    if (!confirm("Supprimer « " + name + " » ? Ce document ne sera plus partageable.")) return;
    startTransition(async () => {
      try { await deleteLibraryDocument(id); toast.success("Document supprimé"); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <button onClick={() => setUploadOpen(true)} className="btn-primary py-2 px-4 text-sm"><Plus size={15} /> Téléverser</button>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-5">Vos documents d'école (brochures, programmes, formulaires…) à partager avec les prospects et étudiants.</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document…" className="input pl-9 text-sm" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="input text-sm py-2 w-44">
          <option value="">Toutes catégories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{documents.length === 0 ? "Aucun document pour l'instant" : "Aucun document ne correspond"}</p>
          {documents.length === 0 && <button onClick={() => setUploadOpen(true)} className="btn-primary py-2 text-xs mt-4"><Plus size={14} /> Téléverser un document</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => {
            const Icon = fileIcon(doc.mimeType);
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{doc.category || "Autre"}</span>
                      <span className="text-[11px] text-gray-400">{formatSize(doc.size)}</span>
                    </div>
                  </div>
                </div>
                {doc.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{doc.description}</p>}
                <p className="text-[11px] text-gray-400 mt-2 mb-3">Ajouté par {doc.uploadedByName} · {new Date(doc.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</p>
                <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-gray-100">
                  <button onClick={() => download(doc.id)} disabled={pending} className="btn-secondary py-1.5 px-2.5 text-xs flex-1 justify-center"><Download size={13} /> Télécharger</button>
                  <button onClick={() => copyLink(doc.id)} disabled={pending} className="btn-secondary py-1.5 px-2.5 text-xs" title="Copier le lien de partage (30 jours)"><Link2 size={13} /></button>
                  <button onClick={() => del(doc.id, doc.name)} disabled={pending} className="btn-secondary py-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uploadOpen && <UploadModal onClose={(saved) => { setUploadOpen(false); if (saved) router.refresh(); }} />}
    </div>
  );
}

function UploadModal({ onClose }: { onClose: (saved?: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Brochure");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Proposition de nom lisible à partir du fichier (modifiable par l'utilisateur).
  const proposeName = (filename: string) =>
    filename
      .replace(/\.[^.]+$/, "")      // retire l'extension
      .replace(/[_-]+/g, " ")        // tirets / underscores → espaces
      .replace(/\s+/g, " ")          // espaces multiples
      .trim()
      .replace(/^./, (c) => c.toUpperCase()); // 1re lettre en majuscule

  const pick = (f: File | null) => {
    setFile(f);
    if (f && !name.trim()) setName(proposeName(f.name));
  };

  const submit = async () => {
    if (!file) { toast.error("Choisissez un fichier"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim() || file.name);
      fd.append("category", category);
      fd.append("description", description);
      const res = await fetch("/api/library/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Téléversement échoué");
      toast.success("Document téléversé");
      onClose(true);
    } catch (e: any) { toast.error(e.message || "Erreur"); setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Téléverser un document</p>
            <button onClick={() => onClose()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-3">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-1.5 hover:border-brand-500 hover:bg-brand-50/30 transition-colors">
              <Upload size={22} className="text-brand-500" />
              {file ? <span className="text-sm font-medium text-gray-900 px-4 text-center break-all">{file.name}</span> : <span className="text-sm text-gray-500">Cliquez pour choisir un fichier</span>}
              <span className="text-[11px] text-gray-400">PDF, image, Word… (max 15 Mo)</span>
            </button>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du document</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="Brochure 2026" />
              {file && <p className="text-[10px] text-gray-400 mt-1">Proposé d'après le fichier — modifiez-le si besoin.</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description <span className="text-gray-400 font-normal">(option.)</span></label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="input text-sm" placeholder="Note interne…" />
              </div>
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={saving}>Annuler</button>
            <button onClick={submit} className="btn-primary py-2 px-4 text-xs" disabled={saving || !file}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Téléverser</button>
          </div>
        </div>
      </div>
    </>
  );
}
