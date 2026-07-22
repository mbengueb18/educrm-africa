"use client";

// Espace candidat — refonte en onglets : Suivi / Mon dossier / Pièces / Messages.
// Le dossier (sections + checklist) est rendu par le MÊME socle que l'onglet Candidature
// du CRM (DossierSectionsView / ChecklistCard) — aucune divergence possible entre les vues.
// Dépôt cadré : le candidat ne remplit que les cases nommées de la checklist ;
// remplacement possible tant que le dossier est incomplet, puis verrouillage automatique.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Calendar, MapPin, Video, FileText, Upload, MessageSquare,
  Phone, Mail, AlertCircle, Loader2, Lock, Sparkles, GraduationCap, Download, Pencil,
} from "lucide-react";
import { DossierSectionsView, ChecklistCard } from "@/components/forms/dossier-view";
import type { DossierSection, DossierChecklist, ChecklistItem } from "@/lib/candidature";

export type PortalDossier = {
  formName: string;
  submittedAt: string;
  sections: DossierSection[];
  checklist: DossierChecklist | null;
};

interface PortalData {
  id: string;
  expiresAt: Date;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    program: { id: string; name: string; level: string; durationMonths: number; tuitionAmount: number; currency: string } | null;
    campus: { id: string; name: string; city: string; country: string | null } | null;
    stage: { id: string; name: string; color: string; order: number };
    assignedTo: { id: string; name: string; email: string } | null;
    documents: { id: string; name: string; url: string; size: number; createdAt: Date }[];
    appointments: { id: string; title: string; type: string; status: string; startAt: Date; endAt: Date; location: string | null; meetingUrl: string | null }[];
    messages: { id: string; channel: string; direction: string; content: string; status: string; sentAt: Date }[];
  };
  organization: { id: string; name: string; logo: string | null; slug: string };
}

const STAGE_ORDER = ["Reçu", "Pré-étude", "Entretien", "Admis", "Inscrit"];

