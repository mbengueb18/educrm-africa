"use client";

import { useState, useRef } from "react";
import type { FormField } from "@/lib/forms";
import { COUNTRIES, NATIONALITIES } from "@/lib/countries";

// Rendu d'un champ de formulaire (utilisé par le constructeur en aperçu ET par la page publique).
// preview=true → champs non interactifs (constructeur). Sinon interactif (valeurs contrôlées).
export function FormFieldView({ field, value, onChange, preview, slug }: {
  field: FormField;
  value?: any;
  onChange?: (name: string, value: any) => void;
  preview?: boolean;
  slug?: string;
}) {
  const f = field;
  const set = (v: any) => { if (onChange) onChange(f.name, v); };
  const common = { disabled: preview } as any;

  // Types "mise en page"
  if (f.type === "heading") return <div className="tf-heading">{f.content || f.label}</div>;
  if (f.type === "paragraph") return <p className="tf-para">{f.content || f.label}</p>;
  if (f.type === "divider") return <hr className="tf-div" />;
  if (f.type === "hidden") {
    return preview ? <div className="tf-help">🙈 Champ caché : <b>{f.name}</b></div> : null;
  }

  const label = (
    <label className="tf-label">{f.label}{f.required && <span className="tf-req"> *</span>}</label>
  );
  const help = f.help ? <div className="tf-help">{f.help}</div> : null;

  let control: React.ReactNode = null;

  if (f.type === "consent") {
    return (
      <label className="tf-consent">
        <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} {...common} />
        <span>{f.content || f.label}{f.required && <span className="tf-req"> *</span>}</span>
      </label>
    );
  }

  if (f.type === "textarea") {
    control = <textarea value={value || ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} {...common} />;
  } else if (f.type === "select") {
    control = (
      <select value={value || ""} onChange={(e) => set(e.target.value)} {...common}>
        <option value="">{f.placeholder || "Sélectionner…"}</option>
        {(f.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
      </select>
    );
  } else if (f.type === "country" || f.type === "nationality") {
    const geoOpts = f.type === "country" ? COUNTRIES : NATIONALITIES;
    control = (
      <select value={value || ""} onChange={(e) => set(e.target.value)} {...common}>
        <option value="">{f.placeholder || "Sélectionner…"}</option>
        {geoOpts.map((o, i) => <option key={i} value={o}>{o}</option>)}
      </select>
    );
  } else if (f.type === "radio") {
    control = (
      <div>
        {(f.options || []).map((o, i) => (
          <label key={i} className="tf-opt"><input type="radio" name={f.name} value={o} checked={value === o} onChange={() => set(o)} {...common} /> {o}</label>
        ))}
      </div>
    );
  } else if (f.type === "checkboxes") {
    const arr: string[] = Array.isArray(value) ? value : [];
    control = (
      <div>
        {(f.options || []).map((o, i) => (
          <label key={i} className="tf-opt">
            <input type="checkbox" checked={arr.includes(o)} onChange={(e) => set(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} {...common} /> {o}
          </label>
        ))}
      </div>
    );
  } else if (f.type === "boolean") {
    control = (
      <div>
        <label className="tf-opt"><input type="radio" name={f.name} checked={value === "Oui"} onChange={() => set("Oui")} {...common} /> Oui</label>
        <label className="tf-opt"><input type="radio" name={f.name} checked={value === "Non"} onChange={() => set("Non")} {...common} /> Non</label>
      </div>
    );
  } else if (f.type === "file") {
    control = <FileFieldControl value={value} onChange={set} preview={preview} slug={slug} />;
  } else if (f.type === "tel" || f.type === "whatsapp") {
    control = <PhoneControl value={value} onChange={set} preview={preview} />;
  } else {
    const typeMap: Record<string, string> = { text: "text", email: "email", tel: "tel", whatsapp: "tel", number: "number", url: "url", date: "date", time: "time" };
    control = <input className="tf-input" type={typeMap[f.type] || "text"} value={value || ""} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} {...common} />;
  }

  return (
    <div className="tf-field">
      {label}
      {control}
      {help}
    </div>
  );
}

const DIAL_CODES = [
  { c: "+221", f: "🇸🇳", n: "Sénégal" }, { c: "+225", f: "🇨🇮", n: "Côte d'Ivoire" },
  { c: "+223", f: "🇲🇱", n: "Mali" }, { c: "+226", f: "🇧🇫", n: "Burkina Faso" },
  { c: "+229", f: "🇧🇯", n: "Bénin" }, { c: "+228", f: "🇹🇬", n: "Togo" },
  { c: "+227", f: "🇳🇪", n: "Niger" }, { c: "+224", f: "🇬🇳", n: "Guinée" },
  { c: "+237", f: "🇨🇲", n: "Cameroun" }, { c: "+241", f: "🇬🇦", n: "Gabon" },
  { c: "+242", f: "🇨🇬", n: "Congo" }, { c: "+243", f: "🇨🇩", n: "RD Congo" },
  { c: "+235", f: "🇹🇩", n: "Tchad" }, { c: "+222", f: "🇲🇷", n: "Mauritanie" },
  { c: "+212", f: "🇲🇦", n: "Maroc" }, { c: "+213", f: "🇩🇿", n: "Algérie" },
  { c: "+216", f: "🇹🇳", n: "Tunisie" }, { c: "+33", f: "🇫🇷", n: "France" },
  { c: "+32", f: "🇧🇪", n: "Belgique" }, { c: "+1", f: "🇨🇦", n: "USA / Canada" },
];

function PhoneControl({ value, onChange, preview }: { value?: any; onChange: (v: any) => void; preview?: boolean }) {
  const parse = (v: any) => {
    const s = String(v || "").trim();
    const match = DIAL_CODES.slice().sort((a, b) => b.c.length - a.c.length).find((d) => s.startsWith(d.c));
    if (match) return { code: match.c, num: s.slice(match.c.length).trim() };
    return { code: "+221", num: s };
  };
  const [st, setSt] = useState(() => parse(value));
  const emit = (code: string, num: string) => { setSt({ code, num }); onChange(num.trim() ? code + " " + num.trim() : ""); };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select className="tf-input" value={st.code} disabled={preview} onChange={(e) => emit(e.target.value, st.num)} style={{ flex: "0 0 auto", width: "auto", minWidth: 96 }}>
        {DIAL_CODES.map((d) => <option key={d.c} value={d.c}>{d.f} {d.c}</option>)}
      </select>
      <input className="tf-input" type="tel" value={st.num} disabled={preview} onChange={(e) => emit(st.code, e.target.value)} placeholder="77 000 00 00" style={{ flex: 1 }} />
    </div>
  );
}

function FileFieldControl({ value, onChange, preview, slug }: { value?: any; onChange: (v: any) => void; preview?: boolean; slug?: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const pick = async (file: File | null) => {
    if (!file || preview || !slug) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/forms/" + slug + "/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Échec de l'envoi");
      setName(file.name); onChange(d.url);
    } catch (e: any) { setErr(e.message || "Erreur"); }
    setBusy(false);
  };

  return (
    <div>
      <button type="button" onClick={() => ref.current?.click()} disabled={preview || busy}
        style={{ width: "100%", padding: "10px 12px", border: "1px dashed #cbd2d9", borderRadius: 8, background: "#fafbfc", color: "#374151", fontSize: 13, cursor: preview ? "default" : "pointer", textAlign: "left" }}>
        {busy ? "Envoi…" : value ? "✓ " + (name || "Fichier envoyé") : "📎 Choisir un fichier…"}
      </button>
      <input ref={ref} type="file" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0] || null)} disabled={preview} />
      {err && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 3 }}>{err}</div>}
    </div>
  );
}
