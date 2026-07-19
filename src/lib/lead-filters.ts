import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type FilterRule = { field: string; operator: string; value: any };
export type FilterGroup = { operator: "AND" | "OR"; rules: (FilterRule | FilterGroup)[] };

function isGroup(node: any): node is FilterGroup {
  return node && typeof node === "object" && Array.isArray(node.rules) && (node.operator === "AND" || node.operator === "OR");
}

export function normalizeToGroup(input: any): FilterGroup {
  if (!input) return { operator: "AND", rules: [] };
  if (isGroup(input)) return input;
  if (Array.isArray(input)) return { operator: "AND", rules: input };
  return { operator: "AND", rules: [] };
}

var DATE_FIELDS = ["createdAt", "updatedAt", "convertedAt", "dateOfBirth"];
var NUMBER_FIELDS = ["score"];

// Champs standards natifs du Lead (filtrables directement)
var STANDARD_FIELDS = [
  "stageId", "pipelineId", "source", "programId", "campusId", "assignedToId",
  "city", "country", "civility", "score", "createdAt", "convertedAt", "isConverted",
];

// ─── Clause pour une règle sur un champ STANDARD ───
function buildStandardClause(rule: FilterRule): any {
  var field = rule.field;
  var operator = rule.operator;
  var value = rule.value;

  function cast(v: any): any {
    if (DATE_FIELDS.indexOf(field) !== -1) return new Date(v);
    if (NUMBER_FIELDS.indexOf(field) !== -1) return Number(v);
    return v;
  }

  switch (operator) {
    case "equals": return { [field]: cast(value) };
    case "not_equals": return { [field]: { not: cast(value) } };
    case "contains": return { [field]: { contains: value, mode: "insensitive" } };
    case "starts_with": return { [field]: { startsWith: value, mode: "insensitive" } };
    case "gt": return { [field]: { gt: cast(value) } };
    case "gte": return { [field]: { gte: cast(value) } };
    case "lt": return { [field]: { lt: cast(value) } };
    case "lte": return { [field]: { lte: cast(value) } };
    case "between": return { [field]: { gte: cast(value[0]), lte: cast(value[1]) } };
    case "in": return { [field]: { in: Array.isArray(value) ? value : [value] } };
    case "not_in": return { [field]: { notIn: Array.isArray(value) ? value : [value] } };
    case "exists": return { [field]: { not: null } };
    case "not_exists": return { [field]: null };
    case "today": {
      var ts = new Date(); ts.setHours(0,0,0,0);
      var te = new Date(); te.setHours(23,59,59,999);
      return { [field]: { gte: ts, lte: te } };
    }
    case "yesterday": {
      var ys = new Date(); ys.setDate(ys.getDate()-1); ys.setHours(0,0,0,0);
      var ye = new Date(); ye.setDate(ye.getDate()-1); ye.setHours(23,59,59,999);
      return { [field]: { gte: ys, lte: ye } };
    }
    case "this_week": {
      var ws = new Date(); var d = (ws.getDay()+6)%7; ws.setDate(ws.getDate()-d); ws.setHours(0,0,0,0);
      return { [field]: { gte: ws } };
    }
    case "this_month": {
      var ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
      return { [field]: { gte: ms } };
    }
    case "last_month": {
      var lms = new Date(); lms.setMonth(lms.getMonth()-1, 1); lms.setHours(0,0,0,0);
      var lme = new Date(); lme.setDate(1); lme.setHours(0,0,0,0);
      return { [field]: { gte: lms, lt: lme } };
    }
    case "last_n_days": {
      var n = Number(value) || 7;
      var nd = new Date(); nd.setDate(nd.getDate()-n); nd.setHours(0,0,0,0);
      return { [field]: { gte: nd } };
    }
    default: return {};
  }
}

// ─── Clause pour une règle sur un CUSTOM FIELD (JSON Lead.customFields) ───
// Clé du champ encodée comme "custom:laClé"
function buildCustomClause(key: string, rule: FilterRule): any {
  var operator = rule.operator;
  var value = rule.value;

  switch (operator) {
    case "equals":
      return { customFields: { path: [key], equals: value } };
    case "not_equals":
      return { NOT: { customFields: { path: [key], equals: value } } };
    case "contains":
      // Postgres JSONB : string_contains fonctionne si la valeur est une string
      return { customFields: { path: [key], string_contains: value } };
    case "exists":
      return { NOT: { customFields: { path: [key], equals: Prisma.JsonNull } } };
    case "not_exists":
      return { customFields: { path: [key], equals: Prisma.JsonNull } };
    default:
      // gt/lt non fiables sur JSON → on tente equals par défaut
      return { customFields: { path: [key], equals: value } };
  }
}

