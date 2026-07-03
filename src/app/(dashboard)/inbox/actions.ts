"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendBulkEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

// ─── Send email to a lead ───
export async function sendEmailToLead(
  leadId: string,
  subject: string,
  body: string,
  attachments?: { path: string; filename: string; contentType?: string; size?: number }[],
  isHtml?: boolean
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const [lead, sender, org] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
      select: { email: true, firstName: true, lastName: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { name: true } }),
  ]);

  if (!lead) throw new Error("Lead introuvable");
  if (!lead.email) throw new Error("Ce lead n'a pas d'adresse email");

  // Expéditeur aligné sur les campagnes : "Nom user — Nom org" + admission@talibcrm.com.
  // Si l'utilisateur a connecté sa boîte Gmail, preferUserMailbox enverra depuis SON email
  // (ces valeurs ne servent alors que de repli Resend).
  const fromName = [sender?.name, org?.name].filter(Boolean).join(" — ") || undefined;
  const fromEmail = process.env.EMAIL_FROM_CAMPAIGN || "admission@talibcrm.com";

  const result = await sendEmail({
    to: lead.email,
    toName: lead.firstName + " " + lead.lastName,
    subject,
    body,
    leadId,
    organizationId: session.user.organizationId,
    sentById: session.user.id,
    attachments,
    isHtml,
    preferUserMailbox: true,
    fromName,
    fromEmail,
  });

  revalidatePath("/pipeline");
  revalidatePath("/inbox");

  return result;
}

// ─── Send bulk email to multiple leads ───
export async function sendBulkEmailToLeads(
  leadIds: string[],
  subject: string,
  body: string,
  isHtml?: boolean
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      organizationId: session.user.organizationId,
      email: { not: null },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (leads.length === 0) throw new Error("Aucun lead avec email");

  const result = await sendBulkEmail({
    leads: leads.map(function(l) {
      return { id: l.id, email: l.email!, firstName: l.firstName, lastName: l.lastName };
    }),
    subject,
    body,
    organizationId: session.user.organizationId,
    sentById: session.user.id,
    isHtml,
  });

  revalidatePath("/pipeline");
  revalidatePath("/inbox");

  return result;
}

// ─── Get messages for a lead ───
export async function getLeadMessages(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.message.findMany({
    where: { leadId, organizationId: session.user.organizationId },
    orderBy: { sentAt: "desc" },
    include: {
      sentBy: { select: { id: true, name: true } },
    },
  });
}

// ─── Get all messages (inbox) ───
export async function getInboxMessages(params?: {
  channel?: string;
  search?: string;
  limit?: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // 1. Find the most recent message per lead (only leads with messages)
  var leadIdsWithMessages = await prisma.message.findMany({
    where: {
      organizationId: session.user.organizationId,
      leadId: { not: null },
      isCampaign: false,
      ...(params?.channel ? { channel: params.channel as any } : {}),
    },
    select: { leadId: true },
    orderBy: { sentAt: "desc" },
    distinct: ["leadId"],
    take: params?.limit || 100,
  });

  var leadIds = leadIdsWithMessages
    .map(function(m) { return m.leadId; })
    .filter(function(id): id is string { return !!id; });

  if (leadIds.length === 0) return [];

  // 2. Get ALL messages for those leads (not capped at 50)
  const messages = await prisma.message.findMany({
    where: {
      organizationId: session.user.organizationId,
      leadId: { in: leadIds },
    },
    orderBy: { sentAt: "desc" },
    include: {
      lead: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          whatsapp: true, score: true,
          assignedTo: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, color: true } },
          pipeline: { select: { id: true, name: true } },
          program: { select: { id: true, name: true } },
        },
      },
      sentBy: { select: { id: true, name: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true } },
    },
  });

  // 3. Group by lead
  var grouped: Record<string, {
    lead: typeof messages[0]["lead"];
    messages: typeof messages;
    lastMessage: typeof messages[0];
    unreadCount: number;
  }> = {};

  for (var msg of messages) {
    if (!msg.lead) continue;
    var key = msg.lead.id;
    if (!grouped[key]) {
      grouped[key] = {
        lead: msg.lead,
        messages: [],
        lastMessage: msg,
        unreadCount: 0,
      };
    }
    grouped[key].messages.push(msg);
    if (msg.direction === "INBOUND" && msg.status !== "READ") {
      grouped[key].unreadCount++;
    }
  }

  return Object.values(grouped).sort(function(a, b) {
    return new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime();
  });
}

