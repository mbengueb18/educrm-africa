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

  // Auto-calculate lead scores
  await calculateLeadScores(organizationId);

  // Calculate last contact date for each lead
  var leadIds = leads.map(function(l) { return l.id; });

  var [lastCalls, lastMessages, lastAppointments] = await Promise.all([
    prisma.call.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { calledAt: true },
    }),
    prisma.message.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, direction: "OUTBOUND" },
      _max: { sentAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, status: { in: ["COMPLETED", "CONFIRMED", "SCHEDULED"] } },
      _max: { startAt: true },
    }),
  ]);

  var enrichedLeads = leads.map(function(lead) {
    var callDate = lastCalls.find(function(c) { return c.leadId === lead.id; })?._max?.calledAt;
    var msgDate = lastMessages.find(function(m) { return m.leadId === lead.id; })?._max?.sentAt;
    var apptDate = lastAppointments.find(function(a) { return a.leadId === lead.id; })?._max?.startAt;

    var dates = [callDate, msgDate, apptDate].filter(Boolean) as Date[];
    var lastContactAt = dates.length > 0 ? new Date(Math.max(...dates.map(function(d) { return d.getTime(); }))) : null;

    var now = new Date();
    var daysSinceContact = lastContactAt
      ? Math.floor((now.getTime() - lastContactAt.getTime()) / 86_400_000)
      : Math.floor((now.getTime() - lead.createdAt.getTime()) / 86_400_000);

    return { ...lead, lastContactAt, daysSinceContact };
  });

  return { stages, leads: enrichedLeads, users };
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

// ─── Calculate lead score ───
export async function calculateLeadScores(orgId: string) {
  var leads = await prisma.lead.findMany({
    where: { organizationId: orgId, isConverted: false },
    select: {
      id: true, source: true, email: true, whatsapp: true,
      programId: true, campusId: true, score: true, createdAt: true,
      _count: { select: { calls: true, messages: true, appointments: true } },
    },
  });

  var now = new Date();

  // Get last contact dates
  var leadIds = leads.map(function(l) { return l.id; });
  var [lastCalls, lastMessages] = await Promise.all([
    prisma.call.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { calledAt: true },
    }),
    prisma.message.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds }, direction: "OUTBOUND" },
      _max: { sentAt: true },
    }),
  ]);

  var sourceScores: Record<string, number> = {
    REFERRAL: 20, WALK_IN: 20, WEBSITE: 15, PHONE_CALL: 15,
    FACEBOOK: 10, INSTAGRAM: 10, WHATSAPP: 10,
    SALON: 10, PARTNER: 10, RADIO: 5, TV: 5, IMPORT: 5, OTHER: 5,
  };

  var updates: { id: string; score: number }[] = [];

  for (var lead of leads) {
    var score = 0;

    // Source score (max 20)
    score += sourceScores[lead.source] || 5;

    // Profile completeness (max 25)
    if (lead.email) score += 5;
    if (lead.whatsapp) score += 5;
    if (lead.programId) score += 10;
    if (lead.campusId) score += 5;

    // Interactions (max 55)
    score += Math.min(lead._count.calls * 5, 20);
    score += Math.min(lead._count.messages * 3, 15);
    score += Math.min(lead._count.appointments * 10, 20);

    // Recency bonus (max 15)
    var callDate = lastCalls.find(function(c) { return c.leadId === lead.id; })?._max?.calledAt;
    var msgDate = lastMessages.find(function(m) { return m.leadId === lead.id; })?._max?.sentAt;
    var dates = [callDate, msgDate].filter(Boolean) as Date[];
    var lastContact = dates.length > 0 ? new Date(Math.max(...dates.map(function(d) { return d.getTime(); }))) : null;

    if (lastContact) {
      var daysSince = Math.floor((now.getTime() - lastContact.getTime()) / 86_400_000);
      if (daysSince <= 3) score += 15;
      else if (daysSince <= 7) score += 10;
      else if (daysSince <= 14) score += 5;
    }

    // Cap at 100
    score = Math.min(score, 100);

    if (score !== lead.score) {
      updates.push({ id: lead.id, score });
    }
  }

  // Batch update scores
  if (updates.length > 0) {
    await Promise.all(
      updates.map(function(u) {
        return prisma.lead.update({ where: { id: u.id }, data: { score: u.score } });
      })
    );
  }

  return { updated: updates.length };
}

