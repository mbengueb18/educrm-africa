"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Calendar, Video, Bell, Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";

interface Props {
  initialConnected: boolean;
  initialEmail: string | null;
}

export function GoogleCalendarSettingsClient({ initialConnected, initialEmail }: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [email, setEmail] = useState(initialEmail);
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  // Show success toast after OAuth redirect
  useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("google") === "success") {
      toast.success("Google Calendar connecté avec succès !");
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh status from API
      fetch("/api/integrations/google/status")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.connected) {
            setConnected(true);
            setEmail(data.email);
          }
        });
    } else if (params.get("google") === "error") {
      var reason = params.get("reason") || "unknown";
      toast.error("Erreur de connexion Google : " + reason);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleDisconnect = async function() {
    if (!confirm("Vraiment déconnecter Google Calendar ? Les rendez-vous existants resteront mais ne seront plus synchronisés.")) return;
    setDisconnecting(true);
    try {
      const response = await fetch("/api/integrations/google/disconnect", { method: "POST" });
      if (response.ok) {
        setConnected(false);
        setEmail(null);
        toast.success("Google Calendar déconnecté");
      } else {
        toast.error("Erreur lors de la déconnexion");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setDisconnecting(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" alt="Google Calendar" className="w-8 h-8" />
            Google Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Synchronisez vos rendez-vous et générez des liens Google Meet automatiquement</p>
        </div>
      </div>

      {/* Connection status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        {connected ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Connecté à Google Calendar</h3>
                {email && <p className="text-sm text-gray-500">Compte : {email}</p>}
              </div>
              <button onClick={handleDisconnect} disabled={disconnecting} className="btn-secondary py-2 px-4 text-xs text-red-600 border-red-200 hover:bg-red-50">
                {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Déconnecter
              </button>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800">
                ✓ Vos rendez-vous TalibCRM peuvent être synchronisés automatiquement avec Google Calendar.
                Lors de la création d'un nouveau RDV, activez l'option "Synchroniser avec Google Calendar"
                pour créer également l'événement dans votre agenda Google.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-gray-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Non connecté</h3>
                <p className="text-sm text-gray-500">Connectez votre compte Google pour activer la synchronisation</p>
              </div>
            </div>
            <a href="/api/integrations/google/connect?returnTo=/settings/google-calendar" className="btn-primary py-2.5 px-4 text-sm inline-flex">
              <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" alt="" className="w-5 h-5" />
              Connecter Google Calendar
            </a>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Ce qui est synchronisé</h3>
        <div className="space-y-3">
          <FeatureRow
            icon={Calendar}
            title="Création automatique d'événements"
            description="Chaque RDV TalibCRM peut être ajouté à votre agenda Google avec un seul clic"
          />
          <FeatureRow
            icon={Video}
            title="Liens Google Meet automatiques"
            description="Pour les rendez-vous en visio, un lien Meet est généré sans configuration"
          />
          <FeatureRow
            icon={Bell}
            title="Rappels Google Calendar"
            description="Bénéficiez des notifications natives de Google sur vos appareils"
          />
          <FeatureRow
            icon={LinkIcon}
            title="Mise à jour bidirectionnelle"
            description="Les modifications faites dans TalibCRM se répercutent dans Google Calendar"
          />
        </div>
      </div>

      {/* Permissions info */}
      {!connected && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-5">
          <p className="text-xs text-blue-700">
            <strong>🔒 Permissions demandées :</strong> Lecture/écriture de votre Google Calendar et accès à votre adresse email Google. Vous pouvez révoquer l'accès à tout moment depuis cette page ou depuis votre compte Google.
          </p>
        </div>
      )}
    </div>
  );
}

function FeatureRow({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-blue-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}