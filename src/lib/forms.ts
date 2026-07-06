// Types & helpers partagés du constructeur de formulaires.

export type FieldType =
  | "text" | "textarea" | "email" | "tel" | "whatsapp" | "number" | "url" | "date" | "time"
  | "select" | "radio" | "checkboxes" | "boolean" | "consent"
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
  boolean: "Oui / Non", consent: "Consentement", hidden: "Champ caché",
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

// Champs standards reconnus par l'ingestion (le reste → champs personnalisés).
const STANDARD_NAMES = new Set(["firstName", "lastName", "name", "email", "phone", "tel", "whatsapp", "city", "message"]);
export function isStandardName(name: string): boolean {
  return STANDARD_NAMES.has(name);
}
