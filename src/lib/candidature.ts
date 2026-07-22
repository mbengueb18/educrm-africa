// Socle partagé « dossier de candidature » : reconstruit les réponses d'une FormSubmission
// en sections ordonnées (les titres du formulaire), prêtes à afficher.
// Utilisé par l'onglet Candidature de la fiche prospect ET (à terme) par le portail candidat —
// un seul renderer pour éviter que les deux vues divergent.

import { splitIntoSteps, isInputField, isFieldVisible, type FormField } from "@/lib/forms";

export type DossierItem = {
  label: string;
  value: string;
  kind: "text" | "file" | "longtext";
};

export type DossierSection = {
  title: string;
  items: DossierItem[];
};

// ── Checklist des pièces du dossier ──
// Chaque champ « fichier » du formulaire = une pièce attendue. Seuls les champs applicables
// au candidat comptent (isFieldVisible : les pièces conditionnelles non pertinentes ne sont
// jamais réclamées). Snapshot figé à la soumission pour ne pas dériver si le formulaire change.
export type ChecklistItem = {
  name: string;   // clé technique du champ fichier
  label: string;
  status: "PROVIDED" | "MISSING";
  url?: string;
  updatedAt?: string;              // ISO — dernier remplacement/dépôt (portail candidat)
  updatedBy?: "candidate" | "advisor";
};

export type DossierChecklist = {
  items: ChecklistItem[];
  locked: boolean;   // dossier complet → verrouillé (le conseiller peut rouvrir)
  lockedAt?: string;
};

export function buildChecklist(fields: FormField[], data: Record<string, any>): DossierChecklist {
  const items: ChecklistItem[] = (fields || [])
    .filter((f) => f.type === "file" && isFieldVisible(f, data))
    .map((f) => {
      const raw = data[f.name];
      const url = typeof raw === "string" && raw.trim() ? raw.trim() : "";
      return { name: f.name, label: f.label || f.name, status: url ? "PROVIDED" as const : "MISSING" as const, ...(url ? { url } : {}) };
    });
  const locked = items.length > 0 && items.every((i) => i.status === "PROVIDED");
  return { items, locked, ...(locked ? { lockedAt: new Date().toISOString() } : {}) };
}

// Nom de fichier lisible depuis une URL d'upload (…/form-uploads/1784661369603-mrope6-Bulletin.pdf → Bulletin.pdf).
export function fileNameFromUrl(url: string): string {
  try {
    const base = decodeURIComponent(url.split("/").pop() || "");
    return base.replace(/^\d+-[a-z0-9]+-/i, "") || "Fichier";
  } catch {
    return "Fichier";
  }
}

export function buildDossierSections(
  fields: FormField[],
  data: Record<string, any>,
  programNames?: Record<string, string>, // id de Program → nom (résolution du champ Filière)
  opts?: { excludeFiles?: boolean },     // true quand une checklist de pièces est affichée à part
): DossierSection[] {
  const steps = splitIntoSteps(fields || []);
  const sections: DossierSection[] = [];

  for (const step of steps) {
    const items: DossierItem[] = [];
    for (const f of step.fields) {
      if (!isInputField(f.type) || f.type === "hidden") continue;
      if (opts?.excludeFiles && f.type === "file") continue; // pièces portées par la checklist
      if (!isFieldVisible(f, data)) continue; // champs conditionnels non applicables
      const raw = data[f.name];
      if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;

      let value: string;
      let kind: DossierItem["kind"] = "text";
      if (f.type === "file") {
        value = String(raw); // URL du fichier
        kind = "file";
      } else if (f.type === "program") {
        value = (programNames && programNames[String(raw)]) || String(raw);
      } else if (f.type === "consent") {
        value = raw ? "Oui" : "Non";
      } else if (Array.isArray(raw)) {
        value = raw.join(", ");
      } else {
        value = String(raw);
        if (f.type === "textarea" || value.length > 120) kind = "longtext";
      }
      items.push({ label: f.label || f.name, value, kind });
    }
    if (items.length) sections.push({ title: step.title || "Informations", items });
  }
  return sections;
}
