"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate, formatRelative, formatPhone, formatCFA, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Filter, GraduationCap, Phone, Mail, MapPin, Calendar,
  User as UserIcon, Building2, BookOpen, CreditCard, ChevronRight,
  X, Loader2, Pencil, Trash2, Check, XCircle, MoreHorizontal,
  Plus, FileText, Activity, Shield, Hash, AlertTriangle,
} from "lucide-react";
import { getStudentDetail, updateStudent, deleteStudent } from "./actions";

type Student = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  status: string;
  enrollmentDate: Date;
  createdAt: Date;
  program: { id: string; name: string; code: string | null; level: string };
  campus: { id: string; name: string; city: string };
  lead: { id: string; source: string; sourceDetail: string | null } | null;
  _count: { payments: number; enrollments: number };
};

interface StudentsClientProps {
  students: Student[];
  stats: { total: number; active: number; suspended: number; graduated: number; withdrawn: number; thisMonth: number };
  programs: { id: string; name: string; code: string | null; level: string }[];
  campuses: { id: string; name: string; city: string }[];
}

var STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Actif", color: "text-emerald-600", bg: "bg-emerald-50" },
  SUSPENDED: { label: "Suspendu", color: "text-amber-600", bg: "bg-amber-50" },
  ON_LEAVE: { label: "En congé", color: "text-blue-500", bg: "bg-blue-50" },
  GRADUATED: { label: "Diplômé", color: "text-purple-600", bg: "bg-purple-50" },
  WITHDRAWN: { label: "Retiré", color: "text-red-500", bg: "bg-red-50" },
  EXPELLED: { label: "Exclu", color: "text-red-700", bg: "bg-red-50" },
};

var SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Site web", FACEBOOK: "Facebook", INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp", PHONE_CALL: "Appel", WALK_IN: "Visite",
  REFERRAL: "Parrainage", SALON: "Salon", RADIO: "Radio", TV: "TV",
  PARTNER: "Partenaire", IMPORT: "Import", OTHER: "Autre",
};

