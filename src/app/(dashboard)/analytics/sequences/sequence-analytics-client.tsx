"use client";

import { useState, useTransition } from "react";
import { getSequenceAnalytics } from "./actions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp, Users, Reply, Clock, XCircle, CheckCircle2,
  Mail, MessageCircle, Phone, AlertTriangle, ChevronRight,
  Repeat, Loader2,
} from "lucide-react";

interface Analytics {
  period: { days: number; since: string };
  overview: {
    totalLeadsRelance: number;
    repliedCount: number;
    replyRate: number;
    avgReplyDays: number;
    autoLost: number;
    converted: number;
    conversionRate: number;
  };
  funnel: { step: string; label: string; total: number; done: number; failed: number; skipped: number }[];
  emails: { sent: number; opened: number; clicked: number; bounced: number };
  tasks: { total: number; done: number };
}

interface LeadInSequence {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  stage: { name: string; color: string };
  assignedToName: string | null;
  daysSinceCreated: number;
  lastStep: string | null;
  lastStepAt: Date | null;
  hasReplied: boolean;
  stepCount: number;
}

const STEP_ICONS: Record<string, any> = {
  J1_email: Mail,
  J3_whatsapp: MessageCircle,
  J7_call_task: Phone,
  J14_last_chance: AlertTriangle,
  J21_auto_lost: XCircle,
};

const STEP_COLORS: Record<string, string> = {
  J1_email: "bg-blue-50 text-blue-600",
  J3_whatsapp: "bg-emerald-50 text-emerald-600",
  J7_call_task: "bg-purple-50 text-purple-600",
  J14_last_chance: "bg-amber-50 text-amber-600",
  J21_auto_lost: "bg-red-50 text-red-600",
};

