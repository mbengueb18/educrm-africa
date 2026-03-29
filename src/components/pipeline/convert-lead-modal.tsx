"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X, Loader2, GraduationCap, CheckCircle2, User, Phone, Mail,
  MapPin, Calendar, Shield, Building2, BookOpen,
} from "lucide-react";
import { convertLeadToStudent, getConversionData } from "@/app/(dashboard)/pipeline/convert-actions";

interface ConvertLeadModalProps {
  open: boolean;
  onClose: (converted?: boolean) => void;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    whatsapp: string | null;
    city: string | null;
    gender: string | null;
    dateOfBirth: Date | null;
    programId: string | null;
    campusId: string | null;
  };
}

export function ConvertLeadModal({ open, onClose, lead }: ConvertLeadModalProps) {
  var [loading, setLoading] = useState(true);
  var [saving, setSaving] = useState(false);
  var [programs, setPrograms] = useState<any[]>([]);
  var [campuses, setCampuses] = useState<any[]>([]);
  var [academicYears, setAcademicYears] = useState<any[]>([]);
  var [success, setSuccess] = useState<{ studentNumber: string } | null>(null);

  // Form state
  var [firstName, setFirstName] = useState(lead.firstName);
  var [lastName, setLastName] = useState(lead.lastName);
  var [phone, setPhone] = useState(lead.phone);
  var [email, setEmail] = useState(lead.email || "");
  var [whatsapp, setWhatsapp] = useState(lead.whatsapp || "");
  var [gender, setGender] = useState(lead.gender || "");
  var [dateOfBirth, setDateOfBirth] = useState(
    lead.dateOfBirth ? new Date(lead.dateOfBirth).toISOString().split("T")[0] : ""
  );
  var [address, setAddress] = useState("");
  var [emergencyContact, setEmergencyContact] = useState("");
  var [emergencyPhone, setEmergencyPhone] = useState("");
  var [programId, setProgramId] = useState(lead.programId || "");
  var [campusId, setCampusId] = useState(lead.campusId || "");
  var [academicYearId, setAcademicYearId] = useState("");

  // Load conversion data
  useEffect(function() {
    if (!open) return;
    setLoading(true);
    getConversionData()
      .then(function(data) {
        setPrograms(data.programs);
        setCampuses(data.campuses);
        setAcademicYears(data.academicYears);
        // Auto-select current academic year
        var current = data.academicYears.find(function(ay: any) { return ay.isCurrent; });
        if (current) setAcademicYearId(current.id);
        // Auto-select campus from program if not set
        if (!campusId && programId) {
          var prog = data.programs.find(function(p: any) { return p.id === programId; });
          if (prog) setCampusId(prog.campusId);
        }
      })
      .catch(function() { toast.error("Erreur chargement des données"); })
      .finally(function() { setLoading(false); });
  }, [open]);

  // Auto-select campus when program changes
  var handleProgramChange = function(newProgramId: string) {
    setProgramId(newProgramId);
    var prog = programs.find(function(p: any) { return p.id === newProgramId; });
    if (prog && prog.campusId) setCampusId(prog.campusId);
  };

  var handleConvert = async function() {
    if (!programId) { toast.error("Sélectionnez une filière"); return; }
    if (!campusId) { toast.error("Sélectionnez un campus"); return; }

    setSaving(true);
    try {
      var result = await convertLeadToStudent({
        leadId: lead.id,
        programId,
        campusId,
        academicYearId: academicYearId || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        address: address.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
      });
      setSuccess({ studentNumber: result.studentNumber });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la conversion");
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={function() { if (!saving) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-brand-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <GraduationCap size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Convertir en étudiant</h2>
              <p className="text-xs text-gray-500">{lead.firstName} {lead.lastName}</p>
            </div>
          </div>
          <button onClick={function() { if (!saving) onClose(); }} className="p-1.5 rounded-lg hover:bg-white/60 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Success screen */}
        {success && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-6">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Conversion réussie !</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              {firstName} {lastName} est maintenant inscrit(e)
            </p>
            <div className="bg-emerald-50 rounded-xl px-6 py-3 mt-3 text-center">
              <p className="text-xs text-emerald-600 font-medium">Numéro étudiant</p>
              <p className="text-2xl font-bold text-emerald-700 tracking-wider">{success.studentNumber}</p>
            </div>
            <button onClick={function() { onClose(true); }} className="btn-primary py-2.5 px-8 text-sm mt-6">
              Fermer
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && !success && (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-brand-500" />
          </div>
        )}

        {/* Form */}
        {!loading && !success && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Formation */}
              <Section title="Formation" icon={BookOpen}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Filière *</label>
                    <select value={programId} onChange={function(e) { handleProgramChange(e.target.value); }} className="input text-sm">
                      <option value="">Sélectionner une filière</option>
                      {programs.map(function(p: any) {
                        return <option key={p.id} value={p.id}>{p.name} ({p.level})</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Campus *</label>
                    <select value={campusId} onChange={function(e) { setCampusId(e.target.value); }} className="input text-sm">
                      <option value="">Sélectionner un campus</option>
                      {campuses.map(function(c: any) {
                        return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Année académique</label>
                  <select value={academicYearId} onChange={function(e) { setAcademicYearId(e.target.value); }} className="input text-sm">
                    <option value="">Aucune (inscription sans année)</option>
                    {academicYears.map(function(ay: any) {
                      return <option key={ay.id} value={ay.id}>{ay.label} {ay.isCurrent ? "(en cours)" : ""}</option>;
                    })}
                  </select>
                </div>
              </Section>

              {/* Informations personnelles */}
              <Section title="Informations personnelles" icon={User}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Prénom *</label>
                    <input type="text" value={firstName} onChange={function(e) { setFirstName(e.target.value); }} className="input text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
                    <input type="text" value={lastName} onChange={function(e) { setLastName(e.target.value); }} className="input text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Genre</label>
                    <select value={gender} onChange={function(e) { setGender(e.target.value); }} className="input text-sm">
                      <option value="">Non spécifié</option>
                      <option value="MALE">Homme</option>
                      <option value="FEMALE">Femme</option>
                      <option value="OTHER">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Date de naissance</label>
                    <input type="date" value={dateOfBirth} onChange={function(e) { setDateOfBirth(e.target.value); }} className="input text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Adresse</label>
                  <input type="text" value={address} onChange={function(e) { setAddress(e.target.value); }} className="input text-sm" placeholder="Adresse complète" />
                </div>
              </Section>

              {/* Contact */}
              <Section title="Contact" icon={Phone}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone *</label>
                    <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }} className="input text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp</label>
                    <input type="tel" value={whatsapp} onChange={function(e) { setWhatsapp(e.target.value); }} className="input text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                  <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} className="input text-sm" />
                </div>
              </Section>

              {/* Urgence */}
              <Section title="Contact d'urgence" icon={Shield}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Nom du contact</label>
                    <input type="text" value={emergencyContact} onChange={function(e) { setEmergencyContact(e.target.value); }} className="input text-sm" placeholder="Parent, tuteur..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone d'urgence</label>
                    <input type="tel" value={emergencyPhone} onChange={function(e) { setEmergencyPhone(e.target.value); }} className="input text-sm" placeholder="+221 7X XXX XX XX" />
                  </div>
                </div>
              </Section>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-400">Le lead sera marqué comme converti</p>
              <div className="flex items-center gap-2">
                <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm" disabled={saving}>
                  Annuler
                </button>
                <button onClick={handleConvert} disabled={saving || !programId || !campusId} className="btn-primary py-2 text-sm bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                  Convertir en étudiant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Icon size={12} /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}