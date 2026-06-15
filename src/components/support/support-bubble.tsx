"use client";

import { useState } from "react";
import { SupportForm } from "@/components/support/support-form";
import { LifeBuoy, X } from "lucide-react";

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
              <SupportForm compact onSuccess={function() { setOpen(false); }} />
            </div>
          </div>
        </>
      )}
    </>
  );
}