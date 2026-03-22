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
        take: 20,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 10,
        select: {
          id: true,
          channel: true,
          direction: true,
          content: true,
          status: true,
          sentAt: true,
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
        select: { messages: true, activities: true, documents: true },
      },
    },
  });

  if (!lead) throw new Error("Lead introuvable");

  return lead;
}