export function SequenceAnalyticsClient({ initialAnalytics, initialLeads }: {
  initialAnalytics: Analytics;
  initialLeads: LeadInSequence[];
}) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [leads] = useState(initialLeads);
  const [period, setPeriod] = useState(30);
  const [, startTransition] = useTransition();
  const [stepFilter, setStepFilter] = useState<string>("all");

  const handlePeriodChange = (days: number) => {
    setPeriod(days);
    startTransition(async () => {
      const data = await getSequenceAnalytics(days);
      setAnalytics(data as any);
    });
  };

  const filteredLeads = leads.filter((l) => {
    if (stepFilter === "all") return true;
    if (stepFilter === "replied") return l.hasReplied;
    if (stepFilter === "no_reply") return !l.hasReplied;
    return l.lastStep?.toLowerCase().includes(stepFilter.toLowerCase());
  });

  const formatRelative = (d: Date | string | null) => {
    if (!d) return "—";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    return "Il y a " + days + "j";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Repeat size={24} className="text-brand-500" /> Performance des relances
          </h1>
          <p className="text-sm text-gray-500 mt-1">Suivez l'efficacité de vos séquences automatiques</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/sequences" className="btn-secondary py-2 px-3 text-xs">
            Configurer les séquences
          </Link>
          <select value={period} onChange={(e) => handlePeriodChange(parseInt(e.target.value))} className="input text-xs py-1.5">
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="365">12 derniers mois</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={Users}
          color="text-brand-600"
          bg="bg-brand-50"
          value={analytics.overview.totalLeadsRelance}
          label="Leads relancés"
        />
        <KpiCard
          icon={Reply}
          color="text-emerald-600"
          bg="bg-emerald-50"
          value={analytics.overview.repliedCount}
          subValue={analytics.overview.replyRate + "%"}
          label="Réponses reçues"
        />
        <KpiCard
          icon={Clock}
          color="text-blue-600"
          bg="bg-blue-50"
          value={analytics.overview.avgReplyDays}
          unit=" j"
          label="Délai moyen de réponse"
        />
        <KpiCard
          icon={TrendingUp}
          color="text-violet-600"
          bg="bg-violet-50"
          value={analytics.overview.converted}
          subValue={analytics.overview.conversionRate + "%"}
          label="Conversions"
        />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" /> Entonnoir des relances
        </h3>
        <div className="space-y-2">
          {analytics.funnel.map((step) => {
            const Icon = STEP_ICONS[step.step] || Mail;
            const colorClass = STEP_COLORS[step.step] || "bg-gray-50 text-gray-600";
            const maxTotal = Math.max(...analytics.funnel.map((f) => f.done), 1);
            const widthPct = Math.max((step.done / maxTotal) * 100, 5);
            return (
              <div key={step.step} className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-700">{step.label}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-gray-900">{step.done}</span> exécutés
                      {step.failed > 0 && <span className="text-red-500 ml-2">{step.failed} échecs</span>}
                      {step.skipped > 0 && <span className="text-gray-400 ml-2">{step.skipped} ignorés</span>}
                    </p>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                    <div className={cn("h-full transition-all", colorClass.split(" ")[0])} style={{ width: widthPct + "%" }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email + Tasks performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Mail size={16} className="text-blue-500" /> Performance Email
          </h3>
          <div className="space-y-2">
            <StatRow label="Envoyés" value={analytics.emails.sent} />
            <StatRow label="Ouverts" value={analytics.emails.opened} percentage={analytics.emails.sent > 0 ? Math.round((analytics.emails.opened / analytics.emails.sent) * 100) : 0} />
            <StatRow label="Cliqués" value={analytics.emails.clicked} percentage={analytics.emails.sent > 0 ? Math.round((analytics.emails.clicked / analytics.emails.sent) * 100) : 0} />
            <StatRow label="Bouncés" value={analytics.emails.bounced} negative />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" /> Performance Tâches
          </h3>
          <div className="space-y-2">
            <StatRow label="Tâches créées" value={analytics.tasks.total} />
            <StatRow label="Tâches effectuées" value={analytics.tasks.done} percentage={analytics.tasks.total > 0 ? Math.round((analytics.tasks.done / analytics.tasks.total) * 100) : 0} />
            <StatRow label="Tâches en attente" value={analytics.tasks.total - analytics.tasks.done} />
          </div>
        </div>
      </div>

      {/* Leads in sequence */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users size={16} className="text-brand-500" /> Leads en séquence active ({filteredLeads.length})
          </h3>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {[
            { key: "all", label: "Tous" },
            { key: "replied", label: "Ont répondu" },
            { key: "no_reply", label: "Pas de réponse" },
            { key: "Email", label: "Étape Email" },
            { key: "WhatsApp", label: "Étape WhatsApp" },
            { key: "Appel", label: "Étape Appel" },
          ].map((f) => (
            <button key={f.key} onClick={() => setStepFilter(f.key)}
              className={cn(
                "text-xs px-3 py-1 rounded-full border font-medium transition-colors",
                stepFilter === f.key ? "bg-brand-100 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}>
              {f.label}
            </button>
          ))}
        </div>

        {filteredLeads.length === 0 ? (
          <div className="text-center py-8">
            <Users size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun lead actif dans une séquence</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLeads.slice(0, 50).map((lead) => (
              <Link key={lead.id} href={"/pipeline?leadId=" + lead.id} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-brand-50 rounded-lg transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: lead.stage.color + "20", color: lead.stage.color }}>
                      {lead.stage.name}
                    </span>
                    {lead.hasReplied && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">A répondu ✓</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{lead.daysSinceCreated} j depuis création</span>
                    {lead.lastStep && <span>• Dernière étape : {lead.lastStep}</span>}
                    {lead.lastStepAt && <span>• {formatRelative(lead.lastStepAt)}</span>}
                    {lead.assignedToName && <span>• {lead.assignedToName}</span>}
                  </div>
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-brand-600 shrink-0" />
              </Link>
            ))}
            {filteredLeads.length > 50 && (
              <p className="text-xs text-gray-400 text-center py-2">+ {filteredLeads.length - 50} autres leads (affichage limité à 50)</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, color, bg, value, subValue, label, unit }: {
  icon: any; color: string; bg: string; value: number; subValue?: string; label: string; unit?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
          <Icon size={18} className={color} />
        </div>
        {subValue && <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", bg, color)}>{subValue}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}{unit || ""}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatRow({ label, value, percentage, negative }: { label: string; value: number; percentage?: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900">{value}</span>
        {percentage !== undefined && (
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", negative ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600")}>{percentage}%</span>
        )}
      </div>
    </div>
  );
}