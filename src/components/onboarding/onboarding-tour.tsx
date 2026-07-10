"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ArrowRight, ArrowLeft, Check, PlayCircle, FileText, PenLine, Megaphone, MessageCircle } from "lucide-react";

// Bump la version pour re-déclencher l'accueil après de futures nouveautés.
const SEEN_KEY = "talibcrm_onboarding_v3";

type Step = {
  selector?: string; // élément à surligner (facultatif → bulle centrée)
  route?: string;    // page vers laquelle naviguer pour cette étape
  icon: any;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    selector: 'a[href="/inbox"]', route: "/inbox", icon: MessageCircle,
    title: "WhatsApp intégré nativement",
    body: "Connectez votre numéro dans Réglages → WhatsApp : les messages de vos prospects arrivent ici, dans la Boîte de réception. Vous répondez sans quitter le CRM, et chaque conversation crée ou rattache un lead automatiquement.",
  },
  {
    selector: 'a[href="/documents"]', route: "/documents", icon: FileText,
    title: "Bibliothèque de documents",
    body: "Téléversez une fois vos brochures, programmes, formulaires, dossiers de candidature… puis partagez-les : en pièce jointe (bouton « Bibliothèque » dans un email ou une campagne), par lien copiable, ou en téléchargement.",
  },
  {
    selector: 'a[href="/campaigns"]', route: "/campaigns", icon: Megaphone,
    title: "Campagnes : envoi direct & programmation",
    body: "Envoyez une campagne directement depuis l'éditeur — ou programmez son départ à la date et l'heure de votre choix, via le bouton « Programmer ».",
  },
  {
    route: "/profile", icon: PenLine,
    title: "Votre signature email",
    body: "Dans Mon profil → onglet « Signature », créez votre signature (avec logo/image) : elle s'ajoute automatiquement à vos emails et campagnes. Le bouton « Visualiser » vous montre l'email complet avant l'envoi.",
  },
];

const FEATURES = [
  { icon: MessageCircle, title: "WhatsApp intégré", desc: "Recevez & répondez aux messages dans la Boîte de réception." },
  { icon: FileText, title: "Bibliothèque de documents", desc: "Partagez brochures & formulaires en 1 clic." },
  { icon: PenLine, title: "Signature email", desc: "Ajoutée automatiquement à vos envois." },
  { icon: Megaphone, title: "Campagnes programmables", desc: "Envoi direct ou planifié à la date voulue." },
];

function findVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return els.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
}

