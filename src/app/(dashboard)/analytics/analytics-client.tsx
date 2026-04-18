"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import {
  Users, UserPlus, UserCheck, TrendingUp, TrendingDown,
  GraduationCap, Phone, Calendar, ListTodo, AlertTriangle,
  Activity, Target, BarChart3, Clock, Filter, PhoneMissed,
  CheckCircle2, XCircle, Timer, CalendarDays, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend,
} from "recharts";
import { getDashboardData } from "./actions";

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

var PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#6b7280"];

function getGreeting(): string {
  var h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatDurationShort(seconds: number): string {
  if (seconds < 60) return seconds + "s";
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function formatDateShort(dateStr: string): string {
  var d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface AnalyticsClientProps {
  data: any;
  userName: string;
  currentUserId: string;
}

export function AnalyticsClient({ data: initialData, userName, currentUserId }: AnalyticsClientProps) {
  var [data, setData] = useState(initialData);
  var [period, setPeriod] = useState(data.period || "30d");
  var [filterUser, setFilterUser] = useState("");
  var [filterCampus, setFilterCampus] = useState("");
  var [showFilters, setShowFilters] = useState(false);
  var [isPending, startTransition] = useTransition();
  var router = useRouter();

  var { kpis } = data;

  var handleFilterChange = function(newPeriod?: string, newUser?: string, newCampus?: string) {
    var p = newPeriod !== undefined ? newPeriod : period;
    var u = newUser !== undefined ? newUser : filterUser;
    var c = newCampus !== undefined ? newCampus : filterCampus;
    if (newPeriod !== undefined) setPeriod(p);
    if (newUser !== undefined) setFilterUser(u);
    if (newCampus !== undefined) setFilterCampus(c);

    startTransition(async function() {
      var result = await getDashboardData({
        period: p,
        userId: u || undefined,
        campusId: c || undefined,
      });
      setData(result);
    });
  };

  return (
    <div>
      {/* Header + Filters */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {getGreeting()}, {userName.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Voici un aperçu de votre activité</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: "7d", label: "7j" },
              { key: "30d", label: "30j" },
              { key: "90d", label: "90j" },
              { key: "12m", label: "12m" },
            ].map(function(p) {
              return (
                <button key={p.key} onClick={function() { handleFilterChange(p.key); }}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    period === p.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {p.label}
                </button>
              );
            })}
          </div>

          <button onClick={function() { setShowFilters(!showFilters); }}
            className={cn("btn-secondary py-2 text-xs", (filterUser || filterCampus) && "border-brand-300 text-brand-700")}>
            <Filter size={14} /> Filtres
            {(filterUser || filterCampus) && <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">!</span>}
          </button>

          {isPending && <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres</h4>
            <button onClick={function() { handleFilterChange(undefined, "", ""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Commercial</label>
              <select value={filterUser} onChange={function(e) { handleFilterChange(undefined, e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                <option value={currentUserId}>Mes données</option>
                {data.filterOptions.users.map(function(u: any) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Campus</label>
              <select value={filterCampus} onChange={function(e) { handleFilterChange(undefined, undefined, e.target.value); }} className="input text-sm py-1.5">
                <option value="">Tous</option>
                {data.filterOptions.campuses.map(function(c: any) { return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>; })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Nouveaux leads" value={kpis.leadsCurrentPeriod} change={kpis.leadsGrowth} prev={kpis.leadsPreviousPeriod} icon={UserPlus} iconColor="text-brand-600" iconBg="bg-brand-50" />
        <KpiCard label="Convertis" value={kpis.convertedCurrentPeriod} change={kpis.conversionGrowth} prev={kpis.convertedPreviousPeriod} icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <KpiCard label="Taux de conversion" value={kpis.conversionRate + "%"} change={kpis.conversionGrowth} icon={Target} iconColor="text-purple-600" iconBg="bg-purple-50" />
        <KpiCard label="Étudiants actifs" value={kpis.activeStudents} icon={GraduationCap} iconColor="text-amber-600" iconBg="bg-amber-50" subLabel={"Total : " + kpis.totalStudents} />
      </div>

      {/* Activity KPIs (calls + appointments + tasks) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <MiniKpi icon={Phone} label="Appels" value={String(kpis.callsTotal)} color="text-blue-600" />
        <MiniKpi icon={CheckCircle2} label="Joignabilité" value={kpis.callReachRate + "%"} color="text-emerald-600" />
        <MiniKpi icon={Timer} label="Durée moy." value={formatDurationShort(kpis.avgDuration)} color="text-purple-600" />
        <MiniKpi icon={CalendarDays} label="RDV" value={String(kpis.apptsTotal)} color="text-teal-600" />
        <MiniKpi icon={CheckCircle2} label="Présence" value={kpis.apptPresenceRate + "%"} color="text-emerald-600" />
        <MiniKpi icon={XCircle} label="Absents" value={String(kpis.apptsNoShow)} color="text-red-500" />
        <MiniKpi icon={ListTodo} label="Tâches" value={String(kpis.tasksOpen)} color="text-indigo-600" />
        <MiniKpi icon={AlertTriangle} label="En retard" value={String(kpis.tasksOverdue)} color="text-red-600" highlight={kpis.tasksOverdue > 0} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Leads + Conversions curve */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Leads & Conversions</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.leadsTimeline}>
              <defs>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                labelFormatter={function(label) { return formatDateShort(label); }}
              />
              <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} fill="url(#gradLeads)" name="Leads" />
              <Area type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} fill="url(#gradConv)" name="Conversions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sources pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sources d'acquisition</h3>
          {data.leadsBySource.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data.leadsBySource.slice(0, 6)}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    dataKey="count" nameKey="source"
                    strokeWidth={2} stroke="#fff"
                  >
                    {data.leadsBySource.slice(0, 6).map(function(entry: any, index: number) {
                      return <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || PIE_COLORS[index % PIE_COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={function(value: any, name: any) { return [value + " leads", SOURCE_LABELS[name] || name]; }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {data.leadsBySource.slice(0, 5).map(function(s: any, i: number) {
                  return (
                    <div key={s.source} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s.source] || PIE_COLORS[i] }} />
                        <span className="text-gray-600">{SOURCE_LABELS[s.source] || s.source}</span>
                      </div>
                      <span className="font-semibold text-gray-700">{s.count} <span className="text-gray-400 font-normal">({s.pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-12">Pas de données</p>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Pipeline funnel with conversion rates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline & Taux de conversion</h3>
          <div className="space-y-2.5">
            {data.pipelineFunnel.map(function(stage: any, idx: number) {
              var maxCount = data.pipelineFunnel[0]?.count || 1;
              var width = Math.max((stage.count / maxCount) * 100, 8);
              return (
                <div key={stage.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{stage.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">{stage.count}</span>
                      {idx > 0 && stage.conversionRate > 0 && (
                        <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full font-medium">{stage.conversionRate}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 bg-gray-50 rounded-lg overflow-hidden">
                    <div className="h-full rounded-lg transition-all" style={{ width: width + "%", backgroundColor: stage.color, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calls chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Appels quotidiens</h3>
          {data.callsByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.callsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  labelFormatter={function(label) { return formatDateShort(label); }}
                />
                <Bar dataKey="total" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="answered" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Décroché" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-12">Pas de données</p>
          )}
        </div>

        {/* Top programs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top filières</h3>
          {data.leadsByProgram.length > 0 ? (
            <div className="space-y-3">
              {data.leadsByProgram.map(function(prog: any, i: number) {
                var maxProg = data.leadsByProgram[0]?.count || 1;
                var pct = Math.round((prog.count / maxProg) * 100);
                var colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"];
                return (
                  <div key={prog.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 font-medium">{prog.name}</span>
                      <span className="text-xs font-bold text-gray-700">{prog.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: pct + "%", backgroundColor: colors[i % colors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-12">Pas de données</p>
          )}
        </div>
      </div>

      {/* Row 3: Commercial performance + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Commercial performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Performance commerciale</h3>
          {data.commercialPerf.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Commercial</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Leads</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Convertis</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Taux</th>
                    <th className="text-center py-2 text-gray-500 font-medium">Appels</th>
                    <th className="text-center py-2 text-gray-500 font-medium">RDV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.commercialPerf.map(function(user: any) {
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-700 text-[9px] font-bold flex items-center justify-center">{getInitials(user.name)}</div>
                            <span className="font-medium text-gray-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="text-center py-2.5 text-gray-700">{user.assigned}</td>
                        <td className="text-center py-2.5">
                          <span className="font-bold text-emerald-600">{user.converted}</span>
                        </td>
                        <td className="text-center py-2.5">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            user.convRate >= 20 ? "bg-emerald-50 text-emerald-600" :
                            user.convRate >= 10 ? "bg-amber-50 text-amber-600" :
                            "bg-gray-100 text-gray-500"
                          )}>{user.convRate}%</span>
                        </td>
                        <td className="text-center py-2.5 text-gray-700">{user.calls}</td>
                        <td className="text-center py-2.5 text-gray-700">{user.appointments}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">Aucun commercial</p>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Activité récente</h3>
          {data.recentActivities.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivities.map(function(a: any) {
                var person = a.lead ? a.lead.firstName + " " + a.lead.lastName :
                             a.student ? a.student.firstName + " " + a.student.lastName : "";
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity size={12} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 leading-relaxed">{a.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.user && <span className="text-[10px] text-gray-500">{a.user.name}</span>}
                        {person && <span className="text-[10px] text-brand-600">— {person}</span>}
                        <span className="text-[10px] text-gray-400">{formatRelative(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">Aucune activité</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({ label, value, change, prev, icon: Icon, iconColor, iconBg, subLabel }: {
  label: string; value: number | string; change?: number; prev?: number;
  icon: typeof Users; iconColor: string; iconBg: string; subLabel?: string;
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
      {prev !== undefined && (
        <p className="text-[10px] text-gray-400 mt-0.5">vs {prev} période précédente</p>
      )}
      {subLabel && <p className="text-[10px] text-gray-400 mt-0.5">{subLabel}</p>}
    </div>
  );
}

// ─── Mini KPI ───
function MiniKpi({ icon: Icon, label, value, color, highlight }: {
  icon: typeof Users; label: string; value: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 px-3 py-3 text-center", highlight && "border-red-200 bg-red-50/30")}>
      <Icon size={14} className={cn("mx-auto mb-1", color)} />
      <div className={cn("text-lg font-bold", color)}>{value}</div>
      <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}