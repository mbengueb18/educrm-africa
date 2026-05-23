// src/components/lead/whatsapp-button.tsx
"use client";

import { useState, useEffect } from "react";
import { MessageCircle, ExternalLink, Sparkles } from "lucide-react";
import { SendWhatsAppModal } from "./send-whatsapp-modal";
import { WhatsAppUpgradeModal } from "./whatsapp-upgrade-modal";
import { getWhatsAppMode, type WhatsAppMode } from "@/lib/whatsapp-status";

interface Props {
  leadId: string;
  leadName: string;
  leadPhone: string;
  defaultMessage?: string;
  variant?: "primary" | "secondary";
  className?: string;
  showBadge?: boolean;
  // ✅ NOUVEAU : info plan injectée depuis page.tsx
  canUseWhatsAppAPI: boolean;
  currentPlanName: string;
}

export function WhatsAppButton({
  leadId,
  leadName,
  leadPhone,
  defaultMessage = "",
  variant = "secondary",
  className = "",
  showBadge = false,
  canUseWhatsAppAPI,
  currentPlanName,
}: Props) {
  const [mode, setMode] = useState<WhatsAppMode | "loading">("loading");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  useEffect(() => {
    getWhatsAppMode().then((m) => setMode(m));
  }, []);

  // Click handler intelligent : 3 cas possibles
  const handleClick = () => {
    if (!leadPhone) return;

    // ✅ NOUVEAU : Cas B - Pas Performance → modale comparative
    if (!canUseWhatsAppAPI) {
      setUpgradeModalOpen(true);
      return;
    }

    // Cas A - Performance + intégration active → modale d'envoi API
    if (mode === "cloud_api") {
      setSendModalOpen(true);
      return;
    }

    // Cas C - Performance mais pas d'intégration → wa.me direct
    handleWaLink();
  };

  // Mode wa.me classique (fallback)
  const handleWaLink = () => {
    if (!leadPhone) return;
    const cleanedNumber = leadPhone.replace(/[\s+\-()]/g, "");
    const encodedMessage = encodeURIComponent(defaultMessage);
    const url = `https://wa.me/${cleanedNumber}${encodedMessage ? `?text=${encodedMessage}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Pas de numéro → bouton désactivé
  if (!leadPhone) {
    return (
      <button
        disabled
        className={`btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 opacity-50 cursor-not-allowed ${className}`}
      >
        <MessageCircle size={12} />
        WhatsApp
      </button>
    );
  }

  const baseClasses =
    variant === "primary"
      ? "btn-primary bg-emerald-500 hover:bg-emerald-600"
      : "btn-secondary";

  // Tooltip dynamique selon le cas
  const tooltip = !canUseWhatsAppAPI
    ? "WhatsApp (envoi manuel ou passez en Performance pour l'envoi automatisé)"
    : mode === "cloud_api"
    ? "Envoyer via WhatsApp Cloud API (envoi automatique)"
    : "Ouvrir WhatsApp (envoi manuel)";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={mode === "loading"}
        className={`${baseClasses} py-1.5 px-3 text-xs flex items-center gap-1.5 ${className}`}
        title={tooltip}
      >
        <MessageCircle
          size={12}
          className={mode === "cloud_api" && canUseWhatsAppAPI ? "text-emerald-500" : "text-emerald-600"}
        />
        WhatsApp
        {/* Icône ExternalLink uniquement si vraie ouverture wa.me */}
        {canUseWhatsAppAPI && mode === "wa_link" && (
          <ExternalLink size={10} className="text-gray-400" />
        )}
        {/* Badge API si Performance + intégration */}
        {showBadge && canUseWhatsAppAPI && mode === "cloud_api" && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold ml-0.5">
            API
          </span>
        )}
        {/* ✅ NOUVEAU : Badge Sparkles pour Croissance/Essentiel (subtle upsell) */}
        {showBadge && !canUseWhatsAppAPI && (
          <Sparkles size={10} className="text-amber-500 ml-0.5" />
        )}
      </button>

      {/* Modale d'envoi via API (existante) */}
      {canUseWhatsAppAPI && mode === "cloud_api" && (
        <SendWhatsAppModal
          leadId={leadId}
          leadName={leadName}
          leadPhone={leadPhone}
          open={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
        />
      )}

      {/* ✅ NOUVEAU : Modale comparative pour upgrade */}
      <WhatsAppUpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentPlanName={currentPlanName}
        leadName={leadName}
        leadPhone={leadPhone}
        defaultMessage={defaultMessage}
      />
    </>
  );
}