/**
 * Évaluateur EN MÉMOIRE d'un lead contre un groupe de règles, dans le MÊME
 * dialecte que le rule-builder des audiences / campagnes emailing :
 *  - opérateurs : equals, not_equals, contains, not_contains, starts_with,
 *    ends_with, greater_than, less_than, in, not_in, exists, not_exists
 *  - chemins pointés : "program.formationType", "customFields.budget"
 *
 * Tolérant au format historique des filtres de workflows (groupes imbriqués
 * exprimés via `operator_group`, et clés de custom fields "plates").
 *
 * NB : les familles non évaluables en mémoire (activité, appartenance à une
 * audience) ne sont pas gérées ici — elles renvoient `true` (non filtrant).
 */

export function evaluateLeadFilters(lead: any, group: any): boolean {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) return true;

  const op = group.operator === "OR" ? "OR" : "AND";
  const results = group.rules.map((rule: any): boolean => {
    // Groupe imbriqué — format audiences {operator, rules}
    if (rule && Array.isArray(rule.rules) && (rule.operator === "AND" || rule.operator === "OR")) {
      return evaluateLeadFilters(lead, rule);
    }
    // Groupe imbriqué — format legacy workflows {operator_group, rules}
    if (rule && rule.operator_group) {
      return evaluateLeadFilters(lead, { operator: rule.operator_group, rules: rule.rules || [] });
    }
    return evaluateOneRule(lead, rule);
  });

  return op === "OR" ? results.some(Boolean) : results.every(Boolean);
}

function evaluateOneRule(lead: any, rule: any): boolean {
  if (!rule || !rule.field) return true;
  const { field, operator, value } = rule;
  const leadValue = getNestedValue(lead, field);

  switch (operator) {
    case "exists": return leadValue !== null && leadValue !== undefined && leadValue !== "";
    case "not_exists": return leadValue === null || leadValue === undefined || leadValue === "";
    case "equals": return String(leadValue ?? "") === String(value ?? "");
    case "not_equals": return String(leadValue ?? "") !== String(value ?? "");
    case "contains": return String(leadValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
    case "not_contains": return !String(leadValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
    case "starts_with": return String(leadValue ?? "").toLowerCase().startsWith(String(value ?? "").toLowerCase());
    case "ends_with": return String(leadValue ?? "").toLowerCase().endsWith(String(value ?? "").toLowerCase());
    case "greater_than":
      if (isDateField(field)) return new Date(leadValue) > new Date(value);
      return Number(leadValue) > Number(value);
    case "less_than":
      if (isDateField(field)) return new Date(leadValue) < new Date(value);
      return Number(leadValue) < Number(value);
    case "in":
      if (!Array.isArray(value)) return false;
      return value.map((v: any) => String(v)).includes(String(leadValue ?? ""));
    case "not_in":
      if (!Array.isArray(value)) return true;
      return !value.map((v: any) => String(v)).includes(String(leadValue ?? ""));
    default:
      return false;
  }
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  // Chemin direct (pas de point)
  if (path.indexOf(".") === -1) {
    if (obj[path] !== undefined) return obj[path];
    // Fallback custom fields (format legacy workflows : clé plate)
    if (obj.customFields && typeof obj.customFields === "object") return obj.customFields[path];
    return undefined;
  }

  // Chemin pointé : "program.formationType", "customFields.budget"
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (p === "customFields" && typeof cur.customFields === "object" && cur.customFields !== null) {
      cur = cur.customFields;
      continue;
    }
    cur = cur[p];
  }
  return cur;
}

function isDateField(field: string): boolean {
  const f = field.toLowerCase();
  return f.endsWith("at") || f.includes("date") || field === "dateOfBirth";
}
