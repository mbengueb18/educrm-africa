// Types & helpers partagés du constructeur de formulaires.

export type FieldType =
  | "text" | "textarea" | "email" | "tel" | "whatsapp" | "number" | "url" | "date" | "time"
  | "select" | "radio" | "checkboxes" | "boolean" | "consent" | "file"
  | "hidden" | "heading" | "paragraph" | "divider";

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  name: string;              // clé technique (envoyée à l'ingestion)
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];        // select / radio / checkboxes
  width?: "full" | "half";
  content?: string;          // heading / paragraph / consent (texte)
  defaultValue?: string;     // hidden
};

export type FormSettings = {
  submitLabel?: string;
  successMode?: "message" | "redirect";
  successMessage?: string;
  redirectUrl?: string;
  color?: string;        // couleur principale
  buttonColor?: string;
  bgColor?: string;
  textColor?: string;
  radius?: number;
  logo?: string;
  showLogo?: boolean;
  customCss?: string;
  notifyEmail?: string; // email averti à chaque soumission (vide = désactivé)
  multiStep?: boolean;  // affichage en plusieurs étapes (formulaires longs)
};

export type FormRouting = {
  pipelineStageId?: string | null;
  assignToId?: string | null;
  tags?: string[];
};

// Types "layout" : n'émettent pas de valeur (pas de lead).
export const LAYOUT_TYPES: FieldType[] = ["heading", "paragraph", "divider"];
export function isInputField(t: FieldType): boolean {
  return !LAYOUT_TYPES.includes(t);
}

// Types à options.
export const OPTION_TYPES: FieldType[] = ["select", "radio", "checkboxes"];
export function hasOptions(t: FieldType): boolean {
  return OPTION_TYPES.includes(t);
}

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "formulaire";
}

// Nom technique par défaut pour un nouveau champ d'un type donné.
const DEFAULT_NAMES: Partial<Record<FieldType, string>> = {
  email: "email", tel: "phone", whatsapp: "whatsapp", text: "firstName",
  textarea: "message", date: "date", number: "number", url: "url",
};

let counter = 0;
export function newField(type: FieldType): FormField {
  counter += 1;
  const base: FormField = {
    id: "f" + Date.now().toString(36) + (counter % 1000),
    type,
    label: DEFAULT_LABELS[type] || "Champ",
    name: DEFAULT_NAMES[type] || (type + "_" + (counter % 1000)),
    required: type === "email" || type === "tel",
    width: "full",
  };
  if (hasOptions(type)) base.options = ["Option 1", "Option 2"];
  if (type === "consent") base.content = "J'accepte d'être recontacté(e).";
  if (type === "heading") base.content = "Titre de section";
  if (type === "paragraph") base.content = "Texte d'information.";
  return base;
}

export const DEFAULT_LABELS: Record<FieldType, string> = {
  text: "Texte", textarea: "Message", email: "Email", tel: "Téléphone",
  whatsapp: "WhatsApp", number: "Nombre", url: "Lien", date: "Date", time: "Heure",
  select: "Liste déroulante", radio: "Choix unique", checkboxes: "Cases à cocher",
  boolean: "Oui / Non", consent: "Consentement", file: "Fichier joint", hidden: "Champ caché",
  heading: "Titre", paragraph: "Paragraphe", divider: "Séparateur",
};

export const DEFAULT_SETTINGS: FormSettings = {
  submitLabel: "Envoyer",
  successMode: "message",
  successMessage: "Merci ! Nous vous recontacterons très bientôt.",
  redirectUrl: "",
  color: "#2471A3",
  buttonColor: "#2471A3",
  bgColor: "#EEF4FB",
  textColor: "#1A2229",
  radius: 12,
  showLogo: true,
  customCss: "",
};

// Regroupe les champs en lignes (paires de champs demi-largeur consécutifs).
export function groupIntoRows(fields: FormField[]): FormField[][] {
  const rows: FormField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const nf = fields[i + 1];
    if (f.width === "half" && isInputField(f.type) && nf && nf.width === "half" && isInputField(nf.type)) {
      rows.push([f, nf]); i++;
    } else {
      rows.push([f]);
    }
  }
  return rows;
}

// ── Multi-étapes ────────────────────────────────────────────────────
export type FormStep = { title: string; fields: FormField[] };

