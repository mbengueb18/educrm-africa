"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, formatPhone, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, MessageCircle, Calendar, FileText, ListTodo,
  Activity as ActivityIcon, History, GraduationCap, MapPin, Building2,
  User as UserIcon, Edit3, Star, Tag, Clock, Briefcase, Globe,
  ExternalLink, ChevronRight, ChevronDown, Plus, Loader2, Check, Trash2, X,
  AlertCircle, CheckCircle2, Video, Sparkles, Zap, Copy,
  TrendingUp, ThumbsUp, AlertTriangle, RefreshCw, Globe2, MousePointer2, MessageSquare, Bot, Send, ArrowRight,
  StickyNote, Pencil, XCircle,
} from "lucide-react";
import { ComposeEmail } from "@/components/messaging/compose-email";
import { createTask, updateTask, deleteTask } from "@/app/(dashboard)/tasks/actions";
import { moveLeadToStage } from "@/app/(dashboard)/pipeline/actions";
import { updateLeadNotes } from "@/app/(dashboard)/pipeline/lead-actions";
import { type CustomFieldConfig } from "@/lib/custom-fields";
import { getDocumentSignedUrl, deleteDocument } from "./document-actions";
import { reopenDossier } from "./dossier-actions";
import { createAppointment, updateAppointment, deleteAppointment } from "@/app/(dashboard)/appointments/actions";
import { startCallTracking } from "@/lib/call-tracking";
import { stripHtml } from "@/lib/email-blocks";
import { getLeadJourney } from "./journey-actions";
import { WhatsAppButton } from "@/components/lead/whatsapp-button";
import { formatCFA } from "@/lib/utils";
import { DossierSectionsView, ChecklistCard } from "@/components/forms/dossier-view";
import { normalizeLabel, type DossierSection, type DossierChecklist } from "@/lib/candidature";

type Candidature = {
  formName: string;
  submittedAt: string;
  sections: DossierSection[];
  checklist?: DossierChecklist | null;
  fieldLabels: string[];
};

const activityIcons: Record<string, any> = {
  LEAD_CREATED: Tag,
  LEAD_STAGE_CHANGED: ArrowRight,
  LEAD_ASSIGNED: UserIcon,
  MESSAGE_SENT: Send,
  MESSAGE_RECEIVED: MessageSquare,
  CALL_LOGGED: Phone,
  NOTE_ADDED: FileText,
  DOCUMENT_UPLOADED: FileText,
};

interface LeadDetailClientProps {
  lead: any;
  initialTab: string;
  canUseWhatsAppAPI: boolean;
  currentPlanName: string;
  stages: { id: string; name: string; color: string }[];
  customFields?: CustomFieldConfig[];
  candidature?: Candidature | null;
}

const TABS = [
  { id: "overview", label: "Aperçu", icon: UserIcon },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "ai", label: "Assistant IA", icon: Sparkles },
  { id: "journey", label: "Parcours web", icon: Globe2 },
  { id: "email", label: "Email", icon: Mail },
  { id: "history", label: "Historique", icon: History },
  { id: "tasks", label: "Tâches", icon: ListTodo },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "appointments", label: "Rendez-vous", icon: Calendar },
];

