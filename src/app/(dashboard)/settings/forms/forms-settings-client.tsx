"use client";

import { useState, useEffect, useRef, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getFormsWithMapping, deleteFormSchema, renameForm, mapFieldFromForm, listCustomFieldsBrief,
  type FormWithMapping, type MappedField,
} from "@/lib/form-schemas";
import { MAPPABLE_STANDARD_FIELDS } from "@/lib/custom-fields-constants";
import { createForm, deleteForm } from "@/app/(dashboard)/forms/actions";
import { ShareModal } from "@/app/(dashboard)/forms/share-modal";
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText, CheckCircle2, AlertCircle,
  Calendar, Layers, Settings2, Trash2, Search, Loader2, Pencil, Check, X,
  Globe, Tag, Plus, Link2, Share2, BarChart3, FolderOpen, Sparkles, MonitorSmartphone, FileUp,
} from "lucide-react";

type FormRow = {
  id: string; name: string; slug: string; status: string;
  submissionsCount: number; createdAt: string | Date; updatedAt: string | Date;
};

type BriefCustom = { id: string; label: string; target?: string; standardField?: string };

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
      " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ══════════════════════════════════════════════════════════════════
// Page : deux onglets — Formulaires TalibCRM (builder) / Formulaires du site (natifs)
// ══════════════════════════════════════════════════════════════════
export function FormsSettingsClient({ builderForms }: { builderForms: FormRow[] }) {
  const [tab, setTab] = useState<"builder" | "site">("builder");

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Formulaires</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Vos formulaires créés dans TalibCRM et ceux détectés sur votre site web
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5 max-w-full overflow-x-auto no-scrollbar">
        <TabButton active={tab === "builder"} onClick={() => setTab("builder")} icon={Sparkles} label="Formulaires TalibCRM" count={builderForms.length} />
        <TabButton active={tab === "site"} onClick={() => setTab("site")} icon={MonitorSmartphone} label="Formulaires du site" />
      </div>

      {tab === "builder" ? <BuilderFormsTab forms={builderForms} /> : <SiteFormsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: any; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0",
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      )}
    >
      <Icon size={15} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", active ? "bg-brand-50 text-brand-600" : "bg-gray-200 text-gray-500")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
