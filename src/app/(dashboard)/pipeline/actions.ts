"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Get pipeline data ───
export async function getPipelineData() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  const [stages, leads, users] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { order: "asc" },
    }),
    prisma.lead.findMany({
      where: { organizationId, isConverted: false },
      include: {
        assignedTo: { select: { id: true, name: true, avatar: true } },
        program: { select: { id: true, name: true, code: true } },
        campaign: { select: { id: true, name: true } },
        _count: { select: { messages: true, activities: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { organizationId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
      select: { id: true, name: true, avatar: true },
    }),
  ]);

  return { stages, leads, users };
}

// ─── Move lead to stage ───
export async function moveLeadToStage(leadId: string, stageId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { stageId },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_STAGE_CHANGED",
      description: `Lead déplacé vers une nouvelle étape`,
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
      metadata: { newStageId: stageId },
    },
  });

  revalidatePath("/pipeline");
  return lead;
}

// ─── Create new lead ───
const createLeadSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().min(8, "Téléphone requis"),
  whatsapp: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  city: z.string().optional(),
  source: z.enum([
    "WEBSITE", "FACEBOOK", "INSTAGRAM", "WHATSAPP", "PHONE_CALL",
    "WALK_IN", "REFERRAL", "SALON", "RADIO", "TV", "PARTNER", "IMPORT", "OTHER",
  ]),
  sourceDetail: z.string().optional(),
  programId: z.string().optional(),
  campusId: z.string().optional(),
  assignedToId: z.string().optional(),
});

export async function createLead(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  const data = createLeadSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    city: formData.get("city"),
    source: formData.get("source"),
    sourceDetail: formData.get("sourceDetail"),
    programId: formData.get("programId") || undefined,
    campusId: formData.get("campusId") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
  });

  const defaultStage = await prisma.pipelineStage.findFirst({
    where: { organizationId, isDefault: true },
  });

  if (!defaultStage) throw new Error("Aucune étape par défaut configurée");

  const lead = await prisma.lead.create({
    data: {
      ...data,
      email: data.email || null,
      whatsapp: data.whatsapp || data.phone,
      stageId: defaultStage.id,
      organizationId,
    },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_CREATED",
      description: `Nouveau lead: ${data.firstName} ${data.lastName}`,
      userId: session.user.id,
      leadId: lead.id,
      organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true, lead };
}

// ─── Update lead score ───
export async function updateLeadScore(leadId: string, score: number) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.lead.update({
    where: { id: leadId },
    data: { score: Math.max(0, Math.min(100, score)) },
  });

  revalidatePath("/pipeline");
}

// ─── Assign lead ───
export async function assignLead(leadId: string, userId: string | null) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: userId },
  });

  await prisma.activity.create({
    data: {
      type: "LEAD_ASSIGNED",
      description: userId ? "Lead assigné" : "Lead désassigné",
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/pipeline");
}

// ─── Get pipeline stats ───
export async function getPipelineStats() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [totalLeads, newLeadsWeek, convertedMonth, stages] = await Promise.all([
    prisma.lead.count({
      where: { organizationId, isConverted: false },
    }),
    prisma.lead.count({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.lead.count({
      where: { organizationId, isConverted: true, convertedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.pipelineStage.findMany({
      where: { organizationId },
      include: { _count: { select: { leads: true } } },
      orderBy: { order: "asc" },
    }),
  ]);

  return {
    totalLeads,
    newLeadsWeek,
    convertedMonth,
    stageBreakdown: stages.map((s) => ({
      name: s.name,
      count: s._count.leads,
      color: s.color,
    })),
  };
}