export function LeadDetailClient({
  lead,
  initialTab,
  canUseWhatsAppAPI,
  currentPlanName,
  stages,
  customFields = [],
  candidature = null }: LeadDetailClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  const scrollTabsRight = () => {
    tabsScrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  const fullName = lead.firstName + " " + lead.lastName;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-base sm:text-lg shrink-0">
          {getInitials(fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 break-words">{fullName}</h1>
            <StageSelector leadId={lead.id} currentStage={lead.stage} stages={stages} />
            {lead.isConverted && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">Converti ✓</span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 mt-1 flex-wrap">
            {lead.program && (
              <span className="flex items-center gap-1 min-w-0 max-w-full">
                <GraduationCap size={11} className="shrink-0" />
                <span className="truncate">{lead.program.name}</span>
              </span>
            )}
            {lead.campus && (
              <span className="flex items-center gap-1 min-w-0">
                <Building2 size={11} className="shrink-0" />
                <span className="truncate">{lead.campus.name}</span>
              </span>
            )}
            {lead.assignedTo && (
              <span className="flex items-center gap-1 min-w-0">
                <UserIcon size={11} className="shrink-0" />
                <span className="truncate">{lead.assignedTo.name}</span>
              </span>
            )}
          </div>
        </div>
        {/* "Retour au pipeline" — desktop only (back arrow does the same on mobile) */}
        <Link href="/pipeline" className="hidden lg:inline-flex btn-secondary py-2 px-3 text-xs shrink-0">
          Retour au pipeline
        </Link>
      </div>

      {/* Quick actions bar */}
      <div className="flex items-center gap-2 mb-4 sm:mb-5 flex-wrap">
        <a href={"tel:" + lead.phone}
          onClick={function() { startCallTracking({ id: lead.id, name: lead.firstName + " " + lead.lastName, phone: lead.phone }); }}
          className="btn-secondary py-1.5 px-3 text-xs">
          <Phone size={13} /> Appeler
        </a>
        {(lead.whatsapp || lead.phone) && (
          <WhatsAppButton
            leadId={lead.id}
            leadName={lead.firstName + " " + lead.lastName}
            leadPhone={lead.whatsapp || lead.phone}
            canUseWhatsAppAPI={canUseWhatsAppAPI}
            currentPlanName={currentPlanName}
          />
        )}
        {lead.email && (
          <button onClick={() => handleTabChange("email")} className="btn-secondary py-1.5 px-3 text-xs">
            <Mail size={13} /> <span className="hidden sm:inline">Composer </span>Email
          </button>
        )}
      </div>

      {/* Tabs — horizontal scroll with right edge fade + clickable scroll button on mobile */}
      <div className="relative border-b border-gray-200 mb-4 sm:mb-5 -mx-3 sm:mx-0">
        <div ref={tabsScrollRef} className="flex gap-1 overflow-x-auto no-scrollbar px-3 sm:px-0 scroll-smooth">
          {(candidature
            ? [TABS[0], { id: "application", label: "Candidature", icon: GraduationCap }, ...TABS.slice(1)]
            : TABS
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                <Icon size={14} className="shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* Right edge: fade + clickable chevron button — mobile only */}
        <div className="absolute top-0 right-0 bottom-px w-16 bg-gradient-to-l from-gray-50 via-gray-50/95 to-transparent sm:hidden flex items-center justify-end pr-1">
          <button
            type="button"
            onClick={scrollTabsRight}
            className="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-transform hover:bg-gray-50"
            aria-label="Voir plus d'onglets"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab lead={lead} customFieldsConfig={customFields} hideLabels={candidature?.fieldLabels} />}
      {activeTab === "application" && candidature && <ApplicationTab candidature={candidature} leadId={lead.id} />}
      {activeTab === "notes" && <NotesTab lead={lead} />}
      {activeTab === "ai" && <AIAssistantTab lead={lead} />}
      {activeTab === "journey" && <JourneyTab lead={lead} />}
      {activeTab === "email" && <EmailTab lead={lead} onSent={() => router.refresh()} />}
      {activeTab === "history" && <HistoryTab lead={lead} />}
      {activeTab === "tasks" && <TasksTab lead={lead} />}
      {activeTab === "documents" && <DocumentsTab lead={lead} />}
      {activeTab === "appointments" && <AppointmentsTab lead={lead} />}
    </div>
  );
}

// ─── Overview Tab ───
// ─── Sélecteur d'étape (changement de statut depuis la fiche) ───
function StageSelector({ leadId, currentStage, stages }: {
  leadId: string;
  currentStage: any;
  stages: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const color = currentStage?.color || "#888";

  const change = (stageId: string) => {
    setOpen(false);
    if (stageId === currentStage?.id) return;
    startTransition(async () => {
      try {
        await moveLeadToStage(leadId, stageId);
        toast.success("Statut mis à jour");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        disabled={pending || stages.length === 0}
        className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-60"
        style={{ backgroundColor: color + "20", color }}
        title="Changer le statut"
      >
        {pending && <Loader2 size={11} className="animate-spin" />}
        {currentStage?.name || "—"}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-56 max-h-72 overflow-y-auto animate-scale-in">
            <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider">Changer le statut</p>
            {stages.map((s) => (
              <button
                key={s.id}
                onClick={() => change(s.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2",
                  s.id === currentStage?.id ? "font-semibold text-gray-900" : "text-gray-700"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.name}</span>
                {s.id === currentStage?.id && <Check size={12} className="ml-auto text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Candidature Tab ───
// Dossier de candidature : sections rejouées depuis le formulaire d'origine (socle partagé
// avec le portail candidat via DossierSectionsView).
function ApplicationTab({ candidature, leadId }: { candidature: Candidature; leadId: string }) {
  const cl = candidature.checklist;
  const nProvided = cl ? cl.items.filter((i) => i.status === "PROVIDED").length : 0;
  const nMissing = cl ? cl.items.length - nProvided : 0;
  const [generating, setGenerating] = useState(false);

  // Génère le PDF fusionné (synthèse + pièces) côté serveur puis ouvre l'URL signée.
  const downloadPdf = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/leads/" + leadId + "/dossier-pdf", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Génération impossible");
      window.open(d.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du PDF");
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><GraduationCap size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{candidature.formName}</h3>
          <p className="text-xs text-gray-500">
            Soumis le {new Date(candidature.submittedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {cl && cl.items.length > 0 && <> · {nProvided}/{cl.items.length} pièce{cl.items.length > 1 ? "s" : ""}</>}
          </p>
        </div>
        {cl && cl.items.length > 0 && (
          nMissing > 0
            ? <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0">{nMissing} manquante{nMissing > 1 ? "s" : ""}</span>
            : <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">Dossier complet</span>
        )}
        <button onClick={downloadPdf} disabled={generating} className="btn-primary py-1.5 px-3 text-xs shrink-0">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          {generating ? "Génération…" : "Dossier PDF"}
        </button>
      </div>
      {cl && <ChecklistCard checklist={cl} lockedSlot={<ReopenButton leadId={leadId} />} />}
      {candidature.sections.length > 0 && <DossierSectionsView sections={candidature.sections} />}
    </div>
  );
}

// Rouvre un dossier verrouillé (permet au candidat de remplacer une pièce erronée).
function ReopenButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const reopen = async () => {
    setBusy(true);
    const r = await reopenDossier(leadId);
    if (r.ok) { toast.success("Dossier rouvert — le candidat peut à nouveau déposer des pièces."); router.refresh(); }
    else toast.error(r.error || "Erreur");
    setBusy(false);
  };
  return (
    <button onClick={reopen} disabled={busy} className="btn-secondary py-1 px-2.5 text-[11px] shrink-0">
      {busy ? <Loader2 size={11} className="animate-spin" /> : null} Rouvrir
    </button>
  );
}

function OverviewTab({ lead, customFieldsConfig = [], hideLabels }: { lead: any; customFieldsConfig?: CustomFieldConfig[]; hideLabels?: string[] }) {
  // Informations complémentaires : champs custom (hors clés techniques préfixées par "_").
  // Les réponses du dossier de candidature (hideLabels, déjà normalisés) sont masquées ici :
  // elles sont présentées, structurées par sections, dans l'onglet Candidature.
  const hidden = new Set(hideLabels || []);
  const customFields = (lead.customFields as Record<string, any>) || {};
  const mappedEntries: { label: string; value: string }[] = [];
  const unmappedEntries: { label: string; value: string }[] = [];
  for (const key in customFields) {
    const value = customFields[key];
    if (key.startsWith("_") || !value) continue;
    if (hidden.has(normalizeLabel(key))) continue;
    const config = customFieldsConfig.find(
      (cf) => cf.key === key || cf.mappedFormFields.some((mf) => mf.toLowerCase() === key.toLowerCase())
    );
    if (config) {
      mappedEntries.push({ label: config.label, value: String(value) });
    } else {
      const niceLabel = key.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      unmappedEntries.push({ label: niceLabel, value: String(value) });
    }
  }
  const allCustom = mappedEntries.concat(unmappedEntries);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
      {/* Contact info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact</h3>
        <div className="space-y-3">
          {lead.civility && <InfoRow icon={UserIcon} label="Civilité" value={lead.civility} />}
          <InfoRow icon={Phone} label="Téléphone" value={lead.phone ? formatPhone(lead.phone) : "—"} />
          <InfoRow icon={MessageCircle} label="WhatsApp" value={lead.whatsapp ? formatPhone(lead.whatsapp) : "—"} />
          <InfoRow icon={Mail} label="Email" value={lead.email || "—"} />
          {lead.dateOfBirth && (
            <InfoRow icon={Calendar} label="Naissance" value={new Date(lead.dateOfBirth).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
          )}
          <InfoRow icon={MapPin} label="Ville" value={lead.city || "—"} />
          <InfoRow icon={Globe} label="Pays" value={lead.country || "—"} />
        </div>

      </div>

      {/* NOUVEAU — Formation souhaitée */}
      {lead.program && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Formation souhaitée</h3>
          <div className="space-y-3">
            <InfoRow icon={GraduationCap} label="Filière" value={lead.program.name} />
            {lead.program.code && <InfoRow icon={Tag} label="Code" value={lead.program.code} />}
            <InfoRow icon={Tag} label="Niveau" value={lead.program.level} />
            {lead.program.formationType && (
              <InfoRow 
                icon={Briefcase} 
                label="Type" 
                value={
                  lead.program.formationType === "INITIAL" ? "Formation Initiale (FI)" :
                  lead.program.formationType === "CONTINUE" ? "Formation Continue (FC)" :
                  "FI + FC"
                }
              />
            )}
            {lead.program.tuitionAmount && (
              <InfoRow icon={Tag} label="Frais" value={formatCFA(lead.program.tuitionAmount)} />
            )}
          </div>
        </div>
      )}

      {/* Pipeline info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline</h3>
        <div className="space-y-3">
          <InfoRow icon={Tag} label="Étape" value={lead.stage?.name || "—"} />
          <InfoRow icon={UserIcon} label="Assigné à" value={lead.assignedTo?.name || "Non assigné"} />
          <InfoRow icon={Star} label="Score" value={lead.score + "/100"} />
          <InfoRow icon={Globe} label="Source" value={lead.source} />
          {lead.sourceDetail && <InfoRow icon={Briefcase} label="Détail source" value={lead.sourceDetail} />}
          {lead.campaign && <InfoRow icon={Briefcase} label="Campagne" value={lead.campaign.name} />}
          <InfoRow icon={Clock} label="Créé le" value={new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Activité</h3>
        <div className="space-y-3">
          <StatRow icon={Mail} label="Messages" value={lead._count?.messages || 0} />
          <StatRow icon={Phone} label="Appels" value={lead._count?.calls || 0} />
          <StatRow icon={Calendar} label="Rendez-vous" value={lead._count?.appointments || 0} />
          <StatRow icon={ListTodo} label="Tâches" value={lead._count?.tasks || 0} />
          <StatRow icon={FileText} label="Documents" value={lead._count?.documents || 0} />
          <StatRow icon={ActivityIcon} label="Activités" value={lead._count?.activities || 0} />
        </div>
      </div>

      {/* Message du formulaire de contact */}
      {(lead.message || lead.subject) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 md:col-span-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Message</h3>
          {lead.subject && <p className="text-xs font-medium text-gray-700 mb-1">{lead.subject}</p>}
          {lead.message && <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{lead.message}</p>}
        </div>
      )}

      {/* Informations complémentaires (champs personnalisés / formulaires) */}
      {allCustom.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 md:col-span-3">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations complémentaires</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
            {allCustom.map((cf, i) => (
              <InfoRow key={i} icon={Tag} label={cf.label} value={cf.value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notes Tab ───
function NotesTab({ lead }: { lead: any }) {
  const initial = ((lead.customFields as any)?._notes as string) || "";
  const [savedNotes, setSavedNotes] = useState(initial);
  const [notes, setNotes] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!initial);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLeadNotes(lead.id, notes);
      setSavedNotes(notes);
      toast.success("Notes enregistrées");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 max-w-3xl">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote size={16} className="text-amber-500 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-700">Notes internes</h3>
        </div>
        {!editing && savedNotes && (
          <button onClick={() => setEditing(true)} className="btn-secondary py-1 px-2.5 text-xs shrink-0">
            <Pencil size={12} /> Modifier
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"Ajoutez des notes internes sur ce lead (visibles uniquement par votre équipe)...\n\nExemples :\n• Parents divorcés, contact préférentiel : mère\n• Intéressé par la filière Marketing, budget limité\n• Doit rappeler après les examens du bac"}
            className="input text-sm w-full min-h-[250px] sm:min-h-[300px] resize-y font-normal"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            {savedNotes && (
              <button onClick={() => { setNotes(savedNotes); setEditing(false); }} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}>
                <XCircle size={13} /> Annuler
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="btn-primary py-1.5 px-3 text-xs">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Enregistrer
            </button>
          </div>
        </>
      ) : (
        <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">{savedNotes || "Aucune note"}</p>
        </div>
      )}
    </div>
  );
}

// ─── Email Tab ───
function EmailTab({ lead, onSent }: { lead: any; onSent: () => void }) {
  if (!lead.email) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 sm:py-16 text-center">
        <Mail size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Ce lead n'a pas d'adresse email</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
      <ComposeEmail
        leadId={lead.id}
        leadName={lead.firstName + " " + lead.lastName}
        leadEmail={lead.email}
        onSent={onSent}
      />
    </div>
  );
}

// ─── History Tab ───
function HistoryTab({ lead }: { lead: any }) {
  const activities = lead.activities || [];
  const messages = lead.messages || [];

  const events: any[] = [
    ...activities.map((a: any) => ({ type: "activity", ...a, sortDate: new Date(a.createdAt) })),
    ...messages.map((m: any) => ({ type: "message", ...m, sortDate: new Date(m.sentAt) })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
        <History size={36} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucun historique</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="space-y-4">
        {events.map((event, idx) => {
          const date = new Date(event.sortDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

          if (event.type === "message") {
        const msg = event;
        const isWhatsApp = msg.channel === "WHATSAPP";
        const isSMS = msg.channel === "SMS";
        const isEmail = msg.channel === "EMAIL";
        const isChatbot = msg.channel === "CHATBOT";
        const isInbound = msg.direction === "INBOUND";

        const MsgIcon = isWhatsApp ? MessageCircle : isSMS ? MessageSquare : isChatbot ? Bot : Mail;

        const msgIconBg = isWhatsApp
          ? "bg-emerald-50 text-emerald-600"
          : isEmail
          ? "bg-blue-50 text-blue-600"
          : isChatbot
          ? "bg-violet-50 text-violet-600"
          : "bg-purple-50 text-purple-600";

        const channelLabel = isWhatsApp ? "WhatsApp" : isSMS ? "SMS" : isEmail ? "Email" : isChatbot ? "Chatbot" : msg.channel;
        const dirLabel = isInbound ? "reçu" : "envoyé";

        // Parsing : email = JSON, autres = texte brut
        let parsedContent = { subject: null as string | null, body: "" };
        try {
          const parsed = JSON.parse(msg.content);
          parsedContent = { subject: parsed.subject || null, body: parsed.body || "" };
        } catch {
          parsedContent = { subject: null, body: msg.content };
        }

        let displayBody = parsedContent.body || "";

        // Strip HTML pour les emails
        const isHtmlBody = displayBody.trim().startsWith("<") && (
          displayBody.includes("<html") ||
          displayBody.includes("<!DOCTYPE") ||
          displayBody.includes("<div") ||
          displayBody.includes("<table") ||
          displayBody.includes("<body") ||
          displayBody.includes("<p")
        );
        if (isHtmlBody) {
          displayBody = stripHtml(displayBody);
        }

        // Cleanup quoted replies pour les inbounds
        if (isInbound) {
          displayBody = displayBody
            .replace(/^(>+\s*.*\n?)+/gm, "")
            .replace(/On .{1,200} wrote:[\s\S]*$/i, "")
            .replace(/Le .{1,200} a [eé]crit\s*:[\s\S]*$/i, "")
            .replace(/-{2,}.*Original Message.*-{2,}[\s\S]*$/i, "")
            .replace(/_{3,}[\s\S]*$/m, "")
            .trim();
        }
        if (!displayBody.trim()) {
          displayBody = "(Message vide)";
        }

        return (
          <div key={idx} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", msgIconBg)}>
              <MsgIcon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <p className="text-sm font-medium text-gray-700">
                    {channelLabel} {dirLabel}
                  </p>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
                    msg.status === "DELIVERED" || msg.status === "READ" ? "bg-emerald-100 text-emerald-700" :
                    msg.status === "FAILED" ? "bg-red-100 text-red-600" :
                    "bg-gray-100 text-gray-500"
                  )}>
                    {msg.status === "READ" ? "Lu" : msg.status === "DELIVERED" ? "Reçu" : msg.status === "SENT" ? "Envoyé" : msg.status === "FAILED" ? "Échoué" : msg.status}
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{date}</span>
              </div>
              {parsedContent.subject && (
                <p className="text-xs font-semibold text-gray-800 mb-1 break-words">{parsedContent.subject}</p>
              )}
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-6 break-words">{displayBody}</p>
            </div>
          </div>
        );
      }

          // Activity
      const ActIcon = activityIcons[event.type] || ActivityIcon;
      
      // Couleurs spécifiques selon le type d'activité
      let actBg = "bg-gray-50 text-gray-500";
      if (event.type === "MESSAGE_SENT") {
        actBg = "bg-blue-50 text-blue-600";
      } else if (event.type === "MESSAGE_RECEIVED") {
        actBg = "bg-emerald-50 text-emerald-600";
      } else if (event.type === "CALL_LOGGED") {
        actBg = "bg-violet-50 text-violet-600";
      } else if (event.type === "LEAD_STAGE_CHANGED") {
        actBg = "bg-amber-50 text-amber-600";
      } else if (event.type === "DOCUMENT_UPLOADED") {
        actBg = "bg-orange-50 text-orange-600";
      }
      
      return (
        <div key={idx} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", actBg)}>
            <ActIcon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
              <p className="text-sm text-gray-700 min-w-0 break-words">{event.description}</p>
              <span className="text-xs text-gray-400 shrink-0">{date}</span>
            </div>
            {event.user && <p className="text-xs text-gray-400">Par {event.user.name}</p>}
          </div>
        </div>
      );
        })}
      </div>
    </div>
  );
}

// ─── Tasks Tab ───
function TasksTab({ lead }: { lead: any }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const tasks = lead.tasks || [];

  const handleStatusToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await updateTask(taskId, { status: newStatus });
      toast.success(newStatus === "DONE" ? "Tâche marquée terminée" : "Tâche réouverte");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    try {
      await deleteTask(taskId);
      toast.success("Tâche supprimée");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const sortedTasks = [...tasks].sort((a: any, b: any) => {
    if (a.status !== "DONE" && b.status === "DONE") return -1;
    if (a.status === "DONE" && b.status !== "DONE") return 1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary py-1.5 px-3 text-xs shrink-0">
          <Plus size={13} /> <span className="hidden sm:inline">Nouvelle tâche</span><span className="sm:hidden">Nouvelle</span>
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateTaskInline
          leadId={lead.id}
          assignedToId={lead.assignedToId || lead.assignedTo?.id}
          onClose={(created) => { setShowCreate(false); if (created) router.refresh(); }}
        />
      )}

      {/* Tasks list */}
      {sortedTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <ListTodo size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune tâche</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {sortedTasks.map((task: any) => {
            const isDone = task.status === "DONE";
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;
            const priorityConfig: Record<string, { color: string; bg: string }> = {
              URGENT: { color: "text-red-700", bg: "bg-red-100" },
              HIGH: { color: "text-amber-700", bg: "bg-amber-100" },
              MEDIUM: { color: "text-gray-600", bg: "bg-gray-100" },
              LOW: { color: "text-gray-500", bg: "bg-gray-50" },
            };
            const pc = priorityConfig[task.priority] || priorityConfig.MEDIUM;

            return (
              <div key={task.id} className={cn("flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 group hover:bg-gray-50/50", isOverdue && !isDone && "bg-red-50/30")}>
                {/* Checkbox */}
                <button
                  onClick={() => handleStatusToggle(task.id, task.status)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                    isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-emerald-500"
                  )}
                >
                  {isDone && <Check size={12} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium break-words", isDone && "line-through text-gray-400")}>{task.title}</p>
                  {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.dueDate && (
                      <span className={cn("text-[10px] flex items-center gap-1",
                        isOverdue && !isDone ? "text-red-600 font-medium" : "text-gray-400"
                      )}>
                        <Clock size={10} />
                        {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {isOverdue && !isDone && " (en retard)"}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="text-[10px] text-gray-400">• {task.assignedTo.name}</span>
                    )}
                  </div>
                </div>

                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 hidden sm:inline-block", pc.bg, pc.color)}>
                  {task.priority}
                </span>

                {/* Delete — always visible on mobile */}
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Task Inline ───
function CreateTaskInline({ leadId, assignedToId, onClose }: {
  leadId: string;
  assignedToId: string;
  onClose: (created?: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [type, setType] = useState("TODO");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    setSaving(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        type,
        dueDate: dueDate || undefined,
        leadId,
        assignedToId,
      });
      toast.success("Tâche créée");
      onClose(true);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-3 sm:p-4 space-y-3 animate-scale-in">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la tâche..."
        className="input text-sm font-medium"
        onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) handleSubmit(); }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (facultatif)"
        className="input text-sm"
        rows={2}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input text-xs py-1.5">
            <option value="TODO">À faire</option>
            <option value="CALL">Appel</option>
            <option value="EMAIL">Email</option>
            <option value="MEETING">RDV</option>
            <option value="FOLLOW_UP">Relance</option>
            <option value="DOCUMENT">Document</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Priorité</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input text-xs py-1.5">
            <option value="LOW">Basse</option>
            <option value="MEDIUM">Moyenne</option>
            <option value="HIGH">Haute</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Échéance</label>
          <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input text-xs py-1.5" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => onClose()} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
        <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Créer
        </button>
      </div>
    </div>
  );
}

// ─── Documents Tab ───
function DocumentsTab({ lead }: { lead: any }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("OTHER");
  const documents = lead.documents || [];

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
        formData.append("type", docType);

        const response = await fetch("/api/leads/" + lead.id + "/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (response.ok) {
          toast.success(file.name + " ajouté");
        } else {
          toast.error(data.error || "Erreur upload " + file.name);
        }
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setUploading(false);
    event.target.value = "";
  };

  const handleView = async (documentId: string) => {
    try {
      const result = await getDocumentSignedUrl(documentId);
      window.open(result.url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Supprimer ce document ? Cette action est irréversible.")) return;
    try {
      await deleteDocument(documentId);
      toast.success("Document supprimé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  const DOC_TYPE_LABELS: Record<string, string> = {
    ID_CARD: "Pièce d'identité",
    DIPLOMA: "Diplôme",
    TRANSCRIPT: "Relevé de notes",
    PHOTO: "Photo",
    ENROLLMENT_FORM: "Formulaire",
    RECEIPT: "Reçu",
    CERTIFICATE: "Certificat",
    OTHER: "Autre",
  };

  const DOC_TYPE_COLORS: Record<string, string> = {
    ID_CARD: "bg-blue-100 text-blue-700",
    DIPLOMA: "bg-emerald-100 text-emerald-700",
    TRANSCRIPT: "bg-violet-100 text-violet-700",
    PHOTO: "bg-amber-100 text-amber-700",
    ENROLLMENT_FORM: "bg-indigo-100 text-indigo-700",
    RECEIPT: "bg-orange-100 text-orange-700",
    CERTIFICATE: "bg-teal-100 text-teal-700",
    OTHER: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-4">
      {/* Upload bar — stacks on mobile */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input text-xs py-2 sm:py-1.5 w-full sm:w-44" disabled={uploading}>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className={cn(
            "btn-primary py-2 sm:py-1.5 px-3 text-xs cursor-pointer w-full sm:flex-1 justify-center",
            uploading && "opacity-50 cursor-not-allowed"
          )}>
            {uploading ? (
              <><Loader2 size={13} className="animate-spin" /> Upload en cours...</>
            ) : (
              <><Plus size={13} /> Ajouter un document</>
            )}
            <input type="file" multiple onChange={handleFileUpload} disabled={uploading} className="hidden" />
          </label>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Formats acceptés : tous • Taille max : 25 MB par fichier</p>
      </div>

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <FileText size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun document</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 group hover:bg-gray-50/50">
              <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleView(doc.id)}>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate min-w-0">{doc.name}</p>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", DOC_TYPE_COLORS[doc.type] || "bg-gray-100 text-gray-600")}>
                    {DOC_TYPE_LABELS[doc.type] || doc.type}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  {doc.size ? formatSize(doc.size) : ""}{doc.size ? " • " : ""}
                  {new Date(doc.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => handleView(doc.id)}
                className="p-2 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 shrink-0"
                title="Voir/Télécharger"
              >
                <ExternalLink size={14} />
              </button>
              {/* Delete — always visible on mobile */}
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Appointments Tab ───
function AppointmentsTab({ lead }: { lead: any }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const appointments = lead.appointments || [];

  const handleStatusChange = async (apptId: string, newStatus: string) => {
    try {
      await updateAppointment(apptId, { status: newStatus });
      toast.success("Statut mis à jour");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (apptId: string) => {
    if (!confirm("Supprimer ce rendez-vous ?")) return;
    try {
      await deleteAppointment(apptId);
      toast.success("Rendez-vous supprimé");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const now = new Date();
  const upcoming = appointments.filter((a: any) => new Date(a.startAt) >= now)
    .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = appointments.filter((a: any) => new Date(a.startAt) < now)
    .sort((a: any, b: any) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    SCHEDULED: { label: "Planifié", bg: "bg-blue-100", color: "text-blue-700" },
    CONFIRMED: { label: "Confirmé", bg: "bg-emerald-100", color: "text-emerald-700" },
    IN_PROGRESS: { label: "En cours", bg: "bg-amber-100", color: "text-amber-700" },
    COMPLETED: { label: "Terminé", bg: "bg-gray-100", color: "text-gray-600" },
    CANCELLED: { label: "Annulé", bg: "bg-red-100", color: "text-red-700" },
    NO_SHOW: { label: "Absent", bg: "bg-red-100", color: "text-red-700" },
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{appointments.length} rendez-vous</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary py-1.5 px-3 text-xs shrink-0">
          <Plus size={13} /> <span className="hidden sm:inline">Nouveau </span>RDV
        </button>
      </div>

      {showCreate && (
        <CreateAppointmentInline
          leadId={lead.id}
          assignedToId={lead.assignedToId || lead.assignedTo?.id}
          onClose={(created) => { setShowCreate(false); if (created) router.refresh(); }}
        />
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">À venir ({upcoming.length})</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {upcoming.map((appt: any) => (
              <AppointmentRow key={appt.id} appt={appt} statusConfig={STATUS_CONFIG} onStatusChange={handleStatusChange} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Passés ({past.length})</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {past.slice(0, 10).map((appt: any) => (
              <AppointmentRow key={appt.id} appt={appt} statusConfig={STATUS_CONFIG} onStatusChange={handleStatusChange} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {appointments.length === 0 && !showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <Calendar size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun rendez-vous</p>
        </div>
      )}
    </div>
  );
}

// ─── Appointment Row ───
function AppointmentRow({ appt, statusConfig, onStatusChange, onDelete }: any) {
  const [showMenu, setShowMenu] = useState(false);
  const sc = statusConfig[appt.status] || statusConfig.SCHEDULED;

  const TypeIcon = appt.type === "VIDEO_CALL" ? Video : appt.type === "PHONE" ? Phone : MapPin;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 group hover:bg-gray-50/50">
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        appt.type === "VIDEO_CALL" ? "bg-purple-50 text-purple-600" :
        appt.type === "PHONE" ? "bg-emerald-50 text-emerald-600" :
        "bg-blue-50 text-blue-600"
      )}>
        <TypeIcon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate min-w-0">{appt.title}</p>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", sc.bg, sc.color)}>{sc.label}</span>
        </div>
        <p className="text-xs text-gray-500 break-words">
          {new Date(appt.startAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          {appt.location && " • " + appt.location}
        </p>
        {appt.meetingUrl && (
          <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-600 hover:underline mt-0.5 inline-flex items-center gap-0.5">
            <Video size={10} /> Rejoindre la visio
          </a>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          title="Actions"
        >
          <Edit3 size={14} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44 animate-scale-in">
              <p className="px-3 py-1 text-[10px] text-gray-400 uppercase tracking-wider">Changer le statut</p>
              {Object.entries(statusConfig).map(([key, conf]: any) => (
                <button
                  key={key}
                  onClick={() => { setShowMenu(false); onStatusChange(appt.id, key); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50",
                    appt.status === key ? "text-brand-600 font-medium" : "text-gray-700"
                  )}
                >
                  {conf.label}
                </button>
              ))}
              <div className="h-px bg-gray-100 my-1" />
              <button
                onClick={() => { setShowMenu(false); onDelete(appt.id); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Create Appointment Inline ───
function CreateAppointmentInline({ leadId, assignedToId, onClose }: {
  leadId: string;
  assignedToId: string;
  onClose: (created?: boolean) => void;
}) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 86400000);
  defaultStart.setHours(10, 0, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 3600000);

  const toLocalISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + day + "T" + h + ":" + min;
  };

  const [title, setTitle] = useState("");
  const [type, setType] = useState("IN_PERSON");
  const [startAt, setStartAt] = useState(toLocalISO(defaultStart));
  const [endAt, setEndAt] = useState(toLocalISO(defaultEnd));
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleStartChange = (val: string) => {
    setStartAt(val);
    if (val) {
      const s = new Date(val);
      const e = new Date(s.getTime() + 3600000);
      setEndAt(toLocalISO(e));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!startAt || !endAt) { toast.error("Dates requises"); return; }
    setSaving(true);
    try {
      await createAppointment({
        title: title.trim(),
        type,
        startAt,
        endAt,
        location: location.trim() || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        leadId,
        assignedToId,
      });
      toast.success("Rendez-vous créé");
      onClose(true);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-3 sm:p-4 space-y-3 animate-scale-in">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du rendez-vous..."
        className="input text-sm font-medium"
      />

      {/* Type */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Type</label>
        <div className="flex gap-2">
          {[
            { key: "IN_PERSON", label: "Présentiel", icon: MapPin },
            { key: "PHONE", label: "Téléphone", icon: Phone },
            { key: "VIDEO_CALL", label: "Visio", icon: Video },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setType(opt.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors",
                  type === opt.key ? "bg-brand-50 text-brand-600 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                )}
              >
                <Icon size={13} className="shrink-0" /> {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date/time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Début</label>
          <input type="datetime-local" value={startAt} onChange={(e) => handleStartChange(e.target.value)} className="input text-xs py-1.5" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Fin</label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="input text-xs py-1.5" />
        </div>
      </div>

      {type === "IN_PERSON" && (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Lieu</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Campus Dakar, Bureau 201" className="input text-xs py-1.5" />
        </div>
      )}
      {type === "VIDEO_CALL" && (
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Lien visio</label>
          <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." className="input text-xs py-1.5" />
        </div>
      )}

      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ordre du jour, documents à apporter..." className="input text-xs py-1.5" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => onClose()} className="btn-secondary py-1.5 px-3 text-xs">Annuler</button>
        <button onClick={handleSubmit} disabled={saving || !title.trim()} className="btn-primary py-1.5 px-3 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
          Créer
        </button>
      </div>
    </div>
  );
}

// ─── AI Assistant Tab ───
function AIAssistantTab({ lead }: { lead: any }) {
  const [activeMode, setActiveMode] = useState<"brief" | "actions" | "draft_email" | "draft_whatsapp">("brief");
  const [briefData, setBriefData] = useState<any>(null);
  const [actionsData, setActionsData] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<any>(null);
  const [whatsappDraft, setWhatsappDraft] = useState<any>(null);
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string | null>(null);
  const [actionsGeneratedAt, setActionsGeneratedAt] = useState<string | null>(null);
  const [hasMajorChange, setHasMajorChange] = useState(false);
  const [changeReasons, setChangeReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [extraContext, setExtraContext] = useState("");

  useEffect(() => {
    fetch("/api/leads/" + lead.id + "/ai-assistant")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBriefData(data.briefData);
          setActionsData(data.actionsData);
          setBriefGeneratedAt(data.briefGeneratedAt);
          setActionsGeneratedAt(data.actionsGeneratedAt);
          setHasMajorChange(data.hasMajorChange);
          setChangeReasons(data.changeReasons || []);
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [lead.id]);

  const callAI = async (mode: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/leads/" + lead.id + "/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, context: extraContext || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur");

      if (mode === "brief") {
        setBriefData(data.data);
        setBriefGeneratedAt(new Date().toISOString());
        setHasMajorChange(false);
        setChangeReasons([]);
      } else if (mode === "actions") {
        setActionsData(data.data);
        setActionsGeneratedAt(new Date().toISOString());
        setHasMajorChange(false);
        setChangeReasons([]);
      } else if (mode === "draft_email") {
        setEmailDraft(data.data);
      } else if (mode === "draft_whatsapp") {
        setWhatsappDraft(data.data);
      }

      toast.success("Analyse générée");
    } catch (e: any) {
      toast.error(e.message || "Erreur IA");
    }
    setLoading(false);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 rounded-xl border border-violet-200 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-md">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Assistant IA commercial</h3>
            <p className="text-xs text-gray-600 mt-0.5">Analysez ce lead, obtenez des recommandations et rédigez des messages personnalisés.</p>
          </div>
        </div>
      </div>

      {hasMajorChange && (briefData || actionsData) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Nouvelle analyse recommandée</p>
              <p className="text-xs text-amber-700 mt-0.5 break-words">
                Activité importante depuis la dernière analyse : {changeReasons.join(", ")}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ModeButton active={activeMode === "brief"} icon={UserIcon} label="Brief lead" onClick={() => setActiveMode("brief")} />
        <ModeButton active={activeMode === "actions"} icon={Zap} label="Actions suggérées" onClick={() => setActiveMode("actions")} />
        <ModeButton active={activeMode === "draft_email"} icon={Mail} label="Brouillon email" onClick={() => setActiveMode("draft_email")} />
        <ModeButton active={activeMode === "draft_whatsapp"} icon={MessageCircle} label="Brouillon WhatsApp" onClick={() => setActiveMode("draft_whatsapp")} />
      </div>

      {activeMode === "brief" && (
        <BriefContent
          data={briefData}
          generatedAt={briefGeneratedAt}
          loading={loading}
          hasMajorChange={hasMajorChange}
          onGenerate={() => callAI("brief")}
        />
      )}
      {activeMode === "actions" && (
        <ActionsContent
          data={actionsData}
          generatedAt={actionsGeneratedAt}
          loading={loading}
          hasMajorChange={hasMajorChange}
          onGenerate={() => callAI("actions")}
        />
      )}
      {activeMode === "draft_email" && (
        <DraftContent
          type="email"
          data={emailDraft}
          loading={loading}
          extraContext={extraContext}
          setExtraContext={setExtraContext}
          onGenerate={() => callAI("draft_email")}
          onCopy={copyText}
          lead={lead}
        />
      )}
      {activeMode === "draft_whatsapp" && (
        <DraftContent
          type="whatsapp"
          data={whatsappDraft}
          loading={loading}
          extraContext={extraContext}
          setExtraContext={setExtraContext}
          onGenerate={() => callAI("draft_whatsapp")}
          onCopy={copyText}
          lead={lead}
        />
      )}
    </div>
  );
}

// ─── Mode button ───
function ModeButton({ active, icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 px-2 sm:px-3 py-3 rounded-xl border transition-all text-center",
        active
          ? "bg-violet-50 border-violet-300 text-violet-700 shadow-sm"
          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      <Icon size={16} />
      <span className="text-[11px] sm:text-xs font-medium leading-tight">{label}</span>
    </button>
  );
}

function EmptyAIState({ icon: Icon, title, description, buttonLabel, onAction, loading }: any) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200 py-10 sm:py-12 px-4 sm:px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
        <Icon size={26} className="text-violet-500" />
      </div>
      <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-600 mb-5 max-w-sm mx-auto">{description}</p>
      <button
        onClick={onAction}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> Analyse en cours...</>
        ) : (
          <><Sparkles size={14} /> {buttonLabel}</>
        )}
      </button>
    </div>
  );
}

function BriefContent({ data, generatedAt, loading, hasMajorChange, onGenerate }: any) {
  if (loading && !data) return <AILoadingState message="L'IA analyse ce lead..." />;
  if (!data) {
    return (
      <EmptyAIState
        icon={UserIcon}
        title="Aucune analyse pour ce lead"
        description="Lancez l'IA pour obtenir un brief complet : qui est ce lead, son niveau d'engagement, les points clés et l'approche recommandée."
        buttonLabel="Analyser ce lead"
        onAction={onGenerate}
        loading={loading}
      />
    );
  }

  const engagementConfig: Record<string, { color: string; bg: string; label: string }> = {
    HOT: { color: "text-red-700", bg: "bg-red-100", label: "🔥 Lead chaud" },
    WARM: { color: "text-amber-700", bg: "bg-amber-100", label: "☀️ Lead tiède" },
    COLD: { color: "text-blue-700", bg: "bg-blue-100", label: "❄️ Lead froid" },
  };
  const engConf = engagementConfig[data.engagement] || engagementConfig.WARM;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
          Brief commercial {generatedAt && "• Généré " + formatRelativeDate(generatedAt)}
        </p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className={cn(
            "text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors",
            hasMajorChange
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"
              : "text-violet-600 hover:bg-violet-50"
          )}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Régénération..." : (hasMajorChange ? "Régénérer (recommandé)" : "Régénérer")}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <p className="text-sm text-gray-800 leading-relaxed">{data.summary}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Niveau d'engagement</span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", engConf.bg, engConf.color)}>
            {engConf.label}
          </span>
        </div>
        <p className="text-sm text-gray-700">{data.engagementReason}</p>
      </div>

      {data.keyPoints && data.keyPoints.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Points clés à retenir</p>
          <ul className="space-y-1.5">
            {data.keyPoints.map((point: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.concerns && data.concerns.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 sm:p-4">
          <p className="text-[10px] text-amber-700 uppercase tracking-wider mb-2 font-semibold">⚠️ Points d'attention</p>
          <ul className="space-y-1.5">
            {data.concerns.map((concern: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.approach && (
        <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200 p-3 sm:p-4">
          <p className="text-[10px] text-violet-700 uppercase tracking-wider mb-1 font-semibold">💡 Approche recommandée</p>
          <p className="text-sm text-gray-800">{data.approach}</p>
        </div>
      )}
    </div>
  );
}

function ActionsContent({ data, generatedAt, loading, hasMajorChange, onGenerate }: any) {
  if (loading && !data) return <AILoadingState message="L'IA génère les meilleures actions..." />;
  if (!data) {
    return (
      <EmptyAIState
        icon={Zap}
        title="Aucune suggestion d'action"
        description="Lancez l'IA pour obtenir 3 à 5 prochaines actions priorisées avec leur timing optimal."
        buttonLabel="Suggérer des actions"
        onAction={onGenerate}
        loading={loading}
      />
    );
  }

  const actions = data.actions || [];

  const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    URGENT: { color: "text-red-700", bg: "bg-red-100", label: "Urgent" },
    HIGH: { color: "text-amber-700", bg: "bg-amber-100", label: "Haute" },
    MEDIUM: { color: "text-blue-700", bg: "bg-blue-100", label: "Moyenne" },
  };

  const TYPE_ICONS: Record<string, any> = {
    CALL: Phone,
    EMAIL: Mail,
    WHATSAPP: MessageCircle,
    MEETING: Calendar,
    FOLLOW_UP: RefreshCw,
    OTHER: Zap,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
          Actions recommandées {generatedAt && "• Généré " + formatRelativeDate(generatedAt)}
        </p>
        <button
          onClick={onGenerate}
          disabled={loading}
          className={cn(
            "text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors",
            hasMajorChange
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium"
              : "text-violet-600 hover:bg-violet-50"
          )}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Régénération..." : (hasMajorChange ? "Régénérer (recommandé)" : "Régénérer")}
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-400">Aucune action suggérée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action: any, i: number) => {
            const Icon = TYPE_ICONS[action.type] || Zap;
            const pConf = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.MEDIUM;
            return (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:border-violet-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 break-words min-w-0">{action.title}</p>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0", pConf.bg, pConf.color)}>
                        {pConf.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1.5 break-words">{action.reason}</p>
                    {action.timing && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock size={10} />
                        <span>{action.timing}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DraftContent({ type, data, loading, extraContext, setExtraContext, onGenerate, onCopy, lead }: any) {
  const isEmail = type === "email";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Contexte / instructions (facultatif)</label>
        <textarea
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          placeholder={isEmail
            ? "Ex: Relance après RDV, proposition de RDV, bienvenue chaleureuse, rappel paiement..."
            : "Ex: Relance courte, proposition de RDV, suivi de visite..."
          }
          className="input text-xs"
          rows={2}
        />
        <button
          onClick={onGenerate}
          disabled={loading}
          className="btn-primary py-2 px-4 text-xs mt-2 w-full"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Génération...</>
          ) : (
            <><Sparkles size={14} /> {data ? "Régénérer" : "Générer le brouillon"}</>
          )}
        </button>
      </div>

      {data && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isEmail && data.subject && (
            <div className="px-3 sm:px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Objet</p>
              <p className="text-sm font-semibold text-gray-900 break-words">{data.subject}</p>
            </div>
          )}
          <div className="p-3 sm:p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{isEmail ? "Corps de l'email" : "Message WhatsApp"}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed break-words">{isEmail ? data.body : data.message}</p>
          </div>
          {data.rationale && (
            <div className="px-3 sm:px-4 py-2.5 bg-violet-50/50 border-t border-violet-100">
              <p className="text-[10px] text-violet-700 uppercase tracking-wider mb-0.5 font-semibold">💡 Pourquoi ce message</p>
              <p className="text-xs text-gray-700 break-words">{data.rationale}</p>
            </div>
          )}
          <div className="px-3 sm:px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => onCopy(isEmail ? (data.subject + "\n\n" + data.body) : data.message)}
              className="btn-secondary py-2 px-3 text-xs flex-1 justify-center"
            >
              <Copy size={13} /> Copier
            </button>
            {!isEmail && lead.whatsapp && (
              <a
                href={"https://wa.me/" + lead.whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent(data.message)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 flex-1 justify-center"
              >
                <MessageCircle size={13} /> Ouvrir WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AILoadingState({ message }: { message: string }) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl border border-violet-200 py-12 text-center">
      <Loader2 size={32} className="text-violet-500 animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-700 font-medium">{message}</p>
      <p className="text-xs text-gray-500 mt-1">Cela peut prendre quelques secondes</p>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return "il y a " + diffMin + " min";
  if (diffHours < 24) return "il y a " + diffHours + "h";
  if (diffDays < 7) return "il y a " + diffDays + " jour" + (diffDays > 1 ? "s" : "");
  return "le " + date.toLocaleDateString("fr-FR");
}

// ─── Journey Tab ───
function JourneyTab({ lead }: { lead: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeadJourney(lead.id)
      .then(setData)
      .catch((e) => toast.error(e.message || "Erreur"))
      .finally(() => setLoading(false));
  }, [lead.id]);

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return "0s";
    if (ms < 1000) return Math.round(ms) + "ms";
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return seconds + "s";
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    if (minutes < 60) return minutes + "min" + (remainSec > 0 ? " " + remainSec + "s" : "");
    const hours = Math.floor(minutes / 60);
    return hours + "h " + (minutes % 60) + "min";
  };

  const formatDateTime = (dateValue: any) => {
    if (!dateValue) return "Date inconnue";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "Date inconnue";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatTime = (dateValue: any) => {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-12 text-center px-4">
        <Globe2 size={36} className="text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucune visite tracée</p>
        <p className="text-xs text-gray-400 mt-1">Le parcours web s'affichera ici dès qu'une session sera liée à ce lead.</p>
      </div>
    );
  }

  const { sessions, stats } = data;

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">Sessions</p>
            <Globe2 size={14} className="text-blue-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.sessionCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">Pages vues</p>
            <MousePointer2 size={14} className="text-violet-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalPageViews}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">Temps</p>
            <Clock size={14} className="text-emerald-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatDuration(stats.totalEngagedTimeMs)}</p>
        </div>
      </div>

      {/* Top pages */}
      {stats.topPages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Pages les plus consultées</p>
          <div className="space-y-2">
            {stats.topPages.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] font-bold text-gray-400 w-5 sm:w-6 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{p.path}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{p.count}</p>
                  <p className="text-[10px] text-gray-400">{p.count > 1 ? "vues" : "vue"}</p>
                </div>
                <div className="text-right ml-1 sm:ml-2 shrink-0 hidden sm:block">
                  <p className="text-sm font-medium text-gray-700">{formatDuration(p.totalEngagedMs)}</p>
                  <p className="text-[10px] text-gray-400">visible</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions timeline */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Sessions ({sessions.length})</p>
        <div className="space-y-3">
          {sessions.map((s: any, idx: number) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Session header */}
              <div className="px-3 sm:px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Globe2 size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Session #{idx + 1}</p>
                    <p className="text-[10px] text-gray-500 break-words">
                      {formatDateTime(s.startedAt)}
                      {" • "}{s.pageViews.length} page{s.pageViews.length > 1 ? "s" : ""}
                      {" • "}{formatDuration(s.engagedTimeMs)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.utmSource && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{s.utmSource}</span>
                  )}
                  {!s.utmSource && s.referrer && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium truncate max-w-[80px] sm:max-w-[120px]">
                      {(() => { try { return new URL(s.referrer).hostname; } catch { return "Direct"; } })()}
                    </span>
                  )}
                  {!s.utmSource && !s.referrer && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Direct</span>
                  )}
                </div>
              </div>

              {/* Page views */}
              <div className="divide-y divide-gray-50">
                {s.pageViews.map((pv: any, pvIdx: number) => (
                  <div key={pv.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50/50">
                    <div className="w-6 h-6 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 text-[10px] font-bold">
                      {pvIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{pv.title || pv.path}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{pv.path}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-700">{formatTime(pv.viewedAt)}</p>
                      {pv.engagedTimeMs > 0 && (
                        <p className="text-[10px] text-gray-400">{formatDuration(pv.engagedTimeMs)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-900 break-words">{value}</p>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}