"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { previewAudienceRules, getFilterOptions } from "@/app/(dashboard)/audiences/actions";
import {
  Plus, X, Trash2, ChevronDown, Sparkles, Loader2, Eye,
  Layers, AlertCircle,
} from "lucide-react";

// ─── Types ───
export interface FilterRule {
  field: string;
  operator: string;
  value?: any;
}

export interface FilterGroup {
  operator: "AND" | "OR";
  rules: (FilterRule | FilterGroup)[];
}

interface FilterOptions {
  stages: Array<{ id: string; name: string; pipelineId: string | null }>;
  pipelines: Array<{ id: string; name: string; formationType: string | null }>;
  programs: Array<{ id: string; name: string; code: string | null; formationType: string | null }>;
  campuses: Array<{ id: string; name: string; city: string }>;
  users: Array<{ id: string; name: string }>;
}

interface RuleBuilderProps {
  initialRules: FilterGroup;
  onSave: (rules: FilterGroup) => void;
  onCancel: () => void;
}

// ─── Définition des champs filtrables ───
const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE_CALL", label: "Appel" },
  { value: "WALK_IN", label: "Visite" },
  { value: "REFERRAL", label: "Parrainage" },
  { value: "SALON", label: "Salon" },
  { value: "RADIO", label: "Radio" },
  { value: "TV", label: "TV" },
  { value: "PARTNER", label: "Partenaire" },
  { value: "IMPORT", label: "Import" },
  { value: "OTHER", label: "Autre" },
];

type FieldType = "text" | "select" | "number" | "date" | "boolean";

interface FieldDefinition {
  value: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  category: string;
}

function getFieldDefinitions(opts: FilterOptions): FieldDefinition[] {
  return [
    // Identité
    { value: "firstName", label: "Prénom", type: "text", category: "Identité" },
    { value: "lastName", label: "Nom", type: "text", category: "Identité" },
    { value: "email", label: "Email", type: "text", category: "Identité" },
    { value: "phone", label: "Téléphone", type: "text", category: "Identité" },
    { value: "city", label: "Ville", type: "text", category: "Identité" },

    // Acquisition
    { value: "source", label: "Source", type: "select", options: SOURCE_OPTIONS, category: "Acquisition" },
    { value: "sourceDetail", label: "Détail source", type: "text", category: "Acquisition" },

    // Scoring
    { value: "score", label: "Score", type: "number", category: "Scoring" },

    // Pipeline
    {
      value: "stageId",
      label: "Étape",
      type: "select",
      options: opts.stages.map(s => ({ value: s.id, label: s.name })),
      category: "Pipeline",
    },
    {
      value: "pipelineId",
      label: "Pipeline",
      type: "select",
      options: opts.pipelines.map(p => ({
        value: p.id,
        label: p.name + (p.formationType ? ` (${p.formationType === "INITIAL" ? "FI" : "FC"})` : "")
      })),
      category: "Pipeline",
    },

    // Filière / Campus
    {
      value: "programId",
      label: "Filière",
      type: "select",
      options: opts.programs.map(p => ({
        value: p.id,
        label: p.name + (p.formationType ? ` (${p.formationType === "INITIAL" ? "FI" : "FC"})` : "")
      })),
      category: "Filière",
    },
    {
      value: "program.formationType",
      label: "Type de formation",
      type: "select",
      options: [
        { value: "INITIAL", label: "Formation Initiale (FI)" },
        { value: "CONTINUE", label: "Formation Continue (FC)" },
      ],
      category: "Filière",
    },
    {
      value: "campusId",
      label: "Campus",
      type: "select",
      options: opts.campuses.map(c => ({
        value: c.id,
        label: `${c.name} — ${c.city}`,
      })),
      category: "Filière",
    },

    // Assignation
    {
      value: "assignedToId",
      label: "Conseiller assigné",
      type: "select",
      options: opts.users.map(u => ({ value: u.id, label: u.name })),
      category: "Assignation",
    },

    // Dates
    { value: "createdAt", label: "Date de création", type: "date", category: "Dates" },
    { value: "convertedAt", label: "Date de conversion", type: "date", category: "Dates" },

    // Statut
    { value: "isConverted", label: "Est converti", type: "boolean", category: "Statut" },
  ];
}

// ─── Opérateurs par type ───
function getOperatorsForType(type: FieldType): Array<{ value: string; label: string }> {
  const base = [
    { value: "exists", label: "est renseigné" },
    { value: "not_exists", label: "n'est pas renseigné" },
  ];
  switch (type) {
    case "text":
      return [
        { value: "equals", label: "est" },
        { value: "not_equals", label: "n'est pas" },
        { value: "contains", label: "contient" },
        { value: "not_contains", label: "ne contient pas" },
        { value: "starts_with", label: "commence par" },
        { value: "ends_with", label: "se termine par" },
        ...base,
      ];
    case "select":
      return [
        { value: "equals", label: "est" },
        { value: "not_equals", label: "n'est pas" },
        { value: "in", label: "est l'un de" },
        { value: "not_in", label: "n'est aucun de" },
        ...base,
      ];
    case "number":
      return [
        { value: "equals", label: "est égal à" },
        { value: "not_equals", label: "est différent de" },
        { value: "greater_than", label: "est supérieur à" },
        { value: "less_than", label: "est inférieur à" },
        ...base,
      ];
    case "date":
      return [
        { value: "greater_than", label: "est après" },
        { value: "less_than", label: "est avant" },
        ...base,
      ];
    case "boolean":
      return [{ value: "equals", label: "est" }];
    default:
      return base;
  }
}

