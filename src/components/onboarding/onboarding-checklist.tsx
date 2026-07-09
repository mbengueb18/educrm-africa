"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Rocket, Check, ChevronDown, X, ArrowRight, PartyPopper } from "lucide-react";
import type { OnboardingProgress } from "@/lib/onboarding-progress";
import { dismissOnboardingChecklist } from "@/app/(dashboard)/onboarding-actions";

const OPEN_KEY = "talibcrm_onboarding_checklist_open";

export function OnboardingChecklist({ progress }: { progress: OnboardingProgress }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Ouvre automatiquement au tout premier affichage, puis mémorise le choix.
  useEffect(function () {
    try {
      const stored = localStorage.getItem(OPEN_KEY);
      setOpen(stored === null ? true : stored === "1");
    } catch {
      setOpen(true);
    }
  }, []);

  function toggle() {
    setOpen(function (prev) {
      const next = !prev;
      try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }

  async function dismiss() {
    setHidden(true);
    try { await dismissOnboardingChecklist(); } catch {}
  }

  // Rien à afficher si déjà masqué (org), tout terminé, ou masqué localement.
  if (progress.dismissed || progress.allDone || hidden) return null;

  const { steps, completed, total } = progress;
  const pct = Math.round((completed / total) * 100);
  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="fixed left-4 bottom-4 z-[90] w-[330px] max-w-[calc(100vw-2rem)]">
      {open ? (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-scale-in">
          {/* En-tête */}
          <div className="px-4 py-3.5 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket size={17} />
                <span className="text-sm font-bold">Bien démarrer</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={dismiss} title="Ne plus afficher" className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10">
                  <X size={15} />
                </button>
                <button onClick={toggle} title="Réduire" className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10">
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] text-white/85 mb-1">
                <span>{completed} sur {total} terminé{completed > 1 ? "s" : ""}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: pct + "%" }} />
              </div>
            </div>
          </div>

          {/* Étapes */}
          <div className="p-2 max-h-[46vh] overflow-y-auto">
            {steps.map(function (step) {
              const isNext = !step.done && step.key === nextStep?.key;
              return (
                <Link
                  key={step.key}
                  href={step.href}
                  className={
                    "flex items-start gap-3 p-2.5 rounded-xl transition-colors " +
                    (step.done ? "opacity-60" : "hover:bg-gray-50")
                  }
                >
                  <div className={
                    "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 " +
                    (step.done ? "bg-emerald-500 text-white" : isNext ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500" : "bg-gray-100 text-gray-400")
                  }>
                    {step.done ? <Check size={12} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={"text-[13px] font-semibold leading-tight " + (step.done ? "text-gray-500 line-through" : "text-gray-900")}>
                      {step.label}
                    </p>
                    {!step.done && (
                      <p className="text-[11.5px] text-gray-500 leading-snug mt-0.5">{step.description}</p>
                    )}
                    {isNext && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11.5px] font-semibold text-brand-700">
                        {step.cta} <ArrowRight size={12} />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <button onClick={dismiss} className="w-full py-2.5 text-[11.5px] text-gray-400 hover:text-gray-600 border-t border-gray-100">
            Ne plus afficher cette liste
          </button>
        </div>
      ) : (
        <button
          onClick={toggle}
          className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-brand-600 text-white shadow-xl hover:bg-brand-700 transition-colors animate-scale-in"
        >
          {completed === total ? <PartyPopper size={16} /> : <Rocket size={16} />}
          <span className="text-[13px] font-semibold">Bien démarrer</span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white/20">{completed}/{total}</span>
        </button>
      )}
    </div>
  );
}