export function OnboardingTour({ userId }: { userId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"welcome" | "tour" | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Mémorisation PAR UTILISATEUR (et non par navigateur) : chaque user voit le guide une fois.
  const seenKey = SEEN_KEY + "_" + userId;

  const markSeen = useCallback(function () {
    try { localStorage.setItem(seenKey, "1"); } catch {}
  }, [seenKey]);

  // Auto-affichage au 1er passage de CET utilisateur + écoute d'un événement de relance.
  useEffect(function () {
    try { if (userId && !localStorage.getItem(seenKey)) setPhase("welcome"); } catch {}
    var replay = function () { setStep(0); setRect(null); setPhase("welcome"); };
    window.addEventListener("talibcrm:start-tour", replay);
    return function () { window.removeEventListener("talibcrm:start-tour", replay); };
  }, [userId, seenKey]);

  // Navigation + repérage de la cible pour l'étape courante.
  useEffect(function () {
    if (phase !== "tour") return;
    var s = STEPS[step];
    var cancelled = false;
    if (s.route) router.push(s.route);

    var tries = 0;
    var locate = function () {
      if (cancelled) return;
      var el = s.selector ? findVisible(s.selector) : null;
      if (el) {
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
        setRect(el.getBoundingClientRect());
      } else if (s.selector && tries++ < 25) {
        setTimeout(locate, 120);
      } else {
        setRect(null); // fallback : bulle centrée
      }
    };
    var t = setTimeout(locate, s.route ? 400 : 0);
    return function () { cancelled = true; clearTimeout(t); };
  }, [phase, step, router]);

  // Recalcule la position au scroll / resize.
  useEffect(function () {
    if (phase !== "tour") return;
    var onMove = function () {
      var s = STEPS[step];
      var el = s.selector ? findVisible(s.selector) : null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return function () {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [phase, step]);

  var finish = function () { markSeen(); setPhase(null); setRect(null); };
  var startTour = function () { setStep(0); setRect(null); setPhase("tour"); };
  var next = function () { if (step < STEPS.length - 1) setStep(step + 1); else finish(); };
  var prev = function () { if (step > 0) setStep(step - 1); };

  if (!phase) return null;

  // ─── Modale de bienvenue ───
  if (phase === "welcome") {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={finish} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-6 pt-7 pb-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3"><Sparkles size={24} /></div>
            <h2 className="text-xl font-extrabold tracking-tight">Du nouveau sur TalibCRM 👋</h2>
            <p className="text-sm text-white/85 mt-1">WhatsApp intégré, documents partagés, campagnes programmables… découvrez les nouveautés.</p>
          </div>
          <div className="p-5 space-y-2.5">
            {FEATURES.map(function (f, i) {
              var Icon = f.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={17} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{f.title}</p>
                    <p className="text-xs text-gray-500 leading-tight">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-5 flex flex-col gap-2">
            <button onClick={startTour} className="btn-primary w-full py-2.5 text-sm justify-center">
              <PlayCircle size={16} /> Démarrer la visite guidée
            </button>
            <button onClick={finish} className="text-xs text-gray-500 hover:text-gray-700 font-medium py-1">Plus tard</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Visite guidée (spotlight) ───
  var s = STEPS[step];
  var Icon = s.icon;

  // Position de la bulle
  var TW = 330, TH = 210, M = 12;
  var pos: { top: number; left: number };
  if (typeof window === "undefined") {
    pos = { top: 0, left: 0 };
  } else if (!rect) {
    pos = { top: window.innerHeight / 2 - TH / 2, left: window.innerWidth / 2 - TW / 2 };
  } else {
    var spaceRight = window.innerWidth - rect.right;
    var top: number, left: number;
    if (spaceRight > TW + M + 8) {
      left = rect.right + M;
      top = rect.top;
    } else {
      top = rect.bottom + M;
      left = rect.left;
      if (top + TH > window.innerHeight) top = rect.top - TH - M;
    }
    left = Math.max(M, Math.min(left, window.innerWidth - TW - M));
    top = Math.max(M, Math.min(top, window.innerHeight - TH - M));
    pos = { top: top, left: left };
  }

  var pad = 6;

  return (
    <div className="fixed inset-0 z-[120]">
      {/* Capteur de clics (empêche d'interagir avec la page pendant la visite) */}
      <div className="absolute inset-0" onClick={function () { /* no-op */ }} />

      {/* Trou lumineux sur la cible (le box-shadow crée l'assombrissement autour) */}
      {rect && (
        <div
          className="absolute rounded-xl ring-2 ring-brand-500 transition-all duration-200 pointer-events-none"
          style={{
            top: rect.top - pad, left: rect.left - pad,
            width: rect.width + pad * 2, height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(15,23,42,0.62)",
          }}
        />
      )}
      {/* Sans cible : simple voile */}
      {!rect && <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.62)" }} />}

      {/* Bulle */}
      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 animate-scale-in"
        style={{ top: pos.top, left: pos.left, width: TW }}
      >
        <button onClick={finish} className="absolute top-3 right-3 p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100"><X size={16} /></button>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={18} /></div>
          <div>
            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Étape {step + 1} / {STEPS.length}</p>
            <h3 className="text-sm font-bold text-gray-900 leading-tight pr-4">{s.title}</h3>
          </div>
        </div>
        <p className="text-[13px] text-gray-600 leading-relaxed">{s.body}</p>

        {/* Progression */}
        <div className="flex items-center gap-1.5 mt-3.5">
          {STEPS.map(function (_, i) {
            return <span key={i} className={"h-1.5 rounded-full transition-all " + (i === step ? "w-5 bg-brand-600" : "w-1.5 bg-gray-200")} />;
          })}
        </div>

        {/* Contrôles */}
        <div className="flex items-center justify-between gap-2 mt-3">
          <button onClick={finish} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Passer</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={prev} className="btn-secondary py-1.5 px-2.5 text-xs"><ArrowLeft size={13} /> Précédent</button>
            )}
            <button onClick={next} className="btn-primary py-1.5 px-3 text-xs">
              {step < STEPS.length - 1 ? (<>Suivant <ArrowRight size={13} /></>) : (<><Check size={13} /> Terminer</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
