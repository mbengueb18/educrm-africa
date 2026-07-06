"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { blocksToEmailHtml, replaceVars, promoteToContacted } from "@/lib/campaign-html";
import { getCampaignLeadsQuery } from "@/lib/campaign-leads";

// ─── Helper : Get leads for a campaign (audience-based OR rules-based) ───
// ─── Helper : Count leads with/without email for an audience or rules ───
async function getRecipientStats(
  organizationId: string,
  audienceId: string | null,
  rules: any
): Promise<{
  total: number;
  withEmail: number;
  withoutEmail: number;
  fromAudience: boolean;
  audienceName?: string;
}> {
  var queryResult = await getCampaignLeadsQuery(organizationId, audienceId, rules);
  var baseWhere = queryResult.where;

  var [total, withEmail] = await Promise.all([
    prisma.lead.count({ where: baseWhere }),
    prisma.lead.count({ where: { ...baseWhere, email: { not: null } } }),
  ]);

  return {
    total: total,
    withEmail: withEmail,
    withoutEmail: total - withEmail,
    fromAudience: queryResult.fromAudience,
    audienceName: queryResult.audienceName,
  };
}

// ─── Segment rules type ───
export interface SegmentRule {
  field: string;      // stageId, source, city, programId, score, assignedToId, createdAt
  operator: string;   // equals, not_equals, contains, gt, lt, gte, lte, in, between
  value: any;
}

// ─── Create campaign ───
export async function createCampaign(data: {
  name: string;
  subject: string;
  body: string;
  segmentRules: SegmentRule[];
  audienceId?: string | null;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Count matching leads (with email)
  var queryResult = await getCampaignLeadsQuery(
    session.user.organizationId,
    data.audienceId || null,
    data.segmentRules
  );
  var where = { ...queryResult.where, email: { not: null } };
  var matchingCount = await prisma.lead.count({ where: where });

  var campaign = await prisma.emailCampaign.create({
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      segmentRules: data.segmentRules as any,
      audienceId: data.audienceId || null,
      status: "DRAFT",
      totalRecipients: matchingCount,
      createdById: session.user.id,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/campaigns");
  return campaign;
}

// ─── Quick create campaign (empty draft) ───
export async function quickCreateCampaign() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.create({
    data: {
      name: "Nouvelle campagne",
      subject: "",
      body: "[]",
      segmentRules: [],
      status: "DRAFT",
      createdById: session.user.id,
      organizationId: session.user.organizationId,
    },
  });

  return campaign;
}

// ─── Update campaign draft (auto-save) ───
export async function updateCampaignDraft(campaignId: string, data: {
  name?: string;
  subject?: string;
  body?: string;
  segmentRules?: any;
  audienceId?: string | null;
  attachments?: any[];
  includeSignature?: boolean;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Fetch current campaign to know its mode
  var currentCampaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    select: { audienceId: true, segmentRules: true },
  });
  if (!currentCampaign) throw new Error("Campagne introuvable");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.attachments !== undefined) updateData.attachments = data.attachments;
  if (data.includeSignature !== undefined) updateData.includeSignature = data.includeSignature;

  // Handle audienceId update (can be set or unset)
  var newAudienceId = data.audienceId !== undefined ? data.audienceId : currentCampaign.audienceId;
  var newRules = data.segmentRules !== undefined ? data.segmentRules : (currentCampaign.segmentRules as unknown as SegmentRule[]) || [];

  if (data.audienceId !== undefined) {
    updateData.audienceId = data.audienceId;
  }
  if (data.segmentRules !== undefined) {
    updateData.segmentRules = data.segmentRules as any;
  }

  // Recount recipients if audience or rules changed
  if (data.audienceId !== undefined || data.segmentRules !== undefined) {
    var queryResult = await getCampaignLeadsQuery(session.user.organizationId, newAudienceId, newRules);
    var where = { ...queryResult.where, email: { not: null } };
    var count = await prisma.lead.count({ where: where });
    updateData.totalRecipients = count;
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: updateData,
  });

  return { success: true };
}

// ─── Get campaigns list ───
export async function getCampaigns() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.emailCampaign.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { recipients: true } },
    },
  });
}

// ─── Get campaign detail with recipients ───
export async function getCampaignDetail(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      createdBy: { select: { name: true } },
      recipients: {
        orderBy: { sentAt: "desc" },
        take: 200,
      },
    },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  return campaign;
}

