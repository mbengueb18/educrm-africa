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

// ─── Update lead ───
export async function updateLead(leadId: string, data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  city?: string;
  source?: string;
  sourceDetail?: string;
  programId?: string | null;
  campusId?: string | null;
  assignedToId?: string | null;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      whatsapp: data.whatsapp,
      city: data.city,
      source: data.source as any,
      sourceDetail: data.sourceDetail,
      programId: data.programId,
      campusId: data.campusId,
      assignedToId: data.assignedToId,
    },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED" as any,
      description: "Informations du lead mises a jour",
      userId: session.user.id,
      leadId,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true, lead };
}

// ─── Delete lead ───
export async function deleteLead(leadId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Delete related records first
  await prisma.activity.deleteMany({ where: { leadId } });
  await prisma.message.deleteMany({ where: { leadId } });
  await prisma.document.deleteMany({ where: { leadId } });
  await prisma.emailCampaignRecipient.deleteMany({ where: { leadId } });

  await prisma.lead.delete({ where: { id: leadId } });

  revalidatePath("/pipeline");
  return { success: true };
}

// ─── Delete multiple leads ───
export async function deleteLeads(leadIds: string[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  for (var id of leadIds) {
    await prisma.activity.deleteMany({ where: { leadId: id } });
    await prisma.message.deleteMany({ where: { leadId: id } });
    await prisma.document.deleteMany({ where: { leadId: id } });
    await prisma.emailCampaignRecipient.deleteMany({ where: { leadId: id } });
  }

  await prisma.lead.deleteMany({
    where: { id: { in: leadIds }, organizationId: session.user.organizationId },
  });

  revalidatePath("/pipeline");
  return { success: true, count: leadIds.length };
}

// ─── Import leads from CSV data ───
export async function importLeadsFromCSV(rows: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  city?: string;
  source?: string;
  sourceDetail?: string;
  programCode?: string;
}[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var { organizationId } = session.user;

  var defaultStage = await prisma.pipelineStage.findFirst({
    where: { organizationId, isDefault: true },
  });
  if (!defaultStage) throw new Error("Aucune étape par défaut");

  var programs = await prisma.program.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true },
  });

  var created = 0;
  var skipped = 0;
  var errors: string[] = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row.firstName || !row.lastName) {
      errors.push("Ligne " + (i + 2) + ": prenom et nom requis");
      skipped++;
      continue;
    }
    if (!row.phone && !row.email) {
      errors.push("Ligne " + (i + 2) + ": téléphone ou email requis");
      skipped++;
      continue;
    }

    // Check duplicate
    var existing = await prisma.lead.findFirst({
      where: {
        organizationId,
        OR: [
          ...(row.phone ? [{ phone: row.phone }] : []),
          ...(row.email ? [{ email: row.email }] : []),
        ],
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Match program
    var programId: string | null = null;
    if (row.programCode) {
      var match = programs.find(function(p) {
        return (p.code && p.code.toLowerCase() === row.programCode!.toLowerCase()) ||
          p.name.toLowerCase().includes(row.programCode!.toLowerCase());
      });
      if (match) programId = match.id;
    }

    // Map source
    var sourceMap: Record<string, string> = {
      "site web": "WEBSITE", "website": "WEBSITE", "web": "WEBSITE",
      "facebook": "FACEBOOK", "fb": "FACEBOOK",
      "instagram": "INSTAGRAM", "insta": "INSTAGRAM",
      "whatsapp": "WHATSAPP", "wa": "WHATSAPP",
      "salon": "SALON", "forum": "SALON",
      "parrainage": "REFERRAL", "referral": "REFERRAL",
      "import": "IMPORT",
    };
    var source = "IMPORT";
    if (row.source) {
      source = sourceMap[row.source.toLowerCase()] || "IMPORT";
    }

    try {
      await prisma.lead.create({
        data: {
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          phone: row.phone?.trim() || "N/A",
          email: row.email?.trim() || null,
          whatsapp: row.whatsapp?.trim() || row.phone?.trim() || null,
          city: row.city?.trim() || null,
          source: source as any,
          sourceDetail: row.sourceDetail?.trim() || "Import CSV",
          stageId: defaultStage.id,
          programId,
          organizationId,
        },
      });
      created++;
    } catch (err: any) {
      errors.push("Ligne " + (i + 2) + ": " + (err.message || "Erreur"));
      skipped++;
    }
  }

  revalidatePath("/pipeline");
  return { created, skipped, errors, total: rows.length };
}

// ─── Export leads as CSV string ───
export async function exportLeadsCSV() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var leads = await prisma.lead.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      stage: { select: { name: true } },
      program: { select: { name: true, code: true } },
      campus: { select: { name: true, city: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  var headers = [
    "Prenom", "Nom", "Téléphone", "Email", "WhatsApp", "Ville",
    "Source", "Detail source", "Filière", "Campus", "Étape",
    "Score", "Assigne a", "Date création", "Converti"
  ];

  var rows = leads.map(function(l) {
    return [
      l.firstName,
      l.lastName,
      l.phone,
      l.email || "",
      l.whatsapp || "",
      l.city || "",
      l.source,
      l.sourceDetail || "",
      l.program?.name || "",
      l.campus?.city || "",
      l.stage?.name || "",
      String(l.score),
      l.assignedTo?.name || "",
      l.createdAt.toISOString().split("T")[0],
      l.isConverted ? "Oui" : "Non",
    ];
  });

  // Build CSV with BOM for Excel
  var csvContent = "\uFEFF" + headers.join(";") + "\n" +
    rows.map(function(row) {
      return row.map(function(cell) {
        // Escape cells containing separator or quotes
        if (cell.includes(";") || cell.includes('"') || cell.includes("\n")) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(";");
    }).join("\n");

  return csvContent;
}

// ─── Get lead detail with full history ───
export async function getLeadDetail(leadId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    include: {
      stage: { select: { id: true, name: true, color: true } },
      assignedTo: { select: { id: true, name: true, avatar: true } },
      program: { select: { id: true, name: true, code: true } },
      campus: { select: { id: true, name: true, city: true } },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      messages: {
        include: { sender: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      calls: {
        include: { calledBy: { select: { name: true } } },
        orderBy: { calledAt: "desc" },
        take: 20,
      },
      appointments: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take: 20,
      },
      tasks: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { messages: true, activities: true, calls: true, appointments: true, tasks: true } },
    },
  });

  return lead;
}
