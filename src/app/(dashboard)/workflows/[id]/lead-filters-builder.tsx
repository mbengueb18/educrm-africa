"use client";

import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterRule {
  field?: string;
  operator?: string;
  value?: string;
  operator_group?: "AND" | "OR";
  rules?: FilterRule[];
}

export interface FilterGroup {
  operator: "AND" | "OR";
  rules: FilterRule[];
}

const FIELDS = [
  { key: "source", label: "Source", type: "select", options: [
    { value: "WEBSITE", label: "Site web" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "PHONE_CALL", label: "Appel" },
    { value: "WALK_IN", label: "Visite" },
    { value: "REFERRAL", label: "Parrainage" },
    { value: "SALON", label: "Salon" },
    { value: "PARTNER", label: "Partenaire" },
  ]},
  { key: "programId", label: "Filière", type: "select_dynamic", source: "programs" },
  { key: "campusId", label: "Campus", type: "select_dynamic", source: "campuses" },
  { key: "city", label: "Ville", type: "text" },
  { key: "score", label: "Score", type: "number" },
  { key: "stageId", label: "Étape", type: "select_dynamic", source: "stages" },
];

const OPERATORS = [
  { key: "equals", label: "est égal à" },
  { key: "not_equals", label: "n'est pas égal à" },
  { key: "contains", label: "contient" },
  { key: "greater_than", label: "supérieur à" },
  { key: "less_than", label: "inférieur à" },
  { key: "exists", label: "existe" },
];

interface BuilderProps {
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  programs?: { id: string; name: string }[];
  campuses?: { id: string; name: string }[];
  stages?: { id: string; name: string }[];
  level?: number;
}

export function LeadFiltersBuilder({
  filters,
  onChange,
  programs = [],
  campuses = [],
  stages = [],
  level = 0,
}: BuilderProps) {
  const updateGroup = (newOp: "AND" | "OR") => {
    onChange({ ...filters, operator: newOp });
  };

  const addRule = () => {
    onChange({
      ...filters,
      rules: [...filters.rules, { field: "source", operator: "equals", value: "" }],
    });
  };

  const addGroup = () => {
    onChange({
      ...filters,
      rules: [...filters.rules, { operator_group: "AND", rules: [{ field: "source", operator: "equals", value: "" }] }],
    });
  };

  const updateRule = (index: number, newRule: FilterRule) => {
    const newRules = [...filters.rules];
    newRules[index] = newRule;
    onChange({ ...filters, rules: newRules });
  };

  const removeRule = (index: number) => {
    onChange({ ...filters, rules: filters.rules.filter((_, i) => i !== index) });
  };

  const getDynamicOptions = (source: string) => {
    if (source === "programs") return programs.map((p) => ({ value: p.id, label: p.name }));
    if (source === "campuses") return campuses.map((c) => ({ value: c.id, label: c.name }));
    if (source === "stages") return stages.map((s) => ({ value: s.id, label: s.name }));
    return [];
  };

  return (
    <div className={cn("border-l-2 pl-3 py-2", level === 0 ? "border-brand-200" : "border-gray-200")}>
      {/* Group operator selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Combiner avec :</span>
        <div className="flex bg-gray-100 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => updateGroup("AND")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
              filters.operator === "AND" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            ET
          </button>
          <button
            type="button"
            onClick={() => updateGroup("OR")}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded font-medium transition-colors",
              filters.operator === "OR" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            OU
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-1.5">
        {filters.rules.map((rule, index) => {
          // Group (nested)
          if (rule.operator_group) {
            return (
              <div key={index} className="bg-gray-50 rounded-lg p-2 relative">
                <button
                  onClick={() => removeRule(index)}
                  className="absolute top-1 right-1 p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  title="Supprimer le groupe"
                >
                  <Trash2 size={11} />
                </button>
                <LeadFiltersBuilder
                  filters={{ operator: rule.operator_group, rules: rule.rules || [] }}
                  onChange={(g) => updateRule(index, { operator_group: g.operator, rules: g.rules })}
                  programs={programs}
                  campuses={campuses}
                  stages={stages}
                  level={level + 1}
                />
              </div>
            );
          }

          // Simple rule
          const fieldDef = FIELDS.find((f) => f.key === rule.field);
          return (
            <div key={index} className="flex items-center gap-1.5">
              <select
                value={rule.field || "source"}
                onChange={(e) => updateRule(index, { ...rule, field: e.target.value, value: "" })}
                className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
              >
                {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              <select
                value={rule.operator || "equals"}
                onChange={(e) => updateRule(index, { ...rule, operator: e.target.value })}
                className="input text-[11px] py-1 px-1.5 w-28"
              >
                {OPERATORS.map((op) => <option key={op.key} value={op.key}>{op.label}</option>)}
              </select>

              {rule.operator !== "exists" && (
                <>
                  {fieldDef?.type === "select" && (
                    <select
                      value={rule.value || ""}
                      onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                      className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
                    >
                      <option value="">Sélectionner...</option>
                      {fieldDef.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  )}
                  {fieldDef?.type === "select_dynamic" && (
                    <select
                      value={rule.value || ""}
                      onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                      className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
                    >
                      <option value="">Sélectionner...</option>
                      {getDynamicOptions(fieldDef.source!).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  )}
                  {fieldDef?.type === "text" && (
                    <input
                      type="text"
                      value={rule.value || ""}
                      onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                      className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
                      placeholder="Valeur"
                    />
                  )}
                  {fieldDef?.type === "number" && (
                    <input
                      type="number"
                      value={rule.value || ""}
                      onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                      className="input text-[11px] py-1 px-1.5 w-20"
                      placeholder="0"
                    />
                  )}
                </>
              )}

              <button
                onClick={() => removeRule(index)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add buttons */}
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={addRule}
          className="text-[10px] text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
        >
          <Plus size={10} /> Ajouter une condition
        </button>
        {level < 2 && (
          <button
            onClick={addGroup}
            className="text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
          >
            <Plus size={10} /> Ajouter un groupe
          </button>
        )}
      </div>
    </div>
  );
}