/**
 * Helpers pour envoyer des messages WhatsApp via Meta Cloud API
 * Docs : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

const META_API_VERSION = "v22.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;
import { getWhatsAppIntegration } from "./integration";

interface SendTemplateMessageParams {
  to: string;                              // Numéro destinataire au format international (+221770000000)
  templateName: string;                    // Nom du template Meta
  templateLanguage: string;                // Code langue (fr, en_US, etc.)
  bodyVariables?: string[];                // Valeurs ordonnées pour {{1}}, {{2}}, etc.
  headerVariables?: string[];              // Valeurs pour le header (si présent)
}

interface SendResult {
  success: boolean;
  metaMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Formate un numéro de téléphone au format international Meta (sans +, sans espaces)
 * Ex: "+221 77 123 45 67" → "221771234567"
 */
export function formatPhoneForMeta(phone: string): string | null {
  if (!phone) return null;

  // Retirer tous les espaces, tirets, parenthèses
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Retirer le + initial
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Si commence par 00, retirer
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // Si numéro local sénégalais (77/78/76/70/75/33) sans indicatif → ajouter 221
  if (/^(7[05678]|33)\d{7}$/.test(cleaned)) {
    cleaned = "221" + cleaned;
  }

  // Validation : doit faire entre 8 et 15 chiffres
  if (!/^\d{8,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Envoie un message template via Meta Cloud API
 */
export async function sendTemplateMessage(
  orgId: string,
  params: SendTemplateMessageParams
): Promise<SendResult> {
  let token: string;
  let phoneId: string;

  try {
    const integration = await getWhatsAppIntegration(orgId);
    token = integration.accessToken;
    phoneId = integration.phoneNumberId;
  } catch (e: any) {
    return {
      success: false,
      errorCode: "CONFIG_MISSING",
      errorMessage: e.message,
    };
  }

  const formattedPhone = formatPhoneForMeta(params.to);
  if (!formattedPhone) {
    return {
      success: false,
      errorCode: "INVALID_PHONE",
      errorMessage: `Numéro invalide : ${params.to}`,
    };
  }

  // Construire les "components" pour Meta
  const components: any[] = [];

  // Header avec variables (si présentes)
  if (params.headerVariables && params.headerVariables.length > 0) {
    components.push({
      type: "header",
      parameters: params.headerVariables.map((value) => ({
        type: "text",
        text: value,
      })),
    });
  }

  // Body avec variables (si présentes)
  if (params.bodyVariables && params.bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: params.bodyVariables.map((value) => ({
        type: "text",
        text: value,
      })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.templateLanguage },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  try {
    const response = await fetch(`${META_GRAPH_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        errorCode: data.error?.code?.toString() || "UNKNOWN",
        errorMessage: data.error?.message || data.error?.error_user_msg || response.statusText,
      };
    }

    return {
      success: true,
      metaMessageId: data.messages?.[0]?.id,
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: err.message || "Erreur réseau",
    };
  }
}

/**
 * Résout les variables d'un template depuis un lead
 * Convertit le mapping {{lead.firstName}} en valeur réelle
 */
export function resolveVariablesFromLead(
  bodyText: string,
  variableMapping: Record<string, string> | null,
  lead: any
): string[] {
  if (!variableMapping || Object.keys(variableMapping).length === 0) {
    // Pas de variables : extraire depuis le bodyText directement
    const matches = bodyText.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];

    // Si on a {{1}}, {{2}} mais pas de mapping, on ne peut pas résoudre
    return [];
  }

  // Trier par numéro de variable ({{1}}, {{2}}, ...)
  const sortedKeys = Object.keys(variableMapping).sort((a, b) => parseInt(a) - parseInt(b));

  return sortedKeys.map((key) => {
    const path = variableMapping[key];
    return resolveLeadPath(path, lead) || `[${path}]`;
  });
}

/**
 * Résout un chemin "lead.firstName" depuis un objet lead
 */
function resolveLeadPath(path: string, lead: any): string {
  const parts = path.split(".");

  if (parts[0] === "lead" && parts.length === 2) {
    const field = parts[1];
    const value = lead[field];
    return value !== null && value !== undefined ? String(value) : "";
  }

  // Pour les custom fields : "custom.budget" → lead.customFields?.budget
  if (parts[0] === "custom" && parts.length === 2) {
    const field = parts[1];
    const value = lead.customFields?.[field];
    return value !== null && value !== undefined ? String(value) : "";
  }

  return "";
}