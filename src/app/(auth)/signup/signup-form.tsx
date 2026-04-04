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

  var canStep1 = schoolName.trim() && schoolType && city.trim() && country;
  var canStep2 = adminName.trim() && adminEmail.trim() && adminPassword.length >= 6 && adminPassword === confirmPassword;

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
      });
      setResult(res);
      setStep(3);

      // Auto-login
      setTimeout(async function() {
        await signIn("credentials", {
          email: res.email,
          password: adminPassword,
          redirect: false,
        });
        router.push("/pipeline");
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du compte");
    }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Left panel */}
      <div style={{
        flex: "0 0 440px", background: "linear-gradient(170deg, #0E7C6B 0%, #0A5C50 60%, #073D35 100%)",
        padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        color: "#fff", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>E</div>
            <span style={{ fontWeight: 700, fontSize: 20 }}>EduCRM<span style={{ color: "#F5A623", fontWeight: 400 }}>.africa</span></span>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3, marginBottom: 16 }}>
            Créez votre espace CRM en quelques minutes
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.8 }}>
            Rejoignez les établissements qui utilisent EduCRM pour recruter plus efficacement leurs étudiants.
          </p>

          {/* Steps indicator */}
          <div style={{ marginTop: 48 }}>
            {[
              { num: 1, label: "Votre école" },
              { num: 2, label: "Votre compte" },
              { num: 3, label: "C'est prêt !" },
            ].map(function(s) {
              var isActive = s.num === step;
              var isDone = s.num < step;
              return (
                <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isDone ? "#fff" : isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.3s",
                  }}>
                    {isDone ? (
                      <CheckCircle2 size={18} color="#0E7C6B" />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.4)" }}>{s.num}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, opacity: isActive || isDone ? 1 : 0.5 }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <p style={{ fontSize: 12, opacity: 0.5 }}>
            Déjà un compte ?{" "}
            <a href="/login" style={{ color: "#F5A623", textDecoration: "none", fontWeight: 600 }}>Se connecter</a>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px", background: "#FAFBFC" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* ─── STEP 1: School ─── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0F1923", marginBottom: 8 }}>Votre établissement</h2>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 32 }}>Dites-nous en plus sur votre école</p>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Nom de l'école *</label>
                <div style={{ position: "relative" }}>
                  <Building2 size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="text" value={schoolName} onChange={function(e) { setSchoolName(e.target.value); }}
                    placeholder="Ex: Institut Supérieur de Management"
                    style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", transition: "border-color 0.2s", boxSizing: "border-box" }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 8 }}>Type d'établissement *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {SCHOOL_TYPES.map(function(type) {
                    var isSelected = schoolType === type.value;
                    return (
                      <button key={type.value} type="button" onClick={function() { setSchoolType(type.value); }}
                        style={{
                          padding: "12px 8px", borderRadius: 10, border: isSelected ? "2px solid #0E7C6B" : "1.5px solid #e2e8f0",
                          background: isSelected ? "#0E7C6B08" : "#fff", textAlign: "center", cursor: "pointer",
                          transition: "all 0.2s",
                        }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{type.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "#0E7C6B" : "#64748B" }}>{type.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Ville *</label>
                  <div style={{ position: "relative" }}>
                    <MapPin size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input type="text" value={city} onChange={function(e) { setCity(e.target.value); }}
                      placeholder="Dakar"
                      style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                      onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Pays *</label>
                  <div style={{ position: "relative" }}>
                    <Globe size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <select value={country} onChange={function(e) { setCountry(e.target.value); }}
                      style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", background: "#fff", appearance: "auto", boxSizing: "border-box" }}>
                      {COUNTRIES.map(function(c) { return <option key={c.code} value={c.code}>{c.name}</option>; })}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Téléphone (optionnel)</label>
                <div style={{ position: "relative" }}>
                  <Phone size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }}
                    placeholder="+221 7X XXX XX XX"
                    style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                  />
                </div>
              </div>

              <button onClick={function() { setStep(2); }} disabled={!canStep1}
                style={{
                  width: "100%", padding: "14px 24px", borderRadius: 12, border: "none",
                  background: canStep1 ? "#0E7C6B" : "#e2e8f0", color: canStep1 ? "#fff" : "#94a3b8",
                  fontSize: 15, fontWeight: 600, cursor: canStep1 ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                }}>
                Continuer <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ─── STEP 2: Admin account ─── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0F1923", marginBottom: 8 }}>Votre compte administrateur</h2>
              <p style={{ fontSize: 14, color: "#64748B", marginBottom: 32 }}>Créez votre accès à la plateforme</p>

              {error && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Votre nom complet *</label>
                <div style={{ position: "relative" }}>
                  <User size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="text" value={adminName} onChange={function(e) { setAdminName(e.target.value); }}
                    placeholder="Abdoul Aziz Mbengue"
                    style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Adresse email *</label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="email" value={adminEmail} onChange={function(e) { setAdminEmail(e.target.value); }}
                    placeholder="admin@votre-ecole.com"
                    style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Mot de passe * <span style={{ fontWeight: 400, color: "#94a3b8" }}>(min. 6 caractères)</span></label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type={showPassword ? "text" : "password"} value={adminPassword} onChange={function(e) { setAdminPassword(e.target.value); }}
                    placeholder="••••••••"
                    style={{ width: "100%", padding: "12px 40px 12px 40px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
                  />
                  <button type="button" onClick={function() { setShowPassword(!showPassword); }}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Confirmer le mot de passe *</label>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input type="password" value={confirmPassword} onChange={function(e) { setConfirmPassword(e.target.value); }}
                    placeholder="••••••••"
                    style={{
                      width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10,
                      border: confirmPassword && confirmPassword !== adminPassword ? "1.5px solid #EF4444" : "1.5px solid #e2e8f0",
                      fontSize: 14, outline: "none", boxSizing: "border-box",
                    }}
                    onFocus={function(e) { e.target.style.borderColor = "#0E7C6B"; }}
                    onBlur={function(e) { e.target.style.borderColor = confirmPassword && confirmPassword !== adminPassword ? "#EF4444" : "#e2e8f0"; }}
                  />
                </div>
                {confirmPassword && confirmPassword !== adminPassword && (
                  <p style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={function() { setStep(1); setError(""); }}
                  style={{
                    padding: "14px 20px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                    background: "#fff", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  <ArrowLeft size={16} /> Retour
                </button>
                <button onClick={handleSubmit} disabled={!canStep2 || saving}
                  style={{
                    flex: 1, padding: "14px 24px", borderRadius: 12, border: "none",
                    background: canStep2 && !saving ? "#0E7C6B" : "#e2e8f0",
                    color: canStep2 && !saving ? "#fff" : "#94a3b8",
                    fontSize: 15, fontWeight: 600,
                    cursor: canStep2 && !saving ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                  }}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
                  {saving ? "Création en cours..." : "Créer mon compte"}
                </button>
              </div>

              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                En créant un compte, vous acceptez nos{" "}
                <a href="#" style={{ color: "#0E7C6B", textDecoration: "none" }}>Conditions d'utilisation</a>{" "}
                et notre{" "}
                <a href="#" style={{ color: "#0E7C6B", textDecoration: "none" }}>Politique de confidentialité</a>
              </p>
            </div>
          )}

          {/* ─── STEP 3: Success ─── */}
          {step === 3 && result && (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%", background: "#ECFDF5",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <CheckCircle2 size={40} color="#10B981" />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: "#0F1923", marginBottom: 12 }}>
                Bienvenue sur EduCRM ! 🎉
              </h2>
              <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.7, marginBottom: 32 }}>
                Votre espace <strong>{schoolName}</strong> est prêt.<br />
                Nous configurons votre pipeline et vous redirigeons...
              </p>

              <div style={{
                background: "#F0FAF7", borderRadius: 16, padding: 24, marginBottom: 32,
                border: "1px solid #D1FAE5",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "left" }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>École</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#0F1923" }}>{schoolName}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Administrateur</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#0F1923" }}>{adminName}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Email</p>
                    <p style={{ fontSize: 14, color: "#0F1923" }}>{result.email}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>URL</p>
                    <p style={{ fontSize: 14, color: "#0E7C6B", fontWeight: 600 }}>app.educrm.africa/{result.slug}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#0E7C6B" }}>
                <Loader2 size={16} className="animate-spin" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Redirection vers votre dashboard...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}