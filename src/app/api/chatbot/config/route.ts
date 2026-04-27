import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_SCENARIO = [
  {
    id: "start",
    type: "bot",
    message: "Comment puis-je vous aider aujourd'hui ?",
    options: [
      { label: "Découvrir les filières", next: "programs" },
      { label: "Connaître les frais", next: "fees" },
      { label: "Prendre RDV", next: "rdv" },
      { label: "Autre question", next: "free_text" },
    ],
  },
  {
    id: "programs",
    type: "bot",
    message: "Quel niveau d'études vous intéresse ?",
    options: [
      { label: "Bac+2 (BTS, DUT)", next: "ask_name", context: "Bac+2" },
      { label: "Bac+3 (Licence)", next: "ask_name", context: "Bac+3" },
      { label: "Bac+5 (Master)", next: "ask_name", context: "Bac+5" },
      { label: "Doctorat", next: "ask_name", context: "Doctorat" },
    ],
  },
  {
    id: "fees",
    type: "bot",
    message: "Les frais varient selon la filière et le campus. Souhaitez-vous être contacté(e) par un conseiller pour avoir un devis personnalisé ?",
    options: [
      { label: "Oui, contactez-moi", next: "ask_name" },
      { label: "Voir les filières", next: "programs" },
    ],
  },
  {
    id: "rdv",
    type: "bot",
    message: "Pour planifier un rendez-vous, j'ai besoin de quelques informations.",
    options: [
      { label: "Continuer", next: "ask_name" },
    ],
  },
  {
    id: "free_text",
    type: "input",
    message: "Posez-moi votre question :",
    field: "message",
    next: "ask_name",
  },
  {
    id: "ask_name",
    type: "input",
    message: "Quel est votre prénom ?",
    field: "firstName",
    next: "ask_lastname",
  },
  {
    id: "ask_lastname",
    type: "input",
    message: "Et votre nom de famille ?",
    field: "lastName",
    next: "ask_phone",
  },
  {
    id: "ask_phone",
    type: "input",
    message: "Votre numéro WhatsApp ? (un conseiller vous contactera)",
    field: "phone",
    next: "ask_email",
  },
  {
    id: "ask_email",
    type: "input",
    message: "Votre adresse email ?",
    field: "email",
    next: "submit",
  },
  {
    id: "submit",
    type: "submit",
    message: "Merci ! Un conseiller vous contactera dans les meilleurs délais. 👋",
  },
];

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("id");
  if (!slug) {
    return NextResponse.json({ enabled: false }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        chatbotConfig: true,
      },
    });

    if (!org || !org.chatbotConfig?.enabled) {
      return NextResponse.json({ enabled: false }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    var config = org.chatbotConfig;
    var scenario: any[] = [];
    try {
      var parsed = config.scenario as any;
      if (Array.isArray(parsed) && parsed.length > 0) scenario = parsed;
      else scenario = DEFAULT_SCENARIO;
    } catch {
      scenario = DEFAULT_SCENARIO;
    }

    return NextResponse.json({
      enabled: true,
      organizationName: org.name,
      agentName: config.agentName,
      welcomeMessage: config.welcomeMessage,
      primaryColor: config.primaryColor,
      position: config.position,
      scenario: scenario,
    }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return NextResponse.json({ enabled: false }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
}