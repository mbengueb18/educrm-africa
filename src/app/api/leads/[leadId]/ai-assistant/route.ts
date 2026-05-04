import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── GET : retourne le cache existant + détection de changement ───
export async function GET(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: session.user.organizationId },
      include: {
        stage: true,
        program: true,
        // ... autres relations ...
        _count: { select: { messages: true, calls: true, appointments: true, tasks: true } },
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const analysis = lead.aiAnalysis;

    // Détection des changements majeurs
    let hasMajorChange = false;
    let changeReasons: string[] = [];

    if (analysis) {
      if (lead._count.messages > analysis.snapshotMessageCount) {
        hasMajorChange = true;
        changeReasons.push((lead._count.messages - analysis.snapshotMessageCount) + " nouveau(x) message(s)");
      }
      if (lead._count.calls > analysis.snapshotCallCount) {
        hasMajorChange = true;
        changeReasons.push((lead._count.calls - analysis.snapshotCallCount) + " nouvel(s) appel(s)");
      }
      if (lead._count.appointments > analysis.snapshotAppointmentCount) {
        hasMajorChange = true;
        changeReasons.push((lead._count.appointments - analysis.snapshotAppointmentCount) + " nouveau(x) RDV");
      }
      if (lead.stageId !== analysis.snapshotStageId) {
        hasMajorChange = true;
        changeReasons.push("Étape pipeline modifiée");
      }
      if (Math.abs(lead.score - analysis.snapshotScore) >= 20) {
        hasMajorChange = true;
        changeReasons.push("Score modifié significativement");
      }
      if (lead.isConverted !== analysis.snapshotIsConverted) {
        hasMajorChange = true;
        changeReasons.push("Statut de conversion changé");
      }
    }

    return NextResponse.json({
      success: true,
      hasAnalysis: !!analysis,
      briefData: analysis?.briefData || null,
      actionsData: analysis?.actionsData || null,
      briefGeneratedAt: analysis?.briefGeneratedAt || null,
      actionsGeneratedAt: analysis?.actionsGeneratedAt || null,
      hasMajorChange,
      changeReasons,
    });
  } catch (error: any) {
    console.error("[AI Assistant GET]", error);
    return NextResponse.json({ error: error.message || "Erreur" }, { status: 500 });
  }
}

