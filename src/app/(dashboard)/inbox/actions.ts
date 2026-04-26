"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendBulkEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

// ─── Send email to a lead ───
export async function sendEmailToLead(leadId: string, subject: string, body: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!lead) throw new Error("Lead introuvable");
  if (!lead.email) throw new Error("Ce lead n'a pas d'adresse email");

  const result = await sendEmail({
    to: lead.email,
    toName: lead.firstName + " " + lead.lastName,
    subject,
    body,
    leadId,
    organizationId: session.user.organizationId,
    sentById: session.user.id,
  });

  revalidatePath("/pipeline");
  revalidatePath("/inbox");

  return result;
}

// ─── Send bulk email to multiple leads ───
export async function sendBulkEmailToLeads(
  leadIds: string[],
  subject: string,
  body: string
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
      lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      sentBy: { select: { id: true, name: true } },
    },
  });

  // 3. Group by lead
  var grouped: Record<string, {
    lead: { id: string; firstName: string; lastName: string; email: string | null; phone: string };
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
