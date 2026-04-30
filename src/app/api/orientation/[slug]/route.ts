import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { history, action } = body;

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        programs: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            durationMonths: true,
            tuitionAmount: true,
            currency: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    // Build system prompt
    const programsList = org.programs.map((p) =>
      `- ID: ${p.id} | ${p.name} (${p.code || ""}) — Niveau ${p.level}, ${p.durationMonths} mois, ${p.tuitionAmount} ${p.currency}`
    ).join("\n");

    const systemInstruction = `Tu es une conseillère d'orientation amicale et experte pour ${org.name}, une école au Sénégal.

Ta mission : aider un candidat à choisir LA meilleure filière parmi celles disponibles dans cette école, en posant des questions pertinentes une à une.

Filières disponibles dans l'école :
${programsList}

RÈGLES STRICTES :
1. Pose UNE seule question à la fois (max 5-7 questions au total)
2. Tutoie le candidat de manière chaleureuse mais professionnelle
3. Pose des questions ouvertes ou propose des choix multiples
4. Ne recommande des filières QUE depuis la liste ci-dessus
5. Utilise les IDs exacts des filières lors des recommandations finales
6. Réponds TOUJOURS au format JSON (cf. ci-dessous)

Format de réponse JSON STRICT :

Si tu poses une question, retourne :
{
  "type": "question",
  "message": "Ta question ici",
  "options": ["Option 1", "Option 2", "Option 3"] // optionnel, si choix multiples
}

Si tu as assez d'infos pour recommander (après 5-7 questions), retourne :
{
  "type": "recommendation",
  "message": "Petit message de transition",
  "recommendations": [
    {
      "programId": "id-exact-de-la-filiere",
      "matchScore": 95,
      "reasons": ["Raison 1", "Raison 2", "Raison 3"]
    }
    // 1 à 3 recommandations max, triées par matchScore décroissant
  ]
}

Si action = "start", commence par te présenter brièvement et pose la première question.`;

    let geminiMessages: { role: "user" | "model"; parts: { text: string }[] }[] = [];

    if (action === "start") {
      geminiMessages = [
        { role: "user", parts: [{ text: "Démarre l'orientation. Présente-toi brièvement et pose ta première question." }] },
      ];
    } else if (Array.isArray(history)) {
      geminiMessages = history.map((h: any) => ({
        role: h.role === "user" ? "user" as const : "model" as const,
        parts: [{ text: typeof h.content === "string" ? h.content : JSON.stringify(h.content) }],
      }));
    }

    const responseText = await callGemini(geminiMessages, systemInstruction);

    // Try to parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Fallback if Gemini didn't return valid JSON
      parsed = {
        type: "question",
        message: responseText,
      };
    }

    // If recommendation, enrich with program details
    if (parsed.type === "recommendation" && Array.isArray(parsed.recommendations)) {
      parsed.recommendations = parsed.recommendations.map((rec: any) => {
        const prog = org.programs.find((p) => p.id === rec.programId);
        return prog ? { ...rec, program: prog } : rec;
      }).filter((r: any) => r.program);
    }

    return NextResponse.json({ success: true, data: parsed }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("[Orientation API]", error);
    return NextResponse.json({ error: error.message || "Erreur" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}