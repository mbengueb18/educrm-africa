import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";

// Génère 3-4 questions suggérées (raccourcis du widget) à partir des documents
// visibles par le chatbot. Best-effort : ne throw jamais, met en cache le résultat
// dans ChatbotConfig.suggestedQuestions. Destiné à tourner via `after()`.

const MAX_DOCS = 40;
const MAX_CHARS = 60_000; // pas besoin de tout le contexte juste pour des suggestions

export async function generateSuggestions(orgId: string): Promise<void> {
  try {
    const config = await prisma.chatbotConfig.findUnique({
      where: { organizationId: orgId },
      select: { knowledgeEnabled: true, organization: { select: { chatbotAiEnabled: true } } },
    });
    // Effectif seulement si activé par l'école ET habilité au back-office.
    if (!config?.knowledgeEnabled || !config.organization?.chatbotAiEnabled) return;

    const docs = await prisma.libraryDocument.findMany({
      where: {
        organizationId: orgId,
        botVisible: true,
        extractionStatus: "DONE",
        extractedText: { not: null },
      },
      select: { name: true, extractedText: true },
      orderBy: { createdAt: "desc" },
      take: MAX_DOCS,
    });

    // Sans document exploitable : on vide les suggestions (le widget retombe sur ses raccourcis par défaut).
    if (docs.length === 0) {
      await prisma.chatbotConfig.update({
        where: { organizationId: orgId },
        data: { suggestedQuestions: [], suggestionsUpdatedAt: new Date() },
      });
      return;
    }

    let used = 0;
    const parts: string[] = [];
    for (const d of docs) {
      const chunk = `### ${d.name}\n${d.extractedText}`;
      if (used + chunk.length > MAX_CHARS) {
        parts.push(chunk.slice(0, Math.max(0, MAX_CHARS - used)));
        break;
      }
      parts.push(chunk);
      used += chunk.length;
    }
    const context = parts.join("\n\n");

    const system = [
      "À partir des DOCUMENTS d'une école ci-dessous, propose exactement 4 questions courtes",
      "(max 6 mots chacune) qu'un prospect poserait et dont la réponse est réellement présente",
      "dans ces documents. Formule-les du point de vue du visiteur, en français, variées",
      "(filières, frais, admission, débouchés, calendrier…).",
      'Réponds STRICTEMENT en JSON : {"questions": ["...", "...", "...", "..."]}',
      "",
      "DOCUMENTS :",
      context,
    ].join("\n");

    const raw = await callGemini([{ role: "user", parts: [{ text: "Génère les questions suggérées." }] }], system);

    let questions: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.questions)) {
        questions = parsed.questions
          .filter((q: unknown) => typeof q === "string" && (q as string).trim())
          .slice(0, 4)
          .map((q: string) => q.trim());
      }
    } catch {
      // réponse non-JSON : on laisse la liste vide (fallback widget)
    }

    await prisma.chatbotConfig.update({
      where: { organizationId: orgId },
      data: { suggestedQuestions: questions, suggestionsUpdatedAt: new Date() },
    });
  } catch (err) {
    console.error("[generate-suggestions]", orgId, (err as Error).message);
  }
}
