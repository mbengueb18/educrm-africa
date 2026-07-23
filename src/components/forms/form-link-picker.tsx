"use client";

// Sélecteur de formulaire publié — utilisé par l'éditeur email et les composers WhatsApp
// pour insérer le lien public d'un formulaire (partage en 1 clic, sans copier-coller).

import { useEffect, useState } from "react";
import { X, FileText, Loader2, GraduationCap } from "lucide-react";
import { getForms } from "@/app/(dashboard)/forms/actions";

export type PickedForm = { id: string; name: string; slug: string; url: string };

export function FormLinkPicker({ onSelect, onClose, utmSource }: {
  onSelect: (form: PickedForm) => void;
  onClose: () => void;
  utmSource?: string; // « email » / « whatsapp » — pour tracer le canal dans les stats du formulaire
}) {
  const [forms, setForms] = useState<{ id: string; name: string; slug: string; status: string; submissionsCount: number }[] | null>(null);

  useEffect(() => {
    getForms().then((all) => setForms(all.filter((f) => f.status === "PUBLISHED"))).catch(() => setForms([]));
  }, []);

  const pick = (f: { id: string; name: string; slug: string }) => {
    const base = window.location.origin + "/f/" + f.slug;
    const url = utmSource ? base + "?utm_source=" + encodeURIComponent(utmSource) : base;
    onSelect({ id: f.id, name: f.name, slug: f.slug, url });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <GraduationCap size={16} className="text-brand-600" /> Insérer un formulaire
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-2">
          {forms === null ? (
            <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-gray-300 mx-auto" /></div>
          ) : forms.length === 0 ? (
            <div className="py-10 text-center px-4">
              <FileText size={26} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucun formulaire publié.</p>
              <p className="text-xs text-gray-400 mt-1">Publiez un formulaire depuis la page Formulaires pour pouvoir l'insérer.</p>
            </div>
          ) : (
            forms.map((f) => (
              <button key={f.id} onClick={() => pick(f)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-brand-50 text-left transition-colors">
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900 truncate">{f.name}</span>
                  <span className="block text-[11px] text-gray-400 font-mono truncate">/f/{f.slug}</span>
                </span>
                <span className="text-[10px] text-gray-400 shrink-0">{f.submissionsCount} soum.</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
