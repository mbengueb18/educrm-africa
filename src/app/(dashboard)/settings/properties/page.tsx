"use client";

import { useState, useEffect, useTransition } from "react";
import { getAllFieldProperties, type FieldProperty } from "@/lib/field-properties";
import { addCustomField, deleteCustomField, updateCustomField } from "@/lib/custom-fields";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Search, Eye, EyeOff, Tag, Trash2, Plus,
  Settings2, AlertTriangle, Lock, Zap, Database,
  User as UserIcon, Megaphone, GraduationCap, Kanban, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUP_META: Record<string, { icon: typeof UserIcon; color: string; bg: string }> = {
  contact: { icon: UserIcon, color: "text-blue-600", bg: "bg-blue-50" },
  acquisition: { icon: Megaphone, color: "text-amber-600", bg: "bg-amber-50" },
  formation: { icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
  pipeline: { icon: Kanban, color: "text-purple-600", bg: "bg-purple-50" },
  custom: { icon: SlidersHorizontal, color: "text-brand-600", bg: "bg-brand-50" },
  unmapped: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
};

export default function PropertiesPage() {
  const [data, setData] = useState<{ fields: FieldProperty[]; totalLeads: number; groups: { key: string; label: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);

  const loadData = () => {
    setLoading(true);
    getAllFieldProperties()
      .then(setData)
      .catch(() => toast.error("Erreur chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filteredFields = data?.fields.filter((f) => {
    if (activeGroup && f.group !== activeGroup) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.mappedFormFields.some((mf) => mf.toLowerCase().includes(q))
      );
    }
    return true;
  }) || [];

  const unmappedCount = data?.fields.filter((f) => f.source === "unmapped").length || 0;

  const handleQuickMap = (field: FieldProperty) => {
    startTransition(async () => {
      try {
        await addCustomField({
          label: field.label,
          key: field.key.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          type: "text",
          mappedFormFields: [field.key],
          required: false,
          showInCard: false,
          showInList: true,
        });
        toast.success(`"${field.label}" configuré`);
        loadData();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleDelete = (field: FieldProperty) => {
    if (!field.customFieldId) return;
    if (!confirm(`Supprimer le champ "${field.label}" ?`)) return;
    startTransition(async () => {
      try {
        await deleteCustomField(field.customFieldId!);
        toast.success("Champ supprimé");
        loadData();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleToggle = (field: FieldProperty, key: "showInCard" | "showInList") => {
    if (!field.customFieldId) return;
    startTransition(async () => {
      try {
        await updateCustomField(field.customFieldId!, { [key]: !field[key] });
        loadData();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group fields for display
  const groupOrder = ["contact", "acquisition", "formation", "pipeline", "custom", "unmapped"];
  const groupedFields: Record<string, FieldProperty[]> = {};
  for (const f of filteredFields) {
    if (!groupedFields[f.group]) groupedFields[f.group] = [];
    groupedFields[f.group].push(f);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Propriétés</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.fields.length} champs collectés sur {data.totalLeads} leads
          </p>
        </div>
        <Link href="/settings/custom-fields" className="btn-secondary text-sm">
          <SlidersHorizontal size={15} />
          Champs personnalisés
        </Link>
      </div>

      {/* Unmapped alert */}
      {unmappedCount > 0 && !activeGroup && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm text-amber-800">
              <span className="font-semibold">{unmappedCount} champ{unmappedCount > 1 ? "s" : ""} non mappé{unmappedCount > 1 ? "s" : ""}</span> — captés depuis vos formulaires mais pas encore configurés
            </span>
          </div>
          <button onClick={() => setActiveGroup("unmapped")} className="text-sm font-medium text-amber-700 hover:text-amber-900">
            Voir →
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        <button
          onClick={() => setActiveGroup(null)}
          className={cn(
            "rounded-xl px-3 py-3 text-center transition-all border",
            !activeGroup ? "bg-white border-brand-200 shadow-sm" : "bg-white border-gray-100 hover:border-gray-200"
          )}
        >
          <p className="text-lg font-bold text-gray-900">{data.fields.length}</p>
          <p className="text-[11px] text-gray-500">Tous</p>
        </button>
        {data.groups.map((g) => {
          const meta = GROUP_META[g.key] || GROUP_META.custom;
          return (
            <button
              key={g.key}
              onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
              className={cn(
                "rounded-xl px-3 py-3 text-center transition-all border",
                activeGroup === g.key ? "bg-white border-brand-200 shadow-sm" : "bg-white border-gray-100 hover:border-gray-200"
              )}
            >
              <p className={cn("text-lg font-bold", meta.color)}>{g.count}</p>
              <p className="text-[11px] text-gray-500">{g.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un champ..."
            className="input pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-gray-500">{filteredFields.length} champ{filteredFields.length > 1 ? "s" : ""}</span>
      </div>

      {/* Grouped fields */}
      <div className="space-y-6">
        {groupOrder.filter((g) => groupedFields[g]?.length > 0).map((groupKey) => {
          const fields = groupedFields[groupKey];
          const meta = GROUP_META[groupKey] || GROUP_META.custom;
          const GroupIcon = meta.icon;
          const groupLabel = data.groups.find((g) => g.key === groupKey)?.label || groupKey;

          return (
            <div key={groupKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", meta.bg)}>
                  <GroupIcon size={16} className={meta.color} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{groupLabel}</h3>
                  <p className="text-[11px] text-gray-500">{fields.length} champ{fields.length > 1 ? "s" : ""}</p>
                </div>
                {groupKey === "unmapped" && (
                  <span className="badge bg-amber-100 text-amber-700 text-[10px]">Action requise</span>
                )}
                {groupKey === "custom" && (
                  <Link href="/settings/custom-fields" className="text-xs text-brand-600 font-medium hover:text-brand-700">
                    Gérer →
                  </Link>
                )}
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_140px_80px_100px_60px_60px_40px] gap-2 px-5 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <span>Champ</span>
                <span>Mapping formulaire</span>
                <span>Type</span>
                <span>Taux de remplissage</span>
                <span className="text-center">Carte</span>
                <span className="text-center">Liste</span>
                <span></span>
              </div>

              {/* Field rows */}
              <div className="divide-y divide-gray-50">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    className={cn(
                      "grid grid-cols-[1fr_140px_80px_100px_60px_60px_40px] gap-2 items-center px-5 py-2.5 hover:bg-gray-50/50 transition-colors",
                      field.source === "unmapped" && "bg-amber-50/30"
                    )}
                  >
                    {/* Name + key */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{field.label}</p>
                        {field.source === "system" && (
                          <Lock size={11} className="text-gray-300 shrink-0" />
                        )}
                        {field.source === "unmapped" && (
                          <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono truncate">{field.key}</p>
                    </div>

                    {/* Mapped form fields */}
                    <div className="flex flex-wrap gap-1 overflow-hidden">
                      {field.mappedFormFields.slice(0, 2).map((mf) => (
                        <span key={mf} className="badge badge-blue text-[9px] px-1.5 py-0">{mf}</span>
                      ))}
                      {field.mappedFormFields.length > 2 && (
                        <span className="text-[10px] text-gray-400">+{field.mappedFormFields.length - 2}</span>
                      )}
                    </div>

                    {/* Type */}
                    <span className="badge badge-gray text-[10px] w-fit">{field.type}</span>

                    {/* Fill rate */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            field.fillRate >= 70 ? "bg-emerald-500" :
                            field.fillRate >= 40 ? "bg-amber-400" :
                            field.fillRate >= 10 ? "bg-orange-400" : "bg-gray-300"
                          )}
                          style={{ width: `${field.fillRate}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-[11px] font-medium min-w-[32px] text-right",
                        field.fillRate >= 70 ? "text-emerald-600" :
                        field.fillRate >= 40 ? "text-amber-600" :
                        field.fillRate >= 10 ? "text-orange-600" : "text-gray-400"
                      )}>
                        {field.fillRate}%
                      </span>
                    </div>

                    {/* Show in card */}
                    <div className="text-center">
                      {field.source === "custom" ? (
                        <button
                          onClick={() => handleToggle(field, "showInCard")}
                          className={cn("p-1 rounded", field.showInCard ? "text-brand-600 bg-brand-50" : "text-gray-300 hover:text-gray-400")}
                        >
                          {field.showInCard ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      ) : field.showInCard ? (
                        <Eye size={13} className="text-gray-300 mx-auto" />
                      ) : (
                        <EyeOff size={13} className="text-gray-200 mx-auto" />
                      )}
                    </div>

                    {/* Show in list */}
                    <div className="text-center">
                      {field.source === "custom" ? (
                        <button
                          onClick={() => handleToggle(field, "showInList")}
                          className={cn("p-1 rounded", field.showInList ? "text-brand-600 bg-brand-50" : "text-gray-300 hover:text-gray-400")}
                        >
                          {field.showInList ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      ) : field.showInList ? (
                        <Eye size={13} className="text-gray-300 mx-auto" />
                      ) : (
                        <EyeOff size={13} className="text-gray-200 mx-auto" />
                      )}
                    </div>

                    {/* Actions */}
                    <div>
                      {field.source === "unmapped" && (
                        <button
                          onClick={() => handleQuickMap(field)}
                          disabled={isPending}
                          className="p-1 rounded hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600"
                          title="Configurer rapidement"
                        >
                          <Zap size={13} />
                        </button>
                      )}
                      {field.source === "custom" && (
                        <button
                          onClick={() => handleDelete(field)}
                          disabled={isPending}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {filteredFields.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Database size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun champ trouvé</p>
        </div>
      )}
    </div>
  );
}