// ─── Composant principal ───
export function RuleBuilder({ initialRules, onSave, onCancel }: RuleBuilderProps) {
  const [rules, setRules] = useState<FilterGroup>(initialRules);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Charger les options des selects
  useEffect(() => {
    getFilterOptions()
      .then(opts => {
        setOptions(opts);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Erreur lors du chargement des options");
        setLoading(false);
      });
  }, []);

  // Auto-preview (debounced)
  useEffect(() => {
    if (!options) return;
    const timeout = setTimeout(() => {
      runPreview();
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, options]);

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await previewAudienceRules(rules);
      setPreview(result);
    } catch (err: any) {
      // silent fail
    }
    setPreviewLoading(false);
  };

  if (loading || !options) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-3" />
        <span className="text-sm">Chargement des champs...</span>
      </div>
    );
  }

  const fieldDefs = getFieldDefinitions(options);

  return (
    <div className="space-y-4">
      {/* Builder */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-violet-50 border-b border-violet-200 p-3 flex items-center gap-2">
          <Sparkles size={14} className="text-violet-600" />
          <p className="text-xs font-semibold text-violet-900">
            Configurez les critères de sélection des leads
          </p>
        </div>
        <div className="p-4">
          <GroupEditor
            group={rules}
            fieldDefs={fieldDefs}
            depth={0}
            onChange={setRules}
            isRoot
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-brand-500" />
            <p className="text-sm font-semibold text-gray-900">Prévisualisation</p>
          </div>
          {previewLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        {preview ? (
          <>
            <p className="text-sm text-gray-700 mb-3">
              <span className="text-2xl font-bold text-brand-600">{preview.count}</span>
              <span className="ml-2 text-gray-500">
                lead{preview.count > 1 ? "s" : ""} correspond{preview.count > 1 ? "ent" : ""} aux règles
              </span>
            </p>
            {preview.sample.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Aperçu (5 premiers)
                </p>
                {preview.sample.slice(0, 5).map((lead: any) => (
                  <div key={lead.id} className="flex items-center gap-2 text-xs py-1 px-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </span>
                    {lead.email && <span className="text-gray-500 truncate">· {lead.email}</span>}
                  </div>
                ))}
              </div>
            )}
            {preview.count === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Aucun lead ne correspond à ces règles. Vérifiez vos critères.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">En attente de calcul...</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary py-2 px-4 text-xs">
          Annuler
        </button>
        <button
          onClick={() => onSave(rules)}
          className="btn-primary py-2 px-4 text-xs"
          disabled={!preview}
        >
          <Sparkles size={12} /> Enregistrer les règles
        </button>
      </div>
    </div>
  );
}

// ─── Éditeur de groupe (récursif pour les groupes imbriqués) ───
function GroupEditor({ group, fieldDefs, depth, onChange, isRoot }: {
  group: FilterGroup;
  fieldDefs: FieldDefinition[];
  depth: number;
  onChange: (group: FilterGroup) => void;
  isRoot?: boolean;
}) {
  const updateOperator = (op: "AND" | "OR") => {
    onChange({ ...group, operator: op });
  };

  const addRule = () => {
    const firstField = fieldDefs[0];
    const firstOperator = getOperatorsForType(firstField.type)[0];
    const newRule: FilterRule = {
      field: firstField.value,
      operator: firstOperator.value,
      value: "",
    };
    onChange({ ...group, rules: [...group.rules, newRule] });
  };

  const addGroup = () => {
    if (depth >= 2) {
      toast.error("Maximum 3 niveaux d'imbrication");
      return;
    }
    const newGroup: FilterGroup = {
      operator: "AND",
      rules: [],
    };
    onChange({ ...group, rules: [...group.rules, newGroup] });
  };

  const updateChild = (index: number, child: FilterRule | FilterGroup) => {
    const next = [...group.rules];
    next[index] = child;
    onChange({ ...group, rules: next });
  };

  const removeChild = (index: number) => {
    const next = group.rules.filter((_, i) => i !== index);
    onChange({ ...group, rules: next });
  };

  return (
    <div
      className={cn(
        "rounded-lg",
        !isRoot && "border border-gray-200 bg-gray-50/50 p-3"
      )}
    >
      {/* Operator selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500">
          {isRoot ? "Sélectionner les leads quand" : "Et que"}
        </span>
        <select
          value={group.operator}
          onChange={e => updateOperator(e.target.value as "AND" | "OR")}
          className="input py-0.5 px-2 text-xs font-bold"
        >
          <option value="AND">TOUTES les conditions sont vraies</option>
          <option value="OR">AU MOINS UNE condition est vraie</option>
        </select>
      </div>

      {/* Rules + nested groups */}
      <div className="space-y-2">
        {group.rules.length === 0 && (
          <p className="text-xs text-gray-400 italic py-2">Aucune règle. Ajoutez une condition.</p>
        )}
        {group.rules.map((child, index) => {
          const isGroup = "operator" in child && "rules" in child;
          return (
            <div key={index} className="flex items-start gap-2">
              {/* Connector */}
              {index > 0 && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3 w-8 shrink-0 text-center">
                  {group.operator === "AND" ? "ET" : "OU"}
                </div>
              )}
              {index === 0 && <div className="w-8 shrink-0" />}

              <div className="flex-1 min-w-0">
                {isGroup ? (
                  <GroupEditor
                    group={child as FilterGroup}
                    fieldDefs={fieldDefs}
                    depth={depth + 1}
                    onChange={c => updateChild(index, c)}
                  />
                ) : (
                  <RuleEditor
                    rule={child as FilterRule}
                    fieldDefs={fieldDefs}
                    onChange={r => updateChild(index, r)}
                  />
                )}
              </div>

              <button
                onClick={() => removeChild(index)}
                className="mt-1.5 p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0"
                title="Supprimer"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add buttons */}
      <div className="flex items-center gap-2 mt-3 pl-10">
        <button
          onClick={addRule}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          <Plus size={11} /> Ajouter une règle
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="text-xs font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1"
          >
            <Layers size={11} /> Ajouter un groupe
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Éditeur d'une règle individuelle ───
function RuleEditor({ rule, fieldDefs, onChange }: {
  rule: FilterRule;
  fieldDefs: FieldDefinition[];
  onChange: (rule: FilterRule) => void;
}) {
  const currentField = fieldDefs.find(f => f.value === rule.field) || fieldDefs[0];
  const operators = getOperatorsForType(currentField.type);
  const currentOperator = operators.find(o => o.value === rule.operator) || operators[0];

  const needsValue = !["exists", "not_exists"].includes(rule.operator);

  // Reset operator + value si on change de champ et que l'opérateur n'est plus valide
  const handleFieldChange = (newField: string) => {
    const newFieldDef = fieldDefs.find(f => f.value === newField);
    if (!newFieldDef) return;
    const newOperators = getOperatorsForType(newFieldDef.type);
    const operatorStillValid = newOperators.find(o => o.value === rule.operator);
    onChange({
      field: newField,
      operator: operatorStillValid ? rule.operator : newOperators[0].value,
      value: "",
    });
  };

  // Grouper les champs par catégorie pour le select
  const fieldsByCategory: Record<string, FieldDefinition[]> = {};
  fieldDefs.forEach(f => {
    if (!fieldsByCategory[f.category]) fieldsByCategory[f.category] = [];
    fieldsByCategory[f.category].push(f);
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
      {/* Champ */}
      <select
        value={rule.field}
        onChange={e => handleFieldChange(e.target.value)}
        className="input py-1 px-2 text-xs min-w-[140px]"
      >
        {Object.entries(fieldsByCategory).map(([cat, fields]) => (
          <optgroup key={cat} label={cat}>
            {fields.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Opérateur */}
      <select
        value={rule.operator}
        onChange={e => onChange({ ...rule, operator: e.target.value })}
        className="input py-1 px-2 text-xs min-w-[120px]"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Valeur (selon type) */}
      {needsValue && (
        <ValueInput
          field={currentField}
          operator={rule.operator}
          value={rule.value}
          onChange={v => onChange({ ...rule, value: v })}
        />
      )}
    </div>
  );
}

// ─── Input de valeur (select, text, number, date, boolean) ───
function ValueInput({ field, operator, value, onChange }: {
  field: FieldDefinition;
  operator: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const isMulti = operator === "in" || operator === "not_in";

  if (field.type === "boolean") {
    return (
      <select
        value={String(value ?? "true")}
        onChange={e => onChange(e.target.value === "true")}
        className="input py-1 px-2 text-xs min-w-[100px]"
      >
        <option value="true">vrai</option>
        <option value="false">faux</option>
      </select>
    );
  }

  if (field.type === "select" && field.options) {
    if (isMulti) {
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {field.options.map(opt => (
            <label
              key={opt.value}
              className={cn(
                "text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors",
                selected.includes(opt.value)
                  ? "bg-brand-100 text-brand-700 border-brand-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={selected.includes(opt.value)}
                onChange={e => {
                  if (e.target.checked) {
                    onChange([...selected, opt.value]);
                  } else {
                    onChange(selected.filter(v => v !== opt.value));
                  }
                }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }
    return (
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className="input py-1 px-2 text-xs min-w-[140px]"
      >
        <option value="">— Sélectionner —</option>
        {field.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="input py-1 px-2 text-xs w-24"
      />
    );
  }

  if (field.type === "date") {
    return (
      <input
        type="date"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        className="input py-1 px-2 text-xs"
      />
    );
  }

  // text
  return (
    <input
      type="text"
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder="Valeur..."
      className="input py-1 px-2 text-xs min-w-[140px]"
    />
  );
}