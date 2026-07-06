"use client";

import { useState, useTransition, useEffect } from "react";
import { sendEmailToLead, getEmailTemplates, getOrgName } from "@/app/(dashboard)/inbox/actions";
import { toast } from "sonner";
import { Send, Loader2, X, ChevronDown, Paperclip, FileText, Type, Layers, Sparkles, FolderOpen, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailEditor, blocksToHtml, type EmailBlock } from "@/components/messaging/email-editor";
import { getLibraryDocuments } from "@/app/(dashboard)/documents/actions";

interface UploadedAttachment {
  path: string;
  filename: string;
  size: number;
  contentType?: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  blocks: EmailBlock[] | null;
  brandColor: string | null;
  category: string;
}

interface ComposeEmailProps {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  initialSubject?: string;
  onSent?: () => void;
  onClose?: () => void;
  compact?: boolean;
  /** Mode agrandi : la zone de texte remplit toute la hauteur disponible */
  fill?: boolean;
}

const QUICK_TEMPLATES = [
  {
    name: "Bienvenue",
    subject: "Bienvenue a {{ecole}} — Votre demande de renseignements",
    body: "Bonjour {{prenom}},\n\nMerci pour votre interet pour nos formations. Nous avons bien recu votre demande et un membre de notre equipe d'admission vous contactera tres prochainement.\n\nN'hesitez pas a nous contacter si vous avez des questions.\n\nCordialement,\nL'equipe d'admission",
  },
  {
    name: "Relance",
    subject: "Avez-vous des questions sur nos formations ?",
    body: "Bonjour {{prenom}},\n\nNous vous avions contacte recemment au sujet de votre interet pour nos formations. Nous n'avons pas eu de retour de votre part.\n\nSouhaitez-vous planifier un entretien ou recevoir des informations supplementaires ?\n\nNous restons a votre disposition.\n\nCordialement,\nL'equipe d'admission",
  },
  {
    name: "Dossier incomplet",
    subject: "Votre dossier de candidature — Pieces manquantes",
    body: "Bonjour {{prenom}},\n\nNous avons bien recu votre dossier de candidature. Cependant, il manque certaines pieces pour que nous puissions le traiter :\n\n- [Preciser les pieces manquantes]\n\nMerci de nous les transmettre dans les meilleurs delais.\n\nCordialement,\nL'equipe d'admission",
  },
  {
    name: "Admission acceptee",
    subject: "Felicitations ! Votre admission a {{ecole}}",
    body: "Bonjour {{prenom}},\n\nNous avons le plaisir de vous informer que votre candidature a ete acceptee.\n\nPour finaliser votre inscription, merci de proceder au reglement des frais d'inscription et de nous transmettre les documents suivants :\n\n- Photo d'identite\n- Copie du dernier diplome\n\nNous vous accueillerons avec plaisir a la rentree.\n\nCordialement,\nL'equipe d'admission",
  },
];

