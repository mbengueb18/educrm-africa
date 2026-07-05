"use client";

import { useState } from "react";
import { SupportForm } from "@/components/support/support-form";
import { LifeBuoy, X, PlayCircle } from "lucide-react";

export function SupportBubble() {
  var [open, setOpen] = useState(false);

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={function() { setOpen(true); }}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 hover:scale-105 transition-all flex items-center justify-center"
        title="Signaler un bug ou une amélioration"
        aria-label="Support"
      >
        <LifeBuoy size={22} />
      </button>

      {/* Modal */}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={function() { setOpen(false); }} />
          <div className="fixed bottom-0 sm:bottom-5 right-0 sm:right-5 z-50 w-full sm:w-[420px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-in overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-brand-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <LifeBuoy size={18} className="text-brand-600" />
                <h3 className="text-sm font-bold text-gray-900">Support & feedback</h3>
              </div>
              <button onClick={function() { setOpen(false); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <button
                onClick={function() { setOpen(false); window.dispatchEvent(new CustomEvent("talibcrm:start-tour")); }}
                className="w-full flex items-center gap-3 mb-4 px-3 py-2.5 rounded-xl border border-brand-100 bg-brand-50/60 hover:bg-brand-50 text-left transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0"><PlayCircle size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">Revoir la visite guidée</span>
                  <span className="block text-xs text-gray-500">Un rappel des nouveautés en quelques clics.</span>
                </span>
              </button>
              <SupportForm compact onSuccess={function() { setOpen(false); }} />
            </div>
          </div>
        </>
      )}
    </>
  );
}