// ─── Detect duplicate leads ───
export async function detectDuplicates() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  var leads = await prisma.lead.findMany({
    where: { organizationId: orgId, isConverted: false },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, email: true, whatsapp: true,
      score: true, source: true, createdAt: true,
      stageId: true,
      assignedTo: { select: { name: true } },
      program: { select: { name: true } },
      _count: { select: { calls: true, messages: true, appointments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  var duplicateGroups: { key: string; reason: string; leads: typeof leads }[] = [];
  var processed = new Set<string>();

  for (var i = 0; i < leads.length; i++) {
    if (processed.has(leads[i].id)) continue;

    var group: typeof leads = [leads[i]];

    for (var j = i + 1; j < leads.length; j++) {
      if (processed.has(leads[j].id)) continue;

      var reason = "";

      // Same phone
      if (leads[i].phone && leads[j].phone) {
        var p1 = leads[i].phone.replace(/\D/g, "");
        var p2 = leads[j].phone.replace(/\D/g, "");
        if (p1.length >= 8 && p1 === p2) {
          reason = "Même téléphone";
        }
      }

      // Same email
      if (!reason && leads[i].email && leads[j].email) {
        if (leads[i].email.toLowerCase() === leads[j].email.toLowerCase()) {
          reason = "Même email";
        }
      }

      if (reason) {
        group.push(leads[j]);
        processed.add(leads[j].id);
        if (!duplicateGroups.find(function(g) { return g.key === leads[i].id; })) {
          // Set reason for first match
        }
      }
    }

    if (group.length > 1) {
      processed.add(leads[i].id);
      duplicateGroups.push({
        key: leads[i].id,
        reason: getGroupReason(leads[i], group.slice(1)),
        leads: group,
      });
    }
  }

  return duplicateGroups;
}

function getGroupReason(lead: any, others: any[]): string {
  var reasons: string[] = [];
  for (var other of others) {
    var p1 = lead.phone?.replace(/\D/g, "") || "";
    var p2 = other.phone?.replace(/\D/g, "") || "";
    if (p1.length >= 8 && p1 === p2 && !reasons.includes("Même téléphone")) reasons.push("Même téléphone");
    if (lead.email && other.email && lead.email.toLowerCase() === other.email.toLowerCase() && !reasons.includes("Même email")) reasons.push("Même email");
  }
  return reasons.join(" + ");
}

// ─── Merge duplicate leads ───
export async function mergeDuplicateLeads(keepId: string, removeIds: string[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  // Verify all leads belong to org
  var leads = await prisma.lead.findMany({
    where: { id: { in: [keepId, ...removeIds] }, organizationId: orgId },
  });

  if (leads.length !== 1 + removeIds.length) throw new Error("Leads introuvables");

  var keepLead = leads.find(function(l) { return l.id === keepId; });
  if (!keepLead) throw new Error("Lead principal introuvable");

  // Transfer all related data to the kept lead
  for (var removeId of removeIds) {
    await prisma.activity.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.message.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.call.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.appointment.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.task.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.document.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });
    await prisma.emailCampaignRecipient.updateMany({ where: { leadId: removeId }, data: { leadId: keepId } });

    // Merge missing fields
    var removeLead = leads.find(function(l) { return l.id === removeId; });
    if (removeLead) {
      var updates: any = {};
      if (!keepLead.email && removeLead.email) updates.email = removeLead.email;
      if (!keepLead.whatsapp && removeLead.whatsapp) updates.whatsapp = removeLead.whatsapp;
      if (!keepLead.city && removeLead.city) updates.city = removeLead.city;
      if (!keepLead.programId && removeLead.programId) updates.programId = removeLead.programId;
      if (!keepLead.campusId && removeLead.campusId) updates.campusId = removeLead.campusId;
      if (!keepLead.assignedToId && removeLead.assignedToId) updates.assignedToId = removeLead.assignedToId;

      if (Object.keys(updates).length > 0) {
        await prisma.lead.update({ where: { id: keepId }, data: updates });
      }
    }

    // Delete the duplicate
    await prisma.lead.delete({ where: { id: removeId } });
  }

  // Log activity
  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED" as any,
      description: removeIds.length + " doublon(s) fusionné(s)",
      userId: session.user.id,
      leadId: keepId,
      organizationId: orgId,
    },
  });

  revalidatePath("/pipeline");
  return { success: true };
}