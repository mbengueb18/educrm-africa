"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { touchLeadLastContact } from "@/lib/lead-contact";
import { sendWhatsAppTemplate, sendWhatsAppText, sendWhatsAppDocument } from "@/lib/whatsapp";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { resolveVariablesFromLead } from "@/lib/whatsapp/send";
import { assertCanAccessFeature } from "@/lib/plans/checks";
import { PlanLimitError } from "@/lib/plans/errors";

interface SendTemplateInput {
  leadId: string;
  templateId?: string;      // Template approuvé sélectionné (résolu serveur-side)
  templateName?: string;    // Fallback direct (ex. hello_world de test)
  languageCode?: string;
  parameters?: string[];
}

interface SendTextInput {
  leadId: string;
  text: string;
}

export async function sendWhatsAppToLead(input: SendTemplateInput | SendTextInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { program: { select: { name: true } } },
  });

  if (!lead) throw new Error("Lead introuvable");
  if (lead.organizationId !== session.user.organizationId) {
    throw new Error("Accès refusé");
  }

  // check feature gate WhatsApp Business API
  try {
    await assertCanAccessFeature(lead.organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      throw new Error(
        "L'envoi de messages WhatsApp via TalibCRM nécessite le plan Performance. " +
        "Vous pouvez toujours contacter le lead via WhatsApp manuellement avec le bouton de la fiche."
      );
    }
    throw error;
  }

  const targetNumber = lead.whatsapp || lead.phone;
  if (!targetNumber) throw new Error("Aucun numéro WhatsApp pour ce lead");

  let result;
  let content: string;

  if ("text" in input) {
    result = await sendWhatsAppText({
      organizationId: lead.organizationId,
      toPhoneNumber: targetNumber,
      text: input.text,
    });
    content = input.text;
  } else {
    let templateName = input.templateName || "";
    let languageCode = input.languageCode || "en_US";
    let parameters = input.parameters || [];

    // Template choisi dans la liste : on résout nom/langue + variables depuis la DB et le lead.
    if (input.templateId) {
      const tpl = await prisma.whatsAppTemplate.findFirst({
        where: { id: input.templateId, organizationId: lead.organizationId },
        select: { metaName: true, language: true, bodyText: true, variableMapping: true },
      });
      if (!tpl) throw new Error("Template introuvable");
      templateName = tpl.metaName;
      languageCode = tpl.language;
      parameters = resolveVariablesFromLead(tpl.bodyText, tpl.variableMapping as any, lead);
    }

    if (!templateName) throw new Error("Aucun template sélectionné");

    result = await sendWhatsAppTemplate({
      organizationId: lead.organizationId,
      toPhoneNumber: targetNumber,
      templateName,
      languageCode,
      parameters,
    });
    content = `[Template: ${templateName}${parameters.length ? " · " + parameters.join(", ") : ""}]`;
  }

  if (!result.success) {
    throw new Error(result.error || "Erreur d'envoi");
  }

  // Créer le Message en DB
  await prisma.message.create({
    data: {
      organizationId: lead.organizationId,
      leadId: lead.id,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      content,
      status: "SENT",
      externalId: result.messageId,
      sentById: session.user.id,
      sentAt: new Date(),
    },
  });
  await touchLeadLastContact(lead.id, new Date());

  // Activité
  await prisma.activity.create({
    data: {
      organizationId: lead.organizationId,
      leadId: lead.id,
      userId: session.user.id,
      type: "MESSAGE_SENT",
      description: `WhatsApp envoyé à ${lead.firstName} ${lead.lastName}`,
      metadata: { channel: "WHATSAPP", externalId: result.messageId },
    },
  });

  revalidatePath(`/leads/${lead.id}`);
  return { success: true, messageId: result.messageId };
}

// Envoie un document de la bibliothèque au lead via WhatsApp (vrai message « document »,
// avec message d'accompagnement optionnel affiché sous le fichier — caption Meta).
// Le fichier vit dans le bucket privé email-attachments → URL signée le temps que Meta le télécharge.
export async function sendLibraryDocumentToLead(leadId: string, documentId: string, caption?: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Non authentifié" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: session.user.organizationId },
    select: { id: true, firstName: true, lastName: true, whatsapp: true, phone: true, organizationId: true },
  });
  if (!lead) return { ok: false, error: "Lead introuvable" };

  try {
    await assertCanAccessFeature(lead.organizationId, "WHATSAPP_BUSINESS_API");
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return { ok: false, error: "L'envoi WhatsApp via TalibCRM nécessite le plan Performance." };
    }
    throw error;
  }

  const doc = await prisma.libraryDocument.findFirst({
    where: { id: documentId, organizationId: lead.organizationId },
    select: { name: true, path: true, mimeType: true },
  });
  if (!doc) return { ok: false, error: "Document introuvable" };

  const targetNumber = lead.whatsapp || lead.phone;
  if (!targetNumber) return { ok: false, error: "Aucun numéro WhatsApp pour ce lead" };

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("email-attachments")
    .createSignedUrl(doc.path, 3600);
  if (signErr || !signed) return { ok: false, error: "Document inaccessible dans la bibliothèque" };

  // Meta télécharge le fichier via le lien ; filename = nom affiché chez le destinataire.
  const ext = (doc.path.split(".").pop() || "").toLowerCase();
  const filename = /\.[a-z0-9]{2,5}$/i.test(doc.name) ? doc.name : (ext ? doc.name + "." + ext : doc.name);
  const cleanCaption = (caption || "").trim().slice(0, 1024) || undefined; // limite caption Meta
  const result = await sendWhatsAppDocument({
    organizationId: lead.organizationId,
    toPhoneNumber: targetNumber,
    link: signed.signedUrl,
    filename,
    caption: cleanCaption,
  });
  if (!result.success) return { ok: false, error: result.error || "Erreur d'envoi" };

  await prisma.message.create({
    data: {
      organizationId: lead.organizationId,
      leadId: lead.id,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      content: (cleanCaption ? cleanCaption + "\n" : "") + "📎 Document envoyé : " + doc.name,
      status: "SENT",
      externalId: result.messageId,
      sentById: session.user.id,
      sentAt: new Date(),
    },
  });
  await touchLeadLastContact(lead.id, new Date());
  await prisma.activity.create({
    data: {
      organizationId: lead.organizationId,
      leadId: lead.id,
      userId: session.user.id,
      type: "MESSAGE_SENT",
      description: `Document WhatsApp envoyé à ${lead.firstName} ${lead.lastName} : ${doc.name}`,
      metadata: { channel: "WHATSAPP", externalId: result.messageId, document: doc.name },
    },
  }).catch(() => {});

  revalidatePath(`/leads/${lead.id}`);
  return { ok: true };
}