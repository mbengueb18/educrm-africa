"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getFormsWithMapping, deleteFormSchema, renameForm,
  type FormWithMapping, type MappedField,
} from "@/lib/form-schemas";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, ChevronRight, FileText, CheckCircle2,
  AlertCircle, Calendar, Layers, Settings2, Trash2, Search, ExternalLink,
  Loader2, Pencil, Check, X, Globe,
} from "lucide-react";
import Link from "next/link";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) +
      " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function FormsManagementPage() {
  const [forms, setForms] = useState<FormWithMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    getFormsWithMapping()
      .then((data) => {
        setForms(data);
        if (data.length > 0) setOpenId(data[0].formId);
      })
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
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Formulaires</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Les formulaires détectés sur votre site et l&apos;état du mapping de leurs champs
          </p>
        </div>
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
                  <button
                    onClick={() => setOpenId(isOpen ? null : form.formId)}
                    className="text-gray-400 shrink-0"
                  >
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <span className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-brand-600" />
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
                        <button onClick={() => setRenamingId(null)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setOpenId(isOpen ? null : form.formId)} className="block text-left w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 truncate">{form.name}</p>
                            <span className="text-[11px] text-gray-400 font-mono">{form.formId}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400 flex-wrap">
                            <span className="inline-flex items-center gap-1"><Layers size={11} /> {form.fields.length} champs</span>
                            <span className="inline-flex items-center gap-1"><Calendar size={11} /> Vu le {formatDate(form.lastSeen)}</span>
                            {form.pageTitle && (
                              <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                                <Globe size={11} /> {form.pageTitle}
                              </span>
                            )}
                            {form.pageUrl && (
                              <a
                                href={form.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-brand-500 hover:text-brand-700 truncate max-w-[240px]"
                                title={form.pageUrl}
                              >
                                <ExternalLink size={11} /> {form.pageUrl.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                        </button>
                      </>
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
                      <button onClick={() => startRename(form)}
                        className="shrink-0 p-1.5 rounded hover:bg-brand-50 text-gray-300 hover:text-brand-600" title="Renommer">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(form.formId, form.name)} disabled={isPending}
                        className="shrink-0 p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" title="Retirer">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {form.fields.map((field) => (
                      <FieldRow key={field.name} field={field} />
                    ))}
                    {form.unmappedCount > 0 && (
                      <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                        <Link href="/settings/custom-fields"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
                          Mapper les champs manquants <ExternalLink size={12} />
                        </Link>
                      </div>
                    )}
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
            Cette page liste les formulaires détectés sur votre site. Renommez chaque formulaire (icône crayon) pour
            l&apos;identifier facilement. Les champs <strong>auto</strong> (prénom, nom, email, téléphone) sont reconnus
            automatiquement. Pour mapper un champ non reconnu, allez sur la page{" "}
            <Link href="/settings/custom-fields" className="underline">Champs personnalisés</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function FieldRow({ field }: { field: MappedField }) {
  const { mapping } = field;
  const isMapped = mapping.kind !== "none";
  const isAuto = mapping.kind === "auto";

  const statusColor =
    isAuto ? "bg-gray-300" :
    isMapped ? "bg-emerald-400" :
    "bg-amber-400";

  let mappingText = "Non mappé";
  let mappingClass = "text-amber-600";
  if (mapping.kind === "auto") {
    mappingText = `${mapping.target} (auto)`;
    mappingClass = "text-gray-400";
  } else if (mapping.kind === "standard") {
    mappingText = `→ ${mapping.label}`;
    mappingClass = "text-emerald-700";
  } else if (mapping.kind === "custom") {
    mappingText = mapping.label;
    mappingClass = "text-emerald-700";
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${isMapped ? "" : "bg-amber-50/30"}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} title={isMapped ? "Mappé" : "Non mappé"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{field.label || field.name}</p>
          <span className="text-[10px] text-gray-400 font-mono">{field.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{field.type}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={`text-xs font-medium ${mappingClass}`}>{mappingText}</span>
      </div>
    </div>
  );
}