"use client";

import { useState, useTransition } from "react";
import { X, Loader2, GraduationCap, ArrowRight } from "lucide-react";
import { convertLeadToStudent } from "@/app/(dashboard)/students/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ConvertLeadModalProps {
  open: boolean;
  onClose: () => void;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    programId: string | null;
    campusId: string | null;
  } | null;
  programs: { id: string; name: string; code: string | null; tuitionAmount: number }[];
  campuses: { id: string; name: string; city: string }[];
}

export function ConvertLeadModal({ open, onClose, lead, programs, campuses }: ConvertLeadModalProps) {
  const [programId, setProgramId] = useState(lead?.programId || "");
  const [campusId, setCampusId] = useState(lead?.campusId || "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open || !lead) return null;

  const selectedProgram = programs.find((p) => p.id === programId);

  const handleConvert = () => {
    if (!programId || !campusId) {
      toast.error("Veuillez sélectionner une filière et un campus");
      return;
    }

    startTransition(async () => {
      try {
        const student = await convertLeadToStudent(lead.id, programId, campusId);
        toast.success(`${lead.firstName} ${lead.lastName} est maintenant inscrit ! (${student.studentNumber})`);
        onClose();
        router.refresh();
      } catch (error: any) {
        toast.error(error.message || "Erreur lors de la conversion");
      }
    });
  };

  const formatCFA = (n: number) =>
    new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <GraduationCap size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Inscrire l&apos;étudiant</h2>
              <p className="text-sm text-gray-500">{lead.firstName} {lead.lastName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {/* Visual flow */}
          <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-500">Lead</span>
            <ArrowRight size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600">Étudiant inscrit</span>
          </div>

          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filière <span className="text-red-500">*</span>
            </label>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="input"
            >
              <option value="">Sélectionner une filière...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} — ` : ""}{p.name}
                </option>
              ))}
            </select>
            {selectedProgram && (
              <p className="text-xs text-gray-500 mt-1">
                Frais de scolarité : {formatCFA(selectedProgram.tuitionAmount)} — payable en 3 tranches
              </p>
            )}
          </div>

          {/* Campus */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campus <span className="text-red-500">*</span>
            </label>
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="input"
            >
              <option value="">Sélectionner un campus...</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}
                </option>
              ))}
            </select>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800">
              Cette action va créer la fiche étudiant, générer un numéro matricule, créer l&apos;échéancier de paiement en 3 tranches, et marquer le lead comme converti dans le pipeline.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary" disabled={isPending}>
            Annuler
          </button>
          <button
            onClick={handleConvert}
            disabled={isPending || !programId || !campusId}
            className="btn bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Inscription...
              </>
            ) : (
              <>
                <GraduationCap size={16} />
                Inscrire l&apos;étudiant
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
