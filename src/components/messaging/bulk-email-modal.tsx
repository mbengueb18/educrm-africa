"use client";

import { useState, useTransition, useEffect } from "react";
import { sendBulkEmailToLeads, getEmailTemplates } from "@/app/(dashboard)/inbox/actions";
import { toast } from "sonner";
import { X, Send, Loader2, Users, ChevronDown, AlertTriangle, Type, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailEditor, type EmailBlock } from "@/components/messaging/email-editor";

interface BulkEmailModalProps {
  open: boolean;
  onClose: () => void;
  selectedLeads: { id: string; firstName: string; lastName: string; email: string | null }[];
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

const BULK_TEMPLATES = [
  {
    name: "Bienvenue",
    subject: "Bienvenue a ISM Dakar — Votre demande de renseignements",
    body: "Bonjour {{prenom}},\n\nMerci pour votre interet pour nos formations a ISM Dakar. Nous avons bien recu votre demande et un membre de notre equipe d'admission vous contactera tres prochainement.\n\nN'hesitez pas a nous contacter si vous avez des questions.\n\nCordialement,\nL'equipe d'admission\nISM Dakar",
  },
  {
    name: "Relance generale",
    subject: "Ne manquez pas la rentree 2026 — ISM Dakar",
    body: "Bonjour {{prenom}},\n\nNous vous avions contacte recemment au sujet de votre interet pour nos formations. Les inscriptions pour la rentree 2026 sont toujours ouvertes mais les places sont limitees.\n\nSouhaitez-vous :\n- Planifier un entretien avec notre equipe ?\n- Recevoir des informations supplementaires sur une filière ?\n- Visiter notre campus ?\n\nRepondez simplement a cet email et nous vous recontacterons.\n\nCordialement,\nL'equipe d'admission\nISM Dakar",
  },
  {
    name: "Invitation salon",
    subject: "Invitation — Journee portes ouvertes ISM Dakar",
    body: "Bonjour {{prenom}},\n\nNous avons le plaisir de vous inviter a notre prochaine journee portes ouvertes :\n\n[DATE] - [HEURE]\nCampus Dakar — Plateau\n12 Rue Felix Faure\n\nAu programme :\n- Presentation des filières\n- Rencontre avec les enseignants\n- Temoignages d'anciens étudiants\n- Visite du campus\n\nL'entree est libre. Venez nombreux !\n\nCordialement,\nL'equipe d'admission\nISM Dakar",
  },
];

export function BulkEmailModal({ open, onClose, selectedLeads }: BulkEmailModalProps) {
  const [mode, setMode] = useState<"text" | "visual">("text");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [html, setHtml] = useState("");
  const [brandColor, setBrandColor] = useState("#1B4F72");
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  useEffect(function() {
    if (open) {
      getEmailTemplates().then(function(templates) {
        setSavedTemplates(templates as any);
      }).catch(function() {});
    }
  }, [open]);

  if (!open) return null;

  const leadsWithEmail = selectedLeads.filter((l) => l.email);
  const leadsWithoutEmail = selectedLeads.filter((l) => !l.email);

  const applyQuickTemplate = (template: typeof BULK_TEMPLATES[0]) => {
    setSubject(template.subject);
    setBody(template.body);
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
    if (leadsWithEmail.length === 0) { toast.error("Aucun lead avec email"); return; }

    startTransition(async () => {
      try {
        var res = await sendBulkEmailToLeads(
          leadsWithEmail.map((l) => l.id),
          subject,
          finalBody,
          isHtml
        );
        setResult(res);
        if (res.sent > 0) {
          toast.success(res.sent + " email" + (res.sent > 1 ? "s" : "") + " envoyé" + (res.sent > 1 ? "s" : ""));
        }
        if (res.failed > 0) {
          toast.error(res.failed + " echec" + (res.failed > 1 ? "s" : ""));
        }
      } catch (e: any) {
        toast.error(e.message || "Erreur envoi");
      }
    });
  };

  const handleClose = () => {
    setSubject("");
    setBody("");
    setBlocks([]);
    setHtml("");
    setMode("text");
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl animate-scale-in mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Users size={20} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Envoi en masse</h2>
              <p className="text-sm text-gray-500">{leadsWithEmail.length} destinataire{leadsWithEmail.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Result screen */}
        {result ? (
          <div className="p-8 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              result.failed === 0 ? "bg-emerald-50" : "bg-amber-50"
            )}>
              <Send size={28} className={result.failed === 0 ? "text-emerald-500" : "text-amber-500"} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Envoi termine</h3>
            <div className="flex items-center justify-center gap-6 mb-4">
              <div>
                <p className="text-2xl font-bold text-emerald-600">{result.sent}</p>
                <p className="text-xs text-gray-500">envoye{result.sent > 1 ? "s" : ""}</p>
              </div>
              {result.failed > 0 && (
                <div>
                  <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                  <p className="text-xs text-gray-500">echoue{result.failed > 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-left mt-4 max-h-[120px] overflow-y-auto">
                {result.errors.map(function(err, i) {
                  return <p key={i} className="text-xs text-red-600">{err}</p>;
                })}
              </div>
            )}
            <button onClick={handleClose} className="btn-primary mt-6">Fermer</button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Recipients summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Destinataires</span>
                  <span className="badge badge-blue text-xs">{leadsWithEmail.length} lead{leadsWithEmail.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                  {leadsWithEmail.map(function(lead) {
                    return (
                      <span key={lead.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs text-gray-600 border border-gray-200">
                        {lead.firstName} {lead.lastName}
                      </span>
                    );
                  })}
                </div>
                {leadsWithoutEmail.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      {leadsWithoutEmail.length} lead{leadsWithoutEmail.length > 1 ? "s" : ""} sans email exclu{leadsWithoutEmail.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
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
                    <Type size={12} /> Texte
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
                    className="btn-secondary py-2 text-xs w-full justify-between"
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
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2"
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
                      {BULK_TEMPLATES.map(function(t) {
                        return (
                          <button
                            key={t.name}
                            onClick={() => applyQuickTemplate(t)}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <p className="text-sm font-medium text-gray-900">{t.name}</p>
                            <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet de l'email"
                  className="input"
                />
              </div>

              {/* Body */}
              {mode === "text" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Redigez votre message... Utilisez {{prenom}} et {{nom}} pour personnaliser."
                    className="input min-h-[200px] resize-y"
                    rows={10}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400">Variables :</span>
                    {["{{prenom}}", "{{nom}}", "{{email}}"].map(function(v) {
                      return (
                        <button
                          key={v}
                          onClick={() => setBody(body + " " + v)}
                          className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100 transition-colors"
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode === "visual" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message visuel</label>
                  <EmailEditor
                    initialBlocks={blocks.length > 0 ? blocks : undefined}
                    brandColor={brandColor}
                    onChange={(newBlocks, newHtml) => { setBlocks(newBlocks); setHtml(newHtml); }}
                  />
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700">
                  Chaque email sera personnalise avec les variables {"{{prenom}}"}, {"{{nom}}"}, {"{{email}}"} du destinataire.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                {leadsWithEmail.length} email{leadsWithEmail.length > 1 ? "s" : ""} sera{leadsWithEmail.length > 1 ? "ont" : ""} envoye{leadsWithEmail.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={handleClose} className="btn-secondary" disabled={isPending}>Annuler</button>
                <button
                  onClick={handleSend}
                  disabled={isPending || !subject.trim() || (mode === "text" ? !body.trim() : !html.trim()) || leadsWithEmail.length === 0}
                  className="btn-primary"
                >
                  {isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Envoi en cours...</>
                  ) : (
                    <><Send size={16} /> Envoyer a {leadsWithEmail.length} lead{leadsWithEmail.length > 1 ? "s" : ""}</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}