// ─── Liste des utilisateurs assignables (pour le filtre Inbox) ───
export async function getInboxUsers() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      role: { in: ["ADMIN", "COMMERCIAL"] },
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ─── Add internal note to lead ───
export async function addLeadNote(leadId: string, content: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED",
      description: content,
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Nom de l'organisation (pour dynamiser les modèles : {{ecole}}) ───
export async function getOrgName(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "";
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true },
  });
  return org?.name || "";
}

// ─── Get email templates ───
export async function getEmailTemplates() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.messageTemplate.findMany({
    where: {
      organizationId: session.user.organizationId,
      channel: "EMAIL",
    },
    orderBy: { name: "asc" },
  });
}

// ─── Save email template ───
export async function saveEmailTemplate(name: string, subject: string, body: string, category: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const template = await prisma.messageTemplate.create({
    data: {
      name,
      channel: "EMAIL",
      subject,
      body,
      variables: ["prenom", "nom", "email"],
      category: category as any,
      isApproved: true,
      organizationId: session.user.organizationId,
    },
  });

  return template;
}

// ─── Get WhatsApp 24h window status for a lead ───
export async function getWhatsAppWindowStatus(leadId: string): Promise<{
  isOpen: boolean;
  lastInboundAt: Date | null;
  hoursRemaining: number;
  hoursElapsed: number;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Récupère le dernier message INBOUND WhatsApp pour ce lead
  const lastInbound = await prisma.message.findFirst({
    where: {
      leadId,
      organizationId: session.user.organizationId,
      channel: "WHATSAPP",
      direction: "INBOUND",
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (!lastInbound) {
    return { isOpen: false, lastInboundAt: null, hoursRemaining: 0, hoursElapsed: 0 };
  }

  const now = new Date();
  const lastAt = new Date(lastInbound.sentAt);
  const diffMs = now.getTime() - lastAt.getTime();
  const hoursElapsed = diffMs / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, 24 - hoursElapsed);
  const isOpen = hoursElapsed < 24;

  return {
    isOpen,
    lastInboundAt: lastAt,
    hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
  };
}

// ─── Send WhatsApp text from inbox (uses existing whatsapp-actions logic) ───
export async function sendWhatsAppFromInbox(leadId: string, text: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Réutilise la même logique que le slide-over
  const { sendWhatsAppToLead } = await import("@/app/(dashboard)/leads/[leadId]/whatsapp-actions");
  const result = await sendWhatsAppToLead({ leadId, text });

  revalidatePath("/inbox");
  return result;
}

// ─── Get full conversation for a single lead ───
export async function getConversation(leadId: string) {
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
      whatsapp: true,
      score: true,
      pipelineId: true,
      stage: { select: { id: true, name: true, color: true } },
      pipeline: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      program: { select: { id: true, name: true } },
    },
  });

  if (!lead) throw new Error("Lead introuvable");

  const messages = await prisma.message.findMany({
    where: {
      leadId,
      organizationId: session.user.organizationId,
    },
    orderBy: { sentAt: "asc" },
    include: {
      sentBy: { select: { id: true, name: true } },
      attachments: { select: { id: true, filename: true, contentType: true, size: true } },
    },
  });

  return { lead, messages };
}

