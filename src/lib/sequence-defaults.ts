export type SequenceStep = {
  id: string;           // unique key (e.g., "J1_email", "J3_whatsapp"...)
  enabled: boolean;
  daysAfter: number;
  channel: "EMAIL" | "WHATSAPP_TASK" | "CALL_TASK" | "AUTO_LOST";
  label: string;
  emailSubject?: string;
  emailBody?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

export const DEFAULT_SEQUENCE_STEPS: SequenceStep[] = [
  {
    id: "J1_email",
    enabled: true,
    daysAfter: 1,
    channel: "EMAIL",
    label: "Email de relance",
    emailSubject: "{prenom}, votre projet de formation à {ecole}",
    emailBody:
      "Bonjour {prenom},\n\n" +
      "J'espère que vous allez bien.\n\n" +
      "Vous avez manifesté votre intérêt pour {ecole} il y a 24h, et je voulais m'assurer que vous avez bien reçu nos premières informations.\n\n" +
      "Avez-vous quelques questions sur la filière, les frais, ou souhaitez-vous prendre rendez-vous avec un conseiller ?\n\n" +
      "N'hésitez pas à me répondre directement à cet email.\n\n" +
      "Bien cordialement,\nL'équipe {ecole}",
  },
  {
    id: "J3_whatsapp",
    enabled: true,
    daysAfter: 3,
    channel: "WHATSAPP_TASK",
    label: "Tâche WhatsApp",
    taskTitle: "💬 Relance WhatsApp pour {prenom} {nom}",
    taskDescription: "Relance auto J3 — Envoyer un message WhatsApp à ce lead silencieux",
    taskPriority: "HIGH",
  },
  {
    id: "J7_call_task",
    enabled: true,
    daysAfter: 7,
    channel: "CALL_TASK",
    label: "Tâche d'appel URGENT",
    taskTitle: "📞 Appel URGENT pour {prenom} {nom}",
    taskDescription: "Relance auto J7 — Lead silencieux depuis 7 jours, appeler en priorité",
    taskPriority: "URGENT",
  },
  {
    id: "J14_last_chance",
    enabled: true,
    daysAfter: 14,
    channel: "EMAIL",
    label: "Email Last Chance",
    emailSubject: "Souhaitez-vous toujours rejoindre {ecole}, {prenom} ?",
    emailBody:
      "Bonjour {prenom},\n\n" +
      "Cela fait deux semaines que nous n'avons pas eu l'occasion d'échanger ensemble.\n\n" +
      "Souhaitez-vous toujours poursuivre votre projet de formation à {ecole} ?\n\n" +
      "Sans réponse de votre part dans les prochains jours, votre dossier sera clôturé. " +
      "Vous pouvez toujours nous recontacter ultérieurement si vous changez d'avis.\n\n" +
      "Bien cordialement,\nL'équipe {ecole}",
  },
  {
    id: "J21_auto_lost",
    enabled: true,
    daysAfter: 21,
    channel: "AUTO_LOST",
    label: "Auto-marquage Perdu",
  },
];

export function getStepsOrDefault(stored: any): SequenceStep[] {
  if (Array.isArray(stored) && stored.length > 0) {
    // Validate that all default IDs are present (in case schema evolved)
    const storedIds = new Set(stored.map((s: any) => s.id));
    const merged = DEFAULT_SEQUENCE_STEPS.map((def) => {
      const userStep = stored.find((s: any) => s.id === def.id);
      return userStep ? { ...def, ...userStep } : def;
    });
    return merged;
  }
  return DEFAULT_SEQUENCE_STEPS;
}

export function replaceVars(text: string, lead: any, orgName: string): string {
  return text
    .replace(/{prenom}/g, lead.firstName || "")
    .replace(/{nom}/g, lead.lastName || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{telephone}/g, lead.phone || "")
    .replace(/{ecole}/g, orgName);
}