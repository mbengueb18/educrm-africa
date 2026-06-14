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

const GROUP_LABELS: Record<string, string> = {
  contact: "👤 Contact",
  acquisition: "📣 Acquisition",
  formation: "🎓 Formation",
  pipeline: "📊 Pipeline",
  custom: "⚙️ Personnalisés",
  unmapped: "❓ Non mappés",
};

const GROUP_ORDER = ["contact", "acquisition", "formation", "pipeline", "custom", "unmapped"];

const OPERATORS_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  text: [
    { key: "equals", label: "est égal à" },
    { key: "not_equals", label: "n'est pas égal à" },
    { key: "contains", label: "contient" },
    { key: "starts_with", label: "commence par" },
    { key: "exists", label: "existe" },
    { key: "not_exists", label: "n'existe pas" },
  ],
  email: [
    { key: "equals", label: "est égal à" },
    { key: "contains", label: "contient" },
    { key: "exists", label: "existe" },
    { key: "not_exists", label: "n'existe pas" },
  ],
  phone: [
    { key: "equals", label: "est égal à" },
    { key: "contains", label: "contient" },
    { key: "exists", label: "existe" },
    { key: "not_exists", label: "n'existe pas" },
  ],
  number: [
    { key: "equals", label: "est égal à" },
    { key: "not_equals", label: "différent de" },
    { key: "greater_than", label: "supérieur à" },
    { key: "less_than", label: "inférieur à" },
    { key: "exists", label: "existe" },
  ],
  select: [
    { key: "equals", label: "est égal à" },
    { key: "not_equals", label: "n'est pas égal à" },
    { key: "exists", label: "existe" },
  ],
  date: [
    { key: "equals", label: "le" },
    { key: "greater_than", label: "après" },
    { key: "less_than", label: "avant" },
    { key: "exists", label: "existe" },
  ],
  json: [
    { key: "equals", label: "est égal à" },
    { key: "contains", label: "contient" },
    { key: "exists", label: "existe" },
  ],
};

const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE_CALL", label: "Appel" },
  { value: "WALK_IN", label: "Visite" },
  { value: "REFERRAL", label: "Parrainage" },
  { value: "SALON", label: "Salon" },
  { value: "PARTNER", label: "Partenaire" },
];

interface FieldDef {
  key: string;
  label: string;
  group: string;
  type: string;
  source: string;
}

interface BuilderProps {
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  programs?: { id: string; name: string }[];
  campuses?: { id: string; name: string }[];
  stages?: { id: string; name: string }[];
  users?: { id: string; name: string | null }[];
  fields?: FieldDef[];
  level?: number;
}

export function LeadFiltersBuilder({
  filters,
  onChange,
  programs = [],
  campuses = [],
  stages = [],
  users = [],
  fields = [],
  level = 0,
}: BuilderProps) {
  const updateGroup = (newOp: "AND" | "OR") => {
    onChange({ ...filters, operator: newOp });
  };

  const addRule = () => {
    onChange({
      ...filters,
      rules: [...filters.rules, { field: fields[0]?.key || "source", operator: "equals", value: "" }],
    });
  };

  const addGroup = () => {
    onChange({
      ...filters,
      rules: [...filters.rules, { operator_group: "AND", rules: [{ field: fields[0]?.key || "source", operator: "equals", value: "" }] }],
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

  const getValueOptions = (fieldKey: string): { value: string; label: string }[] => {
    if (fieldKey === "source") return SOURCE_OPTIONS;
    if (fieldKey === "programId") return programs.map((p) => ({ value: p.id, label: p.name }));
    if (fieldKey === "campusId") return campuses.map((c) => ({ value: c.id, label: c.name }));
    if (fieldKey === "stageId") return stages.map((s) => ({ value: s.id, label: s.name }));
    if (fieldKey === "assignedToId") return users.map((u) => ({ value: u.id, label: u.name || "Sans nom" }));

    // Custom field with options
    const fieldDef = fields.find((f) => f.key === fieldKey);
    if (fieldDef?.type === "select") {
      // For custom fields with options, look at sampleValues or rely on text
      return [];
    }
    return [];
  };

  const getInputType = (fieldKey: string): string => {
    const fieldDef = fields.find((f) => f.key === fieldKey);
    if (!fieldDef) return "text";
    if (fieldKey === "source" || fieldKey === "programId" || fieldKey === "campusId" || fieldKey === "stageId" || fieldKey === "assignedToId") {
      return "select";
    }
    if (fieldDef.type === "number") return "number";
    if (fieldDef.type === "date") return "date";
    if (fieldDef.type === "email") return "email";
    return "text";
  };

  // Group fields by category
  const fieldsByGroup: Record<string, FieldDef[]> = {};
  fields.forEach((f) => {
    if (!fieldsByGroup[f.group]) fieldsByGroup[f.group] = [];
    fieldsByGroup[f.group].push(f);
  });

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
      <div className="space-y-2">
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
                  users={users}
                  fields={fields}
                  level={level + 1}
                />
              </div>
            );
          }

          // Simple rule
          const inputType = getInputType(rule.field || "source");
          const valueOptions = getValueOptions(rule.field || "source");
          const fieldDef = fields.find((f) => f.key === rule.field);
          const operators = OPERATORS_BY_TYPE[fieldDef?.type || "text"] || OPERATORS_BY_TYPE.text;

          return (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
              {/* Field selector with optgroup */}
              <select
                value={rule.field || "source"}
                onChange={(e) => updateRule(index, { ...rule, field: e.target.value, value: "", operator: "equals" })}
                className="input text-[11px] py-1 px-1.5 w-full"
              >
                {GROUP_ORDER.filter((g) => fieldsByGroup[g]?.length > 0).map((groupKey) => (
                  <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
                    {fieldsByGroup[groupKey].map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                {/* Operator */}
                <select
                  value={rule.operator || "equals"}
                  onChange={(e) => updateRule(index, { ...rule, operator: e.target.value })}
                  className="input text-[11px] py-1 px-1.5 w-32 shrink-0"
                >
                  {operators.map((op) => <option key={op.key} value={op.key}>{op.label}</option>)}
                </select>

                {/* Value */}
                {rule.operator !== "exists" && rule.operator !== "not_exists" && (
                  <>
                    {inputType === "select" && valueOptions.length > 0 ? (
                      <select
                        value={rule.value || ""}
                        onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                        className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
                      >
                        <option value="">Sélectionner...</option>
                        {valueOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={inputType === "number" ? "number" : inputType === "date" ? "date" : "text"}
                        value={rule.value || ""}
                        onChange={(e) => updateRule(index, { ...rule, value: e.target.value })}
                        className="input text-[11px] py-1 px-1.5 flex-1 min-w-0"
                        placeholder="Valeur"
                      />
                    )}
                  </>
                )}

                <button
                  onClick={() => removeRule(index)}
                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
                  title="Supprimer"
                >
                  <X size={12} />
                </button>
              </div>
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
          <Plus size={10} /> Condition
        </button>
        {level < 2 && (
          <button
            onClick={addGroup}
            className="text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
          >
            <Plus size={10} /> Groupe ET/OU
          </button>
        )}
      </div>
    </div>
  );
}