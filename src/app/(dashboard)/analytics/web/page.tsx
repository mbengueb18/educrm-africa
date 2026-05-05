import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WebAnalyticsClient } from "./web-analytics-client";
import { Globe2, Settings, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WebAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { webTrackingEnabled: true },
  });

  if (!org?.webTrackingEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 rounded-2xl border border-violet-200 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-4 shadow-md">
            <Globe2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Activez le tracking web</h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
            Le tracking web vous permet d'analyser le parcours de vos visiteurs, leurs sources de trafic, et de comprendre quelles pages génèrent le plus de leads.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-gray-900 mb-1">📊 Analyse complète</p>
              <p className="text-[11px] text-gray-500">KPI, top pages, sources, funnel de conversion</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-gray-900 mb-1">🎯 Parcours visiteur</p>
              <p className="text-[11px] text-gray-500">Voir l'historique de chaque lead avant et après conversion</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-gray-900 mb-1">🔒 Conforme RGPD</p>
              <p className="text-[11px] text-gray-500">Pas de cookie tiers, identifiant anonyme jusqu'à conversion</p>
            </div>
          </div>

          <Link
            href="/settings/web-tracking"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Settings size={14} /> Activer le tracking web
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return <WebAnalyticsClient />;
}