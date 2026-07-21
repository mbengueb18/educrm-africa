"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Building2, User, Mail, Lock, Phone, MapPin, GraduationCap,
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff,
  Globe, BookOpen,
} from "lucide-react";
import { registerOrganization } from "./actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

var SCHOOL_TYPES = [
  { value: "university", label: "Université", icon: "🎓" },
  { value: "business_school", label: "École de commerce", icon: "💼" },
  { value: "engineering", label: "École d'ingénieurs", icon: "⚙️" },
  { value: "vocational", label: "Formation professionnelle", icon: "🔧" },
  { value: "language", label: "École de langues", icon: "🌍" },
  { value: "other", label: "Autre", icon: "📚" },
];

var COUNTRIES = [
  { code: "SN", name: "Sénégal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "ML", name: "Mali" },
  { code: "BF", name: "Burkina Faso" },
  { code: "GN", name: "Guinée" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Bénin" },
  { code: "NE", name: "Niger" },
  { code: "CM", name: "Cameroun" },
  { code: "GA", name: "Gabon" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "RD Congo" },
  { code: "MA", name: "Maroc" },
  { code: "TN", name: "Tunisie" },
  { code: "DZ", name: "Algérie" },
  { code: "FR", name: "France" },
  { code: "OTHER", name: "Autre" },
];

export function SignupForm() {
  var [step, setStep] = useState<1 | 2 | 3>(1);
  var [saving, setSaving] = useState(false);
  var [showPassword, setShowPassword] = useState(false);
  var [error, setError] = useState("");
  var [result, setResult] = useState<{ slug: string; email: string } | null>(null);
  var router = useRouter();

  // Step 1: School
  var [schoolName, setSchoolName] = useState("");
  var [schoolType, setSchoolType] = useState("");
  var [city, setCity] = useState("");
  var [country, setCountry] = useState("SN");
  var [phone, setPhone] = useState("");

  // Step 2: Admin
  var [adminName, setAdminName] = useState("");
  var [adminEmail, setAdminEmail] = useState("");
  var [adminPassword, setAdminPassword] = useState("");
  var [confirmPassword, setConfirmPassword] = useState("");
  var [acceptedTerms, setAcceptedTerms] = useState(false);
  var [captchaToken, setCaptchaToken] = useState("");
  // Le CAPTCHA n'est requis que si la site key est configurée (dégradé sinon).
  var captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  var canStep1 = schoolName.trim() && schoolType && city.trim() && country;
  var canStep2 = adminName.trim() && adminEmail.trim() && adminPassword.length >= 8 && adminPassword === confirmPassword && acceptedTerms && (!captchaRequired || !!captchaToken);

  var handleSubmit = async function() {
    setError("");
    setSaving(true);
    try {
      var res = await registerOrganization({
        schoolName: schoolName.trim(),
        schoolType,
        city: city.trim(),
        country,
        phone: phone.trim() || undefined,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        acceptedTerms,
        captchaToken,
      });

      if (!res.ok) {
        // Message métier réel (l'action retourne { ok, error } → pas caviardé en prod)
        setError(res.error || "Erreur lors de la création du compte");
        setSaving(false);
        return;
      }

      var loginEmail = res.email; // capturé pour la closure (narrowing perdu dans setTimeout)
      setResult({ slug: res.slug, email: res.email });
      setStep(3);

      // Auto-login puis redirection ; si le signIn échoue, on bascule vers /login
      // avec un message plutôt que de rediriger dans le vide.
      setTimeout(async function() {
        try {
          var signInRes = await signIn("credentials", {
            email: loginEmail,
            password: adminPassword,
            redirect: false,
          });
          if (signInRes && (signInRes as any).error) {
            router.push("/login");
            return;
          }
          router.push("/pipeline");
        } catch {
          router.push("/login");
        }
      }, 2000);
    } catch (err: any) {
      // Filet de sécurité : erreur inattendue (réseau, etc.)
      setError(err?.message || "Erreur lors de la création du compte");
      setSaving(false);
    }
  };

  var STEPS = [
    { num: 1, label: "Votre école" },
    { num: 2, label: "Votre compte" },
    { num: 3, label: "C'est prêt !" },
  ] as const;

  // Accroche par étape — affichée dans la bande de marque sur mobile (cf. maquette).
  var BAND_COPY: Record<number, { title: string; sub: string }> = {
    1: { title: "Créez votre espace en quelques minutes", sub: "Recrutez vos étudiants avec un outil pensé pour vos réalités terrain." },
    2: { title: "Votre compte administrateur", sub: "Encore une étape et votre espace est prêt." },
    3: { title: "Votre espace est prêt", sub: "Redirection vers votre tableau de bord…" },
  };
  var band = BAND_COPY[step];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ─── Branding panel — bande compacte en haut sur mobile, colonne à gauche en desktop.
             Masquée sur mobile à l'étape 3 (l'écran de succès occupe tout l'écran, cf. maquette). ─── */}
      <div className={cn(
        "relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white",
        "px-6 py-8 lg:w-[440px] lg:shrink-0 lg:px-10 lg:py-12 lg:flex lg:flex-col lg:justify-between",
        step === 3 && "hidden lg:flex"
      )}>
        {/* Décor */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/[0.03]" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-2.5 lg:mb-12">
            <div className="w-9 h-9 rounded-xl bg-accent-500 flex items-center justify-center font-bold text-white shadow-lg">T</div>
            <span className="font-bold text-lg lg:text-xl">TalibCRM</span>
          </div>

          {/* Accroche par étape — mobile seulement */}
          <div className="lg:hidden mt-4">
            <h2 className="text-lg font-bold leading-snug text-balance">{band.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-100/80">{band.sub}</p>
          </div>

          {/* Accroche marketing — desktop seulement */}
          <h2 className="hidden lg:block text-[28px] font-bold leading-snug mt-0 mb-4 text-balance">
            Créez votre espace CRM en quelques minutes
          </h2>
          <p className="hidden lg:block text-[15px] leading-relaxed text-brand-100/80">
            Rejoignez les établissements qui utilisent TalibCRM pour recruter plus efficacement leurs étudiants.
          </p>

          {/* Stepper horizontal — mobile */}
          <div className="mt-5 flex items-center gap-2 lg:hidden">
            {STEPS.map(function(s, i) {
              var isActive = s.num === step;
              var isDone = s.num < step;
              return (
                <div key={s.num} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div className={cn(
                    "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    isDone ? "bg-accent-500 text-white" : isActive ? "bg-white text-brand-800" : "bg-white/10 text-white/50"
                  )}>
                    {isDone ? <CheckCircle2 size={15} /> : s.num}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-0.5 flex-1 rounded-full", isDone ? "bg-accent-500" : "bg-white/15")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Stepper vertical — desktop */}
          <div className="hidden lg:block mt-12">
            {STEPS.map(function(s) {
              var isActive = s.num === step;
              var isDone = s.num < step;
              return (
                <div key={s.num} className="flex items-center gap-4 mb-5">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isDone ? "bg-white" : isActive ? "bg-white/20" : "bg-white/[0.08]"
                  )}>
                    {isDone
                      ? <CheckCircle2 size={18} className="text-brand-700" />
                      : <span className={cn("text-sm font-bold", isActive ? "text-white" : "text-white/40")}>{s.num}</span>}
                  </div>
                  <span className={cn("text-sm", isActive ? "font-semibold" : "font-normal", isActive || isDone ? "opacity-100" : "opacity-50")}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="hidden lg:block relative text-xs text-white/50">
          Déjà un compte ?{" "}
          <a href="/login" className="text-accent-400 font-semibold hover:text-accent-300">Se connecter</a>
        </p>
      </div>

      {/* ─── Form panel — accroché en haut sur mobile, centré en desktop ─── */}
      <div className="flex-1 flex items-start justify-center lg:items-center bg-gray-50 px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <div className="w-full max-w-md">

          {/* ─── STEP 1: School ─── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Votre établissement</h2>
              <p className="mt-1.5 mb-8 text-sm text-gray-500">Dites-nous en plus sur votre école</p>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de l'école *</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={schoolName} onChange={function(e) { setSchoolName(e.target.value); }}
                    placeholder="Ex: Institut Supérieur de Management"
                    className="input pl-10" />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d'établissement *</label>
                <select value={schoolType} onChange={function(e) { setSchoolType(e.target.value); }}
                  className="input">
                  <option value="">Sélectionner le type...</option>
                  {SCHOOL_TYPES.map(function(type) {
                    return <option key={type.value} value={type.value}>{type.icon} {type.label}</option>;
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville *</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={city} onChange={function(e) { setCity(e.target.value); }}
                      placeholder="Dakar"
                      className="input pl-10" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Pays *</label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                    <select value={country} onChange={function(e) { setCountry(e.target.value); }}
                      className="input pl-10">
                      {COUNTRIES.map(function(c) { return <option key={c.code} value={c.code}>{c.name}</option>; })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone (optionnel)</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }}
                    placeholder="+221 7X XXX XX XX"
                    className="input pl-10" />
                </div>
              </div>

              <button onClick={function() { setStep(2); }} disabled={!canStep1}
                className="btn-primary w-full py-3.5 text-[15px]">
                Continuer <ArrowRight size={16} />
              </button>

              <p className="mt-6 text-center text-sm text-gray-500 lg:hidden">
                Déjà un compte ?{" "}
                <a href="/login" className="text-brand-600 hover:text-brand-700 font-semibold">Se connecter</a>
              </p>
            </div>
          )}

          {/* ─── STEP 2: Admin account ─── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Votre compte</h2>
              <p className="mt-1.5 mb-8 text-sm text-gray-500">Créez votre accès à la plateforme</p>

              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={adminName} onChange={function(e) { setAdminName(e.target.value); }}
                    placeholder="Abdoul Aziz Mbengue"
                    className="input pl-10" />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={adminEmail} onChange={function(e) { setAdminEmail(e.target.value); }}
                    placeholder="admin@votre-ecole.com"
                    className="input pl-10" />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe * <span className="font-normal text-gray-400">(min. 8)</span></label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? "text" : "password"} value={adminPassword} onChange={function(e) { setAdminPassword(e.target.value); }}
                    placeholder="••••••••"
                    className="input pl-10 pr-11" />
                  <button type="button" onClick={function() { setShowPassword(!showPassword); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={confirmPassword} onChange={function(e) { setConfirmPassword(e.target.value); }}
                    placeholder="••••••••"
                    className={cn("input pl-10", confirmPassword && confirmPassword !== adminPassword && "border-red-400 focus:border-red-400 focus:ring-red-100")} />
                </div>
                {confirmPassword && confirmPassword !== adminPassword && (
                  <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 mb-6 cursor-pointer">
                <input type="checkbox" checked={acceptedTerms} onChange={function(e) { setAcceptedTerms(e.target.checked); }}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 focus:ring-brand-500 cursor-pointer" />
                <span className="text-[12.5px] leading-relaxed text-gray-500">
                  J'accepte les{" "}
                  <a href="/legal/cgu" target="_blank" rel="noopener" className="text-brand-600 hover:text-brand-700 font-semibold">Conditions d'utilisation</a>{" "}
                  et la{" "}
                  <a href="/legal/confidentialite" target="_blank" rel="noopener" className="text-brand-600 hover:text-brand-700 font-semibold">Politique de confidentialité</a>.
                </span>
              </label>

              <TurnstileWidget onToken={setCaptchaToken} />

              <div className="flex gap-3">
                <button onClick={function() { setStep(1); setError(""); }}
                  className="btn-secondary py-3.5">
                  <ArrowLeft size={16} /> Retour
                </button>
                <button onClick={handleSubmit} disabled={!canStep2 || saving}
                  className="btn-primary flex-1 py-3.5 text-[15px]">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
                  {saving ? "Création en cours..." : "Créer mon compte"}
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Success ─── */}
          {step === 3 && result && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-[26px] sm:text-[28px] font-bold text-gray-900 mb-3 text-balance">
                Bienvenue sur TalibCRM ! 🎉
              </h2>
              <p className="text-[15px] leading-relaxed text-gray-500 mb-5">
                Votre espace <strong className="text-gray-900">{schoolName}</strong> est prêt.<br />
                Nous vous redirigeons vers votre tableau de bord...
              </p>

              <div className="flex items-start gap-2.5 text-left bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 mb-6">
                <Mail size={16} className="text-amber-700 mt-0.5 shrink-0" />
                <p className="text-[13px] leading-relaxed text-amber-800">
                  Un email de confirmation a été envoyé à <strong>{result.email}</strong>.
                  Cliquez sur le lien pour activer l'envoi d'emails et de campagnes.
                </p>
              </div>

              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5 sm:p-6 mb-8">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">École</p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{schoolName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Administrateur</p>
                    <p className="text-sm font-semibold text-gray-900 break-words">{adminName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Email</p>
                    <p className="text-sm text-gray-900 break-words">{result.email}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Formule</p>
                    <p className="text-sm font-semibold text-gray-900">Essentiel · gratuit</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-brand-600">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm font-medium">Redirection vers votre dashboard...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}