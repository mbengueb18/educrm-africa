// src/lib/ai/metered.ts

import { callGemini } from "@/lib/gemini";
import { assertCanUseAI } from "@/lib/plans/checks";
import { incrementAIActions } from "@/lib/plans/usage";

interface AIMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface MeteredOptions {
  /** Organisation qui consomme l'action IA (pour quota + décompte) */
  orgId: string;
  messages: AIMessage[];
  systemInstruction?: string;
  /** Nombre d'actions IA consommées par cet appel (défaut : 1) */
  count?: number;
  /**
   * Contrôle du quota :
   *  - true (défaut) → vérifie le quota AVANT l'appel et lève une erreur
   *    (PlanLimitError) si le plan n'inclut pas l'IA ou si le quota mensuel
   *    est épuisé. À utiliser pour les features internes gatées (assistant lead…).
   *  - false → n'impose aucun blocage. À utiliser pour les outils PUBLICS
   *    face au prospect (orientation, chatbot) : on ne veut jamais couper
   *    un candidat en plein tunnel parce que l'école a épuisé son quota.
   *    L'usage reste comptabilisé pour le reporting.
   */
  enforce?: boolean;
}

/**
 * Appel IA « metré » : passe par le même point d'entrée que callGemini
 * (DeepSeek → Gemini) mais vérifie le quota du plan et décompte l'action.
 *
 * C'est le SEUL chemin que doivent emprunter les appels IA côté serveur —
 * ne plus appeler callGemini directement depuis les routes métier.
 */
export async function callAIMetered(opts: MeteredOptions): Promise<string> {
  const count = opts.count ?? 1;

  // 1. Contrôle du quota (bloquant sauf pour les outils publics)
  if (opts.enforce !== false) {
    await assertCanUseAI(opts.orgId, count);
  }

  // 2. Appel effectif de l'IA
  const response = await callGemini(opts.messages, opts.systemInstruction);

  // 3. Décompte — uniquement en cas de succès effectif de l'IA.
  //    On isole l'échec du compteur pour ne jamais perdre une réponse déjà générée.
  try {
    await incrementAIActions(opts.orgId, count);
  } catch (err) {
    console.error("[AI metering] Échec de l'incrément du compteur :", err);
  }

  return response;
}
