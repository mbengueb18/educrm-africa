"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Check, Clock, Share2, Eye, Trash2, ChevronUp, ChevronDown, Plus, X, Monitor } from "lucide-react";
import { newField, DEFAULT_SETTINGS, hasOptions, isInputField, type FormField, type FieldType, type FormSettings, type FormRouting } from "@/lib/forms";
import { COUNTRIES, NATIONALITIES } from "@/lib/countries";
import { formBaseCss } from "@/lib/form-styles";
import { FormFieldView } from "@/components/forms/form-field";
import { updateForm, setFormStatus } from "../../actions";
import { ShareModal } from "../../share-modal";

type Stage = { id: string; name: string; pipelineId: string };
type UserOpt = { id: string; name: string };

const PALETTE: { cat: string; items: { t: FieldType; k: string; lbl: string }[] }[] = [
  { cat: "Saisie", items: [
    { t: "text", k: "🔤", lbl: "Texte court" }, { t: "textarea", k: "📝", lbl: "Texte long" },
    { t: "email", k: "✉️", lbl: "Email" }, { t: "tel", k: "📞", lbl: "Téléphone" },
    { t: "whatsapp", k: "💬", lbl: "WhatsApp" }, { t: "number", k: "🔢", lbl: "Nombre" },
    { t: "url", k: "🔗", lbl: "Lien / URL" }, { t: "date", k: "📅", lbl: "Date" }, { t: "time", k: "⏰", lbl: "Heure" },
  ]},
  { cat: "Choix", items: [
    { t: "select", k: "🔽", lbl: "Liste déroulante" }, { t: "radio", k: "🔘", lbl: "Choix unique" },
    { t: "checkboxes", k: "☑️", lbl: "Cases à cocher" }, { t: "boolean", k: "🔀", lbl: "Oui / Non" },
    { t: "country", k: "🌍", lbl: "Pays" }, { t: "nationality", k: "🏳️", lbl: "Nationalité" },
  ]},
  { cat: "Avancé", items: [
    { t: "file", k: "📎", lbl: "Fichier joint" }, { t: "consent", k: "✅", lbl: "Consentement" }, { t: "hidden", k: "🙈", lbl: "Champ caché" },
  ]},
  { cat: "Mise en page", items: [
    { t: "heading", k: "🅷", lbl: "Titre" }, { t: "paragraph", k: "¶", lbl: "Paragraphe" }, { t: "divider", k: "➖", lbl: "Séparateur" },
  ]},
];