// ─── POST : génère ou régénère une analyse ───
export async function POST(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { leadId } = await params;
    const body = await request.json();
    const { mode, context: extraContext } = body;
    // mode: "brief" | "actions" | "draft_email" | "draft_whatsapp"

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: session.user.organizationId },
      include: {
        stage: true,
        program: true,
        campus: true,
        assignedTo: { select: { name: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { type: true, description: true, createdAt: true },
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 10,
          select: { channel: true, direction: true, content: true, status: true, sentAt: true },
        },
        calls: {
          orderBy: { calledAt: "desc" },
          take: 5,
          select: { outcome: true, notes: true, duration: true, calledAt: true },
        },
        appointments: {
          orderBy: { startAt: "desc" },
          take: 5,
          select: { title: true, status: true, startAt: true, type: true },
        },
        tasks: {
          where: { status: { in: ["TODO", "IN_PROGRESS"] } },
          orderBy: { dueDate: "asc" },
          take: 10,
          select: { title: true, type: true, priority: true, dueDate: true },
        },
        _count: { select: { messages: true, calls: true, appointments: true, tasks: true } },
      },
    });

    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const leadContext = buildLeadContext(lead);
    const prompt = buildPrompt(mode, leadContext, extraContext);

    const response = await callGemini([{ role: "user", parts: [{ text: prompt }] }]);
    if (!response) {
      return NextResponse.json({ error: "Aucune réponse de l'IA" }, { status: 500 });
    }

    let parsed: any = null;
    try {
      const cleaned = response.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { text: response };
    }

    // ─── Sauvegarder dans le cache si c'est brief ou actions (pas pour les drafts éphémères) ───
    if (mode === "brief" || mode === "actions") {
      const snapshot = {
        snapshotMessageCount: lead._count.messages,
        snapshotCallCount: lead._count.calls,
        snapshotAppointmentCount: lead._count.appointments,
        snapshotTaskCount: lead._count.tasks,
        snapshotStageId: lead.stageId,
        snapshotScore: lead.score,
        snapshotIsConverted: lead.isConverted,
      };

      const updateData: any = { ...snapshot };
      if (mode === "brief") {
        updateData.briefData = parsed;
        updateData.briefGeneratedAt = new Date();
      }
      if (mode === "actions") {
        updateData.actionsData = parsed;
        updateData.actionsGeneratedAt = new Date();
      }

      await prisma.leadAIAnalysis.upsert({
        where: { leadId: lead.id },
        create: { leadId: lead.id, ...updateData },
        update: updateData,
      });
    }

    return NextResponse.json({ success: true, data: parsed, mode });
  } catch (error: any) {
    console.error("[AI Assistant POST]", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

// ─── Build context ───
function buildLeadContext(lead: any): string {
  const lines: string[] = [];
  lines.push("=== INFORMATIONS DU LEAD ===");
  lines.push("Nom : " + lead.firstName + " " + lead.lastName);
  if (lead.phone) lines.push("Téléphone : " + lead.phone);
  if (lead.email) lines.push("Email : " + lead.email);
  if (lead.whatsapp) lines.push("WhatsApp : " + lead.whatsapp);
  if (lead.city) lines.push("Ville : " + lead.city);
  if (lead.gender) lines.push("Genre : " + lead.gender);
  if (lead.dateOfBirth) lines.push("Né(e) le : " + new Date(lead.dateOfBirth).toLocaleDateString("fr-FR"));

  lines.push("\n=== PIPELINE ===");
  if (lead.stage) lines.push("Étape actuelle : " + lead.stage.name);
  lines.push("Score : " + lead.score + "/100");
  lines.push("Source : " + lead.source + (lead.sourceDetail ? " (" + lead.sourceDetail + ")" : ""));
  if (lead.program) lines.push("Filière souhaitée : " + lead.program.name);
  if (lead.campus) lines.push("Campus : " + lead.campus.name);
  if (lead.assignedTo) lines.push("Commercial assigné : " + lead.assignedTo.name);
  lines.push("Date de création : " + new Date(lead.createdAt).toLocaleDateString("fr-FR"));
  lines.push("Statut : " + (lead.isConverted ? "Converti en étudiant ✓" : "Non converti"));

  if (lead.customFields && Object.keys(lead.customFields).length > 0) {
    lines.push("\n=== CHAMPS PERSONNALISÉS ===");
    for (const [key, value] of Object.entries(lead.customFields)) {
      if (key.startsWith("_") || !value) continue;
      lines.push(key + " : " + String(value));
    }
  }

  if (lead.calls && lead.calls.length > 0) {
    lines.push("\n=== HISTORIQUE DES APPELS ===");
    for (const call of lead.calls) {
      lines.push("- " + new Date(call.calledAt).toLocaleDateString("fr-FR") + " : " + call.outcome + (call.notes ? " — " + call.notes : ""));
    }
  }

  if (lead.appointments && lead.appointments.length > 0) {
    lines.push("\n=== RENDEZ-VOUS ===");
    for (const appt of lead.appointments) {
      lines.push("- " + new Date(appt.startAt).toLocaleDateString("fr-FR") + " : " + appt.title + " (" + appt.status + ")");
    }
  }

  if (lead.messages && lead.messages.length > 0) {
    lines.push("\n=== DERNIERS MESSAGES ===");
    for (const msg of lead.messages.slice(0, 5)) {
      let content = msg.content;
      try {
        const parsed = JSON.parse(content);
        content = parsed.subject || parsed.body || content;
      } catch {}
      const cleanContent = content.replace(/<[^>]+>/g, "").substring(0, 150);
      lines.push("- " + msg.channel + " " + msg.direction + " : " + cleanContent);
    }
  }

  if (lead.tasks && lead.tasks.length > 0) {
    lines.push("\n=== TÂCHES EN COURS ===");
    for (const task of lead.tasks) {
      lines.push("- " + task.title + (task.dueDate ? " (échéance " + new Date(task.dueDate).toLocaleDateString("fr-FR") + ")" : ""));
    }
  }

  if (lead.activities && lead.activities.length > 0) {
    lines.push("\n=== ACTIVITÉ RÉCENTE ===");
    for (const act of lead.activities.slice(0, 8)) {
      lines.push("- " + new Date(act.createdAt).toLocaleDateString("fr-FR") + " : " + act.description);
    }
  }

  return lines.join("\n");
}

// ─── Build prompt by mode ───
function buildPrompt(mode: string, leadContext: string, extraContext?: string): string {
  const baseContext =
    "Tu es un assistant IA commercial expert en relation client pour une école d'enseignement supérieur en Afrique de l'Ouest francophone.\n" +
    "Tu analyses les données du lead ci-dessous et tu donnes des recommandations actionnables, concrètes et personnalisées.\n" +
    "Tu utilises un ton professionnel mais chaleureux. Tu écris EN FRANÇAIS uniquement.\n" +
    "Tu prends en compte le contexte africain (Sénégal, Côte d'Ivoire, etc.) et la culture locale.\n\n" +
    leadContext +
    "\n\n";

  if (mode === "brief") {
    return baseContext +
      "TÂCHE : Rédige un BRIEF COMMERCIAL court et utile sur ce lead pour un commercial qui doit le contacter.\n\n" +
      "Réponds STRICTEMENT en JSON valide avec cette structure :\n" +
      "{\n" +
      '  "summary": "Résumé en 2-3 phrases de qui est ce lead et où il en est dans son parcours",\n' +
      '  "engagement": "HOT" | "WARM" | "COLD" (niveau d\'engagement basé sur le comportement),\n' +
      '  "engagementReason": "Explication courte du niveau choisi",\n' +
      '  "keyPoints": ["3-5 points clés à savoir avant le contact"],\n' +
      '  "concerns": ["1-3 points d\'attention ou risques éventuels"],\n' +
      '  "approach": "Recommandation concrète sur l\'approche à adopter (1-2 phrases)"\n' +
      "}\n\n" +
      "Pas de texte avant ou après le JSON. Pas de markdown.";
  }

  if (mode === "actions") {
    return baseContext +
      "TÂCHE : Suggère les MEILLEURES PROCHAINES ACTIONS à entreprendre maintenant pour faire progresser ce lead.\n\n" +
      "Réponds STRICTEMENT en JSON valide avec cette structure :\n" +
      "{\n" +
      '  "actions": [\n' +
      "    {\n" +
      '      "priority": "URGENT" | "HIGH" | "MEDIUM",\n' +
      '      "type": "CALL" | "EMAIL" | "WHATSAPP" | "MEETING" | "FOLLOW_UP" | "OTHER",\n' +
      '      "title": "Titre court et actionnable",\n' +
      '      "reason": "Pourquoi cette action est pertinente maintenant",\n' +
      '      "timing": "Quand faire cette action (ex: aujourd\'hui, dans 2 jours, avant vendredi)"\n' +
      "    }\n" +
      "  ]\n" +
      "}\n\n" +
      "Maximum 3-5 actions. Trie par priorité décroissante. Pas de texte avant/après. Pas de markdown.";
  }

  if (mode === "draft_email") {
    return baseContext +
      (extraContext ? "\nCONTEXTE SUPPLÉMENTAIRE : " + extraContext + "\n\n" : "") +
      "TÂCHE : Rédige un EMAIL personnalisé à envoyer à ce lead maintenant. L'email doit être adapté à sa situation, son score d'engagement, ses précédentes interactions et son projet.\n\n" +
      "Règles :\n" +
      "- Ton professionnel mais chaleureux\n" +
      "- Tutoiement seulement si le lead a tutoyé en premier\n" +
      "- Court et actionnable (150-250 mots max)\n" +
      "- Inclure un appel à l'action clair\n" +
      "- Personnaliser avec son prénom et sa filière si connue\n" +
      "- Adapté au contexte ouest-africain\n\n" +
      "Réponds STRICTEMENT en JSON valide :\n" +
      "{\n" +
      '  "subject": "Objet de l\'email",\n' +
      '  "body": "Corps de l\'email avec sauts de ligne \\n",\n' +
      '  "rationale": "Pourquoi ce message est adapté à ce lead (1 phrase)"\n' +
      "}\n\n" +
      "Pas de texte avant/après. Pas de markdown.";
  }

  if (mode === "draft_whatsapp") {
    return baseContext +
      (extraContext ? "\nCONTEXTE SUPPLÉMENTAIRE : " + extraContext + "\n\n" : "") +
      "TÂCHE : Rédige un MESSAGE WHATSAPP court et impactant à envoyer à ce lead.\n\n" +
      "Règles :\n" +
      "- Très court (50-100 mots max)\n" +
      "- Ton décontracté mais respectueux (adapté au WhatsApp pro)\n" +
      "- Émojis avec parcimonie\n" +
      "- Question ouverte ou appel à l'action clair\n" +
      "- Personnaliser avec son prénom\n\n" +
      "Réponds STRICTEMENT en JSON valide :\n" +
      "{\n" +
      '  "message": "Le message WhatsApp",\n' +
      '  "rationale": "Pourquoi ce message est adapté (1 phrase)"\n' +
      "}\n\n" +
      "Pas de texte avant/après. Pas de markdown.";
  }

  return baseContext + "Aide-moi avec ce lead.";
}