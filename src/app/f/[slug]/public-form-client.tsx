"use client";

import { useEffect, useMemo, useState } from "react";
import { formBaseCss } from "@/lib/form-styles";
import { FormFieldView } from "@/components/forms/form-field";
import { groupIntoRows, isInputField, splitIntoSteps, type FormField, type FormSettings } from "@/lib/forms";

export function PublicFormClient({ form, orgName, orgLogo, embed, preview }: {
  form: { id: string; name: string; description: string | null; fields: FormField[]; settings: FormSettings; slug: string };
  orgName: string; orgLogo: string | null; embed?: boolean; preview?: boolean;
}) {
  const s: FormSettings = form.settings || {};
  const fields = form.fields || [];

  const hiddenDefaults = () => {
    const init: Record<string, any> = {};
    fields.forEach((f) => { if (f.type === "hidden" && f.defaultValue) init[f.name] = f.defaultValue; });
    return init;
  };

  const [values, setValues] = useState<Record<string, any>>(hiddenDefaults);
  const [step, setStep] = useState(0);
  const [restored, setRestored] = useState(false);
  const [hp, setHp] = useState(""); // honeypot anti-spam
  const [mountTs] = useState(() => Date.now()); // time-trap anti-bot
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));
  const logo = orgLogo && s.showLogo !== false ? (s.logo || orgLogo) : (s.showLogo !== false ? s.logo : null);

  // Découpage en étapes (multi-étapes activé + au moins 2 étapes).
  const allSteps = useMemo(() => splitIntoSteps(fields), [fields]);
  const multi = s.multiStep === true && allSteps.length > 1;
  const steps = multi ? allSteps : [{ title: "", fields }];
  const persist = s.multiStep === true && !preview;
  const storageKey = "talibcrm-form-" + form.slug;

  const stepIdx = Math.min(step, steps.length - 1);
  const current = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;
  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);

  // Restauration de la saisie (localStorage) — après montage pour éviter tout mismatch SSR.
  useEffect(() => {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && saved.v && typeof saved.v === "object") {
        setValues((prev) => ({ ...prev, ...saved.v }));
        if (typeof saved.s === "number") setStep(saved.s);
        setRestored(true);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enregistrement automatique de la saisie.
  useEffect(() => {
    if (!persist) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ v: values, s: step })); } catch { /* ignore */ }
  }, [values, step, persist, storageKey]);

  const clearDraft = () => { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } };

  const resetDraft = () => {
    clearDraft();
    setValues(hiddenDefaults());
    setStep(0);
    setRestored(false);
    setError("");
  };

  // Validation des champs requis d'un sous-ensemble.
  const validate = (subset: FormField[]): boolean => {
    for (const f of subset) {
      if (f.required && isInputField(f.type)) {
        const v = values[f.name];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0) || (f.type === "consent" && !v)) {
          setError("Merci de remplir tous les champs obligatoires."); return false;
        }
      }
    }
    setError(""); return true;
  };

  const goNext = () => {
    if (!validate(current.fields)) return;
    setStep((st) => Math.min(st + 1, steps.length - 1));
    if (!embed && typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goPrev = () => {
    setError("");
    setStep((st) => Math.max(st - 1, 0));
    if (!embed && typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // En multi-étapes, Entrée / bouton sur une étape intermédiaire = passer à la suivante.
    if (multi && !isLast) { goNext(); return; }
    // Validation de tous les champs avant envoi.
    if (!validate(fields)) return;
    if (preview) { setDone(true); return; }
    setSending(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { const v = params.get(k); if (v) utm[k] = v; });

      const res = await fetch("/api/forms/" + form.slug + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, hp, utm, referrer: document.referrer || "", _t: Date.now() - mountTs }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erreur");
      clearDraft();
      if (s.successMode === "redirect" && s.redirectUrl) { window.location.href = s.redirectUrl; return; }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Réessayez.");
      setSending(false);
    }
  };

  const rows = groupIntoRows(current.fields);

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : (s.bgColor || "#EEF4FB"), display: "flex", alignItems: "center", justifyContent: "center", padding: embed ? "8px" : "28px 16px" }}>
      <style>{formBaseCss(s)}</style>
      <div style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ background: "#fff", borderRadius: (s.radius ?? 12) + 4 + "px", boxShadow: embed ? "none" : "0 8px 30px rgba(20,40,70,.12)", overflow: "hidden" }}>
          <div style={{ height: 7, background: s.color || "#2471A3" }} />
          <div style={{ padding: "26px 28px" }}>
            {done ? (
              <div style={{ textAlign: "center", padding: "24px 8px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.5 }}>{s.successMessage || "Merci ! Nous vous recontacterons très bientôt."}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="talib-form">
                {logo && <img src={logo} alt={orgName} style={{ height: 42, marginBottom: 12 }} />}
                <div className="tf-heading" style={{ marginTop: 0 }}>{form.name}</div>
                {form.description && <p className="tf-para">{form.description}</p>}

                {multi && (
                  <div style={{ margin: "8px 0 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>Étape {stepIdx + 1} sur {steps.length}{current.title ? " · " + current.title : ""}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: s.color || "#2471A3", borderRadius: 999, transition: "width .3s ease" }} />
                    </div>
                  </div>
                )}

                {restored && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", fontSize: 12, borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
                    <span>Nous avons restauré votre saisie précédente.</span>
                    <button type="button" onClick={resetDraft} style={{ background: "transparent", border: "none", color: "#0369a1", fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Recommencer</button>
                  </div>
                )}

                {rows.map((row, ri) => row.length === 2 ? (
                  <div className="tf-row" key={ri}>
                    {row.map((f) => <FormFieldView key={f.id} field={f} value={values[f.name]} onChange={set} slug={form.slug} />)}
                  </div>
                ) : (
                  <FormFieldView key={row[0].id} field={row[0]} value={values[row[0].name]} onChange={set} slug={form.slug} />
                ))}

                {/* honeypot */}
                <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

                {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 10px" }}>{error}</p>}

                {multi ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    {stepIdx > 0 && (
                      <button type="button" onClick={goPrev} style={{ flex: "0 0 auto", background: "transparent", border: "1px solid #d1d5db", color: "#374151", borderRadius: (s.radius ?? 12) + "px", padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Précédent</button>
                    )}
                    {isLast
                      ? <button type="submit" className="tf-submit" style={{ flex: 1, margin: 0 }} disabled={sending}>{sending ? "Envoi…" : (s.submitLabel || "Envoyer")}</button>
                      : <button type="button" onClick={goNext} className="tf-submit" style={{ flex: 1, margin: 0 }}>Suivant</button>}
                  </div>
                ) : (
                  <button type="submit" className="tf-submit" disabled={sending}>{sending ? "Envoi…" : (s.submitLabel || "Envoyer")}</button>
                )}

                {persist && <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>✓ Votre saisie est enregistrée automatiquement</div>}

                <div className="tf-powered">Propulsé par <a href="https://talibcrm.com" target="_blank" rel="noopener noreferrer">TalibCRM</a></div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