export function ComposeEmail({ leadId, leadName, leadEmail, initialSubject, onSent, onClose, compact = false, fill = false }: ComposeEmailProps) {
  const [mode, setMode] = useState<"text" | "visual">("text");
  const [subject, setSubject] = useState(initialSubject || "");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [html, setHtml] = useState("");
  const [brandColor, setBrandColor] = useState("#1B4F72");
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [isPending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [addSignature, setAddSignature] = useState(true);
  const [orgName, setOrgName] = useState("");
  // Bibliothèque de documents (pièce jointe sans ré-upload)
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryDocs, setLibraryDocs] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  const openLibrary = function() {
    setLibraryOpen(true);
    if (libraryDocs.length === 0) {
      setLibraryLoading(true);
      getLibraryDocuments().then(function(d) { setLibraryDocs(d as any); }).catch(function() {}).finally(function() { setLibraryLoading(false); });
    }
  };
  const addFromLibrary = function(doc: any) {
    setAttachments(function(prev) {
      if (prev.some(function(a) { return a.path === doc.path; })) return prev;
      return prev.concat([{ path: doc.path, filename: doc.name, size: doc.size, contentType: doc.mimeType }]);
    });
    toast.success("« " + doc.name + " » joint");
    setLibraryOpen(false);
  };

  // Load saved templates + nom de l'organisation on mount
  useEffect(function() {
    getEmailTemplates().then(function(templates) {
      setSavedTemplates(templates as any);
    }).catch(function() {});
    getOrgName().then(setOrgName).catch(function() {});
  }, []);

  // Remplace les variables {{prenom}} et {{ecole}} dans un texte de modèle
  const fillVars = (text: string): string => {
    var firstName = leadName.split(" ")[0] || "";
    return (text || "")
      .replace(/\{\{prenom\}\}/gi, firstName)
      .replace(/\{\{ecole\}\}/gi, orgName || "notre établissement")
      .replace(/\{\{organisation\}\}/gi, orgName || "notre établissement");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
          toast.error(file.name + " : trop volumineux (max 25 MB)");
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("leadId", leadId);

        const response = await fetch("/api/attachments/upload", { method: "POST", body: formData });
        const data = await response.json();
        if (response.ok) {
          setAttachments(function(prev) {
            return prev.concat([{
              path: data.path,
              filename: data.filename,
              size: data.size,
              contentType: data.contentType,
            }]);
          });
          toast.success(file.name + " ajouté");
        } else {
          toast.error(data.error || "Erreur upload " + file.name);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur upload");
    }
    setUploading(false);
    event.target.value = "";
  };

  const removeAttachment = (path: string) => {
    setAttachments(function(prev) { return prev.filter(function(a) { return a.path !== path; }); });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  if (!leadEmail) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500">Ce lead n'a pas d'adresse email.</p>
      </div>
    );
  }

  const applyQuickTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    setSubject(fillVars(template.subject));
    setBody(fillVars(template.body));
    setShowTemplates(false);
    setMode("text");
  };

  const applySavedTemplate = (template: SavedTemplate) => {
    setSubject(fillVars(template.subject || ""));
    if (template.blocks && template.blocks.length > 0) {
      setBlocks(template.blocks);
      setHtml(fillVars(template.body));
      setBrandColor(template.brandColor || "#1B4F72");
      setMode("visual");
    } else {
      setBody(fillVars(template.body));
      setMode("text");
    }
    setShowTemplates(false);
  };

  const handleSend = () => {
    if (!subject.trim()) { toast.error("L'objet est requis"); return; }

    const finalBody = mode === "visual" ? html : body;
    const isHtml = mode === "visual";

    if (!finalBody.trim()) { toast.error("Le message est requis"); return; }

    startTransition(async () => {
      try {
        var result = await sendEmailToLead(
          leadId,
          subject,
          finalBody,
          attachments.length > 0 ? attachments.map(function(a) {
            return { path: a.path, filename: a.filename, contentType: a.contentType, size: a.size };
          }) : undefined,
          isHtml,
          addSignature
        );
        if (result.success) {
          toast.success(result.demoMode
            ? "Email enregistre (mode demo — configurez RESEND_API_KEY pour envoyer)"
            : "Email envoye a " + leadEmail
          );
          setSubject("");
          setBody("");
          setBlocks([]);
          setHtml("");
          setAttachments([]);
          onSent?.();
        } else {
          toast.error(result.error || "Erreur envoi");
        }
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  return (
    <div className={cn("flex flex-col", fill && "h-full min-h-0", compact ? "gap-2" : "gap-3")}>
      {/* To — masqué en mode compact (destinataire déjà visible dans l'en-tête) */}
      {!compact && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400 w-8 shrink-0">A :</span>
          <span className="text-gray-700 font-medium">{leadName}</span>
          <span className="text-gray-400">&lt;{leadEmail}&gt;</span>
        </div>
      )}

      {/* Mode toggle + Templates */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={function() { setMode("text"); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
              mode === "text" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            <Type size={12} /> Texte simple
          </button>
          <button
            onClick={function() { setMode("visual"); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
              mode === "visual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            <Layers size={12} /> Visuel
          </button>
        </div>

        <div className="relative flex-1">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="btn-secondary py-1.5 text-xs w-full justify-between"
          >
            <span className="flex items-center gap-1.5"><Sparkles size={12} /> Modèles</span>
            <ChevronDown size={14} className={cn("transition-transform", showTemplates && "rotate-180")} />
          </button>
          {showTemplates && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg py-1 animate-scale-in max-h-80 overflow-y-auto">
              {savedTemplates.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Mes templates</div>
                  {savedTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applySavedTemplate(t)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      {t.blocks && t.blocks.length > 0 && <Layers size={12} className="text-violet-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                        <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Modèles rapides</div>
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyQuickTemplate(t)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Objet de l'email"
        className="input text-sm"
      />

      {/* Body — Text mode */}
      {mode === "text" && (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Redigez votre message..."
            className={cn("input text-sm", fill ? "flex-1 min-h-0 resize-none" : cn("resize-y", compact ? "min-h-[76px]" : "min-h-[150px]"))}
            rows={compact ? 3 : 8}
          />

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-gray-400">Variables :</span>
            {["{{prenom}}", "{{nom}}", "{{email}}", "{{ecole}}"].map((v) => (
              <button
                key={v}
                onClick={() => setBody(body + " " + v)}
                className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Body — Visual mode */}
      {mode === "visual" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <EmailEditor
            initialBlocks={blocks.length > 0 ? blocks : undefined}
            brandColor={brandColor}
            onChange={(newBlocks, newHtml) => { setBlocks(newBlocks); setHtml(newHtml); }}
          />
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(function(att) {
            return (
              <div key={att.path} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                <FileText size={14} className="text-gray-400 shrink-0" />
                <span className="text-xs text-gray-700 truncate flex-1">{att.filename}</span>
                <span className="text-[10px] text-gray-400">{formatSize(att.size)}</span>
                <button
                  onClick={function() { removeAttachment(att.path); }}
                  className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="btn-secondary py-1.5 text-xs" disabled={isPending}>
              Annuler
            </button>
          )}
          <label className={cn(
            "btn-secondary py-1.5 text-xs cursor-pointer",
            (uploading || isPending) && "opacity-50 cursor-not-allowed"
          )}>
            {uploading ? (
              <><Loader2 size={13} className="animate-spin" /> Upload...</>
            ) : (
              <><Paperclip size={13} /> Joindre</>
            )}
            <input type="file" multiple onChange={handleFileUpload} disabled={uploading || isPending} className="hidden" />
          </label>
          <button type="button" onClick={openLibrary} disabled={uploading || isPending} className="btn-secondary py-1.5 text-xs">
            <FolderOpen size={13} /> Bibliothèque
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none ml-1" title="Ajouter votre signature en bas de l'email">
            <input type="checkbox" checked={addSignature} onChange={function(e) { setAddSignature(e.target.checked); }} className="rounded border-gray-300 text-brand-600" />
            Ma signature
          </label>
        </div>
        <button
          onClick={handleSend}
          disabled={isPending || uploading || !subject.trim() || (mode === "text" ? !body.trim() : !html.trim())}
          className="btn-primary py-1.5 text-xs"
        >
          {isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Envoi...</>
          ) : (
            <><Send size={14} /> Envoyer</>
          )}
        </button>
      </div>

      {/* Sélecteur : joindre un document de la bibliothèque */}
      {libraryOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={function() { setLibraryOpen(false); }} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-2"><FolderOpen size={16} className="text-brand-600" /> Joindre depuis la bibliothèque</p>
                <button onClick={function() { setLibraryOpen(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={librarySearch} onChange={function(e) { setLibrarySearch(e.target.value); }} placeholder="Rechercher un document…" className="input pl-9 text-sm" />
                </div>
              </div>
              <div className="overflow-y-auto p-2">
                {libraryLoading ? (
                  <div className="py-10 text-center"><Loader2 size={22} className="animate-spin text-brand-500 mx-auto" /></div>
                ) : (
                  (function() {
                    var q = librarySearch.trim().toLowerCase();
                    var list = libraryDocs.filter(function(d) { return !q || (d.name + " " + (d.category || "")).toLowerCase().includes(q); });
                    if (list.length === 0) return <p className="py-10 text-center text-sm text-gray-400">{libraryDocs.length === 0 ? "Aucun document dans la bibliothèque." : "Aucun résultat."}</p>;
                    return list.map(function(d) {
                      return (
                        <button key={d.id} type="button" onClick={function() { addFromLibrary(d); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                            <p className="text-[11px] text-gray-400">{d.category || "Autre"}</p>
                          </div>
                          <Check size={15} className="text-gray-300 shrink-0" />
                        </button>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}