"use client";

import { useState } from "react";
import { formBaseCss } from "@/lib/form-styles";
import { FormFieldView } from "@/components/forms/form-field";
import { groupIntoRows, isInputField, type FormField, type FormSettings } from "@/lib/forms";

export function PublicFormClient({ form, orgName, orgLogo, embed, preview }: {
  form: { id: string; name: string; description: string | null; fields: FormField[]; settings: FormSettings; slug: string };
  orgName: string; orgLogo: string | null; embed?: boolean; preview?: boolean;
}) {
  const s: FormSettings = form.settings || {};
  const fields = form.fields || [];
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => { if (f.type === "hidden" && f.defaultValue) init[f.name] = f.defaultValue; });
    return init;
  });
  const [hp, setHp] = useState(""); // honeypot anti-spam
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));
  const logo = orgLogo && s.showLogo !== false ? (s.logo || orgLogo) : (s.showLogo !== false ? s.logo : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation requis
    for (const f of fields) {
      if (f.required && isInputField(f.type)) {
        const v = values[f.name];
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0) || (f.type === "consent" && !v)) {
          setError("Merci de remplir tous les champs obligatoires."); return;
        }
      }
    }
    setError("");
    if (preview) { setDone(true); return; }
    setSending(true);
    try {
      // UTM depuis l'URL
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { const v = params.get(k); if (v) utm[k] = v; });

      const res = await fetch("/api/forms/" + form.slug + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, hp, utm, referrer: document.referrer || "" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erreur");
      if (s.successMode === "redirect" && s.redirectUrl) { window.location.href = s.redirectUrl; return; }
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Réessayez.");
      setSending(false);
    }
  };

  const rows = groupIntoRows(fields);

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
                <button type="submit" className="tf-submit" disabled={sending}>{sending ? "Envoi…" : (s.submitLabel || "Envoyer")}</button>
                <div className="tf-powered">Propulsé par <a href="https://talibcrm.com" target="_blank" rel="noopener noreferrer">TalibCRM</a></div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