export function StudentsClient({ students, stats, programs, campuses }: StudentsClientProps) {
  var [search, setSearch] = useState("");
  var [filterStatus, setFilterStatus] = useState<string>("");
  var [filterProgram, setFilterProgram] = useState<string>("");
  var [filterCampus, setFilterCampus] = useState<string>("");
  var [showFilters, setShowFilters] = useState(false);
  var [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  var router = useRouter();

  var filtered = useMemo(function() {
    return students.filter(function(s) {
      if (search) {
        var q = search.toLowerCase();
        var match = (s.firstName + " " + s.lastName).toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.program.name.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterProgram && s.program.id !== filterProgram) return false;
      if (filterCampus && s.campus.id !== filterCampus) return false;
      return true;
    });
  }, [students, search, filterStatus, filterProgram, filterCampus]);

  var activeFiltersCount = [filterStatus, filterProgram, filterCampus].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Étudiants</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des étudiants inscrits</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MiniStat label="Total" value={stats.total} color="text-gray-700" />
        <MiniStat label="Actifs" value={stats.active} color="text-emerald-600" />
        <MiniStat label="Suspendus" value={stats.suspended} color="text-amber-600" highlight={stats.suspended > 0} />
        <MiniStat label="Diplômés" value={stats.graduated} color="text-purple-600" />
        <MiniStat label="Retirés" value={stats.withdrawn} color="text-red-500" />
        <MiniStat label="Ce mois" value={stats.thisMonth} color="text-brand-600" highlight={stats.thisMonth > 0} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher par nom, n° étudiant, email, tél..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: "", label: "Tous" },
            { key: "ACTIVE", label: "Actifs" },
            { key: "SUSPENDED", label: "Suspendus" },
            { key: "GRADUATED", label: "Diplômés" },
          ].map(function(f) {
            return (
              <button key={f.key} onClick={function() { setFilterStatus(f.key); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterStatus === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {f.label}
              </button>
            );
          })}
        </div>

        <button onClick={function() { setShowFilters(!showFilters); }}
          className={cn("btn-secondary py-2 text-xs", activeFiltersCount > 0 && "border-brand-300 text-brand-700")}>
          <Filter size={14} /> Filtres
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">{activeFiltersCount}</span>
          )}
        </button>

        <span className="text-sm text-gray-500 ml-auto">{filtered.length} étudiant{filtered.length > 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres avancés</h4>
            <button onClick={function() { setFilterProgram(""); setFilterCampus(""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Filière</label>
              <select value={filterProgram} onChange={function(e) { setFilterProgram(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Toutes</option>
                {programs.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Campus</label>
              <select value={filterCampus} onChange={function(e) { setFilterCampus(e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {campuses.map(function(c) { return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>; })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <GraduationCap size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun étudiant trouvé</p>
            <p className="text-xs text-gray-300 mt-1">Les leads convertis apparaîtront ici</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Étudiant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">N° Étudiant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Filière</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Campus</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Inscrit le</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(function(student) {
                  var statusConf = STATUS_CONFIG[student.status] || STATUS_CONFIG.ACTIVE;
                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={function() { setSelectedStudentId(student.id); }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(student.firstName + " " + student.lastName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{student.firstName} {student.lastName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{student.studentNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs font-medium text-brand-600">{student.program.code || student.program.name}</span>
                          <span className="text-[10px] text-gray-400 ml-1">({student.program.level})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{student.campus.city}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusConf.bg, statusConf.color)}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500">
                          {student.email && <div className="truncate max-w-[150px]">{student.email}</div>}
                          <div>{formatPhone(student.phone)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{formatRelative(student.enrollmentDate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight size={14} className="text-gray-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student slide-over */}
      {selectedStudentId && (
        <StudentSlideOver
          studentId={selectedStudentId}
          onClose={function(updated) {
            setSelectedStudentId(null);
            if (updated) router.refresh();
          }}
          programs={programs}
          campuses={campuses}
        />
      )}
    </div>
  );
}

// ─── Student Slide Over ───
function StudentSlideOver({ studentId, onClose, programs, campuses }: {
  studentId: string;
  onClose: (updated?: boolean) => void;
  programs: { id: string; name: string; code: string | null; level: string }[];
  campuses: { id: string; name: string; city: string }[];
}) {
  var [student, setStudent] = useState<any>(null);
  var [loading, setLoading] = useState(true);
  var [editMode, setEditMode] = useState(false);
  var [saving, setSaving] = useState(false);
  var [deleting, setDeleting] = useState(false);
  var [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  var [activeTab, setActiveTab] = useState<"info" | "payments" | "activity">("info");

  var [editData, setEditData] = useState<any>({});

  useEffect(function() {
    setLoading(true);
    getStudentDetail(studentId)
      .then(function(data) {
        setStudent(data);
        if (data) {
          setEditData({
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email || "",
            whatsapp: data.whatsapp || "",
            gender: data.gender || "",
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split("T")[0] : "",
            address: data.address || "",
            emergencyContact: data.emergencyContact || "",
            emergencyPhone: data.emergencyPhone || "",
            status: data.status,
          });
        }
      })
      .catch(function() { toast.error("Erreur chargement"); })
      .finally(function() { setLoading(false); });
  }, [studentId]);

  useEffect(function() {
    var handler = function(e: KeyboardEvent) { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return function() { document.removeEventListener("keydown", handler); };
  }, [onClose]);

  var handleSave = async function() {
    setSaving(true);
    try {
      await updateStudent(studentId, editData);
      toast.success("Étudiant mis à jour");
      setEditMode(false);
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  var handleDelete = async function() {
    setDeleting(true);
    try {
      await deleteStudent(studentId);
      toast.success("Étudiant supprimé — le lead a été restauré dans le pipeline");
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={function() { onClose(); }} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col" style={{ animationName: "slideInRight" }}>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-brand-500" />
          </div>
        )}

        {student && !loading && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 text-lg font-bold flex items-center justify-center shrink-0">
                    {getInitials(student.firstName + " " + student.lastName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 truncate">{student.firstName} {student.lastName}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{student.studentNumber}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        (STATUS_CONFIG[student.status] || STATUS_CONFIG.ACTIVE).bg,
                        (STATUS_CONFIG[student.status] || STATUS_CONFIG.ACTIVE).color
                      )}>
                        {(STATUS_CONFIG[student.status] || STATUS_CONFIG.ACTIVE).label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <a href={"tel:" + student.phone} className="btn-secondary py-1.5 px-3 text-xs"><Phone size={13} /> Appeler</a>
                  {student.whatsapp && (
                    <a href={"https://wa.me/" + student.whatsapp.replace(/\D/g, "")} target="_blank" className="btn-secondary py-1.5 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <Phone size={13} /> WhatsApp
                    </a>
                  )}
                  {student.email && (
                    <a href={"mailto:" + student.email} className="btn-secondary py-1.5 px-3 text-xs"><Mail size={13} /> Email</a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={function() { setShowDeleteConfirm(true); }} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Supprimer">
                  <Trash2 size={18} />
                </button>
                <button onClick={function() { onClose(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-600" />
                  <span className="text-sm text-red-700 font-medium">Supprimer cet étudiant ? Le lead sera restauré dans le pipeline.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={function() { setShowDeleteConfirm(false); }} className="px-3 py-1.5 text-xs text-gray-600 bg-white rounded-lg border border-gray-200" disabled={deleting}>Annuler</button>
                  <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-1">
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { key: "info" as const, label: "Informations" },
                { key: "payments" as const, label: "Paiements (" + (student.payments?.length || 0) + ")" },
                { key: "activity" as const, label: "Activité (" + (student.activities?.length || 0) + ")" },
              ].map(function(tab) {
                return (
                  <button key={tab.key} onClick={function() { setActiveTab(tab.key); }}
                    className={cn("flex-1 py-3 text-xs font-medium transition-colors relative",
                      activeTab === tab.key ? "text-brand-600" : "text-gray-500 hover:text-gray-700"
                    )}>
                    {tab.label}
                    {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "info" && (
                <div className="p-5 space-y-5">
                  {/* Edit toggle */}
                  <div className="flex items-center justify-end gap-2">
                    {editMode ? (
                      <>
                        <button onClick={function() { setEditMode(false); }} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}><XCircle size={13} /> Annuler</button>
                        <button onClick={handleSave} className="btn-primary py-1.5 px-3 text-xs" disabled={saving}>
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Sauvegarder
                        </button>
                      </>
                    ) : (
                      <button onClick={function() { setEditMode(true); }} className="btn-secondary py-1.5 px-3 text-xs"><Pencil size={13} /> Modifier</button>
                    )}
                  </div>

                  {/* Status change */}
                  {editMode && (
                    <InfoSection title="Statut" icon={GraduationCap}>
                      <select value={editData.status} onChange={function(e) { setEditData({ ...editData, status: e.target.value }); }} className="input text-sm">
                        {Object.entries(STATUS_CONFIG).map(function(entry) {
                          return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>;
                        })}
                      </select>
                    </InfoSection>
                  )}

                  {/* Formation */}
                  <InfoSection title="Formation" icon={BookOpen}>
                    <InfoRow icon={GraduationCap} label="Filière" value={student.program.name + " (" + student.program.level + ")"} />
                    {student.program.code && <InfoRow icon={Hash} label="Code" value={student.program.code} />}
                    <InfoRow icon={Building2} label="Campus" value={student.campus.name + " — " + student.campus.city} />
                    <InfoRow icon={CreditCard} label="Scolarité" value={formatCFA(student.program.tuitionAmount)} />
                    {student.enrollments.length > 0 && (
                      <InfoRow icon={Calendar} label="Année" value={student.enrollments[0].academicYear.label + (student.enrollments[0].academicYear.isCurrent ? " (en cours)" : "")} />
                    )}
                  </InfoSection>

                  {/* Personal info */}
                  <InfoSection title="Informations personnelles" icon={UserIcon}>
                    {editMode ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <EditField label="Prénom" value={editData.firstName} onChange={function(v) { setEditData({ ...editData, firstName: v }); }} />
                          <EditField label="Nom" value={editData.lastName} onChange={function(v) { setEditData({ ...editData, lastName: v }); }} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Genre</label>
                            <select value={editData.gender} onChange={function(e) { setEditData({ ...editData, gender: e.target.value }); }} className="input text-sm py-1.5 w-full">
                              <option value="">Non spécifié</option>
                              <option value="MALE">Homme</option>
                              <option value="FEMALE">Femme</option>
                            </select>
                          </div>
                          <EditField label="Date de naissance" value={editData.dateOfBirth} onChange={function(v) { setEditData({ ...editData, dateOfBirth: v }); }} type="date" />
                        </div>
                        <EditField label="Adresse" value={editData.address} onChange={function(v) { setEditData({ ...editData, address: v }); }} />
                      </div>
                    ) : (
                      <>
                        {student.gender && <InfoRow icon={UserIcon} label="Genre" value={student.gender === "MALE" ? "Homme" : student.gender === "FEMALE" ? "Femme" : "Autre"} />}
                        {student.dateOfBirth && <InfoRow icon={Calendar} label="Naissance" value={formatDate(student.dateOfBirth)} />}
                        {student.address && <InfoRow icon={MapPin} label="Adresse" value={student.address} />}
                      </>
                    )}
                  </InfoSection>

                  {/* Contact */}
                  <InfoSection title="Contact" icon={Phone}>
                    {editMode ? (
                      <div className="space-y-3">
                        <EditField label="Téléphone" value={editData.phone} onChange={function(v) { setEditData({ ...editData, phone: v }); }} />
                        <EditField label="Email" value={editData.email} onChange={function(v) { setEditData({ ...editData, email: v }); }} type="email" />
                        <EditField label="WhatsApp" value={editData.whatsapp} onChange={function(v) { setEditData({ ...editData, whatsapp: v }); }} />
                      </div>
                    ) : (
                      <>
                        <InfoRow icon={Phone} label="Téléphone" value={formatPhone(student.phone)} />
                        {student.whatsapp && student.whatsapp !== student.phone && <InfoRow icon={Phone} label="WhatsApp" value={formatPhone(student.whatsapp)} />}
                        {student.email && <InfoRow icon={Mail} label="Email" value={student.email} />}
                      </>
                    )}
                  </InfoSection>

                  {/* Emergency */}
                  <InfoSection title="Contact d'urgence" icon={Shield}>
                    {editMode ? (
                      <div className="grid grid-cols-2 gap-3">
                        <EditField label="Nom" value={editData.emergencyContact} onChange={function(v) { setEditData({ ...editData, emergencyContact: v }); }} />
                        <EditField label="Téléphone" value={editData.emergencyPhone} onChange={function(v) { setEditData({ ...editData, emergencyPhone: v }); }} />
                      </div>
                    ) : (
                      <>
                        {student.emergencyContact && <InfoRow icon={UserIcon} label="Contact" value={student.emergencyContact} />}
                        {student.emergencyPhone && <InfoRow icon={Phone} label="Téléphone" value={formatPhone(student.emergencyPhone)} />}
                        {!student.emergencyContact && !student.emergencyPhone && <p className="text-xs text-gray-400">Non renseigné</p>}
                      </>
                    )}
                  </InfoSection>

                  {/* Source */}
                  {student.lead && (
                    <InfoSection title="Origine" icon={Activity}>
                      <InfoRow icon={Activity} label="Source" value={SOURCE_LABELS[student.lead.source] || student.lead.source} />
                      {student.lead.sourceDetail && <InfoRow icon={FileText} label="Détail" value={student.lead.sourceDetail} />}
                      <InfoRow icon={Calendar} label="Lead créé le" value={formatDate(student.lead.createdAt)} />
                      <InfoRow icon={Calendar} label="Inscrit le" value={formatDate(student.enrollmentDate)} />
                    </InfoSection>
                  )}
                </div>
              )}

              {activeTab === "payments" && (
                <div className="p-5">
                  {student.payments.length === 0 ? (
                    <div className="py-12 text-center">
                      <CreditCard size={32} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Aucun paiement enregistré</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {student.payments.map(function(p: any) {
                        var isPaid = p.status === "PAID";
                        var isOverdue = p.status === "OVERDUE" || (p.status === "PENDING" && new Date(p.dueDate) < new Date());
                        return (
                          <div key={p.id} className={cn("flex items-center justify-between p-3 rounded-lg border",
                            isPaid ? "bg-emerald-50/50 border-emerald-200" : isOverdue ? "bg-red-50/50 border-red-200" : "bg-white border-gray-200"
                          )}>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{p.label}</p>
                              <p className="text-xs text-gray-500">Échéance : {formatDate(p.dueDate)}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn("text-sm font-bold", isPaid ? "text-emerald-600" : isOverdue ? "text-red-600" : "text-gray-700")}>{formatCFA(p.amount)}</p>
                              <p className={cn("text-[10px] font-semibold",
                                isPaid ? "text-emerald-600" : isOverdue ? "text-red-600" : "text-amber-600"
                              )}>
                                {isPaid ? "Payé" : isOverdue ? "En retard" : p.status === "PARTIAL" ? "Partiel" : "En attente"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div className="p-5">
                  {student.activities.length === 0 ? (
                    <div className="py-12 text-center">
                      <Activity size={32} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Aucune activité</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {student.activities.map(function(a: any) {
                        return (
                          <div key={a.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                              <Activity size={14} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700">{a.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {a.user && <span className="text-xs text-gray-500">{a.user.name}</span>}
                                <span className="text-xs text-gray-400">{formatRelative(a.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─── Reusable components ───
function MiniStat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white px-4 py-3 text-center", highlight && "border-brand-200 bg-brand-50/30")}>
      <div className={cn("text-xl font-bold", color)}>{value}</div>
      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function InfoSection({ title, icon: Icon, children }: { title: string; icon: typeof UserIcon; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Icon size={12} /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 truncate">{value}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type={type || "text"} value={value} onChange={function(e) { onChange(e.target.value); }} className="input text-sm py-1.5 w-full" placeholder={label} />
    </div>
  );
}