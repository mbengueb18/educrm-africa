"use client";

import { useState, useEffect } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import { SendWhatsAppModal } from "./send-whatsapp-modal";
import { getWhatsAppMode, type WhatsAppMode } from "@/lib/whatsapp-status";

interface Props {
  leadId: string;
  leadName: string;
  leadPhone: string;
  defaultMessage?: string;
  variant?: "primary" | "secondary";
  className?: string;
  showBadge?: boolean;
}

export function WhatsAppButton({
  leadId,
  leadName,
  leadPhone,
  defaultMessage = "",
  variant = "secondary",
  className = "",
  showBadge = false,
}: Props) {
  const [mode, setMode] = useState<WhatsAppMode | "loading">("loading");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    getWhatsAppMode().then((m) => setMode(m));
  }, []);

  // Mode wa.me (lien classique, méthode actuelle)
  const handleWaLink = () => {
    if (!leadPhone) return;
    const cleanedNumber = leadPhone.replace(/[\s+\-()]/g, "");
    const encodedMessage = encodeURIComponent(defaultMessage);
    const url = `https://wa.me/${cleanedNumber}${encodedMessage ? `?text=${encodedMessage}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Mode Cloud API (envoi natif)
  const handleCloudApi = () => {
    setModalOpen(true);
  };

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

  const baseClasses = variant === "primary"
    ? "btn-primary bg-emerald-500 hover:bg-emerald-600"
    : "btn-secondary";

  return (
    <>
      <button
        onClick={mode === "cloud_api" ? handleCloudApi : handleWaLink}
        disabled={mode === "loading"}
        className={`${baseClasses} py-1.5 px-3 text-xs flex items-center gap-1.5 ${className}`}
        title={
          mode === "cloud_api"
            ? "Envoyer via WhatsApp Cloud API (envoi automatique)"
            : "Ouvrir WhatsApp (envoi manuel)"
        }
      >
        <MessageCircle size={12} className={mode === "cloud_api" ? "text-emerald-500" : "text-emerald-600"} />
        WhatsApp
        {mode === "wa_link" && <ExternalLink size={10} className="text-gray-400" />}
        {showBadge && mode === "cloud_api" && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold ml-0.5">
            API
          </span>
        )}
      </button>

      {mode === "cloud_api" && (
        <SendWhatsAppModal
          leadId={leadId}
          leadName={leadName}
          leadPhone={leadPhone}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}