// ─── Marquer tous les messages INBOUND d'une conversation comme lus ───
export async function markConversationAsRead(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const result = await prisma.message.updateMany({
    where: {
      leadId,
      organizationId: session.user.organizationId,
      direction: "INBOUND",
      status: { not: "READ" },
    },
    data: {
      status: "READ",
    },
  });

  revalidatePath("/inbox");
  return { markedAsRead: result.count };
}

// ─── Compteur total de messages non lus (pour le badge sidebar) ───
export async function getTotalUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;

  const count = await prisma.message.count({
    where: {
      organizationId: session.user.organizationId,
      direction: "INBOUND",
      status: { not: "READ" },
      leadId: { not: null },
      isCampaign: false,
    },
  });

  return count;
}

import { sendTemplateMessage, resolveVariablesFromLead } from "@/lib/whatsapp/send";
import { getWhatsAppIntegration } from "@/lib/whatsapp/integration";

// ─── Liste les templates Meta approuvés disponibles pour cette org ───
export async function getApprovedTemplatesForInbox() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const templates = await prisma.whatsAppTemplate.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      metaName: true,
      category: true,
      language: true,
      bodyText: true,
      headerText: true,
      footerText: true,
      buttons: true,
      variableMapping: true,
    },
  });

  return templates;
}

// ─── Envoie un template Meta depuis l'Inbox (utilisable même hors fenêtre 24h) ───
export async function sendWhatsAppTemplateFromInbox(
  leadId: string,
  templateId: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const orgId = session.user.organizationId;

  // Vérifier l'intégration AVANT toute action
  try {
    await getWhatsAppIntegration(orgId);
  } catch (e: any) {
    throw new Error(e.message);
  }

  // Récupérer le lead
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
  });
  if (!lead) throw new Error("Lead introuvable");
  if (!lead.whatsapp) throw new Error("Ce lead n'a pas de numéro WhatsApp");

  // Récupérer le template
  const template = await prisma.whatsAppTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: orgId,
      status: "APPROVED",
    },
  });
  if (!template) throw new Error("Template introuvable ou non approuvé");

  // Résoudre les variables du template depuis le lead
  const variableMapping = (template.variableMapping as Record<string, string> | null) || {};
  const bodyVariables = resolveVariablesFromLead(template.bodyText, variableMapping, lead);

  // Envoyer via Meta
  const result = await sendTemplateMessage(orgId, {
    to: lead.whatsapp,
    templateName: template.metaName,
    templateLanguage: template.language,
    bodyVariables: bodyVariables,
  });

  if (!result.success) {
    throw new Error(
      `Envoi échoué : ${result.errorMessage || "Erreur inconnue"} (code: ${result.errorCode || "—"})`
    );
  }

  // Construire un aperçu du message envoyé pour l'historique
  let renderedContent = template.bodyText;
  bodyVariables.forEach((value, idx) => {
    const placeholder = `{{${idx + 1}}}`;
    renderedContent = renderedContent.replace(placeholder, value);
  });

  // Créer un Message OUTBOUND dans la conversation
  await prisma.message.create({
    data: {
      organizationId: orgId,
      leadId: lead.id,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      content: renderedContent,
      status: "SENT",
      externalId: result.metaMessageId || null,
      sentAt: new Date(),
      sentById: session.user.id,
    },
  });

  // Créer une Activity
  await prisma.activity.create({
    data: {
      organizationId: orgId,
      leadId: lead.id,
      userId: session.user.id,
      type: "MESSAGE_SENT",
      description: `Template WhatsApp envoyé : ${template.metaName}`,
      metadata: {
        channel: "WHATSAPP",
        direction: "OUTBOUND",
        templateId: template.id,
        templateName: template.metaName,
        externalId: result.metaMessageId,
      },
    },
  });

  revalidatePath(`/inbox/${lead.id}`);
  revalidatePath("/inbox");

  return {
    success: true,
    metaMessageId: result.metaMessageId,
    renderedContent,
  };
}