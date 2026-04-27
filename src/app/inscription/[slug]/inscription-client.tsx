"use client";

import { useState, useEffect, useTransition } from "react";
import { submitInscription } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  GraduationCap, MapPin, Calendar, User as UserIcon, Mail, Phone, MessageCircle,
  ChevronRight, ChevronLeft, Check, Loader2, Upload, Paperclip, X,
  FileText, CheckCircle2, Building2,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  logo: string | null;
  programs: {
    id: string;
    name: string;
    code: string | null;
    level: string;
    durationMonths: number;
    tuitionAmount: number;
    currency: string;
  }[];
  campuses: {
    id: string;
    name: string;
    city: string;
    country: string | null;
    address: string | null;
  }[];
}

interface UploadedDoc {
  path: string;
  filename: string;
  size: number;
  contentType: string | null;
}

const SOURCE_OPTIONS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "GOOGLE", label: "Recherche Google" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "REFERRAL", label: "Recommandation d'un ami" },
  { value: "RADIO", label: "Radio" },
  { value: "TV", label: "Télévision" },
  { value: "AFFICHE", label: "Affichage / Panneau" },
  { value: "SALON", label: "Salon ou forum" },
  { value: "OTHER", label: "Autre" },
];

const LEVEL_OPTIONS = [
  "Bac",
  "Bac+1",
  "Bac+2",
  "Bac+3",
  "Bac+4",
  "Bac+5",
  "Doctorat",
  "Autre",
];