// ONGLET 1 — Formulaires TalibCRM (créés et hébergés ici)
// ══════════════════════════════════════════════════════════════════
function BuilderFormsTab({ forms }: { forms: FormRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [share, setShare] = useState<FormRow | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const create = () => startTransition(async () => {
    try { const r = await createForm(); router.push("/forms/" + r.id + "/edit"); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });

  const onPickPdf = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      toast.error("Veuillez choisir un fichier PDF"); return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("PDF trop volumineux (max 4 Mo). Compressez-le ou réduisez le nombre de pages."); return;
    }
    setImporting(true);
    const t = toast.loading("Analyse du PDF en cours…");
    (async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/forms/import-pdf", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Import impossible");
        toast.success((data.fieldCount || 0) + " champ(s) détecté(s) — vérifiez et ajustez.", { id: t });
        router.push("/forms/" + data.id + "/edit");
      } catch (err: any) {
        toast.error(err.message || "Erreur lors de l'import", { id: t });
        setImporting(false);
      }
    })();
  };

  const del = (f: FormRow) => {
    if (!confirm("Supprimer « " + f.name + " » ? Les soumissions liées seront perdues.")) return;
    startTransition(async () => {
      try { await deleteForm(f.id); toast.success("Formulaire supprimé"); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-gray-500">
          Créez des formulaires hébergés par TalibCRM (site web, webinaire, événement…) pour collecter des leads, ou <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="text-brand-600 font-semibold hover:underline disabled:opacity-50">importez un PDF existant</button> pour le convertir automatiquement.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickPdf} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing || pending} className="btn-secondary py-2 px-4 text-sm" title="Générer un formulaire à partir d'un PDF">
            {importing ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} Importer un PDF
          </button>
          <button onClick={create} disabled={pending || importing} className="btn-primary py-2 px-4 text-sm">
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Nouveau formulaire
          </button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun formulaire pour l'instant</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="btn-secondary py-2 text-xs">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Importer un PDF
            </button>
            <button onClick={create} disabled={pending} className="btn-primary py-2 text-xs"><Plus size={14} /> Créer un formulaire</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {forms.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{f.name}</p>
                  <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (f.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{f.status === "PUBLISHED" ? "Publié" : "Brouillon"}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">/f/{f.slug}</p>
              </div>
              <div className="text-center px-2">
                <p className="text-lg font-extrabold text-gray-900 leading-none">{f.submissionsCount}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Soumissions</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={"/forms/" + f.id + "/submissions"} className="btn-secondary py-1.5 px-2.5 text-xs" title="Soumissions"><BarChart3 size={13} /></Link>
                <button onClick={() => setShare(f)} className="btn-secondary py-1.5 px-2.5 text-xs"><Share2 size={13} /> Diffuser</button>
                <Link href={"/forms/" + f.id + "/edit"} className="btn-secondary py-1.5 px-2.5 text-xs"><Pencil size={13} /> Éditer</Link>
                <button onClick={() => del(f)} className="btn-secondary py-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {share && <ShareModal slug={share.slug} published={share.status === "PUBLISHED"} onClose={() => setShare(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ONGLET 2 — Formulaires du site (détectés via le tracking, à mapper)
// ══════════════════════════════════════════════════════════════════
function SiteFormsTab() {
  const [forms, setForms] = useState<FormWithMapping[]>([]);
  const [customFields, setCustomFields] = useState<BriefCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mappingField, setMappingField] = useState<string | null>(null);

  const reload = () => {
    return Promise.all([getFormsWithMapping(), listCustomFieldsBrief()]).then(([f, c]) => {
      setForms(f);
      setCustomFields(c);
      if (f.length > 0 && !openId) setOpenId(f[0].formId);
    });
  };

  useEffect(() => {
    reload()
      .catch(() => toast.error("Impossible de charger les formulaires"))
      .finally(() => setLoading(false));
  }, []);

  const startRename = (form: FormWithMapping) => {
    setRenamingId(form.formId);
    setRenameValue(form.customName || form.name);
  };

  const submitRename = (formId: string) => {
    const name = renameValue.trim();
    startTransition(async () => {
      try {
        await renameForm(formId, name);
        setForms((prev) => prev.map((f) =>
          f.formId === formId ? { ...f, customName: name || null, name: name || f.name } : f
        ));
        setRenamingId(null);
        toast.success("Formulaire renommé");
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleDelete = (formId: string, name: string) => {
    if (!confirm(`Retirer le formulaire « ${name} » de cette liste ? Il réapparaîtra s'il est de nouveau détecté sur votre site.`)) return;
    startTransition(async () => {
      try {
        await deleteFormSchema(formId);
        setForms((prev) => prev.filter((f) => f.formId !== formId));
        toast.success("Formulaire retiré");
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleMap = (input: any) => {
    startTransition(async () => {
      try {
        await mapFieldFromForm(input);
        await reload();
        setMappingField(null);
        toast.success("Champ mappé");
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const filtered = forms.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return f.name.toLowerCase().includes(q) ||
      f.formId.toLowerCase().includes(q) ||
      (f.pageTitle || "").toLowerCase().includes(q) ||
      f.fields.some((fld) => (fld.label || "").toLowerCase().includes(q) || fld.name.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-gray-500">
          Les formulaires détectés sur votre site web. Mappez leurs champs vers les champs du CRM.
        </p>
        <Link href="/settings/custom-fields" className="btn-secondary text-sm shrink-0">
          <Settings2 size={16} /> <span className="hidden sm:inline">Gérer les champs</span><span className="sm:hidden">Champs</span>
        </Link>
      </div>

      {forms.length > 0 && (
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un formulaire ou un champ…"
            className="input pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 size={28} className="animate-spin text-gray-300 mx-auto" />
          <p className="text-sm text-gray-400 mt-3">Chargement des formulaires…</p>
        </div>
      ) : forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-16 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Aucun formulaire détecté</h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
            Les formulaires de votre site apparaîtront ici automatiquement dès que le code de suivi TalibCRM les détecte.
            Vérifiez que le code de suivi est bien installé, puis visitez une page contenant un formulaire.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((form) => {
            const isOpen = openId === form.formId;
            const isRenaming = renamingId === form.formId;
            return (
              <div key={form.formId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-3 sm:px-4 py-3.5 hover:bg-gray-50/70">
                  <button onClick={() => setOpenId(isOpen ? null : form.formId)} className="text-gray-400 shrink-0">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Globe size={16} className="text-blue-600" />
                  </span>

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename(form.formId);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="input py-1 text-sm flex-1"
                          placeholder="Nom du formulaire"
                        />
                        <button onClick={() => submitRename(form.formId)} disabled={isPending}
                          className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setRenamingId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setOpenId(isOpen ? null : form.formId)} className="block text-left w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{form.name}</p>
                          <span className="text-[11px] text-gray-400 font-mono">{form.formId}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                          <span className="inline-flex items-center gap-1"><Layers size={11} /> {form.fields.length} champs</span>
                          <span className="inline-flex items-center gap-1"><Calendar size={11} /> Vu le {formatDate(form.lastSeen)}</span>
                          {form.pageTitle && (
                            <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                              <Globe size={11} /> {form.pageTitle}
                            </span>
                          )}
                        </div>
                      </button>
                    )}
                  </div>

                  {!isRenaming && (
                    <>
                      {form.unmappedCount > 0 ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">
                          <AlertCircle size={11} /> {form.unmappedCount} à mapper
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                          <CheckCircle2 size={11} /> Tout mappé
                        </span>
                      )}
                      <button onClick={() => startRename(form)} className="shrink-0 p-1.5 rounded hover:bg-brand-50 text-gray-300 hover:text-brand-600" title="Renommer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(form.formId, form.name)} disabled={isPending} className="shrink-0 p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" title="Retirer">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {form.fields.map((field) => (
                      <FieldRow
                        key={field.name}
                        field={field}
                        isMapping={mappingField === form.formId + "::" + field.name}
                        onStartMap={() => setMappingField(form.formId + "::" + field.name)}
                        onCancelMap={() => setMappingField(null)}
                        onMap={handleMap}
                        customFields={customFields}
                        isPending={isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Aucun formulaire ne correspond à « {query} ».
            </div>
          )}
        </div>
      )}

      {forms.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 mt-6">
          <p className="font-medium mb-1">Comment ça marche</p>
          <p>
            Renommez chaque formulaire (icône crayon) pour l&apos;identifier facilement. Les champs <strong>auto</strong>{" "}
            (prénom, nom, email, téléphone) sont reconnus automatiquement. Pour les autres, cliquez sur <strong>Mapper</strong> :
            vous pouvez les envoyer vers un champ standard, créer un champ personnalisé, ou les rattacher à un champ existant —
            sans attendre qu&apos;un lead soit collecté.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field, isMapping, onStartMap, onCancelMap, onMap, customFields, isPending,
}: {
  field: MappedField;
  isMapping: boolean;
  onStartMap: () => void;
  onCancelMap: () => void;
  onMap: (input: any) => void;
  customFields: BriefCustom[];
  isPending: boolean;
}) {
  const { mapping } = field;
  const isMapped = mapping.kind !== "none";
  const isAuto = mapping.kind === "auto";

  const statusColor = isAuto ? "bg-gray-300" : isMapped ? "bg-emerald-400" : "bg-amber-400";

  let mappingText = "Non mappé";
  let mappingClass = "text-amber-600";
  if (mapping.kind === "auto") { mappingText = `${mapping.target} (auto)`; mappingClass = "text-gray-400"; }
  else if (mapping.kind === "standard") { mappingText = `→ ${mapping.label}`; mappingClass = "text-emerald-700"; }
  else if (mapping.kind === "custom") { mappingText = mapping.label; mappingClass = "text-emerald-700"; }

  return (
    <div className={`border-b border-gray-50 last:border-0 ${isMapped ? "" : "bg-amber-50/30"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} title={isMapped ? "Mappé" : "Non mappé"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{field.label || field.name}</p>
            <span className="text-[10px] text-gray-400 font-mono">{field.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{field.type}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-xs font-medium ${mappingClass}`}>{mappingText}</span>
          {mapping.kind === "none" && !isMapping && (
            <button onClick={onStartMap} className="text-xs font-medium text-brand-600 hover:text-brand-700 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-50">
              Mapper
            </button>
          )}
        </div>
      </div>

      {isMapping && (
        <MapZone field={field} customFields={customFields} onMap={onMap} onCancel={onCancelMap} isPending={isPending} />
      )}
    </div>
  );
}

function MapZone({
  field, customFields, onMap, onCancel, isPending,
}: {
  field: MappedField;
  customFields: BriefCustom[];
  onMap: (input: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [tab, setTab] = useState<"standard" | "new" | "existing">("new");
  const [standardField, setStandardField] = useState("");
  const [label, setLabel] = useState(field.label || field.name);
  const [fieldType, setFieldType] = useState<"text" | "select" | "number" | "date" | "email" | "phone">("text");
  const [existingId, setExistingId] = useState("");

  const previewKey = (label || field.name)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const submit = () => {
    if (tab === "standard") {
      if (!standardField) return toast.error("Choisissez un champ standard");
      onMap({ mode: "standard", fieldName: field.name, label, standardField });
    } else if (tab === "new") {
      if (!label.trim()) return toast.error("Le label est requis");
      onMap({ mode: "new_custom", fieldName: field.name, label, type: fieldType });
    } else {
      if (!existingId) return toast.error("Choisissez un champ existant");
      onMap({ mode: "existing_custom", fieldName: field.name, customFieldId: existingId });
    }
  };

  const TabBtn = ({ id, icon, children }: any) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        tab === id ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-brand-300"
      }`}
    >
      {icon} {children}
    </button>
  );

  return (
    <div className="px-4 pb-4 pt-1 bg-gray-50/60 border-t border-gray-100">
      <div className="flex flex-wrap gap-2 mb-3">
        <TabBtn id="new" icon={<Plus size={13} />}>Nouveau champ</TabBtn>
        <TabBtn id="existing" icon={<Link2 size={13} />}>Champ existant</TabBtn>
        <TabBtn id="standard" icon={<Tag size={13} />}>Champ standard</TabBtn>
      </div>

      {tab === "standard" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={standardField} onChange={(e) => setStandardField(e.target.value)} className="input flex-1">
            <option value="">Sélectionner un champ standard…</option>
            {MAPPABLE_STANDARD_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {tab === "new" && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input flex-1"
              placeholder="Nom du champ (ex : Programme souhaité)"
            />
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as any)}
              className="input sm:w-44"
              title="Type de champ"
            >
              <option value="text">Texte</option>
              <option value="select">Liste de choix</option>
              <option value="number">Nombre</option>
              <option value="date">Date</option>
              <option value="email">Email</option>
              <option value="phone">Téléphone</option>
            </select>
          </div>
          <p className="text-[11px] text-gray-400">
            Clé interne : <span className="font-mono text-gray-500">{previewKey || "—"}</span>
            {" · "}Alimenté par <span className="font-mono text-gray-500">{field.name}</span>
            <span className="block mt-0.5">Vous pourrez ajuster la clé et les options sur la page Champs personnalisés.</span>
          </p>
        </div>
      )}

      {tab === "existing" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className="input flex-1">
            <option value="">Sélectionner un champ existant…</option>
            {customFields.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}{c.target === "standard" ? ` (→ ${c.standardField})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="btn-secondary text-xs" disabled={isPending}>Annuler</button>
        <button onClick={submit} className="btn-primary text-xs" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Mapper
        </button>
      </div>
    </div>
  );
}
