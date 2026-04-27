"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getLeadDetail(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      assignedTo: { select: { id: true, name: true, avatar: true, email: true } },
      program: { select: { id: true, name: true, code: true, level: true, tuitionAmount: true, currency: true } },
      campus: { select: { id: true, name: true, city: true } },
      campaign: { select: { id: true, name: true, type: true } },
      stage: { select: { id: true, name: true, color: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 20,
        select: {
          id: true,
          channel: true,
          direction: true,
          content: true,
          status: true,
          sentAt: true,
          attachments: { select: { id: true, filename: true, contentType: true, size: true } },
        },
      },
      calls: {
        orderBy: { calledAt: "desc" },
        take: 20,
        include: {
          calledBy: { select: { name: true } },
        },
      },
      appointments: {
        orderBy: { startAt: "desc" },
        take: 20,
        include: {
          assignedTo: { select: { name: true } },
        },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          assignedTo: { select: { name: true } },
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          url: true,
          createdAt: true,
        },
      },
      _count: {
        select: { messages: true, activities: true, documents: true, calls: true, appointments: true, tasks: true },
      },
    },
  });

  if (!lead) throw new Error("Lead introuvable");

  return lead;
}

// ─── Log WhatsApp message ───
export async function logWhatsAppMessage(leadId: string, content: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.message.create({
    data: {
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      content,
      status: "SENT",
      sentAt: new Date(),
      leadId,
     // sender: { connect: { id: session.user.id } },
      organizationId: session.user.organizationId,
    },
  });

  await prisma.activity.create({
    data: {
      type: "MESSAGE_SENT",
      description: "Message WhatsApp envoyé",
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
    },
  });
}

// ─── Update lead notes ───
export async function updateLeadNotes(leadId: string, notes: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: { customFields: true },
  });

  if (!lead) throw new Error("Lead introuvable");

  var customFields = (lead.customFields as Record<string, any>) || {};
  customFields._notes = notes;

  await prisma.lead.update({
    where: { id: leadId },
    data: { customFields },
  });

  if (notes.trim()) {
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        description: "Note ajoutée",
        userId: session.user.id,
        leadId,
        organizationId: session.user.organizationId,
      },
    });
  }

  return { success: true };
}