export function InscriptionClient({ slug, organization }: { slug: string; organization: Organization }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState<{ dossierNumber: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  // Form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [programId, setProgramId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [source, setSource] = useState("");
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Capture UTM and referrer
  const [utmData, setUtmData] = useState({
    utmSource: "", utmMedium: "", utmCampaign: "", referrer: "",
  });

  useEffect(function() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setUtmData({
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      referrer: document.referrer || "",
    });
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("slug", slug);

        const response = await fetch("/api/inscription/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (response.ok) {
          setDocuments(function(prev) {
            return prev.concat([{
              path: data.path,
              filename: data.filename,
              size: data.size,
              contentType: data.contentType,
            }]);
          });
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

  const removeDocument = (path: string) => {
    setDocuments(function(prev) { return prev.filter(function(d) { return d.path !== path; }); });
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!firstName.trim()) { toast.error("Prénom requis"); return false; }
      if (!lastName.trim()) { toast.error("Nom requis"); return false; }
      if (!email.trim() || !email.includes("@")) { toast.error("Email valide requis"); return false; }
      if (!phone.trim() || phone.length < 8) { toast.error("Téléphone valide requis"); return false; }
    }
    if (step === 2) {
      if (!programId) { toast.error("Veuillez choisir une filière"); return false; }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!acceptTerms) { toast.error("Veuillez accepter les conditions"); return; }

    startTransition(async () => {
      try {
        const result = await submitInscription(slug, {
          firstName, lastName, email, phone, whatsapp: whatsapp || phone, city,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          programId, campusId,
          educationLevel: educationLevel || undefined,
          source: source || undefined,
          documents: documents.length > 0 ? documents : undefined,
          ...utmData,
        });

        if (result.success) {
          setSubmitted({ dossierNumber: result.dossierNumber });
        }
      } catch (e: any) {
        toast.error(e.message || "Erreur lors de l'envoi");
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " o";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
    return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Candidature reçue !</h1>
          <p className="text-gray-600 mb-6">
            Bonjour {firstName}, nous avons bien reçu votre candidature.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Numéro de dossier</p>
            <p className="text-2xl font-bold text-brand-600">{submitted.dossierNumber}</p>
          </div>
          <p className="text-sm text-gray-500 mb-2">
            Un conseiller de <strong>{organization.name}</strong> vous contactera dans les meilleurs délais.
          </p>
          <p className="text-xs text-gray-400">Un email de confirmation vient de vous être envoyé.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {organization.logo && (
            <img src={organization.logo} alt={organization.name} className="h-16 mx-auto mb-4 object-contain" />
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inscription en ligne</h1>
          <p className="text-gray-600">{organization.name}</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(function(s) {
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  step >= s ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400"
                )}>
                  {step > s ? <Check size={14} /> : s}
                </div>
                {s < 3 && <div className={cn("w-12 h-0.5", step > s ? "bg-brand-600" : "bg-gray-200")} />}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          {/* Step 1: Personal info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Vos informations</h2>
                <p className="text-sm text-gray-500">Étape 1 sur 3 — Vos coordonnées personnelles</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Prénom *</label>
                  <input type="text" value={firstName} onChange={function(e) { setFirstName(e.target.value); }} className="input" placeholder="Aïcha" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Nom *</label>
                  <input type="text" value={lastName} onChange={function(e) { setLastName(e.target.value); }} className="input" placeholder="Ndiaye" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Email *</label>
                <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} className="input" placeholder="aicha@example.com" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Téléphone *</label>
                  <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }} className="input" placeholder="+221 77 123 45 67" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">WhatsApp (si différent)</label>
                  <input type="tel" value={whatsapp} onChange={function(e) { setWhatsapp(e.target.value); }} className="input" placeholder="+221 77 123 45 67" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Ville</label>
                  <input type="text" value={city} onChange={function(e) { setCity(e.target.value); }} className="input" placeholder="Dakar" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Date de naissance</label>
                  <input type="date" value={dateOfBirth} onChange={function(e) { setDateOfBirth(e.target.value); }} className="input" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Genre</label>
                <div className="flex gap-2">
                  {[
                    { value: "MALE", label: "Homme" },
                    { value: "FEMALE", label: "Femme" },
                    { value: "OTHER", label: "Autre" },
                  ].map(function(g) {
                    return (
                      <button key={g.value} type="button" onClick={function() { setGender(g.value as any); }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                          gender === g.value ? "bg-brand-50 border-brand-300 text-brand-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                        )}>
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Project */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Votre projet</h2>
                <p className="text-sm text-gray-500">Étape 2 sur 3 — Votre formation souhaitée</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Filière souhaitée *</label>
                <select value={programId} onChange={function(e) { setProgramId(e.target.value); }} className="input">
                  <option value="">— Choisir une filière —</option>
                  {organization.programs.map(function(p) {
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.level} • {p.durationMonths} mois)
                      </option>
                    );
                  })}
                </select>
                {programId && (function() {
                  var prog = organization.programs.find(function(p) { return p.id === programId; });
                  if (!prog) return null;
                  return (
                    <div className="mt-2 p-3 bg-brand-50 rounded-lg border border-brand-100">
                      <p className="text-xs text-brand-700 font-semibold">{prog.name}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Niveau : {prog.level} • Durée : {prog.durationMonths} mois • Frais : {formatCurrency(prog.tuitionAmount, prog.currency)}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {organization.campuses.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Campus</label>
                  <select value={campusId} onChange={function(e) { setCampusId(e.target.value); }} className="input">
                    <option value="">— Sans préférence —</option>
                    {organization.campuses.map(function(c) {
                      return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>;
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Niveau d'études actuel</label>
                <select value={educationLevel} onChange={function(e) { setEducationLevel(e.target.value); }} className="input">
                  <option value="">— Sélectionner —</option>
                  {LEVEL_OPTIONS.map(function(l) {
                    return <option key={l} value={l}>{l}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Comment nous avez-vous connus ?</label>
                <select value={source} onChange={function(e) { setSource(e.target.value); }} className="input">
                  <option value="">— Sélectionner —</option>
                  {SOURCE_OPTIONS.map(function(s) {
                    return <option key={s.value} value={s.value}>{s.label}</option>;
                  })}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Documents (facultatif)</h2>
                <p className="text-sm text-gray-500">Étape 3 sur 3 — Joignez vos documents</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 border border-dashed border-gray-300">
                <div className="text-center">
                  <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Photos d'identité, CV, relevés de notes...</p>
                  <p className="text-xs text-gray-500 mb-3">PDF, JPG, PNG (max 10 MB par fichier)</p>
                  <label className={cn(
                    "btn-primary py-2 px-4 text-xs cursor-pointer inline-flex",
                    uploading && "opacity-50 cursor-not-allowed"
                  )}>
                    {uploading ? (
                      <><Loader2 size={14} className="animate-spin" /> Upload...</>
                    ) : (
                      <><Paperclip size={14} /> Choisir des fichiers</>
                    )}
                    <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                  </label>
                </div>
              </div>

              {documents.length > 0 && (
                <div className="space-y-2">
                  {documents.map(function(doc) {
                    return (
                      <div key={doc.path} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl">
                        <FileText size={18} className="text-brand-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{doc.filename}</p>
                          <p className="text-xs text-gray-400">{formatSize(doc.size)}</p>
                        </div>
                        <button onClick={function() { removeDocument(doc.path); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Terms */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={acceptTerms} onChange={function(e) { setAcceptTerms(e.target.checked); }} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600" />
                  <span className="text-xs text-gray-700">
                    J'accepte que <strong>{organization.name}</strong> traite mes données personnelles dans le cadre de ma candidature et me contacte par email, téléphone ou WhatsApp.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button onClick={function() { setStep(step - 1); }} className="btn-secondary py-2 px-4 text-sm" disabled={isPending}>
                <ChevronLeft size={14} /> Précédent
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button onClick={function() { if (validateStep()) setStep(step + 1); }} className="btn-primary py-2 px-4 text-sm">
                Suivant <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={isPending || uploading || !acceptTerms} className="btn-primary py-2 px-4 text-sm">
                {isPending ? <><Loader2 size={14} className="animate-spin" /> Envoi...</> : <><Check size={14} /> Envoyer ma candidature</>}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Propulsé par <a href="https://talibcrm.com" className="text-brand-600 hover:underline">TalibCRM</a>
        </p>
      </div>
    </div>
  );
}