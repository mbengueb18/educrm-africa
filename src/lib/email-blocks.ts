export interface EmailBlock {
  id: string;
  type: string;
  content: string;
  styles: any;
}

export function blocksToHtml(blocks: EmailBlock[], brandColor: string): string {
  var content = blocksToPreviewHtml(blocks, brandColor);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    "</div></body></html>";
}

function blocksToPreviewHtml(blocks: EmailBlock[], brandColor: string): string {
  return blocks.map(function(block) {
    var styles = block.styles || {};
    switch (block.type) {
      case "text":
        var paragraphs = block.content.split("\n").map(function(line) {
          return '<p style="margin:0 0 8px;line-height:1.6;font-size:' + (styles.fontSize || "15px") + ";color:" + (styles.color || "#555") + ";text-align:" + (styles.textAlign || "left") + ';">' + (line || "&nbsp;") + "</p>";
        }).join("");
        return paragraphs;
      case "heading":
        return '<h2 style="margin:0 0 12px;font-size:' + (styles.fontSize || "22px") + ";color:" + (styles.color || brandColor) + ";text-align:" + (styles.textAlign || "left") + ";font-weight:700;" + '">' + block.content + "</h2>";
      case "button":
        return '<div style="text-align:' + (styles.textAlign || "center") + ';padding:8px 0;"><a href="' + (styles.href || "#") + '" style="display:inline-block;padding:12px 28px;background:' + (styles.bgColor || brandColor) + ";color:" + (styles.color || "white") + ";border-radius:" + (styles.borderRadius || "8px") + ';text-decoration:none;font-weight:600;font-size:14px;">' + block.content + "</a></div>";
      case "image":
        return block.content ? '<div style="text-align:' + (styles.textAlign || "center") + ';padding:8px 0;"><img src="' + block.content + '" alt="" style="max-width:100%;width:' + (styles.width || "100%") + ';border-radius:8px;" /></div>' : "";
      case "video":
        return block.content ? '<div style="text-align:center;padding:8px 0;"><a href="' + block.content + '" style="display:inline-block;padding:16px 32px;background:#333;color:white;border-radius:8px;text-decoration:none;">Regarder la video</a></div>' : "";
      case "divider":
        return '<hr style="border:none;border-top:' + (styles.borderWidth || "1px") + " " + (styles.borderStyle || "solid") + " " + (styles.color || "#e5e7eb") + ';margin:16px 0;" />';
      case "spacer":
        return '<div style="height:' + (styles.height || "24px") + ';"></div>';
      default:
        return "";
    }
  }).join("");
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}