// src/components/lead/whatsapp-upgrade-modal.tsx
"use client";

import { UpgradeModal } from "@/components/upgrade/upgrade-modal";

interface Props {
  open: boolean;
  onClose: () => void;
  currentPlanName: string;       // ex: "Croissance"
  leadName: string;              // ex: "Fatou Diop"
  leadPhone: string;             // ex: "+221771234567"
  defaultMessage?: string;       // optionnel : message pré-rempli
}

export function WhatsAppUpgradeModal({
  open,
  onClose,
  currentPlanName,
  leadName,
  leadPhone,
  defaultMessage,
}: Props) {
  // Construire le lien wa.me pour l'action immédiate
  const cleanedNumber = leadPhone.replace(/[\s+\-()]/g, "");
  const encodedMessage = defaultMessage ? encodeURIComponent(defaultMessage) : "";
  const waMeUrl = `https://wa.me/${cleanedNumber}${encodedMessage ? `?text=${encodedMessage}` : ""}`;

  const handleManualSend = () => {
    window.open(waMeUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <UpgradeModal
      open={open}
      onClose={onClose}
      feature="WhatsApp Business"
      description={`Contactez ${leadName} via WhatsApp. Selon votre plan, vous avez deux options.`}
      currentPlanName={currentPlanName}
      targetPlanName="Performance"
      targetPlanPrice="100 000 FCFA/mois"
      immediateAction={{
        label: "Ouvrir WhatsApp",
        description: "Ouvre WhatsApp Web ou l'app pour écrire manuellement. Sortie du CRM, pas d'historique, pas de tracking.",
        onClick: handleManualSend,
      }}
      targetBenefits={[
        "Envoi de messages sans sortir du CRM",
        "Templates Meta-validés (rentrée, relance, etc.)",
        "Historique automatique des conversations",
        "Campagnes WhatsApp en masse à vos audiences",
        "Statistiques détaillées (livraison, lecture, réponses)",
        "Chatbot WhatsApp automatisé",
      ]}
      comparison={[
        { label: "Envoi WhatsApp direct depuis TalibCRM", current: false, target: true },
        { label: "Templates pré-approuvés Meta", current: false, target: "10 max" },
        { label: "Campagnes en masse", current: false, target: true },
        { label: "Historique des conversations", current: false, target: true },
        { label: "Statistiques de livraison/lecture", current: false, target: true },
        { label: "Lien wa.me manuel", current: true, target: true },
      ]}
    />
  );
}