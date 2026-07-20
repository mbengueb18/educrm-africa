import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { blocksToEmailHtml, replaceVars, promoteToContacted } from "@/lib/campaign-html";
import { getCampaignLeadsQuery } from "@/lib/campaign-leads";
import { orgShowsBranding } from "@/lib/plans/checks";
import { sendTemplateMessage, resolveVariablesFromLead } from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const maxDuration = 60;

var BATCH_SIZE = 30; // emails par campagne et par tick
var WA_BATCH_SIZE = 30; // messages WhatsApp par campagne et par tick
var TIME_BUDGET_MS = 45_000; // marge sous maxDuration pour finir proprement
var STALE_CLAIM_MS = 10 * 60 * 1000; // claim PROCESSING considéré orphelin après 10 min

export async function GET(request: NextRequest) {
  var authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  var started = Date.now();
  var timeLeft = function() { return TIME_BUDGET_MS - (Date.now() - started); };
  var stats = { sent: 0, failed: 0, waSent: 0, waFailed: 0, campaignsCompleted: 0, campaignsStarted: 0 };

  try {
    // ─── Récupération des claims orphelins (tick précédent crashé/timeouté) ───
    var staleCutoff = new Date(Date.now() - STALE_CLAIM_MS);
    await prisma.emailCampaignRecipient.updateMany({
      where: { status: "PROCESSING", processingAt: { lt: staleCutoff } },
      data: { status: "PENDING", processingAt: null },
    });
    await prisma.whatsAppCampaignRecipient.updateMany({
      where: { status: "PROCESSING", processingAt: { lt: staleCutoff } },
      data: { status: "PENDING", processingAt: null },
    });

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

    // ─── Campagnes EMAIL en cours d'envoi ───
    var sendingCampaigns = await prisma.emailCampaign.findMany({
      where: { status: "SENDING" },
      take: 5,
    });

    for (var campaign of sendingCampaigns) {
      if (timeLeft() <= 0) break;

      // Claim ATOMIQUE d'un lot : PENDING → PROCESSING en une requête.
      // FOR UPDATE SKIP LOCKED : deux ticks qui se chevauchent ne peuvent pas
      // claimer les mêmes lignes → plus aucun double envoi possible.
      var pending: { id: string; leadId: string; email: string }[] = await prisma.$queryRaw`
        UPDATE "email_campaign_recipients" SET status = 'PROCESSING', "processingAt" = NOW()
        WHERE id IN (
          SELECT id FROM "email_campaign_recipients"
          WHERE "campaignId" = ${campaign.id} AND status = 'PENDING'
          ORDER BY id
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "leadId", email
      `;

      // Plus de PENDING → clôture si plus rien en cours (PROCESSING inclus)
      if (pending.length === 0) {
        var byStatus = await prisma.emailCampaignRecipient.groupBy({
          by: ["status"],
          where: { campaignId: campaign.id },
          _count: { _all: true },
        });
        var counts: Record<string, number> = {};
        byStatus.forEach(function(g) { counts[g.status] = g._count._all; });
        var inFlight = (counts["PENDING"] || 0) + (counts["PROCESSING"] || 0);
        if (inFlight > 0) continue; // un autre tick envoie encore — on clôturera plus tard

        var total = byStatus.reduce(function(sum, g) { return sum + g._count._all; }, 0);
        var failedCount = counts["FAILED"] || 0;
        var sentCount = total - failedCount;

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

      // Branding « Envoyé via TalibCRM » : plan gratuit uniquement (calculé 1x/campagne)
      var campaignBranding = await orgShowsBranding(campaign.organizationId);

      var attachments = (campaign.attachments as any[]) || [];

      // Leads du lot en une requête (au lieu d'une par destinataire)
      var batchLeads = await prisma.lead.findMany({
        where: { id: { in: pending.map(function(p) { return p.leadId; }) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      var leadMap = new Map(batchLeads.map(function(l) { return [l.id, l]; }));

      // Envoie le lot
      for (var i = 0; i < pending.length; i++) {
        var recipient = pending[i];

        if (timeLeft() <= 0) {
          // Budget temps épuisé : on relâche les claims restants pour le tick suivant
          var remainingIds = pending.slice(i).map(function(p) { return p.id; });
          await prisma.emailCampaignRecipient.updateMany({
            where: { id: { in: remainingIds }, status: "PROCESSING" },
            data: { status: "PENDING", processingAt: null },
          });
          break;
        }

        var lead = leadMap.get(recipient.leadId);
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
            htmlBody = blocksToEmailHtml(parsedBlocks, lead, campaignBranding);
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
          cc: (campaign as any).cc || undefined,
          bcc: (campaign as any).bcc || undefined,
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

    // ─── Campagnes WHATSAPP PROGRAMMÉES à échéance → matérialiser les destinataires ───
    var waDueScheduled = await prisma.whatsAppCampaign.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      take: 5,
    });
    for (var wsc of waDueScheduled) {
      try {
        var wscRules = (wsc.segmentRules as any) || [];
        var wscHasRules = Array.isArray(wscRules) ? wscRules.length > 0 : (wscRules && Array.isArray(wscRules.rules) && wscRules.rules.length > 0);
        if (!wsc.audienceId && !wscHasRules) {
          await prisma.whatsAppCampaign.update({
            where: { id: wsc.id },
            data: { status: "FAILED" },
          });
          continue;
        }
        // Audience figée OU règles ad-hoc — même moteur que l'emailing
        var wscQuery = await getCampaignLeadsQuery(wsc.organizationId, wsc.audienceId, wscRules);
        var waSchedLeads = await prisma.lead.findMany({
          where: { ...wscQuery.where, whatsapp: { not: null } },
          select: { id: true, whatsapp: true },
        });

        if (waSchedLeads.length === 0) {
          await prisma.whatsAppCampaign.update({
            where: { id: wsc.id },
            data: { status: "SENT", sentAt: new Date(), completedAt: new Date(), totalRecipients: 0 },
          });
          continue;
        }

        await prisma.whatsAppCampaignRecipient.createMany({
          data: waSchedLeads.map(function(l) {
            return { campaignId: wsc.id, leadId: l.id, whatsappNumber: l.whatsapp as string, status: "PENDING" as const };
          }),
          skipDuplicates: true,
        });
        await prisma.whatsAppCampaign.update({
          where: { id: wsc.id },
          data: { status: "SENDING", sentAt: new Date(), totalRecipients: waSchedLeads.length },
        });
        stats.campaignsStarted++;
      } catch (e) {
        console.error("[Cron Campaigns] Promotion campagne WhatsApp programmée échouée", wsc.id, e);
      }
    }

    // ─── Campagnes WHATSAPP en cours d'envoi (même modèle : claim + lots via cron) ───
    var waCampaigns = await prisma.whatsAppCampaign.findMany({
      where: { status: "SENDING" },
      include: { template: true },
      take: 3,
    });

    for (var wc of waCampaigns) {
      if (timeLeft() <= 0) break;
      if (!wc.template) continue;

      var waClaimed: { id: string; leadId: string }[] = await prisma.$queryRaw`
        UPDATE "whatsapp_campaign_recipients" SET status = 'PROCESSING', "processingAt" = NOW()
        WHERE id IN (
          SELECT id FROM "whatsapp_campaign_recipients"
          WHERE "campaignId" = ${wc.id} AND status = 'PENDING'
          ORDER BY id
          LIMIT ${WA_BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "leadId"
      `;

      if (waClaimed.length === 0) {
        var waByStatus = await prisma.whatsAppCampaignRecipient.groupBy({
          by: ["status"],
          where: { campaignId: wc.id },
          _count: { _all: true },
        });
        var waCounts: Record<string, number> = {};
        waByStatus.forEach(function(g) { waCounts[g.status] = g._count._all; });
        var waInFlight = (waCounts["PENDING"] || 0) + (waCounts["PROCESSING"] || 0);
        if (waInFlight > 0) continue;

        var waTotal = waByStatus.reduce(function(sum, g) { return sum + g._count._all; }, 0);
        var waFailedCount = waCounts["FAILED"] || 0;
        await prisma.whatsAppCampaign.update({
          where: { id: wc.id },
          data: {
            status: "SENT",
            completedAt: new Date(),
            sentCount: waTotal - waFailedCount,
            failedCount: waFailedCount,
          },
        });
        stats.campaignsCompleted++;
        continue;
      }

      var waLeads = await prisma.lead.findMany({
        where: { id: { in: waClaimed.map(function(r) { return r.leadId; }) } },
        include: { program: { select: { name: true } } }, // pour {{lead.programName}}
      });
      var waLeadMap = new Map(waLeads.map(function(l) { return [l.id, l]; }));
      var variableMapping = (wc.template.variableMapping as Record<string, string> | null) || {};

      for (var j = 0; j < waClaimed.length; j++) {
        var waRecipient = waClaimed[j];

        if (timeLeft() <= 0) {
          var waRemaining = waClaimed.slice(j).map(function(r) { return r.id; });
          await prisma.whatsAppCampaignRecipient.updateMany({
            where: { id: { in: waRemaining }, status: "PROCESSING" },
            data: { status: "PENDING", processingAt: null },
          });
          break;
        }

        var waLead = waLeadMap.get(waRecipient.leadId);
        if (!waLead || !waLead.whatsapp) {
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: waRecipient.id },
            data: { status: "FAILED", errorCode: "NO_LEAD", errorMessage: "Lead ou numéro WhatsApp introuvable" },
          });
          stats.waFailed++;
          continue;
        }

        var bodyVariables = resolveVariablesFromLead(wc.template.bodyText, variableMapping, waLead);
        var waResult = await sendTemplateMessage(wc.organizationId, {
          to: waLead.whatsapp,
          templateName: wc.template.metaName,
          templateLanguage: wc.template.language,
          bodyVariables: bodyVariables,
        });

        if (waResult.success) {
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: waRecipient.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              metaMessageId: waResult.metaMessageId || null,
              variableValues: bodyVariables.reduce(function(acc: any, val, idx) {
                acc[(idx + 1).toString()] = val;
                return acc;
              }, {}),
            },
          });
          stats.waSent++;
        } else {
          await prisma.whatsAppCampaignRecipient.update({
            where: { id: waRecipient.id },
            data: {
              status: "FAILED",
              errorCode: waResult.errorCode || "UNKNOWN",
              errorMessage: waResult.errorMessage || "Erreur inconnue",
            },
          });
          stats.waFailed++;
        }

        // Rate limit Meta (~80 msg/s max, on reste sage)
        await new Promise(function(r) { setTimeout(r, 150); });
      }
    }

    console.log(JSON.stringify({ scope: "cron/campaigns", durationMs: Date.now() - started, ...stats }));
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("[Cron Campaigns]", error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}
