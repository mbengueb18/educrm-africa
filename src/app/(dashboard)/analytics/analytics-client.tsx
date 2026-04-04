"use client";

import { cn, formatRelative, getInitials } from "@/lib/utils";
import {
  Users, UserPlus, UserCheck, TrendingUp, TrendingDown,
  GraduationCap, Phone, Calendar, ListTodo, AlertTriangle,
  Activity, Target, BarChart3, ArrowRight, Clock,
} from "lucide-react";

interface AnalyticsClientProps {
  data: {
    kpis: {
      totalLeads: number; leadsThisMonth: number; leadsPrevMonth: number; leadsGrowth: number;
      convertedThisMonth: number; convertedPrevMonth: number; conversionRate: number; conversionGrowth: number;
      totalStudents: number; activeStudents: number;
      totalTasks: number; overdueTasks: number;
      callsThisWeek: number; callReachRate: number;
      appointmentsThisWeek: number;
    };
    leadsTimeline: { date: string; count: number }[];
    conversionsTimeline: { date: string; count: number }[];
    leadsBySource: { source: string; count: number }[];
    leadsByStage: { name: string; count: number; color: string }[];
    leadsByProgram: { name: string; count: number }[];
    commercialPerf: { name: string; assigned: number; converted: number; calls: number; tasks: number }[];
    recentActivities: any[];
  };
  userName: string;
}

var SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Site web", FACEBOOK: "Facebook", INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp", PHONE_CALL: "Appel", WALK_IN: "Visite",
  REFERRAL: "Parrainage", SALON: "Salon", RADIO: "Radio", TV: "TV",
  PARTNER: "Partenaire", IMPORT: "Import", OTHER: "Autre",
};

var SOURCE_COLORS: Record<string, string> = {
  WEBSITE: "#3b82f6", FACEBOOK: "#1877f2", INSTAGRAM: "#e4405f",
  WHATSAPP: "#25d366", PHONE_CALL: "#6366f1", WALK_IN: "#14b8a6",
  REFERRAL: "#8b5cf6", SALON: "#f59e0b", RADIO: "#ef4444", TV: "#ec4899",
  PARTNER: "#06b6d4", IMPORT: "#6b7280", OTHER: "#9ca3af",
};