// ─── Preview segment (count matching leads) ───
export async function previewSegment(rules: any, audienceId?: string | null) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  var queryResult = await getCampaignLeadsQuery(session.user.organizationId, audienceId || null, rules);
  var where = { ...queryResult.where, email: { not: null } };
  var [count, leads] = await Promise.all([
    prisma.lead.count({ where: where }),
    prisma.lead.findMany({
      where: where,
      select: { id: true, firstName: true, lastName: true, email: true, city: true, source: true, score: true },
      take: 500,
    }),
  ]);
  return { count: count, leads: leads };
}

// ─── Send campaign (prépare l'envoi par lots, ne bloque pas) ───
export async function sendCampaign(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne a deja ete envoyee");

  var rules = (campaign.segmentRules as unknown as SegmentRule[]) || [];
  var queryResult = await getCampaignLeadsQuery(
    session.user.organizationId,
    campaign.audienceId,
    rules
  );
  var where = { ...queryResult.where, email: { not: null } };

  var leads = await prisma.lead.findMany({
    where: where,
    select: { id: true, email: true },
  });
  if (leads.length === 0) throw new Error("Aucun lead avec email dans ce segment");

  // Crée les destinataires en PENDING (l'envoi réel se fait par le cron)
  await prisma.emailCampaignRecipient.createMany({
    data: leads.map(function(lead) {
      return {
        campaignId: campaignId,
        leadId: lead.id,
        email: lead.email!,
        status: "PENDING",
      };
    }),
    skipDuplicates: true,
  });

  // Passe la campagne en SENDING — le cron prend le relais
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENDING",
      sentAt: new Date(),
      totalRecipients: leads.length,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath("/campaigns/" + campaignId);

  // Retourne tout de suite : l'envoi se fait en arrière-plan
  return { queued: leads.length, total: leads.length };
}

// ─── Programmer l'envoi d'une campagne à une date/heure ultérieure ───
export async function scheduleCampaign(campaignId: string, scheduledAtISO: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.organizationId !== session.user.organizationId) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne ne peut plus être programmée.");

  var when = new Date(scheduledAtISO);
  if (isNaN(when.getTime())) throw new Error("Date invalide.");
  if (when.getTime() < Date.now() + 60 * 1000) throw new Error("Choisissez une date au moins 1 minute dans le futur.");

  // Les destinataires seront calculés à l'échéance (par le cron), sur l'audience à jour.
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "SCHEDULED", scheduledAt: when },
  });

  revalidatePath("/campaigns");
  revalidatePath("/campaigns/" + campaignId);
  return { success: true, scheduledAt: when };
}

// ─── Annuler la programmation (repasse en brouillon) ───
export async function cancelScheduledCampaign(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.organizationId !== session.user.organizationId) throw new Error("Campagne introuvable");
  if (campaign.status !== "SCHEDULED") throw new Error("Cette campagne n'est pas programmée.");

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "DRAFT", scheduledAt: null },
  });

  revalidatePath("/campaigns");
  revalidatePath("/campaigns/" + campaignId);
  return { success: true };
}

// ─── Delete campaign ───
export async function deleteCampaign(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  await prisma.emailCampaign.delete({ where: { id: campaignId } });
  revalidatePath("/campaigns");
}

// ─── Get campaign stats (for dashboard) ───
export async function getCampaignStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaigns = await prisma.emailCampaign.findMany({
    where: { organizationId: session.user.organizationId, status: "SENT" },
    select: {
      id: true, name: true, sentAt: true,
      totalRecipients: true, sentCount: true, deliveredCount: true,
      openedCount: true, clickedCount: true, bouncedCount: true, failedCount: true,
    },
    orderBy: { sentAt: "desc" },
    take: 20,
  });

  var totals = {
    totalCampaigns: campaigns.length,
    totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalBounced: 0,
  };

  for (var c of campaigns) {
    totals.totalSent += c.sentCount;
    totals.totalDelivered += c.deliveredCount;
    totals.totalOpened += c.openedCount;
    totals.totalClicked += c.clickedCount;
    totals.totalBounced += c.bouncedCount;
  }

  return { campaigns: campaigns, totals: totals };
}

