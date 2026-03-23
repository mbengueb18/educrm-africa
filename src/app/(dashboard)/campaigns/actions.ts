"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

  // Count matching leads
  var where = buildWhereFromRules(data.segmentRules, session.user.organizationId);
  where.email = { not: null };

  var matchingCount = await prisma.lead.count({ where: where });

  var campaign = await prisma.emailCampaign.create({
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      segmentRules: data.segmentRules as any,
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
  if (!session?.user) throw new Error("Non authentifie");

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
  segmentRules?: SegmentRule[];
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.segmentRules !== undefined) {
    updateData.segmentRules = data.segmentRules as any;
    // Recount recipients
    var where = buildWhereFromRules(data.segmentRules, session.user.organizationId);
    where.email = { not: null };
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
  if (!session?.user) throw new Error("Non authentifie");

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
  if (!session?.user) throw new Error("Non authentifie");

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
export async function previewSegment(rules: SegmentRule[]) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

  var where = buildWhereFromRules(rules, session.user.organizationId);
  where.email = { not: null };

  var leads = await prisma.lead.findMany({
    where: where,
    select: { id: true, firstName: true, lastName: true, email: true, city: true, source: true, score: true },
    take: 500,
  });

  return { count: leads.length, leads: leads };
}

// ─── Send campaign ───
export async function sendCampaign(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

  var campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status !== "DRAFT") throw new Error("Cette campagne a deja ete envoyee");

  var rules = (campaign.segmentRules as unknown as SegmentRule[]) || [];
  var where = buildWhereFromRules(rules, session.user.organizationId);
  where.email = { not: null };

  var leads = await prisma.lead.findMany({
    where: where,
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (leads.length === 0) throw new Error("Aucun lead avec email dans ce segment");

  // Update campaign status
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENDING",
      sentAt: new Date(),
      totalRecipients: leads.length,
    },
  });

  // Create recipients
  await prisma.emailCampaignRecipient.createMany({
    data: leads.map(function(lead) {
      return {
        campaignId: campaignId,
        leadId: lead.id,
        email: lead.email!,
        status: "PENDING",
      };
    }),
  });

  // Send emails via Brevo
  var apiKey = process.env.BREVO_API_KEY;
  var senderEmail = process.env.EMAIL_FROM || "noreply@educrm.africa";
  var senderName = process.env.EMAIL_FROM_NAME || "EduCRM";
  var sentCount = 0;
  var failedCount = 0;

  var recipients = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId: campaignId },
  });

  for (var recipient of recipients) {
    var lead = leads.find(function(l) { return l.id === recipient.leadId; });
    if (!lead || !lead.email) continue;

    var personalizedSubject = replaceVars(campaign.subject, lead);
    var rawBody = campaign.body;
    var htmlBody = "";
    try {
      var parsedBlocks = JSON.parse(rawBody);
      if (Array.isArray(parsedBlocks)) {
        htmlBody = blocksToEmailHtml(parsedBlocks, lead);
      } else {
        htmlBody = replaceVars(rawBody, lead);
      }
    } catch {
      htmlBody = replaceVars(rawBody, lead);
    }

    if (!apiKey) {
      // Demo mode
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sentCount++;
      continue;
    }

    try {
      var response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: lead.email, name: lead.firstName + " " + lead.lastName }],
          subject: personalizedSubject,
          htmlContent: htmlBody.startsWith("<!DOCTYPE") ? htmlBody : formatCampaignHtml(htmlBody, personalizedSubject, senderName),
textContent: stripHtml(htmlBody),
          headers: { "X-Campaign-Id": campaignId },
          tags: ["educrm", "campaign", campaignId],
        }),
      });

      var result = await response.json();

      if (response.ok) {
        await prisma.emailCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            brevoMessageId: result.messageId || null,
          },
        });
        sentCount++;
      } else {
        await prisma.emailCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", errorMessage: result.message || "Erreur Brevo" },
        });
        failedCount++;
      }
    } catch (err: any) {
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", errorMessage: err.message || "Erreur reseau" },
      });
      failedCount++;
    }

    // Rate limit
    await new Promise(function(r) { setTimeout(r, 120); });
  }

  // Update campaign totals
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "SENT",
      completedAt: new Date(),
      sentCount: sentCount,
      failedCount: failedCount,
    },
  });

  revalidatePath("/campaigns");
  revalidatePath("/campaigns/" + campaignId);

  return { sentCount: sentCount, failedCount: failedCount, total: leads.length };
}

