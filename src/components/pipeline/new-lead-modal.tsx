"use client";

import { useRef, useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { createLead } from "@/app/(dashboard)/pipeline/actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NewLeadModalProps {
  open: boolean;
  onClose: (created?: boolean) => void;
  programs?: { id: string; name: string }[];
  users?: { id: string; name: string }[];
}

const sources = [
  { value: "WEBSITE", label: "Site web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE_CALL", label: "Appel téléphonique" },
  { value: "WALK_IN", label: "Visite sur place" },
  { value: "REFERRAL", label: "Parrainage" },
  { value: "SALON", label: "Salon / Forum" },
  { value: "RADIO", label: "Radio" },
  { value: "PARTNER", label: "Partenaire" },
  { value: "OTHER", label: "Autre" },
];

export function NewLeadModal({ open, onClose, programs = [], users = [] }: NewLeadModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await createLead(formData);
        if (result.success) {
          toast.success("Lead créé avec succès !");
          formRef.current?.reset();
          onClose(true);
        }
      } catch (error: any) {
        toast.error(error.message || "Erreur lors de la création");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={() => onClose()}
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-scale-in mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nouveau lead</h2>
            <p className="text-sm text-gray-500 mt-0.5">Ajouter un nouveau prospect au pipeline</p>
          </div>
          <button
            onClick={() => onClose()}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form ref={formRef} action={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identité</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom <span className="text-danger-500">*</span></label>
                  <input name="firstName" required className="input" placeholder="Amadou" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-danger-500">*</span></label>
                  <input name="lastName" required className="input" placeholder="Diallo" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone <span className="text-danger-500">*</span></label>
                  <input name="phone" required type="tel" className="input" placeholder="+221 77 123 45 67" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input name="whatsapp" type="tel" className="input" placeholder="Même numéro si identique" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input name="email" type="email" className="input" placeholder="amadou@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input name="city" className="input" placeholder="Dakar, Thiès, Abidjan..." />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Acquisition</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source <span className="text-danger-500">*</span></label>
                  <select name="source" required className="input">
                    <option value="">Sélectionner...</option>
                    {sources.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Détail source</label>
                  <input name="sourceDetail" className="input" placeholder="Ex: Salon Dakar 2026, Facebook Ad #123..." />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Affectation</h3>
              <div className="grid grid-cols-2 gap-3">
                {programs.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filière souhaitée</label>
                    <select name="programId" className="input">
                      <option value="">Sélectionner...</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {users.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commercial assigné</label>
                    <select name="assignedToId" className="input">
                      <option value="">Auto (round-robin)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button type="button" onClick={() => onClose()} className="btn-secondary" disabled={isPending}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Création...</>
              ) : (
                "Créer le lead"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