// ─── Refresh campaign stats from recipients ───
export async function refreshCampaignStats(campaignId: string) {
  var recipients = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId: campaignId },
  });

  var stats = {
    sentCount: 0, deliveredCount: 0, openedCount: 0,
    clickedCount: 0, bouncedCount: 0, failedCount: 0,
  };

  for (var r of recipients) {
    if (r.status === "SENT" || r.status === "DELIVERED" || r.status === "OPENED" || r.status === "CLICKED") stats.sentCount++;
    if (r.status === "DELIVERED" || r.status === "OPENED" || r.status === "CLICKED") stats.deliveredCount++;
    if (r.status === "OPENED" || r.status === "CLICKED") stats.openedCount++;
    if (r.status === "CLICKED") stats.clickedCount++;
    if (r.status === "BOUNCED") stats.bouncedCount++;
    if (r.status === "FAILED") stats.failedCount++;
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: stats,
  });

  return stats;
}

// ─── Get recipient stats for a campaign (used for confirmation modal) ───
export async function getCampaignRecipientStats(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, organizationId: session.user.organizationId },
    select: { audienceId: true, segmentRules: true },
  });
  if (!campaign) throw new Error("Campagne introuvable");

  var rules = (campaign.segmentRules as unknown as SegmentRule[]) || [];
  return getRecipientStats(session.user.organizationId, campaign.audienceId, rules);
}

// ─── Get available audiences for campaign selector (STATIC + IMPORTED only) ───
export async function getAvailableAudiencesForCampaign() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var audiences = await prisma.audience.findMany({
    where: {
      organizationId: session.user.organizationId,
      type: { in: ["STATIC", "IMPORTED"] },
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      memberCount: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Pour chaque audience, compter les leads avec et sans email
  var enriched = await Promise.all(audiences.map(async function(aud) {
    var members = await prisma.audienceMember.findMany({
      where: { audienceId: aud.id },
      select: { leadId: true },
    });
    var leadIds = members.map(function(m) { return m.leadId; });
    
    if (leadIds.length === 0) {
      return { ...aud, withEmail: 0, withoutEmail: 0 };
    }

    var [withEmail, total] = await Promise.all([
      prisma.lead.count({ where: { id: { in: leadIds }, email: { not: null }, isConverted: false } }),
      prisma.lead.count({ where: { id: { in: leadIds }, isConverted: false } }),
    ]);

    return {
      ...aud,
      withEmail: withEmail,
      withoutEmail: total - withEmail,
    };
  }));

  return enriched;
}

export async function getCampaignProgress(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var [total, done] = await Promise.all([
    prisma.emailCampaignRecipient.count({
      where: { campaignId: campaignId },
    }),
    prisma.emailCampaignRecipient.count({
      where: { campaignId: campaignId, status: { not: "PENDING" } },
    }),
  ]);

  return { total: total, done: done };
}

// ─── Helpers ───
function buildWhereFromRules(rules: SegmentRule[], organizationId: string): any {
  var where: any = { organizationId: organizationId, isConverted: false };

  for (var rule of rules) {
    switch (rule.operator) {
      case "equals":
        where[rule.field] = rule.value;
        break;
      case "not_equals":
        where[rule.field] = { not: rule.value };
        break;
      case "contains":
        where[rule.field] = { contains: rule.value, mode: "insensitive" };
        break;
      case "gt":
        where[rule.field] = { gt: Number(rule.value) };
        break;
      case "gte":
        where[rule.field] = { gte: Number(rule.value) };
        break;
      case "lt":
        where[rule.field] = { lt: Number(rule.value) };
        break;
      case "lte":
        where[rule.field] = { lte: Number(rule.value) };
        break;
      case "in":
        where[rule.field] = { in: Array.isArray(rule.value) ? rule.value : [rule.value] };
        break;
    }
  }

  return where;
}

function formatCampaignHtml(body: string, subject: string, senderName: string): string {
  var paragraphs = body.split("\n").map(function(line) {
    if (!line.trim()) return '<p style="margin:0 0 12px;">&nbsp;</p>';
    return '<p style="margin:0 0 12px;line-height:1.6;color:#2C3E50;">' + line + "</p>";
  }).join("");

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="background:#1B4F72;padding:24px 32px;">' +
    '<h1 style="margin:0;color:white;font-size:18px;font-weight:600;">' + subject + "</h1></div>" +
    '<div style="padding:32px;">' + paragraphs + "</div>" +
    '<div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #e5e7eb;">' +
    '<p style="margin:0;font-size:12px;color:#9CA3AF;">Envoye par ' + senderName + " via TalibCRM</p>" +
    "</div></div></body></html>";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
