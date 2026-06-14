import { prisma } from "@/lib/prisma";
import { getAttachmentBuffer } from "@/lib/supabase-storage";

// ─── Rafraîchit l'access token Gmail si expiré, retourne un token valide ───
async function getValidAccessToken(integration: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: Date | null;
}): Promise<string | null> {
  if (integration.tokenExpiry && integration.tokenExpiry.getTime() > Date.now() + 120_000) {
    return integration.accessToken;
  }
  if (!integration.refreshToken) return null;

  var clientId = process.env.GOOGLE_CLIENT_ID!;
  var clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  var res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[Gmail] Token refresh failed", await res.text());
    return null;
  }

  var data = await res.json();
  var newExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { accessToken: data.access_token, tokenExpiry: newExpiry },
  });

  return data.access_token;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return "=?UTF-8?B?" + Buffer.from(subject, "utf-8").toString("base64") + "?=";
}

export interface GmailAttachment {
  path: string;          // Supabase Storage path
  filename: string;
  contentType?: string;
}

export interface GmailSendParams {
  userId: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: GmailAttachment[];
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  fromEmail?: string;
  error?: string;
  notConnected?: boolean;
}

export async function getGmailIntegration(userId: string) {
  return prisma.userIntegration.findUnique({
    where: { userId_provider: { userId, provider: "gmail" } },
  });
}

export async function sendViaGmail(params: GmailSendParams): Promise<GmailSendResult> {
  var integration = await getGmailIntegration(params.userId);
  if (!integration || !integration.isActive) {
    return { success: false, notConnected: true, error: "Boîte Gmail non connectée" };
  }

  var accessToken = await getValidAccessToken(integration);
  if (!accessToken) {
    return { success: false, error: "Impossible de rafraîchir le token Gmail (reconnexion nécessaire)" };
  }

  var fromEmail = integration.accountEmail || "";
  var fromHeader = params.fromName ? `${encodeSubject(params.fromName)} <${fromEmail}>` : fromEmail;

  // Télécharger les pièces jointes depuis Supabase
  var loadedAttachments: { filename: string; contentType: string; base64: string }[] = [];
  if (params.attachments && params.attachments.length > 0) {
    for (var att of params.attachments) {
      try {
        var buffer = await getAttachmentBuffer(att.path);
        loadedAttachments.push({
          filename: att.filename,
          contentType: att.contentType || "application/octet-stream",
          base64: buffer.toString("base64"),
        });
      } catch (e: any) {
        console.error("[Gmail] Attachment load failed", att.filename, e?.message);
      }
    }
  }

  var hasAttachments = loadedAttachments.length > 0;
  var mixedBoundary = "talibmix_" + Math.random().toString(36).slice(2);
  var altBoundary = "talibalt_" + Math.random().toString(36).slice(2);

  var parts: string[] = [];
  parts.push("From: " + fromHeader);
  parts.push("To: " + params.to);
  if (params.replyTo) parts.push("Reply-To: " + params.replyTo);
  parts.push("Subject: " + encodeSubject(params.subject));
  parts.push("MIME-Version: 1.0");

  // Corps alternatif (texte + html), éventuellement encapsulé dans un multipart/mixed si pièces jointes
  function buildBodyAlternative(): string[] {
    var b: string[] = [];
    b.push('Content-Type: multipart/alternative; boundary="' + altBoundary + '"');
    b.push("");
    if (params.textBody) {
      b.push("--" + altBoundary);
      b.push('Content-Type: text/plain; charset="UTF-8"');
      b.push("Content-Transfer-Encoding: base64");
      b.push("");
      b.push(Buffer.from(params.textBody, "utf-8").toString("base64"));
    }
    b.push("--" + altBoundary);
    b.push('Content-Type: text/html; charset="UTF-8"');
    b.push("Content-Transfer-Encoding: base64");
    b.push("");
    b.push(Buffer.from(params.htmlBody, "utf-8").toString("base64"));
    b.push("--" + altBoundary + "--");
    return b;
  }

  if (hasAttachments) {
    parts.push('Content-Type: multipart/mixed; boundary="' + mixedBoundary + '"');
    parts.push("");
    parts.push("--" + mixedBoundary);
    parts = parts.concat(buildBodyAlternative());
    for (var la of loadedAttachments) {
      parts.push("--" + mixedBoundary);
      parts.push('Content-Type: ' + la.contentType + '; name="' + la.filename + '"');
      parts.push("Content-Transfer-Encoding: base64");
      parts.push('Content-Disposition: attachment; filename="' + la.filename + '"');
      parts.push("");
      parts.push(la.base64);
    }
    parts.push("--" + mixedBoundary + "--");
  } else {
    parts = parts.concat(buildBodyAlternative());
  }

  var rawMessage = toBase64Url(Buffer.from(parts.join("\r\n"), "utf-8"));

  var res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: rawMessage }),
  });

  if (!res.ok) {
    var errText = await res.text();
    console.error("[Gmail] Send failed", errText);
    return { success: false, fromEmail, error: "Échec de l'envoi via Gmail" };
  }

  var result = await res.json();
  return { success: true, messageId: result.id, fromEmail };
}