// ─── Clause ACTIVITÉ (relations messages) ───
function buildActivityClause(rule: FilterRule): any {
  var operator = rule.operator;
  var value = rule.value;

  switch (rule.field) {
    case "has_message":
      // value ignoré : a au moins un message
      return { messages: { some: {} } };
    case "no_message":
      return { messages: { none: {} } };
    case "has_inbound":
      // a répondu (au moins un message entrant)
      return { messages: { some: { direction: "INBOUND" } } };
    case "no_inbound":
      return { messages: { none: { direction: "INBOUND" } } };
    case "last_message_before":
      // dernier message avant une date → aucun message après cette date
      return { messages: { none: { sentAt: { gte: new Date(value) } } } };
    case "last_message_after":
      return { messages: { some: { sentAt: { gte: new Date(value) } } } };
    default:
      return {};
  }
}

// ─── Résout les leadIds d'une audience (pour filtre d'appartenance) ───
async function getAudienceLeadIds(audienceId: string): Promise<string[]> {
  var members = await prisma.audienceMember.findMany({
    where: { audienceId: audienceId },
    select: { leadId: true },
  });
  return members.map(function(m) { return m.leadId; });
}

// ─── Construit le `where` Prisma récursivement ───
export async function buildLeadWhere(input: any, organizationId: string): Promise<any> {
  var group = normalizeToGroup(input);
  var conditions: any[] = [];

  for (var node of group.rules) {
    if (isGroup(node)) {
      var sub = await buildLeadWhere(node, organizationId);
      // On retire le scope org/isConverted des sous-groupes (déjà au niveau racine)
      var subClean: any = {};
      if (sub.AND) subClean.AND = sub.AND;
      if (sub.OR) subClean.OR = sub.OR;
      if (Object.keys(subClean).length > 0) conditions.push(subClean);
      continue;
    }

    var rule = node as FilterRule;
    if (!rule.field) continue;

    var noValueOperators = ["exists", "not_exists", "has_message", "no_message", "has_inbound", "no_inbound", "today", "yesterday", "this_week", "this_month", "last_month"];
    // Les 4 conditions d'activité autonomes portent le préfixe "activity:" dans le field
    // (ex. "activity:no_message") : on compare donc sur le nom SANS préfixe, sinon
    // l'exemption échoue et le filtre (valeur vide) est ignoré → compte faux.
    var bareField = rule.field.indexOf("activity:") === 0 ? rule.field.slice(9) : rule.field;
    var isStandaloneActivity = ["has_message", "no_message", "has_inbound", "no_inbound"].indexOf(bareField) !== -1;
    var needsValue = noValueOperators.indexOf(rule.operator) === -1 && !isStandaloneActivity;
    if (needsValue && (rule.value === "" || rule.value === null || rule.value === undefined)) continue;

    // Famille déduite du préfixe du field
    if (rule.field.indexOf("custom:") === 0) {
      var key = rule.field.slice(7);
      conditions.push(buildCustomClause(key, rule));
    } else if (rule.field.indexOf("activity:") === 0) {
      var activityRule = { ...rule, field: rule.field.slice(9) };
      var ac = buildActivityClause(activityRule);
      if (Object.keys(ac).length > 0) conditions.push(ac);
    } else if (rule.field === "audience") {
      // operator: in_audience / not_in_audience, value: audienceId
      var leadIds = await getAudienceLeadIds(rule.value);
      if (rule.operator === "not_in_audience") {
        conditions.push({ id: { notIn: leadIds.length > 0 ? leadIds : ["__NONE__"] } });
      } else {
        conditions.push({ id: { in: leadIds.length > 0 ? leadIds : ["__NONE__"] } });
      }
    } else if (STANDARD_FIELDS.indexOf(rule.field) !== -1) {
      var sc = buildStandardClause(rule);
      if (Object.keys(sc).length > 0) conditions.push(sc);
    }
    // champ inconnu → ignoré
  }

  var base: any = { organizationId: organizationId, isConverted: false };

  if (conditions.length === 0) return base;

  if (group.operator === "OR") {
    return { ...base, OR: conditions };
  }
  return { ...base, AND: conditions };
}

