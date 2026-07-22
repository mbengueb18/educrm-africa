"use client";

// Rendu partagé du dossier de candidature (sections → cartes).
// Consommé par l'onglet Candidature de la fiche prospect et par le portail candidat,
// pour garantir une présentation identique des deux côtés.

import { FileText, Download, Tag } from "lucide-react";
import { fileNameFromUrl, type DossierSection } from "@/lib/candidature";

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