// ─── Delete campaign ───
export async function deleteCampaign(campaignId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

  await prisma.emailCampaign.delete({ where: { id: campaignId } });
  revalidatePath("/campaigns");
}

// ─── Get campaign stats (for dashboard) ───
export async function getCampaignStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifie");

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

function replaceVars(text: string, lead: { firstName: string; lastName: string; email: string | null }): string {
  return text
    .replace(/\{\{prenom\}\}/gi, lead.firstName)
    .replace(/\{\{firstName\}\}/gi, lead.firstName)
    .replace(/\{\{nom\}\}/gi, lead.lastName)
    .replace(/\{\{lastName\}\}/gi, lead.lastName)
    .replace(/\{\{email\}\}/gi, lead.email || "");
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
    '<p style="margin:0;font-size:12px;color:#9CA3AF;">Envoye par ' + senderName + " via EduCRM Africa</p>" +
    "</div></div></body></html>";
}

function blocksToEmailHtml(blocks: any[], lead: { firstName: string; lastName: string; email: string | null }): string {
  var content = blocks.map(function(b: any) {
    var type = b.type;
    var styles = b.styles || {};
    var raw = b.content || "";
    var text = replaceVars(raw, lead);

    switch (type) {
      case "text":
      return text.split("\n").map(function(line: string) {
          return '<p style="margin:0 0 8px;line-height:1.6;font-size:' + (styles.fontSize || "15px") + ";color:" + (styles.color || "#555") + ";text-align:" + (styles.textAlign || "left") + ';">' + (line || "&nbsp;") + "</p>";
        }).join("");
      case "heading":
  if (text.includes("<")) {
    return '<div style="font-size:' + (styles.fontSize || "22px") + ";color:" + (styles.color || "#1B4F72") + ";font-weight:700;text-align:" + (styles.textAlign || "left") + ';">' + text + "</div>";
  }
  return '<h2 style="margin:0 0 12px;font-size:' + (styles.fontSize || "22px") + ";color:" + (styles.color || "#1B4F72") + ";font-weight:700;text-align:" + (styles.textAlign || "left") + ';">' + text + "</h2>";
      case "button":
        return '<div style="text-align:' + (styles.textAlign || "center") + ';padding:12px 0;"><a href="' + (styles.href || "#") + '" style="display:inline-block;padding:12px 28px;background:' + (styles.bgColor || "#1B4F72") + ";color:" + (styles.color || "white") + ";border-radius:" + (styles.borderRadius || "8px") + ';text-decoration:none;font-weight:600;font-size:14px;">' + text + "</a></div>";
      case "image":
        return raw ? '<div style="text-align:' + (styles.textAlign || "center") + ';padding:8px 0;"><img src="' + raw + '" alt="" style="max-width:100%;width:' + (styles.width || "100%") + ';border-radius:8px;" /></div>' : "";
      case "video":
      var thumbUrl = b.styles.thumbnail || "";
      var videoUrl = b.content || "#";
      if (!thumbUrl && videoUrl.includes("youtube.com")) {
        var vid = videoUrl.match(/[?&]v=([^&]+)/)?.[1] || "";
        if (vid) thumbUrl = "https://img.youtube.com/vi/" + vid + "/hqdefault.jpg";
      }
      return '<div style="text-align:' + (b.styles.textAlign || "center") + ';padding:8px 0;"><a href="' + videoUrl + '" style="display:inline-block;position:relative;text-decoration:none;">' +
        (thumbUrl ? '<img src="' + thumbUrl + '" style="max-width:100%;width:' + (b.styles.width || "100%") + ';border-radius:8px;display:block;" />' : '<div style="width:400px;height:225px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;">&#9654;</span></div>') +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(255,255,255,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="font-size:24px;color:#e74c3c;margin-left:4px;">&#9654;</span></div>' +
        "</a></div>";
      case "divider":
        return '<hr style="border:none;border-top:1px ' + (styles.borderStyle || "solid") + " " + (styles.color || "#e5e7eb") + ';margin:16px 0;" />';
      case "spacer":
        return '<div style="height:' + (styles.height || "24px") + ';"></div>';
      default:
        return "";
    }
  }).join("");

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    '<div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #e5e7eb;">' +
    '<p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">Envoye via EduCRM Africa</p>' +
    "</div></div></body></html>";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
