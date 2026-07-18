import { prisma } from "@/lib/prisma";
import { getSocialNet, socialBadgeHtml } from "@/lib/social-icons";
import { SIGNATURE_SLOT, signatureSlotIndex, FOOTER_BLOCK_START, FOOTER_BLOCK_END } from "@/lib/email-slots";

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

// Enrobe un bloc avec fond + espacement vertical si définis (clé blockBg, cf. éditeur)
function chWrap(html: string, styles: any): string {
  var bg = styles.blockBg;
  var py = styles.padY;
  if (!bg && !py) return html;
  return '<div style="' + (bg ? "background:" + bg + ";" : "") + (py ? "padding:" + py + " 0;" : "") + '">' + html + "</div>";
}

function chFontStack(font?: string): string {
  switch (font) {
    case "arial": return "Arial, Helvetica, sans-serif";
    case "georgia": return "Georgia, 'Times New Roman', serif";
    case "times": return "'Times New Roman', Times, serif";
    case "verdana": return "Verdana, Geneva, sans-serif";
    case "trebuchet": return "'Trebuchet MS', Helvetica, sans-serif";
    default: return "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif";
  }
}

// ─── Convertit les blocs de l'éditeur en HTML email ───
// `branding` = ajoute la mention « Envoyé via TalibCRM » (plan gratuit uniquement).
export function blocksToEmailHtml(blocks: any[], lead: LeadVars, branding: boolean = false): string {
  var settings = (blocks.find(function(b: any) { return b.type === "settings"; }) || {}).styles || {};
  // Emplacement de la signature : juste avant la section de bas d'email (réseaux/footer).
  var slotIdx = signatureSlotIndex(blocks);

  var content = blocks.map(function(b: any, blockIndex: number) {
    var slot = blockIndex === slotIdx ? SIGNATURE_SLOT : "";
    var type = b.type;
    var styles = b.styles || {};
    var raw = b.content || "";
    var text = replaceVars(raw, lead);
    var isRich = styles._html === "1" || text.includes("<");
    var blockHtml = (function(): string {

    switch (type) {
      case "text": {
        var innerT = isRich
          ? '<div style="font-size:' + (styles.fontSize || "15px") + ";color:" + (styles.color || "#555") + ";text-align:" + (styles.textAlign || "left") + ';line-height:1.6;">' + text + "</div>"
          : text.split("\n").map(function(line: string) {
              return '<p style="margin:0 0 8px;line-height:1.6;font-size:' + (styles.fontSize || "15px") + ";color:" + (styles.color || "#555") + ";text-align:" + (styles.textAlign || "left") + ';">' + (line || "&nbsp;") + "</p>";
            }).join("");
        return chWrap(innerT, styles);
      }
      case "footer": {
        var innerF = isRich
          ? '<div style="font-size:' + (styles.fontSize || "12px") + ";color:" + (styles.color || "#9ca3af") + ";text-align:" + (styles.textAlign || "center") + ';line-height:1.6;">' + text + "</div>"
          : text.split("\n").map(function(line: string) {
              return '<p style="margin:0 0 6px;line-height:1.6;font-size:' + (styles.fontSize || "12px") + ";color:" + (styles.color || "#9ca3af") + ";text-align:" + (styles.textAlign || "center") + ';">' + (line || "&nbsp;") + "</p>";
            }).join("");
        return chWrap(innerF, styles);
      }
      case "heading": {
        var innerH = isRich
          ? '<div style="font-size:' + (styles.fontSize || "22px") + ";color:" + (styles.color || "#1B4F72") + ";font-weight:700;text-align:" + (styles.textAlign || "left") + ';line-height:1.4;">' + text + "</div>"
          : '<h2 style="margin:0 0 12px;font-size:' + (styles.fontSize || "22px") + ";color:" + (styles.color || "#1B4F72") + ";font-weight:700;text-align:" + (styles.textAlign || "left") + ';">' + text + "</h2>";
        return chWrap(innerH, styles);
      }
      case "button": {
        var bBg = styles.bgColorBtn || styles.bgColor || "#1B4F72";
        var full = styles.fullWidth === "1";
        return chWrap('<div style="text-align:' + (styles.textAlign || "center") + ';padding:12px 0;"><a href="' + (styles.href || "#") + '" style="' + (full ? "display:block;" : "display:inline-block;") + (styles.btnPad ? "padding:" + styles.btnPad + ";" : "padding:12px 28px;") + "background:" + bBg + ";color:" + (styles.color || "white") + ";border-radius:" + (styles.borderRadius || "8px") + ';text-decoration:none;font-weight:600;font-size:14px;text-align:center;">' + text + "</a></div>", styles);
      }
      case "image": {
        if (!raw) return "";
        var img = '<img src="' + raw + '" alt="' + (styles.alt || "") + '" style="max-width:100%;width:' + (styles.width || "100%") + ";border-radius:" + (styles.imgRadius || "8px") + ';display:inline-block;" />';
        var linked = styles.href ? '<a href="' + styles.href + '">' + img + "</a>" : img;
        return chWrap('<div style="text-align:' + (styles.textAlign || "center") + ';padding:8px 0;">' + linked + "</div>", styles);
      }
      case "video": {
        var thumbUrl = styles.thumb || styles.thumbnail || "";
        var videoUrl = raw || "#";
        if (!thumbUrl && videoUrl.includes("youtube.com")) {
          var vid = videoUrl.match(/[?&]v=([^&]+)/)?.[1] || "";
          if (vid) thumbUrl = "https://img.youtube.com/vi/" + vid + "/hqdefault.jpg";
        }
        return '<div style="text-align:' + (styles.textAlign || "center") + ';padding:8px 0;"><a href="' + videoUrl + '" style="display:inline-block;position:relative;text-decoration:none;">' +
          (thumbUrl ? '<img src="' + thumbUrl + '" style="max-width:100%;width:' + (styles.width || "100%") + ';border-radius:8px;display:block;" />' : '<div style="width:400px;height:225px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;">&#9654;</span></div>') +
          '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(255,255,255,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="font-size:24px;color:#e74c3c;margin-left:4px;">&#9654;</span></div>' +
          "</a></div>";
      }
      case "social": {
        var items: any[] = [];
        try { var arr = JSON.parse(raw || "[]"); if (Array.isArray(arr)) items = arr; } catch (e) {}
        items = items.filter(function(it: any) { return it && it.url; });
        if (!items.length) return "";
        var size = parseInt(styles.iconSize || "34", 10);
        var badges = items.map(function(it: any) {
          var net = getSocialNet(it.network);
          return net ? socialBadgeHtml(net, it.url, size) : "";
        }).join("");
        return '<div style="text-align:' + (styles.textAlign || "center") + ';padding:12px 0;">' + badges + "</div>";
      }
      case "columns": {
        var kids = Array.isArray(b.children) && b.children.length === 2 ? b.children : null;
        if (!kids) return "";
        var gap = parseInt(styles.gap || "16", 10);
        var cell = function(c: any) {
          var cs = c.styles || {};
          if (c.type === "image") {
            return c.content ? '<img src="' + c.content + '" alt="" style="max-width:100%;width:100%;border-radius:6px;display:block;" />' : "&nbsp;";
          }
          var ct = replaceVars(c.content || "", lead);
          return '<div style="font-size:' + (cs.fontSize || "14px") + ";color:" + (cs.color || "#555") + ";text-align:" + (cs.textAlign || "left") + ';line-height:1.6;">' + (ct || "&nbsp;") + "</div>";
        };
        return chWrap('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>' +
          '<td valign="top" style="width:50%;padding-right:' + (gap / 2) + 'px;">' + cell(kids[0]) + "</td>" +
          '<td valign="top" style="width:50%;padding-left:' + (gap / 2) + 'px;">' + cell(kids[1]) + "</td>" +
          "</tr></table>", styles);
      }
      case "divider":
        return chWrap('<hr style="border:none;border-top:' + (styles.borderWidth || "1px") + " " + (styles.borderStyle || "solid") + " " + (styles.color || "#e5e7eb") + ';margin:16px 0;" />', styles);
      case "spacer":
        return '<div style="height:' + (styles.height || "24px") + ";" + (styles.blockBg ? "background:" + styles.blockBg + ";" : "") + '"></div>';
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
    })();
    if (type === "footer") blockHtml = FOOTER_BLOCK_START + blockHtml + FOOTER_BLOCK_END;
    return slot + blockHtml;
  }).join("");

  // Pas de section de bas (réseaux/footer) : marqueur en fin de contenu (DANS la carte).
  if (slotIdx === -1) content += SIGNATURE_SLOT;

  var bodyBg = settings.bodyBg || "#f8f9fa";
  var contentBg = settings.contentBg || "#ffffff";
  var width = settings.contentWidth || "580";
  var font = chFontStack(settings.fontFamily);

  var brandingHtml = branding
    ? '<div style="max-width:' + width + 'px;margin:8px auto 0;text-align:center;">' +
      '<p style="margin:0;font-size:12px;color:#9CA3AF;">Envoyé via <a href="https://talibcrm.com" style="color:#9CA3AF;text-decoration:none;">TalibCRM</a></p></div>'
    : "";

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;font-family:' + font + ";background:" + bodyBg + ';padding:40px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:' + bodyBg + ';"><tr><td align="center">' +
    '<div style="max-width:' + width + "px;margin:0 auto;background:" + contentBg + ';border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    "</div>" + brandingHtml + "</td></tr></table></body></html>";
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