import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { blocksToEmailHtml, replaceVars, promoteToContacted } from "@/lib/campaign-html";
import { getCampaignLeadsQuery } from "@/lib/campaign-leads";

export const runtime = "nodejs";
export const maxDuration = 60;

var BATCH_SIZE = 30;

export async function GET(request: NextRequest) {
  var authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  var stats = { sent: 0, failed: 0, campaignsCompleted: 0, campaignsStarted: 0 };

  try {
    // ─── Campagnes PROGRAMMÉES arrivées à échéance → on matérialise les destinataires ───
    // (l'audience est calculée maintenant, à l'envoi, pour refléter les derniers changements)
    var dueScheduled = await prisma.emailCampaign.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      take: 5,
    });
    for (var sc of dueScheduled) {
      try {
        var scRules = (sc.segmentRules as any) || [];
        var scQuery = await getCampaignLeadsQuery(sc.organizationId, sc.audienceId, scRules);
        var scWhere = { ...scQuery.where, email: { not: null } };
        var scLeads = await prisma.lead.findMany({ where: scWhere, select: { id: true, email: true } });

        if (scLeads.length === 0) {
          // Aucun destinataire → on clôture sans envoi
          await prisma.emailCampaign.update({
            where: { id: sc.id },
            data: { status: "SENT", sentAt: new Date(), completedAt: new Date(), totalRecipients: 0 },
          });
          continue;
        }

        await prisma.emailCampaignRecipient.createMany({
          data: scLeads.map(function(l) { return { campaignId: sc.id, leadId: l.id, email: l.email as string, status: "PENDING" as const }; }),
          skipDuplicates: true,
        });
        await prisma.emailCampaign.update({
          where: { id: sc.id },
          data: { status: "SENDING", sentAt: new Date(), totalRecipients: scLeads.length },
        });
        stats.campaignsStarted++;
      } catch (e) {
        console.error("[Cron Campaigns] Promotion campagne programmée échouée", sc.id, e);
      }
    }

    // Campagnes en cours d'envoi (inclut celles qu'on vient de promouvoir)
    var sendingCampaigns = await prisma.emailCampaign.findMany({
      where: { status: "SENDING" },
      take: 5,
    });

    for (var campaign of sendingCampaigns) {
      // Prend un lot de destinataires en attente
      var pending = await prisma.emailCampaignRecipient.findMany({
        where: { campaignId: campaign.id, status: "PENDING" },
        take: BATCH_SIZE,
      });

      // Plus de PENDING → la campagne est terminée
      if (pending.length === 0) {
        var allRecipients = await prisma.emailCampaignRecipient.findMany({
          where: { campaignId: campaign.id },
          select: { status: true },
        });
        var sentCount = allRecipients.filter(function(r) { return r.status !== "PENDING"; }).length;
        var failedCount = allRecipients.filter(function(r) { return r.status === "FAILED"; }).length;

        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: "SENT", completedAt: new Date(), sentCount: sentCount, failedCount: failedCount },
        });
        stats.campaignsCompleted++;

        // Passage automatique en "Contacté"
        await promoteToContacted(campaign.id, campaign.organizationId);
        continue;
      }

      // Compose l'expéditeur "Nom utilisateur — École"
      var senderUser = campaign.createdById
        ? await prisma.user.findUnique({ where: { id: campaign.createdById }, select: { name: true } })
        : null;
      var org = await prisma.organization.findUnique({
        where: { id: campaign.organizationId },
        select: { name: true },
      });
      var campaignFromName = [senderUser?.name, org?.name].filter(Boolean).join(" — ") || "TalibCRM";
      var campaignFromEmail = process.env.EMAIL_FROM_CAMPAIGN || "admission@talibcrm.com";

      var attachments = (campaign.attachments as any[]) || [];

      // Envoie le lot
      for (var recipient of pending) {
        var lead = await prisma.lead.findUnique({
          where: { id: recipient.leadId },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (!lead || !lead.email) {
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "FAILED", errorMessage: "Lead ou email introuvable" },
          });
          stats.failed++;
          continue;
        }

        var personalizedSubject = replaceVars(campaign.subject, lead);
        var htmlBody = "";
        try {
          var parsedBlocks = JSON.parse(campaign.body);
          if (Array.isArray(parsedBlocks)) {
            htmlBody = blocksToEmailHtml(parsedBlocks, lead);
          } else {
            htmlBody = replaceVars(campaign.body, lead);
          }
        } catch {
          htmlBody = replaceVars(campaign.body, lead);
        }

        var sendResult = await sendEmail({
          to: lead.email,
          toName: lead.firstName + " " + lead.lastName,
          subject: personalizedSubject,
          body: htmlBody,
          isHtml: true,
          leadId: lead.id,
          organizationId: campaign.organizationId,
          sentById: campaign.createdById || undefined,
          fromName: campaignFromName,
          fromEmail: campaignFromEmail,
          isCampaign: true,
          includeSignature: (campaign as any).includeSignature !== false,
          attachments: attachments.length > 0
            ? attachments.map(function(a) {
                return { path: a.path, filename: a.filename, contentType: a.contentType, size: a.size };
              })
            : undefined,
        });

        if (sendResult.success) {
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "SENT", sentAt: new Date(), brevoMessageId: sendResult.messageId || null },
          });
          stats.sent++;
        } else {
          await prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "FAILED", errorMessage: sendResult.error || "Erreur envoi" },
          });
          stats.failed++;
        }

        // Rate limit
        await new Promise(function(r) { setTimeout(r, 120); });
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("[Cron Campaigns]", error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}