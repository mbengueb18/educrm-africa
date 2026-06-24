import { prisma } from "@/lib/prisma";

type LeadVars = { firstName: string; lastName: string; email: string | null };

// ─── Remplace les variables, en réparant celles fragmentées par du HTML ───
export function replaceVars(text: string, lead: LeadVars): string {
  var repaired = text.replace(/\{\s*\{[\s\S]*?\}\s*\}/g, function(match) {
    var inner = match.replace(/<[^>]+>/g, "");
    inner = inner
      .replace(/&nbsp;/gi, "")
      .replace(/&#123;/g, "{")
      .replace(/&#125;/g, "}")
      .replace(/&amp;/gi, "&");
    inner = inner.replace(/\{\{\s*/g, "{{").replace(/\s*\}\}/g, "}}");
    return inner;
  });
  return repaired
    .replace(/\{\{prenom\}\}/gi, lead.firstName)
    .replace(/\{\{firstName\}\}/gi, lead.firstName)
    .replace(/\{\{nom\}\}/gi, lead.lastName)
    .replace(/\{\{lastName\}\}/gi, lead.lastName)
    .replace(/\{\{email\}\}/gi, lead.email || "");
}

// ─── Convertit les blocs de l'éditeur en HTML email ───
export function blocksToEmailHtml(blocks: any[], lead: LeadVars): string {
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
      case "section":
        if (!b.columns) return "";
        var cellsHtml = b.columns.map(function(col: any) {
          var widthPct = parseFloat(col.width);
          var colContent = col.content || "&nbsp;";
          colContent = replaceVars(colContent, lead);
          return '<td style="width:' + widthPct + '%;vertical-align:top;padding:8px;">' +
            '<div style="font-size:15px;line-height:1.6;color:#555;">' + colContent + "</div></td>";
        }).join("");
        return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="' +
          (styles.bgColor ? "background-color:" + styles.bgColor + ";" : "") +
          '"><tr>' + cellsHtml + "</tr></table>";
      default:
        return "";
    }
  }).join("");

  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    '<div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #e5e7eb;">' +
    "</div></div></body></html>";
}

// ─── Passage automatique en « Contacté » (ne fait jamais reculer un lead) ───
export async function promoteToContacted(campaignId: string, organizationId: string): Promise<void> {
  try {
    var sentRecipients = await prisma.emailCampaignRecipient.findMany({
      where: { campaignId: campaignId, status: { not: "FAILED" } },
      select: { leadId: true },
    });
    var sentLeadIds = sentRecipients.map(function(r) { return r.leadId; });
    if (sentLeadIds.length === 0) return;

    var sentLeads = await prisma.lead.findMany({
      where: { id: { in: sentLeadIds }, organizationId: organizationId },
      select: { id: true, pipelineId: true, stageId: true },
    });

    var allStages = await prisma.pipelineStage.findMany({
      where: { organizationId: organizationId },
      select: { id: true, name: true, order: true, pipelineId: true },
    });

    function normalize(s: string): string {
      return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    var contactStageByPipeline: Record<string, { id: string; order: number }> = {};
    for (var st of allStages) {
      if (normalize(st.name) === "contacte" && st.pipelineId) {
        contactStageByPipeline[st.pipelineId] = { id: st.id, order: st.order };
      }
    }

    var stageOrderById: Record<string, number> = {};
    for (var st2 of allStages) {
      stageOrderById[st2.id] = st2.order;
    }

    var byTargetStage: Record<string, string[]> = {};
    for (var ld of sentLeads) {
      if (!ld.pipelineId) continue;
      var contactStage = contactStageByPipeline[ld.pipelineId];
      if (!contactStage) continue;
      var currentOrder = stageOrderById[ld.stageId];
      if (currentOrder !== undefined && currentOrder < contactStage.order) {
        if (!byTargetStage[contactStage.id]) byTargetStage[contactStage.id] = [];
        byTargetStage[contactStage.id].push(ld.id);
      }
    }

    for (var targetStageId in byTargetStage) {
      await prisma.lead.updateMany({
        where: { id: { in: byTargetStage[targetStageId] } },
        data: { stageId: targetStageId },
      });
    }
  } catch (e) {
    console.error("[promoteToContacted] échec", e);
  }
}