// ─── Évaluation EN MÉMOIRE d'un lead contre un FilterGroup (pour le pipeline) ───
// Ne gère que standard + custom (pas activité ni audience).
export function evaluateLeadAgainstGroup(lead: any, input: any): boolean {
  var group = normalizeToGroup(input);
  if (group.rules.length === 0) return true;

  var results = group.rules.map(function(node: any): boolean {
    if (node && Array.isArray(node.rules)) {
      return evaluateLeadAgainstGroup(lead, node); // sous-groupe
    }
    return evaluateRule(lead, node);
  });

  if (group.operator === "OR") return results.some(function(r) { return r; });
  return results.every(function(r) { return r; });
}

function getLeadValue(lead: any, field: string): any {
  // custom:key → customFields
  if (field.indexOf("custom:") === 0) {
    var key = field.slice(7);
    if (lead.customFields && typeof lead.customFields === "object") {
      return lead.customFields[key];
    }
    return undefined;
  }
  // activité/audience non évaluables en mémoire → ignorés (true)
  return lead[field];
}

function evaluateRule(lead: any, rule: any): boolean {
  // Familles non évaluables en mémoire → on ne filtre pas dessus
  if (rule.field === "audience" || rule.field.indexOf("activity:") === 0) return true;

  var value = getLeadValue(lead, rule.field);
  var op = rule.operator;
  var target = rule.value;

  function isDateField(f: string) {
    return f === "createdAt" || f === "convertedAt" || f === "updatedAt" || f === "dateOfBirth";
  }

  switch (op) {
    case "exists": return value !== null && value !== undefined && value !== "";
    case "not_exists": return value === null || value === undefined || value === "";
    case "equals": return String(value == null ? "" : value) === String(target == null ? "" : target);
    case "not_equals": return String(value == null ? "" : value) !== String(target == null ? "" : target);
    case "contains": return String(value || "").toLowerCase().indexOf(String(target || "").toLowerCase()) !== -1;
    case "starts_with": return String(value || "").toLowerCase().indexOf(String(target || "").toLowerCase()) === 0;
    case "gt": return Number(value) > Number(target);
    case "lt": return Number(value) < Number(target);
    case "gte": return Number(value) >= Number(target);
    case "lte": return Number(value) <= Number(target);
    case "today": case "yesterday": case "this_week": case "this_month": case "last_month": case "last_n_days": {
      if (!value) return false;
      var d = new Date(value);
      var bounds = relativeDateBounds(op, target);
      if (bounds.gte && d < bounds.gte) return false;
      if (bounds.lt && d >= bounds.lt) return false;
      if (bounds.lte && d > bounds.lte) return false;
      return true;
    }
    default: return true;
  }
}

function relativeDateBounds(op: string, value: any): { gte?: Date; lte?: Date; lt?: Date } {
  var now = new Date();
  if (op === "today") { var s = new Date(); s.setHours(0,0,0,0); var e = new Date(); e.setHours(23,59,59,999); return { gte: s, lte: e }; }
  if (op === "yesterday") { var ys = new Date(); ys.setDate(ys.getDate()-1); ys.setHours(0,0,0,0); var ye = new Date(); ye.setDate(ye.getDate()-1); ye.setHours(23,59,59,999); return { gte: ys, lte: ye }; }
  if (op === "this_week") { var ws = new Date(); var day = (ws.getDay()+6)%7; ws.setDate(ws.getDate()-day); ws.setHours(0,0,0,0); return { gte: ws }; }
  if (op === "this_month") { var ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0); return { gte: ms }; }
  if (op === "last_month") { var lms = new Date(); lms.setMonth(lms.getMonth()-1, 1); lms.setHours(0,0,0,0); var lme = new Date(); lme.setDate(1); lme.setHours(0,0,0,0); return { gte: lms, lt: lme }; }
  if (op === "last_n_days") { var n = Number(value) || 7; var nd = new Date(); nd.setDate(nd.getDate()-n); nd.setHours(0,0,0,0); return { gte: nd }; }
  return {};
}