"use client";

import { useState } from "react";
import { cn, formatCFA, formatDate, getInitials } from "@/lib/utils";
import {
  GraduationCap, Plus, Search, Filter, Download,
  Phone, Mail, MapPin, ChevronRight,
} from "lucide-react";

interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: string;
  enrollmentDate: Date;
  program: { id: string; name: string; code: string | null; level: string; tuitionAmount: number };
  campus: { id: string; name: string; city: string };
  _count: { payments: number; attendances: number; grades: number };
}

interface StudentsClientProps {
  students: Student[];
  stats: { total: number; active: number; graduated: number; suspended: number };
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  ON_LEAVE: "En congé",
  GRADUATED: "Diplômé",
  WITHDRAWN: "Retiré",
  EXPELLED: "Exclu",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  SUSPENDED: "bg-red-100 text-red-700",
  ON_LEAVE: "bg-amber-100 text-amber-700",
  GRADUATED: "bg-blue-100 text-blue-700",
  WITHDRAWN: "bg-gray-100 text-gray-600",
  EXPELLED: "bg-red-100 text-red-700",
};

export function StudentsClient({ students, stats }: StudentsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filtered = students.filter((s) => {
    const matchesSearch =
      !search ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.studentNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.program.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (students.length === 0) {
    return (
      <div>
        <PageHeader />
        <EmptyState />
      </div>
    );
  }

  return (
    <div>
      <PageHeader />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Actifs" value={stats.active} color="text-emerald-600" />
        <MiniStat label="Diplômés" value={stats.graduated} color="text-blue-600" />
        <MiniStat label="Suspendus" value={stats.suspended} color="text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule, filière..."
            className="input pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto text-sm"
          value={statusFilter || ""}
          onChange={(e) => setStatusFilter(e.target.value || null)}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {filtered.length} étudiant{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Étudiant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Matricule</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Filière</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Campus</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Inscription</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(`${student.firstName} ${student.lastName}`)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{student.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-600">{student.studentNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-gray-900">{student.program.code || student.program.name}</p>
                      <p className="text-xs text-gray-500">{student.program.level}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {student.campus.city}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("badge text-[11px]", statusColors[student.status] || "badge-gray")}>
                      {statusLabels[student.status] || student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(student.enrollmentDate)}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Étudiants</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos étudiants inscrits et leur parcours académique</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary py-2 text-xs">
          <Download size={14} /> Exporter
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <GraduationCap size={32} className="text-brand-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun étudiant inscrit</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        Les étudiants apparaîtront ici une fois convertis depuis le pipeline de recrutement.
        Déplacez un lead dans la colonne &quot;Admis&quot; puis cliquez sur &quot;Inscrire&quot; dans sa fiche.
      </p>
    </div>
  );
}

function MiniStat({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
    </div>
  );
}
