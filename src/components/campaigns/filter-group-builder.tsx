"use client";

import { Plus, X, Filter, FolderPlus } from "lucide-react";
import type { CustomFieldConfig } from "@/lib/custom-fields";

// ─── Types (alignés sur lead-filters.ts) ───
export type FilterRule = { field: string; operator: string; value: any };
export type FilterGroup = { operator: "AND" | "OR"; rules: (FilterRule | FilterGroup)[] };

function isGroup(node: any): node is FilterGroup {
  return node && typeof node === "object" && Array.isArray(node.rules);
}

interface FieldOption {
  value: string;
  label: string;
  type: "select" | "text" | "number" | "date" | "activity" | "activity-date" | "audience";
  options?: { value: string; label: string }[];
}

interface BuilderProps {
  group: FilterGroup;
  onChange: (group: FilterGroup) => void;
  stages: { id: string; name: string; color: string }[];
  programs: { id: string; name: string; code: string | null }[];
  audiences: { id: string; name: string; type: string }[];
  users: { id: string; name: string }[];
  customFields: CustomFieldConfig[];
  hiddenCategories?: string[];
  // Message affiché quand aucun critère n'est défini (dépend du contexte : email, WhatsApp, audience)
  emptyHint?: string;
}

var SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE_CALL", label: "Appel téléphonique" },
  { value: "WALK_IN", label: "Visite spontanée" },
  { value: "REFERRAL", label: "Parrainage" },
  { value: "SALON", label: "Salon" },
  { value: "RADIO", label: "Radio" },
  { value: "TV", label: "TV" },
  { value: "PARTNER", label: "Partenaire" },
  { value: "IMPORT", label: "Import" },
  { value: "OTHER", label: "Autre" },
];

