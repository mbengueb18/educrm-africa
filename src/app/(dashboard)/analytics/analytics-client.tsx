"use client";

import { useState, useTransition, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import {
  Users, UserPlus, UserCheck, TrendingUp, TrendingDown,
  GraduationCap, Phone, ListTodo, AlertTriangle,
  Activity, Target, Filter, Lock,
  CheckCircle2, XCircle, Timer, CalendarDays, Globe2, Repeat,
  Sparkles, LayoutGrid, ArrowRight, Download, Mail, MessageCircle, Gauge,
  Flag, Pencil, Plus, X,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, LineChart, Line,
} from "recharts";
import { getDashboardData } from "./actions";
import type { ReportingAccess } from "./access";
import type { GoalProgress } from "./goals";
import { saveReportingGoal } from "./goals";
import {
  REPORT_SOURCES, REPORT_PERIODS, VIZ_TYPES, isCustomDimension, CUSTOM_DIM_PREFIX,
  type ReportSource, type ReportConfig,
} from "./report-config";
import {
  runReportConfig, saveCustomReport, deleteCustomReport, getReportCustomDimensions,
  type CustomReportsList, type CustomReportItem,
} from "./custom-reports";
import type { ReportRow } from "./report-engine";
import { askAnalyst, getAnalystHistory, type AnalystResult, type AnalystHistoryItem } from "./ai-analyst";
import {
  listDashboards, getDashboard, createDashboard, deleteDashboard,
  addReportToDashboard, removeDashboardItem, setDashboardItemWidth,
  type DashboardsList, type DashboardDetail,
} from "./dashboards";
import {
  getProgramFunnel,
  type ProgramFunnel, type FunnelRow, type FunnelSummary, type FunnelGroup,
} from "./program-funnel";

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

// Canaux de campagne (extensible : SMS, etc.)
var CHANNEL_META: Record<string, { label: string; icon: typeof Mail; bg: string; color: string }> = {
  EMAIL: { label: "Email", icon: Mail, bg: "bg-blue-50", color: "text-blue-600" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, bg: "bg-emerald-50", color: "text-emerald-600" },
  SMS: { label: "SMS", icon: MessageCircle, bg: "bg-amber-50", color: "text-amber-600" },
};

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

// ─── Onglets du hub ───
type TabKey = "overview" | "acquisition" | "pipeline" | "recruitment" | "team" | "sequences" | "custom" | "ai";

var TAB_DEFS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutGrid },
  { key: "acquisition", label: "Acquisition", icon: Globe2 },
  { key: "pipeline", label: "Pipeline", icon: Target },
  { key: "recruitment", label: "Recrutement", icon: GraduationCap },
  { key: "team", label: "Équipe", icon: Users },
  { key: "sequences", label: "Relances", icon: Repeat },
  { key: "custom", label: "Rapports personnalisés", icon: LayoutGrid },
  { key: "ai", label: "Analyste IA", icon: Sparkles },
];

interface AnalyticsClientProps {
  data: any;
  userName: string;
  currentUserId: string;
  access: ReportingAccess;
  goalData: GoalProgress;
  customReports: CustomReportsList;
}

