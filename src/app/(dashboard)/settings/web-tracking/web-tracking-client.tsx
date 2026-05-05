"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Globe2, Code2, CheckCircle2, AlertCircle, Loader2,
  ToggleLeft, ToggleRight, Trash2, Shield, BookOpen, Zap, ArrowRight,
} from "lucide-react";
import { toggleWebTracking, purgeTrackingData } from "./actions";

interface Props {
  organization: {
    id: string;
    name: string;
    slug: string;
    webTrackingEnabled: boolean;
  };
  apiKey?: any;
  baseUrl: string;
}

export function WebTrackingClient({ organization }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(organization.webTrackingEnabled);
  const [pending, startTransition] = useTransition();
  const [showPurge, setShowPurge] = useState(false);

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    startTransition(async () => {
      try {
        await toggleWebTracking(newState);
        toast.success(newState ? "Tracking web activé" : "Tracking web désactivé");
        router.refresh();
      } catch (e: any) {
        setEnabled(!newState);
        toast.error(e.message || "Erreur");
      }
    });
  };

  const handlePurge = () => {
    startTransition(async () => {
      try {
        await purgeTrackingData();
        toast.success("Données de tracking supprimées");
        setShowPurge(false);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe2 size={22} className="text-brand-600" />
          Tracking Web
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Suivez le parcours de vos visiteurs sur votre site web et identifiez les sources de leads.
        </p>
      </div>

      {/* Status + Toggle */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-colors",
        enabled ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              enabled ? "bg-emerald-500 text-white" : "bg-gray-300 text-gray-500"
            )}>
              {enabled ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
            </div>
            <div className="flex-1">
              <h3 className={cn(
                "text-base font-bold",
                enabled ? "text-emerald-900" : "text-gray-700"
              )}>
                {enabled ? "Tracking web activé" : "Tracking web désactivé"}
              </h3>
              <p className={cn(
                "text-sm mt-1",
                enabled ? "text-emerald-700" : "text-gray-600"
              )}>
                {enabled
                  ? "Vos visiteurs sont actuellement trackés. Les données apparaîtront dans la page Analytics."
                  : "Aucune donnée de visite n'est enregistrée. Activez le tracking pour commencer à analyser votre trafic."}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={pending}
            className={cn("shrink-0 transition-colors", pending && "opacity-50 cursor-not-allowed")}
          >
            {enabled ? (
              <ToggleRight size={48} className="text-emerald-500" />
            ) : (
              <ToggleLeft size={48} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Avertissement coût (si désactivé) */}
      {!enabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Pourquoi cette option est désactivée par défaut ?
              </p>
              <p className="text-xs text-blue-800 leading-relaxed">
                Le tracking web stocke chaque page visitée par chaque visiteur de votre site. Pour des sites à fort trafic, cela peut générer un volume important de données. Activez cette fonctionnalité uniquement si vous souhaitez analyser le parcours de vos visiteurs et leurs sources de trafic.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info : snippet unique (si activé) */}
      {enabled && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">
                  Aucune modification de code requise
                </p>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Le tracking des visiteurs s'active automatiquement avec le snippet déjà installé sur votre site (celui qui capture les formulaires). Les changements prennent effet en moins de 60 secondes.
                </p>
                <p className="text-[11px] text-emerald-700 mt-2">
                  Vous n'avez pas encore installé le tracker ?{" "}
                  <Link href="/settings/integrations" className="underline font-medium">
                    Récupérez le code dans Intégrations
                  </Link>.
                </p>
              </div>
            </div>
          </div>

          {/* Comment ça marche */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Code2 size={16} className="text-brand-500" />
              Ce qui est tracké quand activé
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FeatureCard
                icon={Zap}
                title="Tracking automatique"
                description="Pages vues, sessions, sources de trafic et UTMs sont captés automatiquement."
              />
              <FeatureCard
                icon={Globe2}
                title="Parcours visiteur"
                description="Chaque visiteur a un identifiant unique et son historique apparaît sur sa fiche lead après conversion."
              />
              <FeatureCard
                icon={BookOpen}
                title="Standard GA4"
                description="Logique de session de 30 min d'inactivité, comme Google Analytics."
              />
            </div>
          </div>
        </>
      )}

      {/* Données et confidentialité */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Données et confidentialité</h3>
        <div className="space-y-2 text-xs text-gray-600">
          <p>• <strong>Pas de cookies tiers :</strong> seul un identifiant local (localStorage) est utilisé pour suivre le visiteur.</p>
          <p>• <strong>Pas de données personnelles</strong> stockées tant que le visiteur n'a pas soumis de formulaire.</p>
          <p>• <strong>Conforme RGPD :</strong> les visiteurs anonymes ne sont identifiables qu'après un opt-in explicite via formulaire.</p>
          <p>• <strong>Données stockées :</strong> URL, titre, source (referrer/UTM), temps de visibilité, écran, navigateur, langue.</p>
        </div>
      </div>

      {/* Purge */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Trash2 size={14} className="text-red-500" />
              Supprimer toutes les données de tracking
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Efface définitivement tous les visiteurs, sessions et pages vues de votre organisation. Cette action est irréversible.
            </p>
          </div>
          {!showPurge ? (
            <button
              onClick={() => setShowPurge(true)}
              className="btn-secondary py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            >
              <Trash2 size={12} /> Purger
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setShowPurge(false)}
                className="btn-secondary py-1.5 px-3 text-xs"
                disabled={pending}
              >
                Annuler
              </button>
              <button
                onClick={handlePurge}
                disabled={pending}
                className="btn-primary py-1.5 px-3 text-xs bg-red-600 hover:bg-red-700"
              >
                {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Confirmer la suppression
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <Icon size={16} className="text-brand-500 mb-2" />
      <p className="text-xs font-bold text-gray-900 mb-0.5">{title}</p>
      <p className="text-[11px] text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}