function getGreeting(): string {
  var h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function AnalyticsClient({ data, userName }: AnalyticsClientProps) {
  var { kpis } = data;

  var maxLeadsDay = Math.max(...data.leadsTimeline.map(function(d) { return d.count; }), 1);
  var totalSourceLeads = data.leadsBySource.reduce(function(sum, s) { return sum + s.count; }, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {getGreeting()}, {userName.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Voici un aperçu de votre activité</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Leads actifs"
          value={kpis.totalLeads}
          change={kpis.leadsGrowth}
          changeLabel="vs mois dernier"
          icon={Users}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <KpiCard
          label="Nouveaux ce mois"
          value={kpis.leadsThisMonth}
          change={kpis.leadsGrowth}
          changeLabel="vs mois dernier"
          icon={UserPlus}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <KpiCard
          label="Convertis ce mois"
          value={kpis.convertedThisMonth}
          change={kpis.conversionGrowth}
          changeLabel="vs mois dernier"
          icon={UserCheck}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <KpiCard
          label="Taux de conversion"
          value={kpis.conversionRate + "%"}
          change={kpis.conversionGrowth}
          changeLabel="vs mois dernier"
          icon={Target}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MiniKpi icon={GraduationCap} label="Étudiants actifs" value={String(kpis.activeStudents)} color="text-emerald-600" />
        <MiniKpi icon={ListTodo} label="Tâches en cours" value={String(kpis.totalTasks)} color="text-blue-600" subValue={kpis.overdueTasks > 0 ? kpis.overdueTasks + " en retard" : undefined} subColor="text-red-500" />
        <MiniKpi icon={Phone} label="Appels (7j)" value={String(kpis.callsThisWeek)} color="text-indigo-600" subValue={"Joignabilité " + kpis.callReachRate + "%"} />
        <MiniKpi icon={Calendar} label="RDV cette semaine" value={String(kpis.appointmentsThisWeek)} color="text-teal-600" />
        <MiniKpi icon={GraduationCap} label="Total étudiants" value={String(kpis.totalStudents)} color="text-purple-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Leads timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Leads — 30 derniers jours</h3>
          <div className="flex items-end gap-[3px] h-[140px]">
            {data.leadsTimeline.map(function(day) {
              var height = maxLeadsDay > 0 ? Math.max((day.count / maxLeadsDay) * 100, 2) : 2;
              var isToday = day.date === new Date().toISOString().split("T")[0];
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div className="absolute -top-6 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {new Date(day.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} : {day.count}
                  </div>
                  <div
                    className={cn("w-full rounded-t transition-colors", isToday ? "bg-brand-500" : "bg-brand-200 group-hover:bg-brand-400")}
                    style={{ height: height + "%" }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-gray-400">
            <span>{new Date(data.leadsTimeline[0]?.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
            <span>Aujourd'hui</span>
          </div>
        </div>

        {/* Sources breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sources d'acquisition</h3>
          <div className="space-y-2.5">
            {data.leadsBySource.slice(0, 7).map(function(s) {
              var pct = totalSourceLeads > 0 ? Math.round((s.count / totalSourceLeads) * 100) : 0;
              var color = SOURCE_COLORS[s.source] || "#9ca3af";
              return (
                <div key={s.source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{SOURCE_LABELS[s.source] || s.source}</span>
                    <span className="text-xs font-semibold text-gray-700">{s.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline</h3>
          <div className="space-y-2">
            {data.leadsByStage.map(function(stage) {
              var maxStage = Math.max(...data.leadsByStage.map(function(s) { return s.count; }), 1);
              var width = Math.max((stage.count / maxStage) * 100, 8);
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 shrink-0 truncate">{stage.name}</span>
                  <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                    <div className="h-full rounded-lg flex items-center px-2 transition-all" style={{ width: width + "%", backgroundColor: stage.color + "20" }}>
                      <div className="h-full rounded-lg" style={{ width: "100%", backgroundColor: stage.color, opacity: 0.7 }} />
                    </div>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">{stage.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top programs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top filières</h3>
          {data.leadsByProgram.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Pas encore de données</p>
          ) : (
            <div className="space-y-3">
              {data.leadsByProgram.map(function(prog, i) {
                var maxProg = data.leadsByProgram[0]?.count || 1;
                var pct = Math.round((prog.count / maxProg) * 100);
                var colors = ["bg-brand-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-indigo-500"];
                return (
                  <div key={prog.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 font-medium">{prog.name}</span>
                      <span className="text-xs font-bold text-gray-700">{prog.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", colors[i % colors.length])} style={{ width: pct + "%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Commercial performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Performance commerciale</h3>
          {data.commercialPerf.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Aucun commercial</p>
          ) : (
            <div className="space-y-3">
              {data.commercialPerf.map(function(user) {
                return (
                  <div key={user.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-500">{user.assigned} leads</span>
                        <span className="text-[10px] text-emerald-600 font-medium">{user.converted} convertis</span>
                        <span className="text-[10px] text-blue-500">{user.calls} appels</span>
                      </div>
                    </div>
                    {user.tasks > 0 && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">{user.tasks} tâches</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Activité récente</h3>
        {data.recentActivities.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucune activité</p>
        ) : (
          <div className="space-y-3">
            {data.recentActivities.slice(0, 10).map(function(a: any) {
              var person = a.lead ? a.lead.firstName + " " + a.lead.lastName :
                           a.student ? a.student.firstName + " " + a.student.lastName : "";
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity size={13} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{a.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.user && <span className="text-xs text-gray-500">{a.user.name}</span>}
                      {person && <span className="text-xs text-brand-600">— {person}</span>}
                      <span className="text-xs text-gray-400">{formatRelative(a.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({ label, value, change, changeLabel, icon: Icon, iconColor, iconBg }: {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
}) {
  var isPositive = (change || 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
        {change !== undefined && change !== 0 && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full",
            isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
          )}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? "+" : ""}{change}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {changeLabel && <p className="text-[10px] text-gray-400 mt-0.5">{changeLabel}</p>}
    </div>
  );
}

// ─── Mini KPI ───
function MiniKpi({ icon: Icon, label, value, color, subValue, subColor }: {
  icon: typeof Users;
  label: string;
  value: string;
  color: string;
  subValue?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-lg font-bold", color)}>{value}</div>
      {subValue && <p className={cn("text-[10px] mt-0.5", subColor || "text-gray-400")}>{subValue}</p>}
    </div>
  );
}