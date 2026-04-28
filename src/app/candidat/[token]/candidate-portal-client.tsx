"use client";

import { useState, useTransition } from "react";
import { uploadCandidateDocument } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Calendar, MapPin, Video, FileText, Upload, MessageSquare,
  Phone, Mail, AlertCircle, Loader2, Paperclip, Clock, Sparkles, GraduationCap, Building2,
} from "lucide-react";

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

export function CandidatePortalClient({ token, data }: { token: string; data: PortalData }) {
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(file.name + " : trop volumineux (max 10 MB)");
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadCandidateDocument(token, formData);
        if (result.success) {
          toast.success(file.name + " envoyé");
        } else {
          toast.error(result.error || "Erreur");
        }
      }
      // Reload to show new docs
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setUploading(false);
    event.target.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
  };

  const formatDate = (d: Date) => {
    return new Date(d).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const formatTime = (d: Date) => {
    return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatRelative = (d: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7) return "Il y a " + days + " jours";
    return new Date(d).toLocaleDateString("fr-FR");
  };

  const lead = data.lead;
  const org = data.organization;

  // Calculate stage progress
  const currentStageIndex = STAGE_ORDER.findIndex(function(s) {
    return lead.stage.name.toLowerCase().includes(s.toLowerCase());
  });
  const progressIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-4">
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="w-14 h-14 object-contain rounded-xl" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-brand-100 flex items-center justify-center">
                <GraduationCap size={28} className="text-brand-600" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Espace candidat</p>
              <h1 className="text-2xl font-bold text-gray-900">Bonjour {lead.firstName} 👋</h1>
              <p className="text-sm text-gray-600 mt-1">
                {org.name} {lead.program ? "• " + lead.program.name : ""}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Dossier #{lead.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-brand-500" /> Progression de votre candidature
          </h2>

          <div className="relative mb-6">
            <div className="flex items-center justify-between relative z-10">
              {STAGE_ORDER.map(function(stage, i) {
                const isCompleted = i < progressIndex;
                const isCurrent = i === progressIndex;
                return (
                  <div key={stage} className="flex flex-col items-center text-center" style={{ width: "20%" }}>
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all",
                      isCompleted ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-brand-500 text-white ring-4 ring-brand-100" :
                      "bg-gray-200 text-gray-400"
                    )}>
                      {isCompleted ? <CheckCircle2 size={18} /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      isCompleted ? "text-emerald-600" : isCurrent ? "text-brand-600" : "text-gray-400"
                    )}>
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-gray-200 -z-0">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: progressIndex > 0 ? (progressIndex / (STAGE_ORDER.length - 1)) * 100 + "%" : "0%" }}></div>
            </div>
          </div>

          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
            <p className="text-xs text-brand-700">
              {lead.assignedTo
                ? "Votre conseiller " + lead.assignedTo.name + " suit votre candidature."
                : "Un conseiller va prendre contact avec vous très prochainement."}
            </p>
          </div>
        </div>

        {/* Upcoming appointments */}
        {lead.appointments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-blue-500" /> Vos prochains rendez-vous
            </h2>
            <div className="space-y-3">
              {lead.appointments.map(function(appt) {
                const Icon = appt.type === "VIDEO_CALL" ? Video : appt.type === "PHONE" ? Phone : MapPin;
                return (
                  <div key={appt.id} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{appt.title}</p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          📅 {formatDate(appt.startAt)} à {formatTime(appt.startAt)}
                        </p>
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

        {/* Documents */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileText size={18} className="text-violet-500" /> Vos documents
            </h2>
            <label className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors",
              uploading ? "bg-gray-100 text-gray-400" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            )}>
              {uploading ? (
                <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Upload...</span>
              ) : (
                <span className="flex items-center gap-1.5"><Upload size={12} /> Déposer un document</span>
              )}
              <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
          </div>

          {lead.documents.length > 0 ? (
            <div className="space-y-2">
              {lead.documents.map(function(doc) {
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(doc.size)} • {formatRelative(doc.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun document déposé</p>
              <p className="text-xs text-gray-400 mt-1">Cliquez sur "Déposer un document" pour ajouter vos pièces</p>
            </div>
          )}

          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-800">
              <strong>📋 Documents généralement demandés :</strong> Pièce d'identité, CV, dernier diplôme, lettre de motivation, photo d'identité.
            </p>
          </div>
        </div>

        {/* Messages */}
        {lead.messages.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-500" /> Messages avec votre conseiller
            </h2>
            <div className="space-y-3">
              {lead.messages.slice(0, 5).map(function(msg) {
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
          </div>
        )}

        {/* Help */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-orange-500" /> Besoin d'aide ?
          </h2>
          {lead.assignedTo ? (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-700 mb-2">
                Votre conseillère/conseiller : <strong>{lead.assignedTo.name}</strong>
              </p>
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

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-2">
          Espace candidat sécurisé • Propulsé par <a href="https://talibcrm.com" className="text-brand-600 hover:underline">TalibCRM</a>
        </p>
      </div>
    </div>
  );
}