// Découpe les champs en étapes. Règle : chaque "heading" (titre de section)
// démarre une étape (dont il devient le titre). Repli si aucun titre :
// découpage automatique tous les CHUNK champs de saisie.
export function splitIntoSteps(fields: FormField[]): FormStep[] {
  const hasHeading = fields.some((f) => f.type === "heading");
  const steps: FormStep[] = [];

  if (hasHeading) {
    let current: FormStep | null = null;
    for (const f of fields) {
      if (f.type === "heading") {
        current = { title: (f.content || f.label || "").trim() || "Étape " + (steps.length + 1), fields: [] };
        steps.push(current);
        continue; // le heading sert de titre d'étape, pas de champ affiché
      }
      if (!current) { current = { title: "Informations", fields: [] }; steps.push(current); }
      current.fields.push(f);
    }
    const filled = steps.filter((s) => s.fields.length > 0);
    return filled.length > 0 ? filled : [{ title: "Étape 1", fields }];
  }

  const CHUNK = 6;
  let current: FormStep = { title: "Étape 1", fields: [] };
  let count = 0;
  for (const f of fields) {
    current.fields.push(f);
    if (isInputField(f.type)) count += 1;
    if (count >= CHUNK) { steps.push(current); current = { title: "Étape " + (steps.length + 1), fields: [] }; count = 0; }
  }
  if (current.fields.length > 0) steps.push(current);
  return steps.length > 0 ? steps : [{ title: "Étape 1", fields }];
}

// Un formulaire est "long" (candidat au multi-étapes par défaut) s'il a beaucoup
// de champs de saisie ou plusieurs sections.
export function isLongForm(fields: FormField[]): boolean {
  const inputs = fields.filter((f) => isInputField(f.type)).length;
  const headings = fields.filter((f) => f.type === "heading").length;
  return inputs >= 8 || headings >= 2;
}

// Champs standards reconnus par l'ingestion (le reste → champs personnalisés).
const STANDARD_NAMES = new Set(["firstName", "lastName", "name", "email", "phone", "tel", "whatsapp", "city", "message"]);
export function isStandardName(name: string): boolean {
  return STANDARD_NAMES.has(name);
}

// Types que l'IA d'import PDF est autorisée à produire (on exclut hidden/divider).
export const IMPORTABLE_TYPES: FieldType[] = [
  "text", "textarea", "email", "tel", "whatsapp", "number", "url", "date", "time",
  "select", "radio", "checkboxes", "boolean", "consent", "file", "heading", "paragraph",
];

// Dérive une clé technique camelCase à partir d'un libellé.
function nameFromLabel(label: string): string {
  const words = (label || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .filter(Boolean);
  if (words.length === 0) return "";
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

// Normalise la sortie (non fiable) de l'IA en champs de formulaire valides.
// Chaque champ est reconstruit via newField() pour garantir id/name/format cohérents.
export function normalizeImportedFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const out: FormField[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    const providedType = typeof r.type === "string" ? (r.type as FieldType) : null;
    const rawOptions = Array.isArray(r.options)
      ? (r.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
      : [];
    const hasLabel = typeof r.label === "string" && r.label.trim() !== "";
    const hasContent = typeof r.content === "string" && r.content.trim() !== "";
    const hasValidType = providedType !== null && IMPORTABLE_TYPES.includes(providedType);
    // Ignore les objets sans aucun signal exploitable (bruit de l'IA).
    if (!hasLabel && !hasContent && !hasValidType) continue;

    const type: FieldType = hasValidType
      ? (providedType as FieldType)
      : rawOptions.length > 0 ? "select" : "text";

    const field: FormField = { ...newField(type) };

    if (hasLabel) field.label = (r.label as string).trim().slice(0, 140);

    // Clé technique : IA → clé standard du type → dérivée du libellé → défaut. Puis dédoublonnage.
    let name = typeof r.name === "string" ? r.name.replace(/[^a-zA-Z0-9_]/g, "") : "";
    if (!name && (type === "email" || type === "tel" || type === "whatsapp")) name = field.name; // email/phone/whatsapp
    if (!name) name = nameFromLabel(field.label);
    if (!name) name = field.name;
    let unique = name;
    let n = 2;
    while (used.has(unique)) unique = name + "_" + n++;
    used.add(unique);
    field.name = unique;

    if (typeof r.required === "boolean") field.required = r.required;

    if (hasOptions(type)) field.options = rawOptions.length > 0 ? rawOptions : field.options;

    if ((type === "heading" || type === "paragraph" || type === "consent") && typeof r.content === "string" && r.content.trim()) {
      field.content = r.content.trim();
    }

    out.push(field);
  }

  return out;
}
