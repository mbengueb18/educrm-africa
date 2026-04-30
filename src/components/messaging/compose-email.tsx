"use client";

import { useState, useTransition, useEffect } from "react";
import { sendEmailToLead, getEmailTemplates } from "@/app/(dashboard)/inbox/actions";
import { toast } from "sonner";
import { Send, Loader2, X, ChevronDown, Paperclip, FileText, Type, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailEditor, blocksToHtml, type EmailBlock } from "@/components/messaging/email-editor";

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
}

const QUICK_TEMPLATES = [
  {
    name: "Bienvenue",
    subject: "Bienvenue a ISM Dakar — Votre demande de renseignements",
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
    subject: "Felicitations ! Votre admission a ISM Dakar",
    body: "Bonjour {{prenom}},\n\nNous avons le plaisir de vous informer que votre candidature a ete acceptee.\n\nPour finaliser votre inscription, merci de proceder au reglement des frais d'inscription et de nous transmettre les documents suivants :\n\n- Photo d'identite\n- Copie du dernier diplome\n\nNous vous accueillerons avec plaisir a la rentree.\n\nCordialement,\nL'equipe d'admission",
  },
];

export function ComposeEmail({ leadId, leadName, leadEmail, initialSubject, onSent, onClose, compact = false }: ComposeEmailProps) {
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

  // Load saved templates on mount
  useEffect(function() {
    getEmailTemplates().then(function(templates) {
      setSavedTemplates(templates as any);
    }).catch(function() {});
  }, []);

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
    var firstName = leadName.split(" ")[0] || "";
    setSubject(template.subject);
    setBody(template.body.replace(/\{\{prenom\}\}/gi, firstName));
    setShowTemplates(false);
    setMode("text");
  };

  const applySavedTemplate = (template: SavedTemplate) => {
    setSubject(template.subject || "");
    if (template.blocks && template.blocks.length > 0) {
      setBlocks(template.blocks);
      setHtml(template.body);
      setBrandColor(template.brandColor || "#1B4F72");
      setMode("visual");
    } else {
      setBody(template.body);
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
          isHtml
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
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {/* To */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400 w-8 shrink-0">A :</span>
        <span className="text-gray-700 font-medium">{leadName}</span>
        <span className="text-gray-400">&lt;{leadEmail}&gt;</span>
      </div>

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
            className="input text-sm min-h-[150px] resize-y"
            rows={compact ? 5 : 8}
          />

          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-400">Variables :</span>
            {["{{prenom}}", "{{nom}}", "{{email}}"].map((v) => (
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
    </div>
  );
}