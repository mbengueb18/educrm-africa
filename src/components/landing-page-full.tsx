"use client";

import { useState, useEffect, useRef } from "react";

const COLORS = {
  brand: "#0E7C6B",
  brandLight: "#12A68A",
  brandDark: "#0A5C50",
  accent: "#F5A623",
  accentLight: "#FFD080",
  dark: "#0F1923",
  darkBlue: "#1A2940",
  gray: "#64748B",
  lightGray: "#F0F4F8",
  white: "#FFFFFF",
};

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill={COLORS.brand} opacity="0.15" />
      <path d="M5.5 9L8 11.5L12.5 6.5" stroke={COLORS.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ color = "#fff", size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M4 9H14M14 9L10 5M14 9L10 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const features = [
  {
    icon: "📊",
    title: "Pipeline de recrutement",
    desc: "Visualisez chaque étape du parcours étudiant avec un Kanban intuitif. De la prise de contact à l'inscription.",
  },
  {
    icon: "🎯",
    title: "Sources d'acquisition",
    desc: "Identifiez automatiquement d'où viennent vos leads : SEO, réseaux sociaux, Google Ads, ChatGPT, accès direct.",
  },
  {
    icon: "📞",
    title: "Journal d'appels",
    desc: "Enregistrez chaque appel, suivez la joignabilité de vos prospects et mesurez la performance de vos commerciaux.",
  },
  {
    icon: "✅",
    title: "Gestion des tâches",
    desc: "Créez des tâches de suivi, assignez-les aux commerciaux, suivez les échéances et les retards.",
  },
  {
    icon: "📅",
    title: "Rendez-vous & Agenda",
    desc: "Planifiez des rendez-vous en présentiel ou en visio. Intégration Google Meet, Zoom et Teams.",
  },
  {
    icon: "📧",
    title: "Campagnes email",
    desc: "Créez et envoyez des campagnes email personnalisées à vos prospects avec un éditeur visuel.",
  },
  {
    icon: "🎓",
    title: "Module étudiants",
    desc: "Convertissez vos leads en étudiants inscrits. Suivez leur parcours académique et leurs paiements.",
  },
  {
    icon: "📈",
    title: "Dashboard analytics",
    desc: "Tableau de bord avec KPIs en temps réel : taux de conversion, performance par source et par commercial.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "Gratuit",
    period: "",
    desc: "Pour démarrer et tester la plateforme",
    features: ["100 leads", "1 utilisateur", "50 emails/mois", "Pipeline Kanban", "Dashboard basique"],
    cta: "Commencer gratuitement",
    popular: false,
  },
  {
    name: "Growth",
    price: "15 000",
    period: "FCFA/mois",
    desc: "Pour les écoles en croissance",
    features: ["1 000 leads", "3 utilisateurs", "Campagnes email illimitées", "Import/Export CSV", "Sources d'acquisition", "Journal d'appels"],
    cta: "Essai gratuit 14 jours",
    popular: true,
  },
  {
    name: "Pro",
    price: "35 000",
    period: "FCFA/mois",
    desc: "Pour les institutions établies",
    features: ["5 000 leads", "10 utilisateurs", "SMS & WhatsApp", "Module paiements", "Rendez-vous & Agenda", "API & Intégrations", "Support prioritaire"],
    cta: "Essai gratuit 14 jours",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    desc: "Solution sur mesure",
    features: ["Leads illimités", "Utilisateurs illimités", "Multi-campus", "SSO & RGPD", "Formation dédiée", "Account manager", "SLA garanti"],
    cta: "Nous contacter",
    popular: false,
  },
];

const testimonials = [
  {
    name: "Dr. Amadou Diallo",
    role: "Directeur Général, ISM Dakar",
    text: "EduCRM a transformé notre processus de recrutement. Nous avons doublé notre taux de conversion en 3 mois.",
    avatar: "AD",
  },
  {
    name: "Fatou Sow",
    role: "Responsable Admissions, BEM Abidjan",
    text: "L'outil de suivi des sources nous a permis d'optimiser nos investissements marketing. On sait exactement d'où viennent nos meilleurs étudiants.",
    avatar: "FS",
  },
  {
    name: "Moussa Traoré",
    role: "Directeur Commercial, Groupe SUP'INFO",
    text: "Mes commerciaux sont 3x plus productifs grâce au suivi des tâches et des appels. Le dashboard me donne une vision claire en temps réel.",
    avatar: "MT",
  },
];

const steps = [
  { num: "01", title: "Créez votre compte", desc: "Inscription en 2 minutes. Configurez votre école, vos filières et votre pipeline." },
  { num: "02", title: "Installez le tracking", desc: "Un simple script sur votre site web pour capturer automatiquement les leads." },
  { num: "03", title: "Suivez vos prospects", desc: "Gérez vos leads dans le pipeline, assignez-les aux commerciaux, planifiez des appels." },
  { num: "04", title: "Convertissez & Inscrivez", desc: "Transformez vos leads en étudiants inscrits et suivez leurs paiements." },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: COLORS.dark, background: COLORS.white, overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap" rel="stylesheet" />

      {/* ═══════ NAVBAR ═══════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "none",
        transition: "all 0.3s ease",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${COLORS.brand}, ${COLORS.brandLight})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 16,
            }}>E</div>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: scrolled ? COLORS.dark : COLORS.dark }}>
              EduCRM<span style={{ color: COLORS.accent, fontWeight: 400 }}>.africa</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="nav-links">
            {["Fonctionnalités", "Tarifs", "Témoignages"].map((item) => (
              <a key={item} href={"#" + item.toLowerCase().replace("é", "e")} style={{
                textDecoration: "none", color: COLORS.gray, fontSize: 14, fontWeight: 500,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = COLORS.brand)}
              onMouseLeave={(e) => (e.currentTarget.style.color = COLORS.gray)}
              >{item}</a>
            ))}
            <a href="https://app.talibcrm.com/login" style={{
              textDecoration: "none", color: COLORS.brand, fontSize: 14, fontWeight: 600,
            }}>Se connecter</a>
            <a href="https://app.talibcrm.com/signup" style={{
              textDecoration: "none", background: COLORS.brand, color: "#fff",
              padding: "10px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              transition: "all 0.2s", boxShadow: `0 2px 8px ${COLORS.brand}40`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.brandDark; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.brand; e.currentTarget.style.transform = "translateY(0)"; }}
            >Créer un compte</a>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section style={{
        position: "relative", paddingTop: 160, paddingBottom: 100,
        background: `linear-gradient(170deg, #F0FAF7 0%, #FFFFFF 50%, #FFF9F0 100%)`,
        overflow: "hidden",
      }}>
        {/* Decorative elements */}
        <div style={{
          position: "absolute", top: 80, right: -100, width: 400, height: 400,
          borderRadius: "50%", background: `${COLORS.brand}08`, filter: "blur(80px)",
        }} />
        <div style={{
          position: "absolute", bottom: -50, left: -100, width: 300, height: 300,
          borderRadius: "50%", background: `${COLORS.accent}10`, filter: "blur(60px)",
        }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", position: "relative" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${COLORS.brand}10`, borderRadius: 100, padding: "6px 16px 6px 8px",
              marginBottom: 24, fontSize: 13, fontWeight: 600, color: COLORS.brand,
            }}>
              <span style={{ background: COLORS.brand, color: "#fff", borderRadius: 100, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>NOUVEAU</span>
              Classification automatique des sources IA
            </div>

            <h1 style={{
              fontFamily: "'Fraunces', serif", fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 700, lineHeight: 1.1, marginBottom: 24,
              color: COLORS.dark,
            }}>
              Le CRM qui transforme vos{" "}
              <span style={{
                color: COLORS.brand, position: "relative",
                textDecoration: "underline", textDecorationColor: COLORS.accentLight,
                textDecorationThickness: 4, textUnderlineOffset: 6,
              }}>prospects</span>{" "}
              en <span style={{ color: COLORS.accent }}>étudiants</span>
            </h1>

            <p style={{
              fontSize: 18, lineHeight: 1.7, color: COLORS.gray, marginBottom: 40,
              maxWidth: 560, margin: "0 auto 40px",
            }}>
              EduCRM est le premier CRM conçu pour les établissements d'enseignement supérieur en Afrique.
              Pipeline de recrutement, suivi des appels, campagnes email et conversion en un seul outil.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <a href="https://app.talibcrm.com/signup" style={{
                textDecoration: "none", background: COLORS.brand, color: "#fff",
                padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 10,
                boxShadow: `0 4px 20px ${COLORS.brand}40`,
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 30px ${COLORS.brand}50`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 20px ${COLORS.brand}40`; }}
              >
                Démarrer gratuitement <ArrowIcon />
              </a>
              <a href="#fonctionnalites" style={{
                textDecoration: "none", color: COLORS.dark,
                padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 600,
                border: `2px solid ${COLORS.dark}15`, background: "#fff",
                display: "inline-flex", alignItems: "center", gap: 10,
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.brand; e.currentTarget.style.color = COLORS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${COLORS.dark}15`; e.currentTarget.style.color = COLORS.dark; }}
              >
                Voir les fonctionnalités
              </a>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 48, fontSize: 13, color: COLORS.gray }}>
              <span>✓ Gratuit pour commencer</span>
              <span>✓ Aucune carte requise</span>
              <span>✓ Configuration en 2 min</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div style={{
            marginTop: 60, maxWidth: 900, margin: "60px auto 0",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 20px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)",
            background: "#1a1f36",
            padding: 8,
          }}>
            <div style={{ borderRadius: 12, overflow: "hidden", background: "#f8fafc" }}>
              <div style={{ height: 32, background: "#1a1f36", display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                <span style={{ marginLeft: 16, fontSize: 11, color: "#ffffff60" }}>app.educrm.africa/pipeline</span>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
                  {["Nouveau", "Contacté", "Dossier reçu", "Entretien", "Admis"].map((stage, i) => (
                    <div key={stage} style={{ background: "#fff", borderRadius: 10, padding: 12, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: ["#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981"][i] }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#334155" }}>{stage}</span>
                        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{[8, 12, 5, 3, 2][i]}</span>
                      </div>
                      {[0, 1].map((j) => (
                        <div key={j} style={{ background: "#f8fafc", borderRadius: 8, padding: 8, marginBottom: 6, border: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: `${COLORS.brand}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: COLORS.brand }}>
                              {["FD", "AN", "MS", "KT", "ID"][i]}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: "#1e293b" }}>
                                {["Fatou D.", "Amadou N.", "Moussa S.", "Khadija T.", "Ibrahim D."][i]}
                              </div>
                              <div style={{ fontSize: 9, color: "#94a3b8" }}>Marketing Digital</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="fonctionnalites" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand, textTransform: "uppercase", letterSpacing: 2 }}>Fonctionnalités</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700, marginTop: 12, color: COLORS.dark }}>
              Tout ce dont votre école a besoin
            </h2>
            <p style={{ fontSize: 16, color: COLORS.gray, marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
              Un outil complet pour gérer le recrutement, le suivi commercial et l'inscription de vos étudiants.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} style={{
                padding: 28, borderRadius: 16,
                border: "1px solid #e2e8f0", background: "#fff",
                transition: "all 0.3s",
                cursor: "default",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.brand; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 40px ${COLORS.brand}10`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.gray }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section style={{ padding: "100px 24px", background: COLORS.lightGray }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand, textTransform: "uppercase", letterSpacing: 2 }}>Comment ça marche</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700, marginTop: 12, color: COLORS.dark }}>
              Opérationnel en 4 étapes
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 56, fontFamily: "'Fraunces', serif", fontWeight: 700,
                  color: `${COLORS.brand}15`, lineHeight: 1, marginBottom: 16,
                }}>{s.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.gray }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="tarifs" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand, textTransform: "uppercase", letterSpacing: 2 }}>Tarifs</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700, marginTop: 12, color: COLORS.dark }}>
              Un prix adapté à chaque école
            </h2>
            <p style={{ fontSize: 16, color: COLORS.gray, marginTop: 12 }}>Commencez gratuitement, évoluez quand vous êtes prêt.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, alignItems: "start" }}>
            {pricingPlans.map((plan, i) => (
              <div key={i} style={{
                padding: 32, borderRadius: 20,
                border: plan.popular ? `2px solid ${COLORS.brand}` : "1px solid #e2e8f0",
                background: plan.popular ? `linear-gradient(180deg, ${COLORS.brand}05, #fff)` : "#fff",
                position: "relative",
                transform: plan.popular ? "scale(1.02)" : "none",
              }}>
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: COLORS.accent, color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "4px 16px", borderRadius: 100, textTransform: "uppercase", letterSpacing: 1,
                  }}>Populaire</div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark }}>{plan.name}</h3>
                <p style={{ fontSize: 13, color: COLORS.gray, marginTop: 4 }}>{plan.desc}</p>
                <div style={{ marginTop: 20, marginBottom: 24 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: plan.price === "Gratuit" || plan.price === "Sur devis" ? 32 : 36, fontWeight: 700, color: COLORS.dark }}>
                    {plan.price}
                  </span>
                  {plan.period && <span style={{ fontSize: 14, color: COLORS.gray, marginLeft: 4 }}>{plan.period}</span>}
                </div>
                <div style={{ marginBottom: 28 }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <CheckIcon />
                      <span style={{ fontSize: 13, color: COLORS.dark }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href="https://app.talibcrm.com/login" style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
                  background: plan.popular ? COLORS.brand : "transparent",
                  color: plan.popular ? "#fff" : COLORS.brand,
                  border: plan.popular ? "none" : `2px solid ${COLORS.brand}`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { if (!plan.popular) { e.currentTarget.style.background = `${COLORS.brand}08`; } else { e.currentTarget.style.background = COLORS.brandDark; } }}
                onMouseLeave={(e) => { if (!plan.popular) { e.currentTarget.style.background = "transparent"; } else { e.currentTarget.style.background = COLORS.brand; } }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <section id="temoignages" style={{ padding: "100px 24px", background: COLORS.lightGray }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.brand, textTransform: "uppercase", letterSpacing: 2 }}>Témoignages</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700, marginTop: 12, color: COLORS.dark }}>
              Ils nous font confiance
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {testimonials.map((t, i) => (
              <div key={i} style={{
                padding: 32, borderRadius: 20, background: "#fff",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.dark, fontStyle: "italic", marginBottom: 24 }}>
                  "{t.text}"
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${COLORS.brand}, ${COLORS.brandLight})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 14,
                  }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.gray }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section style={{
        padding: "100px 24px",
        background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.darkBlue} 100%)`,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -100, width: 400, height: 400,
          borderRadius: "50%", background: `${COLORS.brand}20`, filter: "blur(100px)",
        }} />
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 20 }}>
            Prêt à transformer le recrutement de votre école ?
          </h2>
          <p style={{ fontSize: 17, color: "#ffffff90", lineHeight: 1.7, marginBottom: 40 }}>
            Rejoignez les établissements qui utilisent EduCRM pour recruter plus efficacement.
            Commencez gratuitement, sans engagement.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <a href="https://app.talibcrm.com/signup" style={{
              textDecoration: "none", background: COLORS.accent, color: COLORS.dark,
              padding: "16px 40px", borderRadius: 12, fontSize: 16, fontWeight: 700,
              display: "inline-flex", alignItems: "center", gap: 10,
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Créer un compte gratuitement <ArrowIcon color={COLORS.dark} />
            </a>
          </div>
          <p style={{ fontSize: 13, color: "#ffffff50", marginTop: 24 }}>
            Aucune carte bancaire requise • Configuration en 2 minutes
          </p>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer style={{ padding: "60px 24px 40px", background: COLORS.dark, color: "#ffffff80" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `linear-gradient(135deg, ${COLORS.brand}, ${COLORS.brandLight})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 14,
                }}>E</div>
                <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                  EduCRM<span style={{ color: COLORS.accent }}>.africa</span>
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>
                Le CRM de recrutement conçu pour les établissements d'enseignement supérieur en Afrique.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Produit</h4>
              {["Pipeline", "Campagnes", "Appels", "Tâches", "Rendez-vous", "Analytics"].map((item) => (
                <a key={item} href="#" style={{ display: "block", textDecoration: "none", color: "#ffffff70", fontSize: 13, marginBottom: 10, transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#ffffff70")}
                >{item}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Ressources</h4>
              {["Documentation", "Blog", "Tarifs", "API", "Statut"].map((item) => (
                <a key={item} href="#" style={{ display: "block", textDecoration: "none", color: "#ffffff70", fontSize: 13, marginBottom: 10, transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#ffffff70")}
                >{item}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Contact</h4>
              <p style={{ fontSize: 13, marginBottom: 8 }}>contact@educrm.africa</p>
              <p style={{ fontSize: 13, marginBottom: 8 }}>+221 77 532 03 55</p>
              <p style={{ fontSize: 13 }}>Dakar, Sénégal</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #ffffff10", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 12 }}>© 2026 EduCRM Africa. Tous droits réservés.</p>
            <div style={{ display: "flex", gap: 24 }}>
              <a href="#" style={{ textDecoration: "none", color: "#ffffff50", fontSize: 12 }}>Confidentialité</a>
              <a href="#" style={{ textDecoration: "none", color: "#ffffff50", fontSize: 12 }}>CGU</a>
              <a href="#" style={{ textDecoration: "none", color: "#ffffff50", fontSize: 12 }}>Mentions légales</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </div>
  );
}