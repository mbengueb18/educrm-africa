/**
 * Helpers pour interagir avec l'API Meta WhatsApp Templates
 * Docs : https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

const META_API_VERSION = "v22.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;
import { getWhatsAppIntegration } from "./integration";

interface MetaTemplate {
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" | "PAUSED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: any[];
  id?: string;
  rejected_reason?: string;
}

/**
 * Liste tous les templates disponibles dans le WABA (WhatsApp Business Account)
 */
export async function listMetaTemplates(orgId: string): Promise<MetaTemplate[]> {
  const integration = await getWhatsAppIntegration(orgId);
  const token = integration.accessToken;
  const wabaId = integration.whatsappBusinessAccountId;

  if (!wabaId) {
    throw new Error(
      "Le WhatsApp Business Account ID n'est pas configuré. Vérifiez vos credentials dans Paramètres → Intégration WhatsApp."
    );
  }

  const url = `${META_GRAPH_URL}/${wabaId}/message_templates?limit=100`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Crée un nouveau template et le soumet à Meta pour approbation
 */
export async function submitMetaTemplate(
  orgId: string,
  template: {
    name: string;
    language: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    bodyText: string;
    headerText?: string | null;
    footerText?: string | null;
    buttons?: any[] | null;
  }
): Promise<{ id: string; status: string }> {
  const integration = await getWhatsAppIntegration(orgId);
  const token = integration.accessToken;
  const wabaId = integration.whatsappBusinessAccountId;

  if (!wabaId) {
    throw new Error("Le WhatsApp Business Account ID n'est pas configuré");
  }

  // Construire les "components" attendus par Meta
  const components: any[] = [];

  if (template.headerText) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: template.headerText,
    });
  }

  components.push({
    type: "BODY",
    text: template.bodyText,
  });

  if (template.footerText) {
    components.push({
      type: "FOOTER",
      text: template.footerText,
    });
  }

  if (template.buttons && template.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons,
    });
  }

  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components,
  };

  const response = await fetch(`${META_GRAPH_URL}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return { id: data.id, status: data.status };
}

/**
 * Supprime un template chez Meta
 */
export async function deleteMetaTemplate(orgId: string, name: string): Promise<void> {
  const integration = await getWhatsAppIntegration(orgId);
  const token = integration.accessToken;
  const wabaId = integration.whatsappBusinessAccountId;

  if (!wabaId) {
    throw new Error("Le WhatsApp Business Account ID n'est pas configuré");
  }

  const url = `${META_GRAPH_URL}/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta API error: ${error.error?.message || response.statusText}`);
  }
}

/**
 * Convertit la syntaxe TalibCRM ({{lead.firstName}}) vers syntaxe Meta ({{1}})
 * Retourne aussi le mapping pour l'envoi futur
 */
export function convertTemplateForMeta(bodyText: string): {
  metaBody: string;
  variableMapping: Record<string, string>;
} {
  const variableMapping: Record<string, string> = {};
  let counter = 1;

  // Match {{lead.fieldName}}, {{custom.fieldName}}, {{audience.fieldName}}
  const metaBody = bodyText.replace(/\{\{(lead|custom|audience)\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, prefix, field) => {
    const variablePath = `${prefix}.${field}`;
    // Si déjà mappé, réutiliser le même numéro
    const existingNumber = Object.entries(variableMapping).find(([_, v]) => v === variablePath)?.[0];
    if (existingNumber) {
      return `{{${existingNumber}}}`;
    }
    variableMapping[counter.toString()] = variablePath;
    return `{{${counter++}}}`;
  });

  return { metaBody, variableMapping };
}

/**
 * Parse les components Meta et retourne le body en syntaxe TalibCRM
 * (utilisé lors d'un sync depuis Meta)
 */
export function parseMetaTemplate(template: MetaTemplate): {
  bodyText: string;
  headerText: string | null;
  footerText: string | null;
  buttons: any[] | null;
} {
  let bodyText = "";
  let headerText: string | null = null;
  let footerText: string | null = null;
  let buttons: any[] | null = null;

  for (const component of template.components || []) {
    if (component.type === "BODY") {
      bodyText = component.text || "";
    } else if (component.type === "HEADER") {
      headerText = component.text || null;
    } else if (component.type === "FOOTER") {
      footerText = component.text || null;
    } else if (component.type === "BUTTONS") {
      buttons = component.buttons || [];
    }
  }

  return { bodyText, headerText, footerText, buttons };
}

/**
 * Mappe le statut Meta vers notre enum WhatsAppTemplateStatus
 */
export function mapMetaStatusToLocal(metaStatus: string): "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" {
  switch (metaStatus) {
    case "APPROVED":
      return "APPROVED";
    case "PENDING":
      return "PENDING";
    case "REJECTED":
      return "REJECTED";
    case "DISABLED":
    case "PAUSED":
      return "DISABLED";
    default:
      return "PENDING";
  }
}