export function CandidatePortalClient({ token, data, dossier }: { token: string; data: PortalData; dossier: PortalDossier | null }) {
  const lead = data.lead;
  const org = data.organization;
  const hasDossier = !!dossier;
  const [tab, setTab] = useState<"suivi" | "dossier" | "pieces" | "messages">("suivi");

  const tabs: { id: typeof tab; label: string }[] = hasDossier
    ? [{ id: "suivi", label: "Suivi" }, { id: "dossier", label: "Mon dossier" }, { id: "pieces", label: "Pièces" }, { id: "messages", label: "Messages" }]
    : [{ id: "suivi", label: "Suivi" }, { id: "pieces", label: "Documents" }, { id: "messages", label: "Messages" }];

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const formatTime = (d: Date | string) =>
    new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const formatRelative = (d: Date | string) => {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7) return "Il y a " + days + " jours";
    return new Date(d).toLocaleDateString("fr-FR");
  };
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  const currentStageIndex = STAGE_ORDER.findIndex((s) => lead.stage.name.toLowerCase().includes(s.toLowerCase()));
  const progressIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

  const cl = dossier?.checklist || null;
  const nProvided = cl ? cl.items.filter((i) => i.status === "PROVIDED").length : 0;
  const nMissing = cl ? cl.items.length - nProvided : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 py-6 sm:py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl" />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-brand-100 flex items-center justify-center">
                <GraduationCap size={26} className="text-brand-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">Espace candidat</p>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bonjour {lead.firstName} 👋</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 truncate">
                {org.name} {lead.program ? "• " + lead.program.name : ""}
              </p>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Dossier</p>
              <p className="text-sm font-mono font-semibold text-brand-700">#{lead.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 flex gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 text-xs sm:text-sm font-semibold py-2 rounded-lg transition-colors relative",
                tab === t.id ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-50"
              )}>
              {t.label}
              {t.id === "pieces" && hasDossier && nMissing > 0 && (
                <span className={cn("absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                  tab === t.id ? "bg-white text-brand-700" : "bg-amber-500 text-white")}>{nMissing}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Suivi ── */}
        {tab === "suivi" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-brand-500" /> Progression de votre candidature
              </h2>
              <div className="relative mb-6">
                <div className="flex items-center justify-between relative z-10">
                  {STAGE_ORDER.map((stage, i) => {
                    const isCompleted = i < progressIndex;
                    const isCurrent = i === progressIndex;
                    return (
                      <div key={stage} className="flex flex-col items-center text-center px-0.5" style={{ width: "20%" }}>
                        <div className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-2 transition-all",
                          isCompleted ? "bg-emerald-500 text-white" :
                          isCurrent ? "bg-brand-500 text-white ring-4 ring-brand-100" :
                          "bg-gray-200 text-gray-400"
                        )}>
                          {isCompleted ? <CheckCircle2 size={17} /> : <span className="text-sm font-bold">{i + 1}</span>}
                        </div>
                        <span className={cn(
                          "text-[10px] sm:text-xs font-medium leading-tight break-words",
                          isCompleted ? "text-emerald-600" : isCurrent ? "text-brand-600" : "text-gray-400"
                        )}>{stage}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-gray-200 -z-0">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: progressIndex > 0 ? (progressIndex / (STAGE_ORDER.length - 1)) * 100 + "%" : "0%" }} />
                </div>
              </div>
              {hasDossier && nMissing > 0 && (
                <button onClick={() => setTab("pieces")} className="w-full mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-left hover:bg-amber-100/60 transition-colors">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-800 flex-1">
                    <strong>{nMissing} pièce{nMissing > 1 ? "s" : ""}</strong> encore attendue{nMissing > 1 ? "s" : ""} pour compléter votre dossier.
                  </span>
                  <span className="text-xs font-semibold text-amber-700">Compléter →</span>
                </button>
              )}
              {hasDossier && cl && nMissing === 0 && (
                <div className="mb-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-800">Votre dossier est <strong>complet</strong>. Il est en cours d'étude.</span>
                </div>
              )}
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <p className="text-xs text-brand-700">
                  {lead.assignedTo
                    ? "Votre conseiller " + lead.assignedTo.name + " suit votre candidature."
                    : "Un conseiller va prendre contact avec vous très prochainement."}
                </p>
              </div>
            </div>

            {lead.appointments.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-500" /> Vos prochains rendez-vous
                </h2>
                <div className="space-y-3">
                  {lead.appointments.map((appt) => {
                    const Icon = appt.type === "VIDEO_CALL" ? Video : appt.type === "PHONE" ? Phone : MapPin;
                    return (
                      <div key={appt.id} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Icon size={18} className="text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{appt.title}</p>
                            <p className="text-xs text-blue-700 mt-0.5">📅 {formatDate(appt.startAt)} à {formatTime(appt.startAt)}</p>
                            {appt.location && <p className="text-xs text-gray-600 mt-1">📍 {appt.location}</p>}
                            {appt.meetingUrl && (
                              <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
                                <Video size={11} /> Rejoindre la visioconférence
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-orange-500" /> Besoin d'aide ?
              </h2>
              {lead.assignedTo ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-700 mb-2">Votre conseillère/conseiller : <strong>{lead.assignedTo.name}</strong></p>
                  {lead.assignedTo.email && (
                    <a href={"mailto:" + lead.assignedTo.email} className="text-sm text-brand-600 hover:underline flex items-center gap-1">
                      <Mail size={13} /> {lead.assignedTo.email}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Un conseiller vous sera bientôt attribué.</p>
              )}
            </div>
          </>
        )}

        {/* ── Mon dossier ── */}
        {tab === "dossier" && dossier && (
          <>
            <DossierPdfCard token={token} />
            <DossierSectionsView sections={dossier.sections} />
          </>
        )}

        {/* ── Pièces ── */}
        {tab === "pieces" && (
          <>
            {cl ? (
              <>
                <ChecklistCard
                  checklist={cl}
                  title="Pièces de mon dossier"
                  renderItemAction={cl.locked ? undefined : (it) => <PieceUploadButton token={token} item={it} />}
                />
                {!cl.locked && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-2.5">
                    <Lock size={15} className="text-brand-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500">
                      Vous ne déposez que les pièces demandées. Remplacement possible tant que le dossier est incomplet —
                      une fois toutes les pièces fournies, il se verrouille automatiquement.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <LegacyDocuments token={token} documents={lead.documents} formatSize={formatSize} formatRelative={formatRelative} />
            )}
          </>
        )}

        {/* ── Messages ── */}
        {tab === "messages" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-500" /> Messages avec votre conseiller
            </h2>
            {lead.messages.length > 0 ? (
              <div className="space-y-3">
                {lead.messages.slice(0, 10).map((msg) => {
                  let parsed = { subject: null as string | null, body: msg.content };
                  try {
                    const p = JSON.parse(msg.content);
                    parsed = { subject: p.subject || null, body: p.body || msg.content };
                  } catch {}
                  const isFromSchool = msg.direction === "OUTBOUND";
                  return (
                    <div key={msg.id} className={cn(
                      "rounded-xl p-3 max-w-[90%]",
                      isFromSchool ? "bg-gray-50 border border-gray-100" : "bg-brand-50 border border-brand-100 ml-auto"
                    )}>
                      <p className="text-[10px] text-gray-400 mb-1">
                        {isFromSchool ? "De votre conseiller" : "De vous"} • {formatRelative(msg.sentAt)}
                      </p>
                      {parsed.subject && <p className="text-xs font-semibold text-gray-700 mb-1">{parsed.subject}</p>}
                      <p className="text-sm text-gray-700 line-clamp-3">{parsed.body}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucun message pour le moment</p>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">
          Espace candidat sécurisé • Propulsé par <a href="https://talibcrm.com" className="text-brand-600 hover:underline">TalibCRM</a>
        </p>
      </div>
    </div>
  );
}

// Carte de téléchargement du dossier complet en PDF (généré à la demande côté serveur).
function DossierPdfCard({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/candidat/" + token + "/dossier-pdf", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Génération impossible");
      window.open(d.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du PDF");
    }
    setBusy(false);
  };
  return (
    <div className="rounded-2xl shadow-sm p-5 sm:p-6 text-white" style={{ background: "linear-gradient(120deg, #1B4F72, #2E86C1)" }}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-11 h-14 rounded-lg bg-white/15 border border-white/30 flex flex-col items-center justify-center shrink-0">
          <FileText size={18} />
          <span className="text-[9px] font-extrabold mt-0.5">PDF</span>
        </div>
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm sm:text-base font-semibold">Votre dossier complet</h2>
          <p className="text-xs text-white/80 mt-0.5">Toutes vos réponses et pièces réunies en un seul PDF.</p>
        </div>
        <button onClick={download} disabled={busy}
          className="bg-white text-brand-700 text-xs sm:text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-brand-50 transition-colors disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Génération…" : "Télécharger"}
        </button>
      </div>
    </div>
  );
}

// Bouton de dépôt / remplacement d'une pièce nommée de la checklist.
function PieceUploadButton({ token, item }: { token: string; item: ChecklistItem }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const missing = item.status === "MISSING";

  const send = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10 Mo)"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fieldName", item.name);
      const res = await fetch("/api/candidat/" + token + "/piece", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Envoi impossible");
      toast.success(missing ? "Pièce déposée ✓" : "Pièce remplacée ✓");
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); ref.current?.click(); }} disabled={busy}
        className={cn(
          "text-[11px] font-semibold rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shrink-0 transition-colors",
          missing
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "bg-brand-50 text-brand-700 border border-brand-100 hover:bg-brand-100"
        )}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : missing ? <Upload size={12} /> : <Pencil size={12} />}
        {busy ? "Envoi…" : missing ? "Téléverser" : "Remplacer"}
      </button>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => send(e.target.files?.[0] || null)} disabled={busy} />
    </>
  );
}

// Repli pour les leads sans dossier de candidature : liste des documents déjà déposés (lecture seule).
function LegacyDocuments({ documents, formatSize, formatRelative }: {
  token: string;
  documents: { id: string; name: string; url: string; size: number; createdAt: Date }[];
  formatSize: (n: number) => string;
  formatRelative: (d: Date | string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FileText size={18} className="text-violet-500" /> Vos documents
      </h2>
      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400">{formatSize(doc.size)} • {formatRelative(doc.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun document</p>
          <p className="text-xs text-gray-400 mt-1">Les pièces à fournir apparaîtront ici lorsque votre dossier de candidature sera enregistré.</p>
        </div>
      )}
    </div>
  );
}
