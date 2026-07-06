"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, FolderOpen, ExternalLink } from "lucide-react";
import { isInputField, type FormField } from "@/lib/forms";

type Sub = { id: string; data: Record<string, any>; leadId: string | null; createdAt: string | Date };
type Data = { form: { id: string; name: string; slug: string; submissionsCount: number; fields: FormField[] }; submissions: Sub[] };

function cellValue(v: any): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function SubmissionsClient({ data }: { data: Data }) {
  const [search, setSearch] = useState("");
  const cols = useMemo(() => (data.form.fields || []).filter((f) => isInputField(f.type) && f.type !== "hidden" && f.type !== "consent").slice(0, 5), [data.form.fields]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.submissions;
    return data.submissions.filter((s) => JSON.stringify(s.data).toLowerCase().includes(q));
  }, [data.submissions, search]);

  const exportCsv = () => {
    const headers = ["Reçu", ...cols.map((c) => c.label), "Lead"];
    const lines = [headers.join(",")];
    data.submissions.forEach((s) => {
      const row = [new Date(s.createdAt).toLocaleString("fr-FR"), ...cols.map((c) => '"' + cellValue(s.data[c.name]).replace(/"/g, '""') + '"'), s.leadId ? "oui" : "non"];
      lines.push(row.join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "soumissions-" + data.form.slug + ".csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link href="/forms" className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={18} /></Link>
        <span className="text-xs text-gray-400">Formulaires › {data.form.name}</span>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Soumissions</h1>
          <p className="text-sm text-gray-500 mt-1">{data.form.submissionsCount} soumission{data.form.submissionsCount > 1 ? "s" : ""} · chaque envoi crée un lead.</p>
        </div>
        {data.submissions.length > 0 && <button onClick={exportCsv} className="btn-secondary py-2 px-3 text-sm">⬇ Exporter CSV</button>}
      </div>

      {data.submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune soumission pour l'instant</p>
        </div>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9 text-sm" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">Reçu</th>
                  {cols.map((c) => <th key={c.id} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">{c.label}</th>)}
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(s.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    {cols.map((c) => <td key={c.id} className="px-4 py-3 text-gray-800 truncate max-w-[180px]">{cellValue(s.data[c.name])}</td>)}
                    <td className="px-4 py-3">
                      {s.leadId ? <Link href={"/leads/" + s.leadId} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"><ExternalLink size={12} /> Fiche</Link> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
