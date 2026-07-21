"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, Download, Link2, Trash2, Search, Plus, Loader2, X, Check, FolderOpen, Folder as FolderIcon, FolderPlus, Image as ImageIcon, Pencil, Bot } from "lucide-react";
import { deleteLibraryDocument, getLibraryDocumentUrl, updateLibraryDocument, createDocumentFolder, renameDocumentFolder, deleteDocumentFolder, setDocumentBotVisible } from "./actions";

type Doc = {
  id: string; name: string; description: string | null; category: string; folderId: string | null;
  path: string; mimeType: string; size: number; uploadedByName: string; createdAt: string | Date;
  botVisible?: boolean; extractionStatus?: string | null;
};
type FolderT = { id: string; name: string };

const CATEGORIES = ["Brochure", "Programme", "Formulaire", "Dossier de candidature", "Tarifs", "Autre"];
const NO_FOLDER = "__none__"; // valeur du filtre « Sans dossier »

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}
function fileIcon(mime: string) {
  return (mime || "").startsWith("image/") ? ImageIcon : FileText;
}

export function DocumentsClient({ documents, folders, chatbotAiEnabled = false }: { documents: Doc[]; folders: FolderT[]; chatbotAiEnabled?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>(""); // "" = tous | id | NO_FOLDER
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cats = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => set.add(d.category || "Autre"));
    return Array.from(set).sort();
  }, [documents]);

  // Nombre de documents par dossier (pour les compteurs des chips)
  const counts = useMemo(() => {
    const m: Record<string, number> = { "": documents.length, [NO_FOLDER]: 0 };
    documents.forEach((d) => {
      const k = d.folderId || NO_FOLDER;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [documents]);

  const activeFolderName = activeFolder && activeFolder !== NO_FOLDER ? folders.find((f) => f.id === activeFolder)?.name : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (activeFolder === NO_FOLDER && d.folderId) return false;
      if (activeFolder && activeFolder !== NO_FOLDER && d.folderId !== activeFolder) return false;
      if (filterCat && (d.category || "Autre") !== filterCat) return false;
      if (q && !((d.name + " " + (d.description || "")).toLowerCase().includes(q))) return false;
      return true;
    });
  }, [documents, search, filterCat, activeFolder]);

  const createFolder = (name: string) => startTransition(async () => {
    try { await createDocumentFolder(name); toast.success("Dossier créé"); setNewFolderOpen(false); router.refresh(); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const renameFolder = (id: string) => {
    const name = prompt("Renommer le dossier", activeFolderName || "");
    if (name === null || !name.trim()) return;
    startTransition(async () => {
      try { await renameDocumentFolder(id, name); toast.success("Dossier renommé"); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };
  const removeFolder = (id: string) => {
    if (!confirm("Supprimer ce dossier ? Les documents qu'il contient seront conservés (sans dossier).")) return;
    startTransition(async () => {
      try { await deleteDocumentFolder(id); toast.success("Dossier supprimé"); setActiveFolder(""); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

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
  const toggleBot = (id: string, next: boolean) => startTransition(async () => {
    const res = await setDocumentBotVisible(id, next);
    if (res?.ok === false) { toast.error(res.error || "Erreur"); return; }
    toast.success(next ? "Document ajouté au chatbot" : "Document retiré du chatbot");
    router.refresh();
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <button onClick={() => setUploadOpen(true)} className="btn-primary py-2 px-4 text-sm"><Plus size={15} /> Téléverser</button>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-4">Vos documents d'école (brochures, programmes, formulaires…) à partager avec les prospects et étudiants.</p>

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
            const folderName = doc.folderId ? folders.find((f) => f.id === doc.folderId)?.name : null;
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{doc.category || "Autre"}</span>
                      {folderName && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600"><FolderIcon size={9} /> {folderName}</span>}
                      <span className="text-[11px] text-gray-400">{formatSize(doc.size)}</span>
                    </div>
                  </div>
                  <button onClick={() => setEditDoc(doc)} className="p-1.5 -mt-1 -mr-1 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-gray-100 shrink-0" title="Modifier les infos"><Pencil size={14} /></button>
                </div>
                {doc.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{doc.description}</p>}
                <p className="text-[11px] text-gray-400 mt-2 mb-3">Ajouté par {doc.uploadedByName} · {new Date(doc.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</p>

                {/* Visibilité chatbot — seulement si l'org a le chatbot IA activé (BO) */}
                {chatbotAiEnabled && (
                <label className="flex items-center justify-between gap-2 mb-3 rounded-lg bg-gray-50 px-2.5 py-2 cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                    <Bot size={13} className={doc.botVisible ? "text-brand-600" : "text-gray-400"} /> Visible par le chatbot
                    {doc.botVisible && doc.extractionStatus === "PENDING" && <span className="text-[10px] text-amber-600">· analyse…</span>}
                    {doc.botVisible && doc.extractionStatus === "FAILED" && <span className="text-[10px] text-red-500">· échec lecture</span>}
                    {doc.botVisible && doc.extractionStatus === "UNSUPPORTED" && <span className="text-[10px] text-gray-400">· format non lu</span>}
                    {doc.botVisible && doc.extractionStatus === "DONE" && <span className="text-[10px] text-emerald-600">· prêt</span>}
                  </span>
                  <span className="relative inline-flex items-center shrink-0">
                    <input type="checkbox" checked={!!doc.botVisible} disabled={pending} onChange={(e) => toggleBot(doc.id, e.target.checked)} className="sr-only peer" />
                    <span className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></span>
                  </span>
                </label>
                )}

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

      {uploadOpen && <UploadModal folders={folders} defaultFolderId={activeFolder && activeFolder !== NO_FOLDER ? activeFolder : ""} onClose={(saved) => { setUploadOpen(false); if (saved) router.refresh(); }} />}
      {editDoc && <EditModal doc={editDoc} folders={folders} onClose={(saved) => { setEditDoc(null); if (saved) router.refresh(); }} />}
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
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Nouveau dossier</p>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
          <div className="p-5">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du dossier</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSubmit(name); }} className="input text-sm" placeholder="Ex: Brochures 2026" />
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary py-2 px-3 text-xs" disabled={pending}>Annuler</button>
            <button onClick={() => name.trim() && onSubmit(name)} className="btn-primary py-2 px-4 text-xs" disabled={pending || !name.trim()}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Créer</button>
          </div>
        </div>
      </div>
    </>
  );
}

function EditModal({ doc, folders, onClose }: { doc: Doc; folders: FolderT[]; onClose: (saved?: boolean) => void }) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(CATEGORIES.includes(doc.category) ? doc.category : "Autre");
  const [description, setDescription] = useState(doc.description || "");
  const [folderId, setFolderId] = useState(doc.folderId || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      await updateLibraryDocument(doc.id, { name, category, description, folderId });
      toast.success("Document mis à jour");
      onClose(true);
    } catch (e: any) { toast.error(e.message || "Erreur"); setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Modifier le document</p>
            <button onClick={() => onClose()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <FileText size={14} className="text-gray-400 shrink-0" /> Le fichier n'est pas modifié — seules les informations le sont.
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du document</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="Brochure 2026" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Dossier</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input text-sm">
                  <option value="">Sans dossier</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description <span className="text-gray-400 font-normal">(option.)</span></label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="input text-sm" placeholder="Note interne…" />
            </div>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={saving}>Annuler</button>
            <button onClick={submit} className="btn-primary py-2 px-4 text-xs" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer</button>
          </div>
        </div>
      </div>
    </>
  );
}

function UploadModal({ folders, defaultFolderId, onClose }: { folders: FolderT[]; defaultFolderId: string; onClose: (saved?: boolean) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Brochure");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId || "");
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
      fd.append("folderId", folderId);
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Dossier</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input text-sm">
                  <option value="">Sans dossier</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description <span className="text-gray-400 font-normal">(option.)</span></label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="input text-sm" placeholder="Note interne…" />
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
