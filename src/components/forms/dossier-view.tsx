"use client";

// Rendu partagé du dossier de candidature (sections → cartes).
// Consommé par l'onglet Candidature de la fiche prospect et par le portail candidat,
// pour garantir une présentation identique des deux côtés.

import { FileText, Download, Tag, Check, Lock, Paperclip, Pencil } from "lucide-react";
import { fileNameFromUrl, type DossierSection, type DossierChecklist, type ChecklistItem } from "@/lib/candidature";

// Carte « Pièces du dossier » : checklist fourni / manquant, barre de complétude, verrouillage.
// Partagée entre l'onglet Candidature (CRM) et le portail candidat.
// - renderItemAction : bouton d'action par pièce (portail : Téléverser / Remplacer).
// - lockedSlot : contenu additionnel à côté de la mention de verrouillage (CRM : « Rouvrir »).
export function ChecklistCard({ checklist, title = "Pièces du dossier", renderItemAction, lockedSlot }: {
  checklist: DossierChecklist;
  title?: string;
  renderItemAction?: (item: ChecklistItem) => React.ReactNode;
  lockedSlot?: React.ReactNode;
}) {
  const items = checklist.items || [];
  if (!items.length) return null;
  const provided = items.filter((i) => i.status === "PROVIDED").length;
  const pct = Math.round((provided / items.length) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip size={15} className="text-brand-600" /> {title}
        </h3>
        <span className="text-xs font-semibold text-gray-500 tabular-nums">{provided}/{items.length} fournie{provided > 1 ? "s" : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-4">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: pct + "%" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((it) => it.status === "PROVIDED" ? (
          <a key={it.name} href={it.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/40 transition-colors group">
            <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"><FileText size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-gray-800 truncate">{it.label}</span>
              <span className="block text-[11px] text-gray-400 truncate">
                {it.updatedAt
                  ? <><Pencil size={9} className="inline mr-0.5" /> Mis à jour le {new Date(it.updatedAt).toLocaleDateString("fr-FR")}</>
                  : fileNameFromUrl(it.url || "")}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
              <Check size={10} /> Fournie
            </span>
            {renderItemAction && <span onClick={(e) => e.preventDefault()}>{renderItemAction(it)}</span>}
          </a>
        ) : (
          <div key={it.name} className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-3 py-2.5">
            <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center shrink-0"><FileText size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-gray-600 truncate">{it.label}</span>
              <span className="block text-[11px] text-gray-400">{renderItemAction ? "Requise pour votre dossier" : "Réclamée au candidat"}</span>
            </span>
            {renderItemAction
              ? renderItemAction(it)
              : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">À fournir</span>}
          </div>
        ))}
      </div>
      {checklist.locked && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <Lock size={13} className="text-brand-500 shrink-0" />
          <span className="flex-1">Dossier complet — les dépôts du candidat sont verrouillés.</span>
          {lockedSlot}
        </div>
      )}
    </div>
  );
}

export function DossierSectionsView({ sections }: { sections: DossierSection[] }) {
  if (!sections.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <FileText size={28} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">Aucune information de candidature.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((s, si) => {
        const files = s.items.filter((it) => it.kind === "file");
        const texts = s.items.filter((it) => it.kind === "text");
        const longs = s.items.filter((it) => it.kind === "longtext");
        return (
          <div key={si} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{s.title}</h3>

            {texts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
                {texts.map((it, i) => (
                  <div key={i} className="flex items-start gap-2 min-w-0">
                    <Tag size={14} className="text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">{it.label}</p>
                      <p className="text-[13px] text-gray-900 break-words">{it.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {longs.length > 0 && (
              <div className={"space-y-3 " + (texts.length ? "mt-4" : "")}>
                {longs.map((it, i) => (
                  <div key={i}>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">{it.label}</p>
                    <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">{it.value}</p>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className={"grid grid-cols-1 sm:grid-cols-2 gap-2 " + (texts.length || longs.length ? "mt-4" : "")}>
                {files.map((it, i) => (
                  <a key={i} href={it.value} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/40 transition-colors group">
                    <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-gray-800 truncate">{it.label}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{fileNameFromUrl(it.value)}</span>
                    </span>
                    <Download size={14} className="text-gray-300 group-hover:text-brand-500 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
