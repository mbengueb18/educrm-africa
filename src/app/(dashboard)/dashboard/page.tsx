import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  BarChart3, Repeat, Users, GraduationCap, CreditCard,
  TrendingUp, Phone, CalendarDays, MessageSquare, Megaphone, ArrowUpRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const orgId = session.user.organizationId;

  // Quick stats for the home page
  const [totalLeads, leadsThisMonth, totalStudents, totalAppointments, totalCampaigns, leadsInSequence] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: new Date(new Date().setDate(1)) },
      },
    }),
    prisma.student.count({ where: { organizationId: orgId } }),
    prisma.appointment.count({
      where: {
        organizationId: orgId,
        startAt: { gte: new Date() },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
    }),
    prisma.emailCampaign.count({ where: { organizationId: orgId } }),
    prisma.lead.count({
      where: {
        organizationId: orgId,
        isConverted: false,
        sequenceExecutions: { some: {} },
      },
    }),
  ]);

  const reports = [
    {
      title: "Reporting global",
      description: "Vue d'ensemble du pipeline, conversions, performance commerciale",
      icon: BarChart3,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      href: "/analytics",
      stats: [
        { label: "Leads totaux", value: totalLeads.toLocaleString("fr-FR") },
        { label: "Ce mois", value: leadsThisMonth.toLocaleString("fr-FR") },
      ],
    },
    {
      title: "Performance des relances",
      description: "Efficacité des séquences automatiques, taux de réponse, cohortes",
      icon: Repeat,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      href: "/analytics/sequences",
      stats: [
        { label: "Leads en séquence", value: leadsInSequence.toLocaleString("fr-FR") },
      ],
    },
  ];

  const quickAccess = [
    { title: "Pipeline", description: "Gérer les leads", icon: Users, href: "/pipeline", color: "text-emerald-600" },
    { title: "Tâches", description: "Voir mes tâches du jour", icon: CalendarDays, href: "/tasks", color: "text-amber-600" },
    { title: "Inbox", description: "Messages reçus", icon: MessageSquare, href: "/inbox", color: "text-blue-600" },
    { title: "Appels", description: "Journal d'appels", icon: Phone, href: "/calls", color: "text-purple-600" },
    { title: "Rendez-vous", description: "Planifier un RDV", icon: CalendarDays, href: "/appointments", color: "text-indigo-600" },
    { title: "Campagnes", description: "Lancer une campagne", icon: Megaphone, href: "/campaigns", color: "text-rose-600" },
    { title: "Étudiants", description: "Liste des inscrits", icon: GraduationCap, href: "/students", color: "text-teal-600" },
    { title: "Paiements", description: "Suivi financier", icon: CreditCard, href: "/payments", color: "text-orange-600" },
  ];

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Bonjour {session.user.name?.split(" ")[0] || ""} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Bienvenue sur votre tableau de bord TalibCRM</p>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <QuickKpi label="Leads totaux" value={totalLeads.toLocaleString("fr-FR")} icon={Users} color="text-brand-600" bg="bg-brand-50" />
        <QuickKpi label="Étudiants inscrits" value={totalStudents.toLocaleString("fr-FR")} icon={GraduationCap} color="text-emerald-600" bg="bg-emerald-50" />
        <QuickKpi label="RDV à venir" value={totalAppointments.toLocaleString("fr-FR")} icon={CalendarDays} color="text-blue-600" bg="bg-blue-50" />
        <QuickKpi label="Campagnes" value={totalCampaigns.toLocaleString("fr-FR")} icon={Megaphone} color="text-rose-600" bg="bg-rose-50" />
      </div>

      {/* Reports section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-brand-500" /> Rapports & analyses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-card-hover hover:border-brand-200 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl ${r.iconBg} flex items-center justify-center`}>
                  <r.icon size={24} className={r.iconColor} />
                </div>
                <ArrowUpRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">{r.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{r.description}</p>
              {r.stats.length > 0 && (
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  {r.stats.map((s, i) => (
                    <div key={i}>
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Quick access section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Accès rapide</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickAccess.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-card-hover hover:border-brand-200 transition-all duration-200 group"
            >
              <q.icon size={20} className={`${q.color} mb-2`} />
              <p className="text-sm font-semibold text-gray-900">{q.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{q.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickKpi({ label, value, icon: Icon, color, bg }: { label: string; value: string; icon: any; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon size={16} className={color} />
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}