export function AnalyticsClient({ data: initialData, userName, currentUserId, access, goalData, customReports }: AnalyticsClientProps) {
  var [data, setData] = useState(initialData);
  var [period, setPeriod] = useState(data.period || "30d");
  var [filterUser, setFilterUser] = useState("");
  var [filterCampus, setFilterCampus] = useState("");
  var [showFilters, setShowFilters] = useState(false);
  var [tab, setTab] = useState<TabKey>("overview");
  var [isPending, startTransition] = useTransition();

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

  var tabEnabled = function(key: TabKey): boolean { return access.tabs[key]; };

  return (
    <div>
      {/* Header + Controls */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {getGreeting()}, {userName.split(" ")[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Centre d'analyse — plan {access.planName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector (options avancées verrouillées hors date filters) */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: "7d", label: "7j" },
              { key: "30d", label: "30j" },
              { key: "90d", label: "90j" },
              { key: "12m", label: "12m" },
            ].map(function(p) {
              var locked = !access.dateFilters && p.key !== "30d";
              return (
                <button key={p.key} disabled={locked}
                  onClick={function() { if (!locked) handleFilterChange(p.key); }}
                  title={locked ? "Filtres de période — plan Croissance" : undefined}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    period === p.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                    locked && "opacity-40 cursor-not-allowed hover:text-gray-500"
                  )}>
                  {p.label}
                </button>
              );
            })}
          </div>

          {access.advancedFilters && (
            <button onClick={function() { setShowFilters(!showFilters); }}
              className={cn("btn-secondary py-2 text-xs", (filterUser || filterCampus) && "border-brand-300 text-brand-700")}>
              <Filter size={14} /> Filtres
              {(filterUser || filterCampus) && <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">!</span>}
            </button>
          )}

          {access.exportData && (
            <button className="btn-secondary py-2 text-xs"><Download size={14} /> Exporter</button>
          )}

          {isPending && <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>

      {/* Filters */}
      {access.advancedFilters && showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 sm:mb-6 animate-scale-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Filtres</h4>
            <button onClick={function() { handleFilterChange(undefined, "", ""); }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Effacer</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Conseiller</label>
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

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TAB_DEFS.map(function(t) {
          var enabled = tabEnabled(t.key);
          var isActive = tab === t.key;
          return (
            <button key={t.key} onClick={function() { setTab(t.key); }}
              className={cn("relative flex items-center gap-1.5 px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-800"
              )}>
              {!enabled && <Lock size={11} className="text-gray-400" />}
              {t.label}
              {isActive && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-500 rounded" />}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {!tabEnabled(tab) ? (
        <UpsellPanel tab={tab} access={access} />
      ) : tab === "overview" ? (
        <OverviewTab data={data} kpis={kpis} access={access} goalData={goalData} />
      ) : tab === "acquisition" ? (
        <AcquisitionTab data={data} />
      ) : tab === "pipeline" ? (
        <PipelineTab data={data} />
      ) : tab === "recruitment" ? (
        <RecruitmentTab />
      ) : tab === "team" ? (
        <TeamTab data={data} />
      ) : tab === "sequences" ? (
        <SequencesTab />
      ) : tab === "custom" ? (
        <CustomReportsTab list={customReports} access={access} />
      ) : tab === "ai" ? (
        <AiTab />
      ) : null}
    </div>
  );
}

// ═══════════════════════ OBJECTIFS DE RENTRÉE ═══════════════════════
function formatGoalRange(start: string, end: string): string {
  var opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return new Date(start).toLocaleDateString("fr-FR", opt) + " → " + new Date(end).toLocaleDateString("fr-FR", opt);
}

function GoalMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActivityRow({ title, items }: { title: string; items: { label: string; value: any; color?: string; alert?: boolean }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 sm:w-28 shrink-0">{title}</span>
        <div className="grid grid-cols-5 gap-2 flex-1">
          {items.map(function(it, i) {
            return (
              <div key={i} className={cn("text-center rounded-lg py-1", it.alert && "bg-red-50/60")}>
                <div className={cn("text-base sm:text-lg font-bold tabular-nums", it.color || "text-gray-900")}>{it.value}</div>
                <div className="text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">{it.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ObjectivesSection({ goalData, summary }: { goalData: GoalProgress; summary: FunnelSummary | null }) {
  var router = useRouter();
  var [editing, setEditing] = useState(false);
  var goal = goalData.goal;
  var onSaved = function() { setEditing(false); router.refresh(); };

  var fmtN = function(n: number | undefined) { return summary ? (n ?? 0).toLocaleString("fr-FR") : "…"; };
  var fmtP = function(n: number | undefined) { return summary ? fmtPct(n ?? 0) : "…"; };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-900">{goal ? goal.label : "Recrutement — rentrée"}</h3>
          </div>
          {goal && (
            <p className="text-xs text-gray-500 mt-0.5">
              {formatGoalRange(goal.startDate, goal.endDate)}
              {goalData.daysLeft !== null && goalData.daysLeft > 0 ? " — " + goalData.daysLeft + " jours restants" : ""}
            </p>
          )}
        </div>
        {goalData.canEdit && (
          <button onClick={function() { setEditing(true); }} className="btn-secondary text-xs py-1.5">
            {goal ? <><Pencil size={13} /> Modifier</> : <><Plus size={14} /> Définir la campagne</>}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GoalMetric label="Leads total" value={fmtN(summary?.leadsTotal)} />
        <GoalMetric label="Contactés" value={fmtN(summary?.contacted)} sub="≥ 1 appel / message" />
        <GoalMetric label="Qualifiés" value={fmtN(summary?.qualified)} sub="contactés + filière" />
        <GoalMetric label="Convertis" value={fmtN(summary?.inscrits)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
        <GoalMetric label="Taux de transformation" value={fmtP(summary?.transformationRate)} sub="inscrits / qualifiés" />
        <GoalMetric label="Objectifs" value={fmtN(summary?.target)} sub="somme par filière" />
        <GoalMetric label="Réalisés" value={fmtN(summary?.inscrits)} />
        <GoalMetric label="Taux de réalisation" value={fmtP(summary?.realizationRate)} sub="inscrits / objectif" />
      </div>
      {editing && <GoalEditor goal={goal} onClose={function() { setEditing(false); }} onSaved={onSaved} />}
    </div>
  );
}

function GoalEditor({ goal, onClose, onSaved }: { goal: GoalProgress["goal"]; onClose: () => void; onSaved: () => void }) {
  var [label, setLabel] = useState(goal?.label ?? "Rentrée 2026–2027");
  var [startDate, setStartDate] = useState(goal ? goal.startDate.slice(0, 10) : "");
  var [endDate, setEndDate] = useState(goal ? goal.endDate.slice(0, 10) : "");
  var [error, setError] = useState("");
  var [pending, startTransition] = useTransition();

  var submit = function() {
    setError("");
    startTransition(async function() {
      var res = await saveReportingGoal({
        id: goal?.id,
        label: label,
        startDate: startDate,
        endDate: endDate,
        targetEnrollments: 0,
        targetLeads: 0,
        targetConversionRate: null,
      });
      if (res.ok) onSaved();
      else setError(res.error || "Erreur");
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{goal ? "Modifier la campagne" : "Définir la campagne de rentrée"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Libellé</label>
            <input value={label} onChange={function(e) { setLabel(e.target.value); }} className="input text-sm" placeholder="Rentrée 2026–2027" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Début</label>
              <input type="date" value={startDate} onChange={function(e) { setStartDate(e.target.value); }} className="input text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fin</label>
              <input type="date" value={endDate} onChange={function(e) { setEndDate(e.target.value); }} className="input text-sm" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Les objectifs d'inscrits se définissent par filière dans Réglages → Organisation.</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={submit} disabled={pending} className="btn-primary text-sm">{pending ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ ONGLET : VUE D'ENSEMBLE ═══════════════════════
function OverviewTab({ data, kpis, access, goalData }: { data: any; kpis: any; access: ReportingAccess; goalData: GoalProgress }) {
  var cmp = access.periodComparison;
  var [funnel, setFunnel] = useState<ProgramFunnel | null>(null);
  useEffect(function() { if (access.objectives) getProgramFunnel().then(setFunnel).catch(function() {}); }, []);
  var s: FunnelSummary | null = funnel && funnel.ok && funnel.summary ? funnel.summary : null;

  return (
    <div>
      {/* Résumé recrutement / rentrée */}
      {access.objectives ? (
        <ObjectivesSection goalData={goalData} summary={s} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Nouveaux leads" value={kpis.leadsCurrentPeriod} change={cmp ? kpis.leadsGrowth : undefined} prev={cmp ? kpis.leadsPreviousPeriod : undefined} icon={UserPlus} iconColor="text-brand-600" iconBg="bg-brand-50" />
          <KpiCard label="Convertis" value={kpis.convertedCurrentPeriod} change={cmp ? kpis.conversionGrowth : undefined} prev={cmp ? kpis.convertedPreviousPeriod : undefined} icon={UserCheck} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          <KpiCard label="Taux de conversion" value={(kpis.conversionRate ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %"} icon={Target} iconColor="text-purple-600" iconBg="bg-purple-50" />
          <KpiCard label="Étudiants actifs" value={kpis.activeStudents} icon={GraduationCap} iconColor="text-amber-600" iconBg="bg-amber-50" subLabel={"Total : " + kpis.totalStudents} />
        </div>
      )}

      {/* Activités : Tâches / Appels / Rendez-vous */}
      <div className="flex flex-col gap-3">
        <ActivityRow title="Tâches" items={[
          { label: "Total", value: kpis.tasksTotal, color: "text-gray-900" },
          { label: "À faire", value: kpis.tasksTodo, color: "text-blue-600" },
          { label: "En cours", value: kpis.tasksInProgress, color: "text-amber-600" },
          { label: "Réalisées", value: kpis.tasksDone, color: "text-emerald-600" },
          { label: "En retard", value: kpis.tasksOverdue, color: "text-red-600", alert: kpis.tasksOverdue > 0 },
        ]} />
        <ActivityRow title="Appels" items={[
          { label: "Total", value: kpis.callsTotal, color: "text-gray-900" },
          { label: "Entrants", value: kpis.callsInbound, color: "text-blue-600" },
          { label: "Sortants", value: kpis.callsOutbound, color: "text-violet-600" },
          { label: "Joignabilité", value: kpis.callReachRate + " %", color: "text-emerald-600" },
          { label: "Durée moy.", value: formatDurationShort(kpis.avgDuration), color: "text-purple-600" },
        ]} />
        <ActivityRow title="Rendez-vous" items={[
          { label: "Total", value: kpis.apptsTotal, color: "text-gray-900" },
          { label: "Planifiés", value: kpis.apptsScheduled, color: "text-blue-600" },
          { label: "Terminés", value: kpis.apptsCompleted, color: "text-emerald-600" },
          { label: "Annulés", value: kpis.apptsCancelled, color: "text-red-500" },
          { label: "Présence", value: kpis.apptPresenceRate + " %", color: "text-emerald-600" },
        ]} />
      </div>
    </div>
  );
}

// ═══════════════════════ ONGLET : ACQUISITION ═══════════════════════
function AcquisitionTab({ data }: { data: any }) {
  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Sources */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Sources d'acquisition</h3>
        {data.leadsBySource.length > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={data.leadsBySource.slice(0, 6)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count" nameKey="source" strokeWidth={2} stroke="#fff">
                  {data.leadsBySource.slice(0, 6).map(function(entry: any, index: number) {
                    return <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || PIE_COLORS[index % PIE_COLORS.length]} />;
                  })}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={function(value: any, name: any) { return [value + " leads", SOURCE_LABELS[name] || name]; }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {data.leadsBySource.slice(0, 6).map(function(s: any, i: number) {
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
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-12">Pas de données</p>
        )}
      </div>

      {/* Analytics web (lien vers la page dédiée, intégration complète à venir) */}
      <Link href="/analytics/web" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-200 hover:shadow-card-hover transition-all group flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center"><Globe2 size={22} className="text-emerald-600" /></div>
          <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Analytics web détaillé</h3>
        <p className="text-xs text-gray-500">Trafic du site, canaux d'acquisition, parcours visiteurs et funnel de conversion visiteur → lead → étudiant.</p>
      </Link>
    </div>

    {/* Hub campagnes email + WhatsApp unifié */}
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Performance des campagnes</h3>
        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Email + WhatsApp</span>
      </div>
      {data.campaignPerf && data.campaignPerf.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left py-2 font-medium">Campagne</th>
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-right py-2 font-medium">Envoyés</th>
                <th className="text-right py-2 font-medium">Délivrés</th>
                <th className="text-right py-2 font-medium">Ouverts</th>
                <th className="text-right py-2 font-medium">Cliqués</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.campaignPerf.map(function(c: any) {
                var meta = CHANNEL_META[c.channel] || CHANNEL_META.EMAIL;
                var deliveredPct = c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0;
                var openPct = c.delivered > 0 ? Math.round((c.opened / c.delivered) * 100) : 0;
                var clickPct = c.delivered > 0 && c.clicked !== null ? Math.round((c.clicked / c.delivered) * 100) : null;
                return (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", meta.bg)}>
                          <meta.icon size={12} className={meta.color} />
                        </div>
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", meta.bg, meta.color)}>{meta.label}</span>
                    </td>
                    <td className="text-right py-2.5 text-gray-700 tabular-nums">{c.sent.toLocaleString("fr-FR")}</td>
                    <td className="text-right py-2.5 text-gray-700 tabular-nums">{c.delivered.toLocaleString("fr-FR")} <span className="text-gray-400">({deliveredPct}%)</span></td>
                    <td className="text-right py-2.5 text-gray-700 tabular-nums">{c.opened.toLocaleString("fr-FR")} <span className="text-gray-400">({openPct}%)</span></td>
                    <td className="text-right py-2.5 text-gray-700 tabular-nums">{c.clicked === null ? "—" : c.clicked.toLocaleString("fr-FR") + " (" + clickPct + "%)"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-8">Aucune campagne envoyée sur la période</p>
      )}
    </div>
    </div>
  );
}

// ═══════════════════════ ONGLET : PIPELINE ═══════════════════════
function PipelineTab({ data }: { data: any }) {
  var kpis = data.kpis;
  return (
    <div className="flex flex-col gap-4">
    {/* Vélocité */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Leads dans le pipeline" value={kpis.pipelineTotal ?? 0} icon={Target} iconColor="text-brand-600" iconBg="bg-brand-50" subLabel="hors perdus / inscrits" />
      <KpiCard label="Cycle moyen" value={(kpis.avgCycleDays ?? 0) + " j"} icon={Gauge} iconColor="text-purple-600" iconBg="bg-purple-50" subLabel="capture → conversion" />
      <KpiCard label="RDV planifiés" value={kpis.apptsTotal} icon={CalendarDays} iconColor="text-teal-600" iconBg="bg-teal-50" />
      <KpiCard label="Taux de présence" value={kpis.apptPresenceRate + "%"} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline &amp; Taux de conversion</h3>
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
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} labelFormatter={function(label) { return formatDateShort(label); }} />
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
    </div>
  );
}

// ═══════════════════════ RECRUTEMENT PAR PROGRAMME ═══════════════════════
function fmtPct(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
}

function FunnelTableRow({ r, kind }: { r: FunnelRow; kind: "prog" | "sub" | "total" }) {
  var base = kind === "total" ? "bg-amber-50 font-bold" : kind === "sub" ? "bg-gray-50 font-semibold" : "";
  return (
    <tr className={cn("border-b border-gray-50", base)}>
      <td className="py-2 px-2 text-left whitespace-nowrap">{r.name}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.globaux}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.qualifies}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.admis}</td>
      <td className="py-2 px-2 text-right tabular-nums text-emerald-700">{r.inscrits}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.qualifies > 0 ? fmtPct(r.transformationRate) : "—"}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.target || "—"}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.realized}</td>
      <td className="py-2 px-2 text-right tabular-nums">{r.target > 0 ? fmtPct(r.realizationRate) : "—"}</td>
    </tr>
  );
}

var FUNNEL_HEADER = (
  <tr className="border-b border-gray-200 text-gray-500">
    <th className="py-2 px-2 text-left font-medium">Filière</th>
    <th className="py-2 px-2 text-right font-medium whitespace-nowrap">Prospects globaux</th>
    <th className="py-2 px-2 text-right font-medium">Qualifiés</th>
    <th className="py-2 px-2 text-right font-medium">Admis</th>
    <th className="py-2 px-2 text-right font-medium">Inscrits</th>
    <th className="py-2 px-2 text-right font-medium whitespace-nowrap">Tx transf.</th>
    <th className="py-2 px-2 text-right font-medium">Objectif</th>
    <th className="py-2 px-2 text-right font-medium">Réalisé</th>
    <th className="py-2 px-2 text-right font-medium whitespace-nowrap">Tx réal.</th>
  </tr>
);

function FormationTable({ group }: { group: FunnelGroup }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{group.label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>{FUNNEL_HEADER}</thead>
          <tbody>
            {group.diplomas.map(function(d) {
              var hasDiploma = d.diploma !== "(sans programme)";
              return (
                <Fragment key={d.diploma}>
                  {hasDiploma && <tr className="bg-brand-50/60"><td colSpan={9} className="py-1.5 px-2 text-left font-semibold text-brand-700 uppercase text-[10px] tracking-wider">{d.diploma}</td></tr>}
                  {d.rows.map(function(r) { return <FunnelTableRow key={r.programId} r={r} kind="prog" />; })}
                  {hasDiploma && d.rows.length > 1 && <FunnelTableRow r={d.subtotal} kind="sub" />}
                </Fragment>
              );
            })}
            <FunnelTableRow r={group.subtotal} kind="total" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecruitmentTab() {
  var [fn, setFn] = useState<ProgramFunnel | null>(null);
  var [type, setType] = useState("");

  useEffect(function() { getProgramFunnel().then(setFn).catch(function() {}); }, []);

  if (!fn) {
    return <div className="bg-white rounded-xl border border-gray-200 p-8"><div className="flex justify-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div></div>;
  }
  if (!fn.ok) {
    return <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">{fn.error || "Indisponible."}</div>;
  }

  var groups = fn.groups || [];
  var shown = type ? groups.filter(function(g) { return g.type === type; }) : groups;
  var total = fn.total;
  var chartData = shown.flatMap(function(g) {
    return g.diplomas.map(function(d) {
      return { name: d.diploma === "(sans programme)" ? g.label : d.diploma, Inscrits: d.subtotal.inscrits, Objectif: d.subtotal.target };
    });
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">Recrutement par programme</h3>
          <p className="text-[11px] text-gray-400 max-w-2xl">Cumulatif · Qualifiés = contactés ≥1 fois (appel/message) + filière · Admis inclut les inscrits · Tx transf. = inscrits/qualifiés · Tx réal. = inscrits/objectif (défini par filière dans Réglages → Organisation).</p>
        </div>
        <select value={type} onChange={function(e) { setType(e.target.value); }} className="input text-xs py-1.5 w-auto">
          <option value="">Toutes les formations</option>
          {(fn.types || []).map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
        </select>
      </div>

      {total && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Prospects globaux" value={total.globaux} icon={Users} iconColor="text-brand-600" iconBg="bg-brand-50" />
          <KpiCard label="Qualifiés" value={total.qualifies} icon={UserCheck} iconColor="text-violet-600" iconBg="bg-violet-50" />
          <KpiCard label="Admis" value={total.admis} icon={CheckCircle2} iconColor="text-blue-600" iconBg="bg-blue-50" />
          <KpiCard label="Inscrits" value={total.inscrits} icon={GraduationCap} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          <KpiCard label="Objectif" value={total.target} icon={Flag} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <KpiCard label="Taux de réalisation" value={total.target > 0 ? fmtPct(total.realizationRate) : "—"} icon={Target} iconColor="text-purple-600" iconBg="bg-purple-50" />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Inscrits vs objectif par programme</h3>
            <div className="flex gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#2E86C1" }} />Inscrits</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#F39C12" }} />Objectif</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="Inscrits" fill="#2E86C1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Objectif" fill="#F39C12" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {shown.map(function(g) { return <FormationTable key={g.type} group={g} />; })}
      {groups.length === 0 && <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Aucun programme actif. Définissez vos filières (type de formation, programme/diplôme, objectif) dans Réglages → Organisation.</div>}
    </div>
  );
}

// ═══════════════════════ ONGLET : ÉQUIPE ═══════════════════════
function TeamTab({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Performance des conseillers</h3>
      {data.commercialPerf.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Conseiller</th>
                <th className="text-center py-2 text-gray-500 font-medium hidden sm:table-cell">Portefeuille</th>
                <th className="text-center py-2 text-gray-500 font-medium">Convertis</th>
                <th className="text-center py-2 text-gray-500 font-medium">Taux</th>
                <th className="text-center py-2 text-gray-500 font-medium hidden sm:table-cell">Appels</th>
                <th className="text-center py-2 text-gray-500 font-medium hidden sm:table-cell">RDV</th>
                <th className="text-center py-2 text-gray-500 font-medium hidden sm:table-cell">Tâches ouvertes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.commercialPerf.map(function(user: any) {
                return (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-brand-100 text-brand-700 text-[9px] font-bold flex items-center justify-center shrink-0">{getInitials(user.name)}</div>
                        <span className="font-medium text-gray-900 truncate">{user.name}</span>
                      </div>
                    </td>
                    <td className="text-center py-2.5 text-gray-700 hidden sm:table-cell">{user.assigned}</td>
                    <td className="text-center py-2.5"><span className="font-bold text-emerald-600">{user.converted}</span></td>
                    <td className="text-center py-2.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                        user.convRate >= 20 ? "bg-emerald-50 text-emerald-600" :
                        user.convRate >= 10 ? "bg-amber-50 text-amber-600" :
                        "bg-gray-100 text-gray-500"
                      )}>{user.convRate.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</span>
                    </td>
                    <td className="text-center py-2.5 text-gray-700 hidden sm:table-cell">{user.calls}</td>
                    <td className="text-center py-2.5 text-gray-700 hidden sm:table-cell">{user.appointments}</td>
                    <td className="text-center py-2.5 text-gray-700 hidden sm:table-cell">{user.tasks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-8">Aucun conseiller</p>
      )}
      <p className="text-[11px] text-gray-400 mt-3">
        <b>Portefeuille</b> et <b>tâches ouvertes</b> sont des instantanés (charge actuelle, indépendants de la période) ; <b>convertis</b>, <b>appels</b> et <b>RDV</b> portent sur la période sélectionnée.
      </p>
      {data.unattributedConverted > 0 && (
        <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
          {data.unattributedConverted} conversion{data.unattributedConverted > 1 ? "s" : ""} de la période non attribuée{data.unattributedConverted > 1 ? "s" : ""} à un conseiller (leads importés ou non assignés) — d'où l'écart avec le KPI « Convertis ».
        </p>
      )}
    </div>
  );
}

// ═══════════════════════ ONGLET : RELANCES ═══════════════════════
function SequencesTab() {
  return (
    <Link href="/analytics/sequences" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-200 hover:shadow-card-hover transition-all group flex items-start gap-4 max-w-2xl">
      <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><Repeat size={24} className="text-violet-600" /></div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Performance des relances</h3>
          <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Funnel des séquences automatiques, taux de réponse, cohortes temporelles et impact « avec vs sans relance ». Export CSV disponible.</p>
      </div>
    </Link>
  );
}

// ═══════════════════════ ONGLET : RAPPORTS PERSONNALISÉS ═══════════════════════
function summarizeConfig(item: CustomReportItem): string {
  var s = REPORT_SOURCES[item.source as ReportSource];
  var dim = isCustomDimension(item.dimension)
    ? item.dimension.slice(CUSTOM_DIM_PREFIX.length) + " (perso.)"
    : s?.dimensions.find(function(d) { return d.key === item.dimension; })?.label || item.dimension;
  var meas = s?.measures.find(function(m) { return m.key === item.measure; })?.label || item.measure;
  var per = REPORT_PERIODS.find(function(p) { return p.key === item.period; })?.label || item.period;
  return meas + " par " + dim + " · " + per;
}

function formatReportValue(v: number, format: string): string {
  if (format === "percent") return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " %";
  if (format === "duration") {
    var s = Math.round(v);
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + " min" + (r ? " " + r + " s" : "");
  }
  return v.toLocaleString("fr-FR");
}

function ReportResult({ rows, format, vizType, total }: { rows: ReportRow[]; format: string; vizType: string; total?: number }) {
  var fmt = function(v: number) { return formatReportValue(v, format); };

  // Grand nombre (KPI) : n'a pas besoin de lignes
  if (vizType === "kpi") {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-4xl font-bold text-gray-900 tabular-nums">{fmt(total ?? 0)}</div>
        <div className="text-xs text-gray-400 mt-1">total sur la période</div>
      </div>
    );
  }

  if (!rows || rows.length === 0) return <p className="text-xs text-gray-400 text-center py-10">Aucune donnée sur la période</p>;

  if (vizType === "pie" || vizType === "donut") {
    var pieData = rows.slice(0, 8);
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={vizType === "donut" ? 60 : 0} outerRadius={95} strokeWidth={2} stroke="#fff">
            {pieData.map(function(e, i) { return <Cell key={e.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />; })}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={function(v: any) { return fmt(Number(v)); }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (vizType === "line" || vizType === "area") {
    var Chart: any = vizType === "line" ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height={250}>
        <Chart data={rows}>
          <defs>
            <linearGradient id="gradReport" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2E86C1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#2E86C1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={function(v: any) { return fmt(Number(v)); }} />
          {vizType === "line"
            ? <Line type="monotone" dataKey="value" stroke="#2E86C1" strokeWidth={2} dot={false} />
            : <Area type="monotone" dataKey="value" stroke="#2E86C1" strokeWidth={2} fill="url(#gradReport)" />}
        </Chart>
      </ResponsiveContainer>
    );
  }

  if (vizType === "column") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={rows.slice(0, 25)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={function(v: any) { return fmt(Number(v)); }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {rows.slice(0, 25).map(function(e, i) { return <Cell key={e.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />; })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (vizType === "table") {
    return (
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
        <table className="w-full text-xs">
          <tbody className="divide-y divide-gray-50">
            {rows.map(function(r) {
              return (
                <tr key={r.key} className="hover:bg-gray-50/50">
                  <td className="py-2 text-gray-700">{r.label}</td>
                  <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">{fmt(r.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // bar (barres horizontales) — défaut
  var max = Math.max.apply(null, rows.map(function(r) { return r.value; }).concat(1));
  return (
    <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
      {rows.map(function(r, i) {
        var pct = max > 0 ? Math.round((r.value / max) * 100) : 0;
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 truncate max-w-[70%]">{r.label}</span>
              <span className="text-xs font-bold text-gray-700 tabular-nums">{fmt(r.value)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: Math.max(pct, 2) + "%", backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomReportsTab({ list, access }: { list: CustomReportsList; access: ReportingAccess }) {
  var [view, setView] = useState<"reports" | "dashboards">("reports");
  return (
    <div>
      {access.tabs.dashboards && (
        <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-5">
          <button onClick={function() { setView("reports"); }}
            className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-colors", view === "reports" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>Rapports</button>
          <button onClick={function() { setView("dashboards"); }}
            className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-colors", view === "dashboards" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>Tableaux de bord</button>
        </div>
      )}
      {view === "reports" ? <ReportsPanel list={list} /> : <DashboardsPanel access={access} reports={list.reports} />}
    </div>
  );
}

function ReportsPanel({ list }: { list: CustomReportsList }) {
  var router = useRouter();
  var [builder, setBuilder] = useState<CustomReportItem | "new" | null>(null);
  var [viewing, setViewing] = useState<CustomReportItem | null>(null);
  var [pendingDelete, startDelete] = useTransition();
  var reports = list.reports;
  var atQuota = reports.length >= list.max;

  var onDelete = function(id: string) {
    if (!confirm("Supprimer ce rapport ?")) return;
    startDelete(async function() { await deleteCustomReport(id); router.refresh(); });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Rapports personnalisés</h3>
          <p className="text-xs text-gray-500">{reports.length} / {list.max} rapports utilisés</p>
        </div>
        {list.canManage && (
          <button onClick={function() { setBuilder("new"); }} disabled={atQuota}
            className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={14} /> Créer un rapport
          </button>
        )}
      </div>

      {atQuota && list.canManage && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Quota atteint ({list.max} rapports). Supprimez-en un ou passez au plan supérieur pour en créer davantage.
        </p>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3"><LayoutGrid size={24} className="text-brand-600" /></div>
          <h4 className="text-sm font-semibold text-gray-900">Aucun rapport pour le moment</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Composez un rapport à partir de vos données : choisissez une source, une dimension, une mesure et une visualisation.</p>
          {list.canManage && <button onClick={function() { setBuilder("new"); }} className="btn-primary text-xs mt-4"><Plus size={14} /> Créer mon premier rapport</button>}
          {!list.canManage && <p className="text-[11px] text-gray-400 mt-3">Seuls les administrateurs peuvent créer des rapports.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(function(r) {
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-200 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center"><LayoutGrid size={16} className="text-brand-600" /></div>
                  {list.canManage && (
                    <div className="flex gap-0.5">
                      <button onClick={function() { setBuilder(r); }} className="text-gray-300 hover:text-brand-500 p-1" title="Modifier"><Pencil size={13} /></button>
                      <button onClick={function() { onDelete(r.id); }} disabled={pendingDelete} className="text-gray-300 hover:text-red-500 p-1" title="Supprimer"><X size={14} /></button>
                    </div>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mt-3 truncate">{r.name}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">{summarizeConfig(r)}</p>
                <button onClick={function() { setViewing(r); }} className="text-xs font-medium text-brand-600 mt-3 inline-flex items-center gap-1 hover:gap-1.5 transition-all">Ouvrir <ArrowRight size={12} /></button>
              </div>
            );
          })}
        </div>
      )}

      {builder && <ReportBuilder report={builder === "new" ? null : builder} onClose={function() { setBuilder(null); }} onSaved={function() { setBuilder(null); router.refresh(); }} />}
      {viewing && <ReportViewer report={viewing} onClose={function() { setViewing(null); }} />}
    </div>
  );
}

function ReportViewer({ report, onClose }: { report: CustomReportItem; onClose: () => void }) {
  var [res, setRes] = useState<Awaited<ReturnType<typeof runReportConfig>> | null>(null);
  var [, startRun] = useTransition();

  useEffect(function() {
    startRun(async function() {
      var r = await runReportConfig({
        source: report.source, dimension: report.dimension, measure: report.measure,
        period: report.period, vizType: report.vizType as any,
      });
      setRes(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-900">{report.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{summarizeConfig(report)}</p>
        {!res ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : res.ok ? (
          <ReportResult rows={res.rows || []} format={res.format || "int"} vizType={report.vizType} total={res.total} />
        ) : (
          <p className="text-xs text-red-500 text-center py-8">{res.error}</p>
        )}
      </div>
    </div>
  );
}

function ReportBuilder({ report, onClose, onSaved }: { report: CustomReportItem | null; onClose: () => void; onSaved: () => void }) {
  var [name, setName] = useState(report?.name ?? "");
  var [source, setSource] = useState<ReportSource>(report?.source ?? "leads");
  var srcDef = REPORT_SOURCES[source];
  var [dimension, setDimension] = useState(report?.dimension ?? srcDef.dimensions[0].key);
  var [measure, setMeasure] = useState(report?.measure ?? srcDef.measures[0].key);
  var [period, setPeriod] = useState(report?.period ?? "90d");
  var [vizType, setVizType] = useState<ReportConfig["vizType"]>((report?.vizType as any) ?? "bar");
  var [res, setRes] = useState<Awaited<ReturnType<typeof runReportConfig>> | null>(null);
  var [customDims, setCustomDims] = useState<{ key: string; label: string }[]>([]);
  var [error, setError] = useState("");
  var [, startPreview] = useTransition();
  var [saving, startSaving] = useTransition();

  useEffect(function() {
    getReportCustomDimensions().then(setCustomDims).catch(function() {});
  }, []);

  // Dimensions custom uniquement pour les prospects
  var dimOptions = source === "leads" ? [...srcDef.dimensions, ...customDims] : srcDef.dimensions;

  var changeSource = function(s: ReportSource) {
    setSource(s);
    var d = REPORT_SOURCES[s];
    setDimension(d.dimensions[0].key);
    setMeasure(d.measures[0].key);
  };

  // Aperçu live (ne dépend pas de vizType : simple re-rendu côté client)
  useEffect(function() {
    startPreview(async function() {
      var r = await runReportConfig({ source: source, dimension: dimension, measure: measure, period: period, vizType: vizType });
      setRes(r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, dimension, measure, period]);

  var submit = function() {
    setError("");
    startSaving(async function() {
      var r = await saveCustomReport({ id: report?.id, name: name, source: source, dimension: dimension, measure: measure, period: period, vizType: vizType });
      if (r.ok) onSaved();
      else setError(r.error || "Erreur");
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{report ? "Modifier le rapport" : "Nouveau rapport personnalisé"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nom du rapport</label>
              <input value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" placeholder="Ex. Leads par filière" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source de données</label>
              <select value={source} onChange={function(e) { changeSource(e.target.value as ReportSource); }} className="input text-sm py-1.5">
                {Object.values(REPORT_SOURCES).map(function(s) { return <option key={s.key} value={s.key}>{s.label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Dimension (regrouper par)</label>
              <select value={dimension} onChange={function(e) { setDimension(e.target.value); }} className="input text-sm py-1.5">
                {dimOptions.map(function(d) { return <option key={d.key} value={d.key}>{d.label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mesure</label>
              <select value={measure} onChange={function(e) { setMeasure(e.target.value); }} className="input text-sm py-1.5">
                {srcDef.measures.map(function(m) { return <option key={m.key} value={m.key}>{m.label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Période</label>
              <select value={period} onChange={function(e) { setPeriod(e.target.value); }} className="input text-sm py-1.5">
                {REPORT_PERIODS.map(function(p) { return <option key={p.key} value={p.key}>{p.label}</option>; })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Visualisation</label>
              <div className="grid grid-cols-4 gap-2">
                {VIZ_TYPES.map(function(v) {
                  return (
                    <button key={v.key} onClick={function() { setVizType(v.key); }}
                      className={cn("text-[11px] py-1.5 rounded-lg border font-medium",
                        vizType === v.key ? "border-brand-400 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}>{v.label}</button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50/70 rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Aperçu</p>
            {!res ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : res.ok ? (
              <ReportResult rows={res.rows || []} format={res.format || "int"} vizType={vizType} total={res.total} />
            ) : (
              <p className="text-xs text-red-500 text-center py-8">{res.error}</p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="btn-primary text-sm disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ TABLEAUX DE BORD ═══════════════════════
function DashboardsPanel({ access, reports }: { access: ReportingAccess; reports: CustomReportItem[] }) {
  var [data, setData] = useState<DashboardsList | null>(null);
  var [openId, setOpenId] = useState<string | null>(null);
  var [creating, setCreating] = useState(false);
  var [name, setName] = useState("");
  var [error, setError] = useState("");
  var [pending, start] = useTransition();

  var refresh = function() { listDashboards().then(setData).catch(function() {}); };
  useEffect(function() { refresh(); }, []);

  if (openId) {
    return <DashboardView id={openId} reports={reports} canManage={!!data?.canManage} onBack={function() { setOpenId(null); refresh(); }} />;
  }

  var dashboards = data?.dashboards || [];
  var max = data?.max ?? access.dashboardsMax;
  var atQuota = dashboards.length >= max;
  var canManage = !!data?.canManage;

  var submitCreate = function() {
    setError("");
    start(async function() {
      var r = await createDashboard(name.trim());
      if (r.ok) { setCreating(false); setName(""); refresh(); if (r.id) setOpenId(r.id); }
      else setError(r.error || "Erreur");
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Tableaux de bord</h3>
          <p className="text-xs text-gray-500">{dashboards.length} / {max} tableau{max > 1 ? "x" : ""} de bord</p>
        </div>
        {canManage && (
          <button onClick={function() { setCreating(true); setError(""); }} disabled={atQuota}
            className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={14} /> Créer</button>
        )}
      </div>

      {atQuota && canManage && (
        <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Vous avez atteint {max} tableau{max > 1 ? "x" : ""} de bord. Pour aller au-delà, <b>contactez-nous pour un devis</b>.
        </p>
      )}

      {!data ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : dashboards.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3"><LayoutGrid size={24} className="text-brand-600" /></div>
          <h4 className="text-sm font-semibold text-gray-900">Aucun tableau de bord</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Regroupez plusieurs rapports sur une même vue pour un suivi d'un coup d'œil.</p>
          {canManage && <button onClick={function() { setCreating(true); }} className="btn-primary text-xs mt-4"><Plus size={14} /> Créer un tableau de bord</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(function(d) {
            return (
              <button key={d.id} onClick={function() { setOpenId(d.id); }}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-brand-200 hover:shadow-card-hover transition-all">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3"><LayoutGrid size={16} className="text-brand-600" /></div>
                <h4 className="text-sm font-semibold text-gray-900 truncate">{d.name}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">{d.itemCount} rapport{d.itemCount > 1 ? "s" : ""}</p>
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={function() { setCreating(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-scale-in" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Nouveau tableau de bord</h3>
              <button onClick={function() { setCreating(false); }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <input value={name} onChange={function(e) { setName(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") submitCreate(); }}
              className="input text-sm" placeholder="Ex. Suivi rentrée" autoFocus />
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={function() { setCreating(false); }} className="btn-secondary text-sm">Annuler</button>
              <button onClick={submitCreate} disabled={pending || !name.trim()} className="btn-primary text-sm disabled:opacity-50">{pending ? "Création…" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardView({ id, reports, canManage, onBack }: { id: string; reports: CustomReportItem[]; canManage: boolean; onBack: () => void }) {
  var [detail, setDetail] = useState<DashboardDetail | null>(null);
  var [adding, setAdding] = useState(false);
  var [, start] = useTransition();

  var refresh = function() { getDashboard(id).then(setDetail).catch(function() {}); };
  useEffect(function() { refresh(); /* eslint-disable-next-line */ }, [id]);

  var items = detail?.items || [];
  var usedIds = new Set(items.map(function(i) { return i.reportId; }));
  var available = reports.filter(function(r) { return !usedIds.has(r.id); });

  var addRep = function(reportId: string) { start(async function() { await addReportToDashboard(id, reportId); setAdding(false); refresh(); }); };
  var removeIt = function(itemId: string) { start(async function() { await removeDashboardItem(itemId); refresh(); }); };
  var toggleW = function(item: any) { start(async function() { await setDashboardItemWidth(item.id, item.width === "full" ? "half" : "full"); refresh(); }); };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button onClick={onBack} className="text-xs font-medium text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">← Tableaux de bord</button>
        {canManage && (
          <div className="relative">
            <button onClick={function() { setAdding(!adding); }} className="btn-secondary text-xs py-1.5"><Plus size={13} /> Ajouter un rapport</button>
            {adding && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-20 p-1.5 max-h-72 overflow-y-auto">
                {available.length === 0 ? (
                  <p className="text-xs text-gray-400 p-3 text-center">Tous vos rapports sont déjà ajoutés.</p>
                ) : available.map(function(r) {
                  return <button key={r.id} onClick={function() { addRep(r.id); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-xs">
                    <span className="font-medium text-gray-800 block truncate">{r.name}</span>
                    <span className="text-[10px] text-gray-400">{summarizeConfig(r)}</span>
                  </button>;
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {detail && detail.name && <h3 className="text-lg font-bold text-gray-900 mb-4">{detail.name}</h3>}

      {!detail ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <h4 className="text-sm font-semibold text-gray-900">Tableau de bord vide</h4>
          <p className="text-xs text-gray-500 mt-1">{canManage ? "Ajoutez des rapports avec le bouton ci-dessus." : "Aucun rapport pour le moment."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(function(item) {
            return (
              <div key={item.id} className={cn("bg-white rounded-xl border border-gray-200 p-5", item.width === "full" && "lg:col-span-2")}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                    <p className="text-[11px] text-gray-400">{summarizeConfig({ id: "", name: "", ...item.config } as CustomReportItem)}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={function() { toggleW(item); }} className="text-[10px] text-gray-400 hover:text-brand-600 border border-gray-200 rounded px-1.5 py-0.5" title="Largeur">{item.width === "full" ? "½" : "□"}</button>
                      <button onClick={function() { removeIt(item.id); }} className="text-gray-300 hover:text-red-500 p-1" title="Retirer"><X size={14} /></button>
                    </div>
                  )}
                </div>
                {item.ok ? <ReportResult rows={item.rows} format={item.format} vizType={item.config.vizType} total={item.total} /> : <p className="text-xs text-red-400 py-6 text-center">Rapport indisponible</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ ONGLET : ANALYSTE IA ═══════════════════════
var AI_EXAMPLES = [
  "Quelle filière convertit le mieux ?",
  "Répartition des leads par source",
  "Appels par conseiller ce trimestre",
  "Étudiants par campus",
];

function AiTab() {
  var [question, setQuestion] = useState("");
  var [result, setResult] = useState<AnalystResult | null>(null);
  var [history, setHistory] = useState<AnalystHistoryItem[]>([]);
  var [pending, startAsk] = useTransition();

  useEffect(function() {
    getAnalystHistory().then(setHistory).catch(function() {});
  }, []);

  var ask = function(qq?: string) {
    var text = (qq !== undefined ? qq : question).trim();
    if (!text) return;
    setQuestion(text);
    startAsk(async function() {
      var r = await askAnalyst(text);
      setResult(r);
      if (r.ok) getAnalystHistory().then(setHistory).catch(function() {});
    });
  };

  return (
    <div className="max-w-3xl">
      {/* Hero + input */}
      <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-gray-200 p-5">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 bg-white border border-gray-200 rounded-full px-3 py-1"><Sparkles size={12} /> Analyste IA</div>
        <h3 className="text-base font-semibold text-gray-900 mt-3">Interrogez vos données en langage naturel</h3>
        <p className="text-xs text-gray-500 mt-1">L'IA choisit le bon rapport, l'exécute sur vos vraies données, puis vous l'explique. <span className="text-gray-400">(2 crédits IA / question)</span></p>
        <div className="flex gap-2 mt-4">
          <input value={question} onChange={function(e) { setQuestion(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") ask(); }}
            placeholder="Ex. Quelle filière convertit le mieux ce trimestre ?" className="input text-sm flex-1" />
          <button onClick={function() { ask(); }} disabled={pending || !question.trim()} className="btn-primary text-sm disabled:opacity-50 whitespace-nowrap">
            {pending ? "Analyse…" : "Analyser"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {AI_EXAMPLES.map(function(ex) {
            return <button key={ex} onClick={function() { ask(ex); }} disabled={pending} className="text-[11px] border border-gray-200 bg-white rounded-full px-3 py-1 text-gray-600 hover:border-brand-300 hover:text-brand-600 disabled:opacity-50">{ex}</button>;
          })}
        </div>
      </div>

      {pending && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /> L'IA analyse vos données…
        </div>
      )}

      {!pending && result && (
        result.ok ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3">
                <span className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center"><Sparkles size={11} className="text-brand-600" /></span> Analyse
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{result.answer || "Voici les résultats correspondants à votre question."}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {result.config && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{summarizeConfig({ id: "", name: "", ...result.config } as CustomReportItem)}</p>}
              <ReportResult rows={result.rows || []} format={result.format || "int"} vizType={result.config?.vizType || "bar"} total={result.total} />
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4"><p className="text-sm text-red-600">{result.error}</p></div>
        )
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Questions récentes</h4>
          <div className="space-y-2">
            {history.map(function(h) {
              return (
                <button key={h.id} onClick={function() { ask(h.question); }} disabled={pending}
                  className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:border-brand-200 transition-all disabled:opacity-50">
                  <p className="text-xs font-medium text-gray-800">{h.question}</p>
                  {h.answer && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{h.answer}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ UPSELL (onglet verrouillé) ═══════════════════════
function UpsellPanel({ tab, access }: { tab: TabKey; access: ReportingAccess }) {
  var LABELS: Record<TabKey, string> = {
    overview: "Vue d'ensemble", acquisition: "Acquisition", pipeline: "Pipeline", recruitment: "Recrutement",
    team: "Équipe", sequences: "Relances", custom: "Rapports personnalisés", ai: "Analyste IA",
  };
  var target = tab === "ai" ? "Performance" : access.nextPlanName || "un plan supérieur";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><Lock size={26} className="text-gray-400" /></div>
      <h3 className="text-lg font-semibold text-gray-900">« {LABELS[tab]} » — plan {target}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
        Cet onglet fait partie du reporting avancé. Passez au plan <b>{target}</b> pour y accéder.
      </p>
      <Link href="/settings/organization" className="btn-primary inline-flex mt-5 text-sm">Voir les plans</Link>
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