// ─── Construit la liste des champs disponibles, par catégorie ───
function buildFieldCatalog(props: BuilderProps): { category: string; fields: FieldOption[] }[] {
  var standard: FieldOption[] = [
    { value: "stageId", label: "Étape", type: "select", options: props.stages.map(function(s) { return { value: s.id, label: s.name }; }) },
    { value: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
    { value: "programId", label: "Filière", type: "select", options: props.programs.map(function(p) { return { value: p.id, label: (p.code ? p.code + " — " : "") + p.name }; }) },
    { value: "assignedToId", label: "Assigné à", type: "select", options: props.users.map(function(u) { return { value: u.id, label: u.name }; }) },
    { value: "score", label: "Score", type: "number" },
    { value: "city", label: "Ville", type: "text" },
    { value: "createdAt", label: "Date de création", type: "date" },
  ];

  // Custom fields → préfixe "custom:" sauf si mappés sur un standard
  var custom: FieldOption[] = props.customFields
    .filter(function(cf) { return cf.target !== "standard"; })
    .map(function(cf) {
      var t: FieldOption["type"] = cf.type === "number" ? "number" : cf.type === "date" ? "date" : cf.type === "select" ? "select" : "text";
      return {
        value: "custom:" + cf.key,
        label: cf.label,
        type: t,
        options: cf.type === "select" && cf.options ? cf.options.map(function(o) { return { value: o, label: o }; }) : undefined,
      };
    });

  var activity: FieldOption[] = [
    { value: "activity:has_message", label: "A au moins un message (envoyé ou reçu)", type: "activity" },
    { value: "activity:no_message", label: "N'a aucun message (ni envoyé ni reçu)", type: "activity" },
    { value: "activity:has_inbound", label: "A répondu (message reçu)", type: "activity" },
    { value: "activity:no_inbound", label: "N'a jamais répondu", type: "activity" },
    { value: "activity:last_message_after", label: "Message échangé depuis le", type: "activity-date" },
    { value: "activity:last_message_before", label: "Aucun message depuis le", type: "activity-date" },
  ];

  var audience: FieldOption[] = [
    { value: "audience", label: "Appartient à une audience", type: "audience", options: props.audiences.map(function(a) { return { value: a.id, label: a.name }; }) },
  ];

  var hidden = props.hiddenCategories || [];
  return [
    { category: "Champs standards", fields: standard },
    { category: "Champs personnalisés", fields: custom },
    { category: "Activité", fields: activity },
    { category: "Audience", fields: audience },
  ].filter(function(g) { return g.fields.length > 0 && hidden.indexOf(g.category) === -1; });
}

// ─── Opérateurs disponibles selon le type de champ ───
function operatorsForField(fieldDef: FieldOption | undefined): { value: string; label: string }[] {
  if (!fieldDef) return [{ value: "equals", label: "est" }];

  if (fieldDef.type === "activity" || fieldDef.type === "activity-date") {
    // Les champs d'activité n'ont pas d'opérateur (ils SONT la condition).
    // activity-date attend juste une date ; activity est une condition seule.
    return [];
  }
  if (fieldDef.type === "audience") {
    return [
      { value: "in_audience", label: "dans" },
      { value: "not_in_audience", label: "pas dans" },
    ];
  }
  if (fieldDef.type === "select") {
    return [
      { value: "equals", label: "est" },
      { value: "not_equals", label: "n'est pas" },
      { value: "exists", label: "est renseigné" },
      { value: "not_exists", label: "est vide" },
    ];
  }
  if (fieldDef.type === "number") {
    return [
      { value: "equals", label: "égal à" },
      { value: "gt", label: "supérieur à" },
      { value: "lt", label: "inférieur à" },
      { value: "gte", label: "≥" },
      { value: "lte", label: "≤" },
      { value: "exists", label: "est renseigné" },
      { value: "not_exists", label: "est vide" },
    ];
  }
  if (fieldDef.type === "date") {
    return [
      { value: "today", label: "aujourd'hui" },
      { value: "yesterday", label: "hier" },
      { value: "this_week", label: "cette semaine" },
      { value: "this_month", label: "ce mois-ci" },
      { value: "last_month", label: "le mois dernier" },
      { value: "last_n_days", label: "X derniers jours" },
      { value: "gte", label: "après le" },
      { value: "lte", label: "avant le" },
      { value: "exists", label: "est renseigné" },
      { value: "not_exists", label: "est vide" },
    ];
  }
  // text
  return [
    { value: "equals", label: "est" },
    { value: "not_equals", label: "n'est pas" },
    { value: "contains", label: "contient" },
    { value: "exists", label: "est renseigné" },
    { value: "not_exists", label: "est vide" },
  ];
}

// Champs "activity" qui sont des conditions directes (pas de valeur)
var STANDALONE_ACTIVITY = ["activity:has_message", "activity:no_message", "activity:has_inbound", "activity:no_inbound"];

// ─── Une ligne de règle ───
function RuleRow({ rule, catalog, onChange, onRemove }: {
  rule: FilterRule;
  catalog: { category: string; fields: FieldOption[] }[];
  onChange: (r: FilterRule) => void;
  onRemove: () => void;
}) {
  var allFields: FieldOption[] = [];
  catalog.forEach(function(c) { allFields = allFields.concat(c.fields); });
  var fieldDef = allFields.find(function(f) { return f.value === rule.field; });
  var operators = operatorsForField(fieldDef);
  var isStandalone = STANDALONE_ACTIVITY.indexOf(rule.field) !== -1;
  var noValueOps = ["exists", "not_exists", "today", "yesterday", "this_week", "this_month", "last_month"];
  var needsNoValue = isStandalone || noValueOps.indexOf(rule.operator) !== -1;

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-gray-200">
      {/* Champ (avec optgroups) */}
      <select
        value={rule.field}
        onChange={function(e) {
          var newField = e.target.value;
          var newDef = allFields.find(function(f) { return f.value === newField; });
          var newOps = operatorsForField(newDef);
          onChange({ field: newField, operator: newOps[0] ? newOps[0].value : "equals", value: "" });
        }}
        className="input text-sm py-1.5 w-40 shrink-0"
      >
        {catalog.map(function(cat) {
          return (
            <optgroup key={cat.category} label={cat.category}>
              {cat.fields.map(function(f) {
                return <option key={f.value} value={f.value}>{f.label}</option>;
              })}
            </optgroup>
          );
        })}
      </select>

      {/* Opérateur (sauf champs standalone) */}
      {operators.length > 0 && (
        <select
          value={rule.operator}
          onChange={function(e) { onChange({ ...rule, operator: e.target.value }); }}
          className="input text-sm py-1.5 w-32 shrink-0"
        >
          {operators.map(function(op) {
            return <option key={op.value} value={op.value}>{op.label}</option>;
          })}
        </select>
      )}

      {/* Valeur (sauf si pas nécessaire) */}
      {!needsNoValue && fieldDef && (
        rule.operator === "last_n_days" ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="number"
              min="1"
              value={rule.value}
              onChange={function(e) { onChange({ ...rule, value: e.target.value }); }}
              className="input text-sm py-1.5 w-24"
              placeholder="7"
            />
            <span className="text-xs text-gray-500">jours</span>
          </div>
        ) : fieldDef.options && fieldDef.options.length > 0 ? (
          <select
            value={rule.value}
            onChange={function(e) { onChange({ ...rule, value: e.target.value }); }}
            className="input text-sm py-1.5 flex-1"
          >
            <option value="">Choisir...</option>
            {fieldDef.options.map(function(o) {
              return <option key={o.value} value={o.value}>{o.label}</option>;
            })}
          </select>
        ) : (fieldDef.type === "date" || fieldDef.type === "activity-date") ? (
          <input
            type="date"
            value={rule.value}
            onChange={function(e) { onChange({ ...rule, value: e.target.value }); }}
            className="input text-sm py-1.5 flex-1"
          />
        ) : (
          <input
            type={fieldDef.type === "number" ? "number" : "text"}
            value={rule.value}
            onChange={function(e) { onChange({ ...rule, value: e.target.value }); }}
            className="input text-sm py-1.5 flex-1"
            placeholder="Valeur..."
          />
        )
      )}
      {needsNoValue && <div className="flex-1" />}

      <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Le builder principal ───
export function FilterGroupBuilder(props: BuilderProps) {
  var catalog = buildFieldCatalog(props);
  var group = props.group;

  function updateGroup(updates: Partial<FilterGroup>) {
    props.onChange({ ...group, ...updates });
  }

  function addRule() {
    var firstField = catalog[0].fields[0];
    var ops = operatorsForField(firstField);
    var newRule: FilterRule = { field: firstField.value, operator: ops[0] ? ops[0].value : "equals", value: "" };
    updateGroup({ rules: [...group.rules, newRule] });
  }

  function addSubGroup() {
    var firstField = catalog[0].fields[0];
    var ops = operatorsForField(firstField);
    var subGroup: FilterGroup = {
      operator: "OR",
      rules: [{ field: firstField.value, operator: ops[0] ? ops[0].value : "equals", value: "" }],
    };
    updateGroup({ rules: [...group.rules, subGroup] });
  }

  function updateNode(index: number, node: FilterRule | FilterGroup) {
    var next = [...group.rules];
    next[index] = node;
    updateGroup({ rules: next });
  }

  function removeNode(index: number) {
    updateGroup({ rules: group.rules.filter(function(_, i) { return i !== index; }) });
  }

  return (
    <div className="space-y-3">
      {/* Opérateur du groupe racine */}
      {group.rules.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Correspondre à</span>
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={function() { updateGroup({ operator: "AND" }); }}
              className={"px-3 py-1 rounded-md text-xs font-medium " + (group.operator === "AND" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500")}
            >
              TOUS les critères (ET)
            </button>
            <button
              onClick={function() { updateGroup({ operator: "OR" }); }}
              className={"px-3 py-1 rounded-md text-xs font-medium " + (group.operator === "OR" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500")}
            >
              AU MOINS UN (OU)
            </button>
          </div>
        </div>
      )}

      {/* Règles et sous-groupes */}
      {group.rules.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <Filter size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{props.emptyHint || "Aucun critère — tous les prospects correspondants seront inclus"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {group.rules.map(function(node, index) {
            if (isGroup(node)) {
              // Sous-groupe (2e niveau) — pas de sous-sous-groupe
              return (
                <div key={index} className="border-2 border-brand-100 rounded-xl p-3 bg-brand-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="inline-flex bg-white rounded-lg p-0.5 border border-gray-200">
                      <button
                        onClick={function() { updateNode(index, { ...node, operator: "AND" }); }}
                        className={"px-2.5 py-0.5 rounded text-[11px] font-medium " + (node.operator === "AND" ? "bg-brand-50 text-brand-700" : "text-gray-500")}
                      >
                        ET
                      </button>
                      <button
                        onClick={function() { updateNode(index, { ...node, operator: "OR" }); }}
                        className={"px-2.5 py-0.5 rounded text-[11px] font-medium " + (node.operator === "OR" ? "bg-brand-50 text-brand-700" : "text-gray-500")}
                      >
                        OU
                      </button>
                    </div>
                    <button onClick={function() { removeNode(index); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {node.rules.map(function(subRule, subIdx) {
                      if (isGroup(subRule)) return null; // pas de 3e niveau
                      return (
                        <RuleRow
                          key={subIdx}
                          rule={subRule as FilterRule}
                          catalog={catalog}
                          onChange={function(r) {
                            var nextSub = [...node.rules];
                            nextSub[subIdx] = r;
                            updateNode(index, { ...node, rules: nextSub });
                          }}
                          onRemove={function() {
                            updateNode(index, { ...node, rules: node.rules.filter(function(_, i) { return i !== subIdx; }) });
                          }}
                        />
                      );
                    })}
                    <button
                      onClick={function() {
                        var firstField = catalog[0].fields[0];
                        var ops = operatorsForField(firstField);
                        var nr: FilterRule = { field: firstField.value, operator: ops[0] ? ops[0].value : "equals", value: "" };
                        updateNode(index, { ...node, rules: [...node.rules, nr] });
                      }}
                      className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <Plus size={12} /> Ajouter au groupe
                    </button>
                  </div>
                </div>
              );
            }
            // Règle simple
            return (
              <RuleRow
                key={index}
                rule={node as FilterRule}
                catalog={catalog}
                onChange={function(r) { updateNode(index, r); }}
                onRemove={function() { removeNode(index); }}
              />
            );
          })}
        </div>
      )}

      {/* Boutons d'ajout */}
      <div className="flex items-center gap-2">
        <button onClick={addRule} className="btn-secondary py-1.5 px-3 text-xs">
          <Plus size={13} /> Ajouter un critère
        </button>
        <button onClick={addSubGroup} className="btn-secondary py-1.5 px-3 text-xs">
          <FolderPlus size={13} /> Ajouter un groupe
        </button>
      </div>
    </div>
  );
}