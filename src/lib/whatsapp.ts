import { prisma } from "@/lib/prisma";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendTemplateOptions {
  organizationId: string;
  toPhoneNumber: string;
  templateName: string;
  languageCode: string;
  parameters?: string[];
}

interface SendTextOptions {
  organizationId: string;
  toPhoneNumber: string;
  text: string;
}

// ─── Envoyer un template (1er contact, hors fenêtre 24h) ───
export async function sendWhatsAppTemplate(opts: SendTemplateOptions): Promise<WhatsAppSendResult> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: opts.organizationId },
  });

  if (!integration || !integration.isActive) {
    return { success: false, error: "WhatsApp Cloud API non configuré pour cette organisation" };
  }

  const cleanedNumber = opts.toPhoneNumber.replace(/[\s+\-()]/g, "");

  const payload: any = {
    messaging_product: "whatsapp",
    to: cleanedNumber,
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode },
    },
  };

  if (opts.parameters && opts.parameters.length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: opts.parameters.map((p) => ({ type: "text", text: p })),
      },
    ];
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${integration.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || data.error?.error_data?.details || "Erreur Meta API",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Envoyer un message texte libre (fenêtre 24h ouverte) ───
// Envoie un vrai message « document » WhatsApp (le destinataire reçoit le fichier dans la
// conversation). Le lien doit être téléchargeable par Meta au moment de l'envoi → pour un
// bucket privé, passer une URL signée.
export async function sendWhatsAppDocument(opts: {
  organizationId: string;
  toPhoneNumber: string;
  link: string;
  filename: string;
  caption?: string;
}): Promise<WhatsAppSendResult> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: opts.organizationId },
  });

  if (!integration || !integration.isActive) {
    return { success: false, error: "WhatsApp Cloud API non configuré" };
  }

  const cleanedNumber = opts.toPhoneNumber.replace(/[\s+\-()]/g, "");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${integration.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanedNumber,
          type: "document",
          document: {
            link: opts.link,
            filename: opts.filename,
            ...(opts.caption ? { caption: opts.caption } : {}),
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Erreur Meta API",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function sendWhatsAppText(opts: SendTextOptions): Promise<WhatsAppSendResult> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { organizationId: opts.organizationId },
  });

  if (!integration || !integration.isActive) {
    return { success: false, error: "WhatsApp Cloud API non configuré" };
  }

  const cleanedNumber = opts.toPhoneNumber.replace(/[\s+\-()]/g, "");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${integration.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanedNumber,
          type: "text",
          text: { body: opts.text },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Erreur Meta API",
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}