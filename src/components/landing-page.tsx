"use client";

import { useState, useEffect } from "react";

var LAUNCH_DATE = new Date("2026-06-01T00:00:00");

function getTimeLeft() {
  var now = new Date();
  var diff = LAUNCH_DATE.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function LandingPage() {
  var [time, setTime] = useState(getTimeLeft());

  useEffect(function() {
    var interval = setInterval(function() { setTime(getTimeLeft()); }, 1000);
    return function() { clearInterval(interval); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(170deg, #0F1923 0%, #1A2940 40%, #0E7C6B 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#fff",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap" rel="stylesheet" />

      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: "rgba(14,124,107,0.15)", filter: "blur(100px)" }} />
      <div style={{ position: "absolute", bottom: -150, left: -150, width: 400, height: 400, borderRadius: "50%", background: "rgba(245,166,35,0.1)", filter: "blur(80px)" }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "linear-gradient(135deg, #0E7C6B, #12A68A)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 22,
        }}>T</div>
        <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 28 }}>
          TalibCRM<span style={{ color: "#F5A623", fontWeight: 400 }}>.africa</span>
        </span>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.1)", borderRadius: 100, padding: "6px 16px 6px 8px",
        marginBottom: 24, fontSize: 13, fontWeight: 600, color: "#F5A623",
        backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{ background: "#F5A623", color: "#0F1923", borderRadius: 100, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>BIENTÔT</span>
        Lancement le 1er Juin 2026
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 5vw, 56px)",
        fontWeight: 700, lineHeight: 1.15, textAlign: "center", marginBottom: 20,
        maxWidth: 700,
      }}>
        Le CRM qui transforme vos{" "}
        <span style={{ color: "#12A68A" }}>prospects</span>{" "}
        en <span style={{ color: "#F5A623" }}>étudiants</span>
      </h1>

      <p style={{
        fontSize: 17, lineHeight: 1.7, color: "rgba(255,255,255,0.7)",
        textAlign: "center", maxWidth: 520, marginBottom: 48,
      }}>
        Le premier CRM conçu pour les établissements d'enseignement supérieur en Afrique.
        Pipeline de recrutement, suivi des appels, Google Calendar, campagnes email et bien plus.
      </p>

      {/* Countdown */}
      <div style={{ display: "flex", gap: 16, marginBottom: 48 }}>
        {[
          { value: time.days, label: "Jours" },
          { value: time.hours, label: "Heures" },
          { value: time.minutes, label: "Minutes" },
          { value: time.seconds, label: "Secondes" },
        ].map(function(item) {
          return (
            <div key={item.label} style={{
              background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16,
              padding: "20px 24px", textAlign: "center", minWidth: 90,
            }}>
              <div style={{
                fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700,
                color: "#fff", lineHeight: 1,
              }}>
                {String(item.value).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 6, textTransform: "uppercase", letterSpacing: 2 }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Email signup */}
      <div style={{
        display: "flex", gap: 8, maxWidth: 440, width: "100%",
        background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 6,
        border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)",
      }}>
        <input type="email" placeholder="Votre email pour être notifié"
          style={{
            flex: 1, padding: "12px 16px", background: "transparent", border: "none",
            outline: "none", color: "#fff", fontSize: 14,
          }} />
        <button style={{
          padding: "12px 24px", borderRadius: 10, border: "none",
          background: "#F5A623", color: "#0F1923", fontSize: 14, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
        onMouseEnter={function(e) { e.currentTarget.style.background = "#FFB84D"; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = "#F5A623"; }}
        >
          Me notifier
        </button>
      </div>

      {/* Features preview */}
      <div style={{
        display: "flex", gap: 24, marginTop: 64, flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { icon: "📊", text: "Pipeline Kanban" },
          { icon: "📞", text: "Journal d'appels" },
          { icon: "📅", text: "Google Calendar" },
          { icon: "🎓", text: "Gestion étudiants" },
          { icon: "📧", text: "Campagnes email" },
          { icon: "📈", text: "Analytics temps réel" },
        ].map(function(f) {
          return (
            <div key={f.text} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.06)", borderRadius: 10,
              padding: "8px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <span>{f.icon}</span> {f.text}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 80, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          © 2026 TalibCRM Africa — Dakar, Sénégal
        </p>
      </div>
    </div>
  );
}