export function FormBuilderClient({ form, routingData }: { form: any; routingData: { stages: Stage[]; users: UserOpt[] } }) {
  const [name, setName] = useState<string>(form.name || "");
  const [fields, setFields] = useState<FormField[]>((form.fields as FormField[]) || []);
  const [settings, setSettings] = useState<FormSettings>({ ...DEFAULT_SETTINGS, ...(form.settings || {}) });
  const [routing, setRouting] = useState<FormRouting>((form.routing as FormRouting) || {});
  const [status, setStatus] = useState<string>(form.status || "DRAFT");
  const [selId, setSelId] = useState<string | null>(null);
  const [tab, setTab] = useState<"champ" | "reglages" | "design" | "routage">("reglages");
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);

  const sel = fields.find((f) => f.id === selId) || null;

  // Auto-save (debounce 1.5s)
  const t = useRef<any>(null);
  const doSave = useCallback(async () => {
    setSaving(true);
    try { await updateForm(form.id, { name, fields, settings, routing }); setSavedAt(new Date()); } catch {}
    setSaving(false);
  }, [form.id, name, fields, settings, routing]);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(doSave, 1500);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [name, fields, settings, routing, doSave]);

  const addField = (type: FieldType) => {
    const nf = newField(type);
    setFields((prev) => {
      const idx = selId ? prev.findIndex((f) => f.id === selId) + 1 : prev.length;
      return [...prev.slice(0, idx), nf, ...prev.slice(idx)];
    });
    setSelId(nf.id); setTab("champ");
  };
  const patchField = (id: string, patch: Partial<FormField>) => setFields((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  const removeField = (id: string) => { setFields((prev) => prev.filter((f) => f.id !== id)); if (selId === id) setSelId(null); };
  const move = (id: string, dir: -1 | 1) => setFields((prev) => {
    const i = prev.findIndex((f) => f.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const cp = [...prev]; const [x] = cp.splice(i, 1); cp.splice(j, 0, x); return cp;
  });

  const togglePublish = () => {
    const next = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setPublishing(true);
    (async () => {
      try { await doSave(); await setFormStatus(form.id, next); setStatus(next); toast.success(next === "PUBLISHED" ? "Formulaire publié ✓" : "Repassé en brouillon"); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
      setPublishing(false);
    })();
  };

  return (
    <>
      {/* Repli mobile — l'éditeur de formulaire nécessite un grand écran (comme les éditeurs email/WhatsApp/workflow) */}
      <div className="lg:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-5">
          <Monitor size={40} className="text-brand-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Éditeur réservé au desktop</h1>
        <p className="text-sm text-gray-600 max-w-xs mb-6">
          L'éditeur de formulaire nécessite un grand écran. Ouvrez cette page depuis un ordinateur.
        </p>
        <Link href="/forms" className="btn-primary text-sm">
          <ArrowLeft size={14} /> Retour aux formulaires
        </Link>
      </div>

      {/* Éditeur desktop */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/forms" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={18} /></Link>
          <input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-bold text-gray-900 border-none outline-none bg-transparent w-72" placeholder="Nom du formulaire" />
          <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{status === "PUBLISHED" ? "Publié" : "Brouillon"}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">{saving ? <><Loader2 size={12} className="animate-spin" /> …</> : savedAt ? <><Check size={12} className="text-emerald-500" /> Enregistré</> : <><Clock size={12} /> Brouillon</>}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={"/f/" + form.slug + "?preview=1"} target="_blank" rel="noopener noreferrer" className="btn-secondary py-1.5 text-xs"><Eye size={13} /> Aperçu</a>
          <button onClick={() => setShare(true)} className="btn-secondary py-1.5 text-xs"><Share2 size={13} /> Diffuser</button>
          <button onClick={togglePublish} disabled={publishing} className="btn-primary py-1.5 text-xs">{publishing ? <Loader2 size={13} className="animate-spin" /> : null} {status === "PUBLISHED" ? "Dépublier" : "Publier"}</button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[188px_1fr_284px] overflow-hidden">
        {/* Palette */}
        <div className="border-r border-gray-200 bg-gray-50/60 overflow-y-auto p-2.5">
          {PALETTE.map((g) => (
            <div key={g.cat} className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1.5 mb-1.5">{g.cat}</p>
              {g.items.map((it) => (
                <button key={it.t} onClick={() => addField(it.t)} className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-brand-400 hover:text-brand-600">
                  <span className="text-[15px]">{it.k}</span> {it.lbl}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="overflow-y-auto p-6 bg-gray-100">
          <div className="max-w-[620px] mx-auto bg-white rounded-2xl border border-gray-200 p-7 sm:p-8">
            <style>{formBaseCss(settings)}</style>
            {settings.showLogo !== false && settings.logo && <img src={settings.logo} alt="" style={{ height: 40, marginBottom: 10 }} />}
            <div className="talib-form" style={{ maxWidth: "none" }}>
              {fields.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Ajoutez des champs depuis la palette →</p>}
              {fields.map((f) => (
                <div key={f.id} onClick={() => { setSelId(f.id); setTab("champ"); }}
                  className={"relative rounded-lg -mx-1 px-1 mb-1 cursor-pointer border " + (selId === f.id ? "border-brand-400 bg-brand-50/40" : "border-transparent hover:bg-gray-50")}>
                  <div className="pointer-events-none"><FormFieldView field={f} preview /></div>
                  <div className="absolute -right-1 top-1 flex gap-0.5 opacity-0 hover:opacity-100" style={{ opacity: selId === f.id ? 1 : undefined }}>
                    <button onClick={(e) => { e.stopPropagation(); move(f.id, -1); }} className="p-1 rounded bg-white border border-gray-200 text-gray-400 hover:text-gray-700"><ChevronUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(f.id, 1); }} className="p-1 rounded bg-white border border-gray-200 text-gray-400 hover:text-gray-700"><ChevronDown size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeField(f.id); }} className="p-1 rounded bg-white border border-gray-200 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
              <button className="tf-submit" disabled>{settings.submitLabel || "Envoyer"}</button>
              <div className="tf-powered">Propulsé par TalibCRM</div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="border-l border-gray-200 bg-white overflow-y-auto">
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
            {(["champ", "reglages", "design", "routage"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={"flex-1 py-2.5 text-[11px] font-semibold border-b-2 " + (tab === k ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}>{{ champ: "Champ", reglages: "Réglages", design: "Design", routage: "Routage" }[k]}</button>
            ))}
          </div>
          <div className="p-4">
            {tab === "champ" && (sel ? <FieldSettings field={sel} fields={fields} onPatch={(p) => patchField(sel.id, p)} /> : <p className="text-xs text-gray-400 py-6 text-center">Sélectionnez un champ dans l'aperçu pour l'éditer.</p>)}
            {tab === "reglages" && <GeneralSettings settings={settings} onPatch={(p) => setSettings((s) => ({ ...s, ...p }))} />}
            {tab === "design" && <DesignSettings settings={settings} onPatch={(p) => setSettings((s) => ({ ...s, ...p }))} />}
            {tab === "routage" && <RoutingSettings routing={routing} onPatch={(p) => setRouting((r) => ({ ...r, ...p }))} stages={routingData.stages} users={routingData.users} />}
          </div>
        </div>
      </div>

      {share && <ShareModal slug={form.slug} published={status === "PUBLISHED"} onClose={() => setShare(false)} />}
      </div>
    </>
  );
}

function Lbl({ children }: { children: React.ReactNode }) { return <span className="text-[11px] font-semibold text-gray-500 mb-1 block">{children}</span>; }
function Inp(props: any) { return <input {...props} className="input text-sm mb-3" />; }

// Valeurs proposées pour la condition, selon le type du champ contrôlant.
function condValueOptions(f: FormField): string[] | null {
  if (f.type === "select" || f.type === "radio" || f.type === "checkboxes") return f.options || [];
  if (f.type === "boolean") return ["Oui", "Non"];
  if (f.type === "country") return COUNTRIES;
  if (f.type === "nationality") return NATIONALITIES;
  return null;
}

function FieldSettings({ field, fields, onPatch }: { field: FormField; fields: FormField[]; onPatch: (p: Partial<FormField>) => void }) {
  const isLayout = !isInputField(field.type);
  const selfIdx = fields.findIndex((f) => f.id === field.id);
  // Champs pouvant contrôler l'affichage : champs de saisie situés AVANT celui-ci.
  const candidates = fields.filter((f, i) => i < selfIdx && isInputField(f.type) && !!f.name);
  const cond = field.showIf;
  const ctrl = cond ? fields.find((f) => f.name === cond.field) : undefined;
  const valueOpts = ctrl ? condValueOptions(ctrl) : null;
  // Change le type d'un champ existant (ex : « Cases à cocher » → « Choix unique »).
  // On garantit des options par défaut si on bascule vers un type à options qui n'en a pas.
  const changeType = (next: FieldType) => {
    const patch: Partial<FormField> = { type: next };
    if (hasOptions(next) && !(field.options && field.options.length)) patch.options = ["Option 1", "Option 2"];
    onPatch(patch);
  };
  return (
    <div>
      <Lbl>Type de champ</Lbl>
      <select className="input text-sm mb-3" value={field.type} onChange={(e) => changeType(e.target.value as FieldType)}>
        {PALETTE.map((g) => (
          <optgroup key={g.cat} label={g.cat}>
            {g.items.map((it) => <option key={it.t} value={it.t}>{it.lbl}</option>)}
          </optgroup>
        ))}
      </select>
      {(field.type === "heading" || field.type === "paragraph" || field.type === "consent") ? (
        <><Lbl>Texte</Lbl><Inp value={field.content || ""} onChange={(e: any) => onPatch({ content: e.target.value })} /></>
      ) : (
        <><Lbl>Libellé</Lbl><Inp value={field.label} onChange={(e: any) => onPatch({ label: e.target.value })} /></>
      )}
      {!isLayout && (
        <>
          <Lbl>Nom technique (clé)</Lbl><Inp value={field.name} onChange={(e: any) => onPatch({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} />
          {field.type !== "consent" && field.type !== "hidden" && <><Lbl>Texte d'aide</Lbl><Inp value={field.help || ""} onChange={(e: any) => onPatch({ help: e.target.value })} /></>}
          {hasOptions(field.type) && (
            <><Lbl>Options (une par ligne)</Lbl>
              <textarea className="input text-sm mb-3" rows={4} value={(field.options || []).join("\n")} onChange={(e) => onPatch({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></>
          )}
          {field.type === "hidden" && <><Lbl>Valeur par défaut</Lbl><Inp value={field.defaultValue || ""} onChange={(e: any) => onPatch({ defaultValue: e.target.value })} /></>}
          <label className="flex items-center justify-between text-sm py-1.5"><span>Champ requis</span>
            <button onClick={() => onPatch({ required: !field.required })} className={"w-9 h-5 rounded-full relative " + (field.required ? "bg-brand-600" : "bg-gray-300")}><span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white " + (field.required ? "left-4" : "left-0.5")} /></button>
          </label>
          <label className="flex items-center justify-between text-sm py-1.5"><span>Demi‑largeur</span>
            <button onClick={() => onPatch({ width: field.width === "half" ? "full" : "half" })} className={"w-9 h-5 rounded-full relative " + (field.width === "half" ? "bg-brand-600" : "bg-gray-300")}><span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white " + (field.width === "half" ? "left-4" : "left-0.5")} /></button>
          </label>

          <div className="border-t border-gray-100 mt-2 pt-3">
            <Lbl>Affichage conditionnel</Lbl>
            {candidates.length === 0 ? (
              <p className="text-[10px] text-gray-400">Placez ce champ après un autre champ de saisie pour pouvoir conditionner son affichage.</p>
            ) : !cond ? (
              <button onClick={() => onPatch({ showIf: { field: candidates[candidates.length - 1].name, op: "eq", value: "" } })} className="text-xs text-brand-600 font-semibold hover:underline">+ Afficher sous condition</button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-500">N'afficher ce champ que si :</p>
                <select className="input text-sm" value={cond.field} onChange={(e) => onPatch({ showIf: { ...cond, field: e.target.value, value: "" } })}>
                  {candidates.map((c) => <option key={c.id} value={c.name}>{c.label || c.name}</option>)}
                </select>
                <select className="input text-sm" value={cond.op} onChange={(e) => onPatch({ showIf: { ...cond, op: e.target.value as "eq" | "neq" } })}>
                  <option value="eq">est égal à</option>
                  <option value="neq">n'est pas égal à</option>
                </select>
                {valueOpts
                  ? <select className="input text-sm" value={cond.value} onChange={(e) => onPatch({ showIf: { ...cond, value: e.target.value } })}><option value="">Choisir une valeur…</option>{valueOpts.map((o, i) => <option key={i} value={o}>{o}</option>)}</select>
                  : <Inp value={cond.value} onChange={(e: any) => onPatch({ showIf: { ...cond, value: e.target.value } })} placeholder="Valeur attendue" />}
                <button onClick={() => onPatch({ showIf: undefined })} className="text-[11px] text-red-500 hover:underline">Retirer la condition</button>
              </div>
            )}
          </div>
        </>
      )}
      </div>
  );
}

function GeneralSettings({ settings, onPatch }: { settings: FormSettings; onPatch: (p: Partial<FormSettings>) => void }) {
  return (
    <div>
      <Lbl>Libellé du bouton</Lbl><Inp value={settings.submitLabel || ""} onChange={(e: any) => onPatch({ submitLabel: e.target.value })} />
      <Lbl>Après soumission</Lbl>
      {[{ v: "message", t: "Message de remerciement" }, { v: "redirect", t: "Redirection vers une URL" }].map((o) => (
        <button key={o.v} onClick={() => onPatch({ successMode: o.v as any })} className={"w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border mb-2 text-xs " + (settings.successMode === o.v ? "border-brand-500 bg-brand-50" : "border-gray-200")}>
          <span className={"w-3.5 h-3.5 rounded-full border-2 " + (settings.successMode === o.v ? "border-brand-600 bg-brand-600" : "border-gray-300")} /> {o.t}
        </button>
      ))}
      {settings.successMode === "redirect"
        ? <><Lbl>URL de redirection</Lbl><Inp value={settings.redirectUrl || ""} onChange={(e: any) => onPatch({ redirectUrl: e.target.value })} placeholder="https://…" /></>
        : <><Lbl>Message</Lbl><textarea className="input text-sm mb-3" rows={3} value={settings.successMessage || ""} onChange={(e) => onPatch({ successMessage: e.target.value })} /></>}

      <div className="border-t border-gray-100 mt-2 pt-3">
        <label className="flex items-center justify-between text-sm py-1.5 cursor-pointer">
          <span>Formulaire multi‑étapes</span>
          <input type="checkbox" checked={settings.multiStep === true} onChange={(e) => onPatch({ multiStep: e.target.checked })} />
        </label>
        <p className="text-[10px] text-gray-400 -mt-0.5">Affiche le formulaire par étapes avec une barre de progression. Les étapes suivent les champs « Titre » (sinon découpage automatique). La saisie est sauvegardée automatiquement dans le navigateur.</p>
      </div>

      <div className="border-t border-gray-100 mt-2 pt-3">
        <Lbl>Notification par email</Lbl>
        <Inp type="email" value={settings.notifyEmail || ""} onChange={(e: any) => onPatch({ notifyEmail: e.target.value })} placeholder="commercial@ecole.sn" />
        <p className="text-[10px] text-gray-400 -mt-1">Un email est envoyé à cette adresse à chaque soumission. Laissez vide pour désactiver.</p>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded border border-gray-200 p-0 cursor-pointer" />
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input text-xs font-mono flex-1" />
    </div>
  );
}

function DesignSettings({ settings, onPatch }: { settings: FormSettings; onPatch: (p: Partial<FormSettings>) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File | null) => {
    if (!file) return; setUploading(true);
    try { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/upload", { method: "POST", body: fd }); const d = await r.json(); if (d.success) onPatch({ logo: d.url, showLogo: true }); else toast.error(d.error || "Erreur"); }
    catch { toast.error("Erreur upload"); }
    setUploading(false);
  };
  return (
    <div>
      <Lbl>Couleurs</Lbl>
      <ColorRow label="Principale" value={settings.color || "#2471A3"} onChange={(v) => onPatch({ color: v })} />
      <ColorRow label="Bouton" value={settings.buttonColor || "#2471A3"} onChange={(v) => onPatch({ buttonColor: v })} />
      <ColorRow label="Fond page" value={settings.bgColor || "#EEF4FB"} onChange={(v) => onPatch({ bgColor: v })} />
      <ColorRow label="Texte" value={settings.textColor || "#1A2229"} onChange={(v) => onPatch({ textColor: v })} />
      <Lbl>Coins arrondis (px)</Lbl><Inp type="number" value={settings.radius ?? 12} onChange={(e: any) => onPatch({ radius: Number(e.target.value) })} />
      <Lbl>Logo</Lbl>
      <div className="flex items-center gap-2 mb-3">
        {settings.logo ? <img src={settings.logo} alt="" style={{ height: 30 }} /> : <span className="w-8 h-8 rounded bg-brand-50 flex items-center justify-center">🖼️</span>}
        <label className="btn-secondary py-1.5 px-2.5 text-xs cursor-pointer">{uploading ? <Loader2 size={12} className="animate-spin" /> : "Téléverser"}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0] || null)} /></label>
        {settings.logo && <button onClick={() => onPatch({ logo: "" })} className="text-xs text-red-500">Retirer</button>}
      </div>
      <Lbl>CSS personnalisé (avancé)</Lbl>
      <textarea className="input text-xs font-mono mb-1" rows={5} value={settings.customCss || ""} onChange={(e) => onPatch({ customCss: e.target.value })} placeholder=".talib-form .tf-field { }" />
      <p className="text-[10px] text-gray-400">Ciblez <code>.talib-form</code> pour tout personnaliser.</p>
    </div>
  );
}

function RoutingSettings({ routing, onPatch, stages, users }: { routing: FormRouting; onPatch: (p: Partial<FormRouting>) => void; stages: Stage[]; users: UserOpt[] }) {
  const [tagInput, setTagInput] = useState("");
  const tags = routing.tags || [];
  return (
    <div>
      <Lbl>Étape du pipeline à l'arrivée</Lbl>
      <select className="input text-sm mb-3" value={routing.pipelineStageId || ""} onChange={(e) => onPatch({ pipelineStageId: e.target.value || null })}>
        <option value="">Automatique (par défaut)</option>
        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Lbl>Assigner à</Lbl>
      <select className="input text-sm mb-3" value={routing.assignToId || ""} onChange={(e) => onPatch({ assignToId: e.target.value || null })}>
        <option value="">Non assigné</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <Lbl>Tags automatiques</Lbl>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((tg) => <span key={tg} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">{tg}<button onClick={() => onPatch({ tags: tags.filter((x) => x !== tg) })}><X size={11} /></button></span>)}
      </div>
      <div className="flex gap-2">
        <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { onPatch({ tags: [...tags, tagInput.trim()] }); setTagInput(""); } }} className="input text-sm flex-1" placeholder="Ajouter un tag + Entrée" />
        <button onClick={() => { if (tagInput.trim()) { onPatch({ tags: [...tags, tagInput.trim()] }); setTagInput(""); } }} className="btn-secondary py-1.5 px-2.5 text-xs"><Plus size={13} /></button>
      </div>
    </div>
  );
}
