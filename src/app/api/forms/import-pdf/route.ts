import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callGeminiWithPdf } from "@/lib/gemini";
import { normalizeImportedFields } from "@/lib/forms";
import { createFormWithFields } from "@/app/(dashboard)/forms/actions";
import { canAccessFeature } from "@/lib/plans/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Limite volontairement conservatrice : les fonctions serverless plafonnent le
// corps de requête autour de 4,5 Mo. Au-delà, on demande à l'utilisateur de compresser.
const MAX_BYTES = 4 * 1024 * 1024;

const SYSTEM_INSTRUCTION = `Tu es un assistant qui convertit un formulaire PDF (papier scanné, PDF natif ou PDF interactif) en définition de formulaire web pour un CRM d'écoles.

Analyse le document et extrais UNIQUEMENT les champs à remplir par la personne. Réponds STRICTEMENT en JSON (aucun texte hors JSON) avec cette forme exacte :
{
  "name": "titre du formulaire déduit du document",
  "fields": [
    { "type": "...", "label": "...", "name": "...", "required": true|false, "options": ["..."], "content": "...", "showIf": { "field": "<name>", "op": "eq|neq", "value": "..." } }
  ]
}

Types de champ autorisés :
- Saisie : text, textarea, email, tel, whatsapp, number, url, date, time
- Choix : select (liste déroulante), radio (choix unique), checkboxes (cases multiples), boolean (oui/non)
- Géo : country (pays — liste déroulante intégrée), nationality (nationalité — liste déroulante intégrée)
- Autres : consent (case d'acceptation RGPD), file (pièce jointe)
- Mise en page : heading (titre de section), paragraph (texte d'information)

Règles :
- "label" = libellé visible en français, tel qu'écrit sur le document.
- "name" = clé technique en camelCase ASCII (ex: "dateNaissance"). Utilise IMPÉRATIVEMENT ces clés standard quand le champ correspond : firstName (prénom), lastName (nom), email, phone (téléphone), whatsapp, city (ville), message (message/commentaire/motivation).
- "options" UNIQUEMENT pour select/radio/checkboxes (reprends les choix listés sur le document). NE mets PAS d'options pour country/nationality (listes intégrées).
- "content" UNIQUEMENT pour heading/paragraph/consent (le texte).
- Choisis le type le plus adapté : email→email, téléphone→tel, date de naissance→date, réponse longue→textarea, cases à cocher multiples→checkboxes, oui/non→boolean, acceptation de conditions→consent, document à joindre→file, pays→country, nationalité→nationality.
- "required": true seulement si le champ est clairement obligatoire (astérisque, mention "obligatoire").
- "showIf" (OPTIONNEL) : ajoute-le uniquement si le document indique clairement qu'un champ dépend d'une réponse précédente (ex : "Si non, précisez qui prend en charge…"). "field" = le "name" du champ contrôlant (défini AVANT), "op" = "eq" (égal) ou "neq" (différent), "value" = la valeur déclencheuse (ex : "Non"). Dans le doute, n'ajoute PAS de showIf.
- Reproduis les titres de sections du document avec des champs "heading".
- N'invente AUCUN champ absent du document. N'ajoute PAS de bouton d'envoi (géré automatiquement).`;

function parseAiJson(text: string): { name?: string; fields?: unknown } {
  try {
    return JSON.parse(text);
  } catch {
    // Filet de sécurité : extraire le premier objet/tableau JSON du texte.
    const match = text.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
    throw new Error("Réponse IA illisible");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Fonctionnalité IA → réservée aux plans payants.
  const aiCheck = await canAccessFeature(session.user.organizationId, "AI_ASSISTANT");
  if (!aiCheck.allowed) {
    return NextResponse.json(
      { error: "L'import de formulaire depuis un PDF (IA) est réservé aux plans payants.", upgrade: true },
      { status: 403 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const f = formData.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "PDF trop volumineux (max 4 Mo). Compressez-le ou réduisez le nombre de pages." },
      { status: 413 },
    );
  }

  let base64: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    base64 = buf.toString("base64");
  } catch {
    return NextResponse.json({ error: "Lecture du fichier impossible" }, { status: 400 });
  }

  let aiText: string;
  try {
    aiText = await callGeminiWithPdf(
      base64,
      "application/pdf",
      "Convertis ce document en formulaire web. Réponds uniquement avec le JSON demandé.",
      SYSTEM_INSTRUCTION,
    );
  } catch (e: any) {
    console.error("[import-pdf] Gemini error", e?.message);
    return NextResponse.json(
      { error: e?.message || "L'analyse du PDF a échoué. Réessayez." },
      { status: 502 },
    );
  }

  let parsed: { name?: string; fields?: unknown };
  try {
    parsed = parseAiJson(aiText);
  } catch {
    return NextResponse.json(
      { error: "Impossible d'interpréter le contenu du PDF. Réessayez avec un document plus lisible." },
      { status: 422 },
    );
  }

  const rawFields = Array.isArray(parsed) ? parsed : parsed.fields;
  const fields = normalizeImportedFields(rawFields);
  if (fields.length === 0) {
    return NextResponse.json(
      { error: "Aucun champ n'a pu être détecté dans ce PDF." },
      { status: 422 },
    );
  }

  const name = (!Array.isArray(parsed) && typeof parsed.name === "string" ? parsed.name : "") ||
    file.name.replace(/\.pdf$/i, "");

  try {
    const { id } = await createFormWithFields(name, fields);
    return NextResponse.json({ id, fieldCount: fields.length });
  } catch (e: any) {
    console.error("[import-pdf] create error", e?.message);
    return NextResponse.json({ error: e?.message || "Création du formulaire impossible" }, { status: 500 });
  }
}
