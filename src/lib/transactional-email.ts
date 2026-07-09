import { Resend } from "resend";

interface TransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

interface TransactionalEmailResult {
  success: boolean;
  messageId?: string;
  demoMode?: boolean;
  error?: string;
}

/**
 * Envoi d'un email *système* (vérification, reset, etc.), sans lien à un lead
 * ni écriture dans la table Message. Utilise l'expéditeur global TalibCRM.
 *
 * En l'absence de RESEND_API_KEY (dev), log le contenu et retourne demoMode.
 */
export async function sendTransactionalEmail(
  params: TransactionalEmailParams
): Promise<TransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || "noreply@talibcrm.com";
  const senderName = process.env.EMAIL_FROM_NAME || "TalibCRM";

  if (!apiKey) {
    console.warn(
      "[transactional-email] mode démo (pas de RESEND_API_KEY). À:",
      params.to,
      "| Sujet:",
      params.subject,
      "\n--- Contenu (texte) ---\n" + params.text + "\n-----------------------"
    );
    return { success: true, demoMode: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      tags: [{ name: "category", value: "transactional" }],
    });

    if (error || !data) {
      return { success: false, error: error?.message || "Erreur Resend" };
    }
    return { success: true, messageId: data.id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur réseau" };
  }
}
