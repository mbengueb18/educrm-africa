"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

function generateToken(): string {
  return "lk_" + randomBytes(24).toString("hex");
}

export async function generatePortalLink(leadId: string, expirationDays: number = 90) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      organizationId: true,
      organization: { select: { name: true } },
      stage: { select: { name: true } },
    },
  });

  if (!lead) throw new Error("Lead introuvable");

  // Le portail n'est disponible qu'à partir de l'étape "Dossier reçu"
  const stageName = (lead.stage?.name || "").toLowerCase();
  if (!stageName.includes("dossier") && !stageName.includes("reçu") && !stageName.includes("recu")) {
    throw new Error("Le portail candidat n'est disponible qu'à partir de l'étape \"Dossier reçu\"");
  }

  // Reuse existing valid token if present
  const existing = await prisma.leadPortalToken.findFirst({
    where: {
      leadId: leadId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const created = await prisma.leadPortalToken.create({
      data: {
        token: generateToken(),
        leadId: lead.id,
        organizationId: lead.organizationId,
        expiresAt,
        createdById: session.user.id,
      },
    });
    token = created.token;
  }

  return {
    token,
    url: "/candidat/" + token,
    leadName: lead.firstName + " " + lead.lastName,
    leadEmail: lead.email,
    organizationName: lead.organization.name,
  };
}

export async function sendPortalLinkByEmail(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const result = await generatePortalLink(leadId);

  if (!result.leadEmail) throw new Error("Aucune adresse email pour ce lead");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.talibcrm.com";
  const fullUrl = baseUrl + result.url;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { firstName: true, organizationId: true },
  });

  await sendEmail({
    to: result.leadEmail,
    toName: result.leadName,
    subject: "Votre espace candidat — " + result.organizationName,
    body:
      "Bonjour " + lead!.firstName + ",\n\n" +
      "Vous pouvez désormais suivre votre candidature en ligne sur votre espace personnel :\n\n" +
      fullUrl + "\n\n" +
      "Sur cet espace, vous pouvez :\n" +
      "• Voir l'avancée de votre dossier\n" +
      "• Déposer vos documents\n" +
      "• Échanger avec votre conseiller\n" +
      "• Suivre vos rendez-vous\n\n" +
      "Ce lien est personnel — gardez-le précieusement.\n\n" +
      "À très vite,\n" +
      "L'équipe " + result.organizationName,
    organizationId: lead!.organizationId,
    leadId: leadId,
  });

  await prisma.activity.create({
    data: {
      type: "MESSAGE_SENT",
      description: "Lien d'accès au portail candidat envoyé",
      userId: session.user.id,
      leadId: leadId,
      organizationId: lead!.organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true, url: fullUrl };
}

export async function revokePortalToken(tokenId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.leadPortalToken.delete({ where: { id: tokenId } });
  return { success: true };
}