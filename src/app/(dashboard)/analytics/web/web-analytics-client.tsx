"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart3, Users, Globe2, MousePointer2, TrendingUp, TrendingDown,
  Clock, Calendar, Filter, RefreshCw, X, Loader2,
  Target, Activity, Layers, Repeat, Minus, FileText, Radio, Plus, GraduationCap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  getWebAnalyticsKPIs,
  getTopPages,
  getDailyTraffic,
  getConversionFunnel,
  getFilterOptions,
  getChannelReport,
  type DateRange,
  type AnalyticsFilters,
  type ChannelDimension,
} from "./actions";

type PresetRange = "today" | "7d" | "28d" | "90d" | "custom";

const ALL_DIMENSIONS: { key: ChannelDimension; label: string }[] = [
  { key: "channel", label: "Canal" },
  { key: "source", label: "Source" },
  { key: "medium", label: "Medium" },
  { key: "campaign", label: "Campagne" },
  { key: "referrer", label: "Referrer" },
];

export function WebAnalyticsClient() {
  const [preset, setPreset] = useState<PresetRange>("28d");
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("28d"));
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [channelDimensions, setChannelDimensions] = useState<ChannelDimension[]>(["source", "medium"]);

  const [kpis, setKpis] = useState<any>(null);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [dailyTraffic, setDailyTraffic] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);
  const [channelReport, setChannelReport] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<any>({ sources: [], mediums: [], campaigns: [] });
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [k, tp, dt, f, cr, fo] = await Promise.all([
        getWebAnalyticsKPIs(dateRange, filters),
        getTopPages(dateRange, filters, 10),
        getDailyTraffic(dateRange, filters),
        getConversionFunnel(dateRange, filters),
        getChannelReport(dateRange, filters, channelDimensions, 25),
        getFilterOptions(dateRange),
      ]);
      setKpis(k);
      setTopPages(tp);
      setDailyTraffic(dt);
      setFunnel(f);
      setChannelReport(cr);
      setFilterOptions(fo);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du chargement");
    }
    setLoading(false);
  }, [dateRange, filters, channelDimensions]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePresetChange = (p: PresetRange) => {
    setPreset(p);
    if (p !== "custom") setDateRange(getPresetRange(p));
  };

  const updateFilter = (key: keyof AnalyticsFilters, value: string | undefined) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const clearFilters = () => setFilters({});
  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={22} className="text-brand-600" />
            Analytics Web
          </h1>
          <p className="text-sm text-gray-500 mt-1">Visiteurs, sessions, conversion et sources de trafic.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PresetSelector preset={preset} onChange={handlePresetChange} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-secondary py-2 px-3 text-xs",
              activeFilterCount > 0 && "bg-brand-50 border-brand-200 text-brand-700"
            )}
          >
            <Filter size={13} /> Filtres
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-brand-600 text-white rounded-full px-1.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button onClick={loadAll} disabled={loading} className="btn-secondary py-2 px-3 text-xs">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <FiltersPanel
          filters={filters}
          options={filterOptions}
          onUpdate={updateFilter}
          onClear={clearFilters}
        />
      )}

      {/* Period info */}
      <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
        <Calendar size={12} />
        <span>
          Du {dateRange.from.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          {" au "}
          {dateRange.to.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </span>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full font-medium">
            {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {kpis ? <KPIGrid kpis={kpis} loading={loading} /> : loading && <KPISkeleton />}

      {/* Daily traffic chart */}
      <DailyTrafficChart data={dailyTraffic} loading={loading} />

      {/* Channel report */}
      <ChannelReport
        data={channelReport}
        dimensions={channelDimensions}
        onDimensionsChange={setChannelDimensions}
        loading={loading}
      />

      {/* Top pages */}
      <TopPagesTable data={topPages} loading={loading} />

      {/* Funnel */}
      {funnel && <ConversionFunnel data={funnel} />}
    </div>
  );
}

// ─── Preset selector ───
function PresetSelector({ preset, onChange }: { preset: PresetRange; onChange: (p: PresetRange) => void }) {
  const options: { value: PresetRange; label: string }[] = [
    { value: "today", label: "Aujourd'hui" },
    { value: "7d", label: "7 jours" },
    { value: "28d", label: "28 jours" },
    { value: "90d", label: "90 jours" },
  ];

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            preset === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Filters panel ───
function FiltersPanel({ filters, options, onUpdate, onClear }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Filtres</p>
        {Object.keys(filters).length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1">
            <X size={11} /> Effacer
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FilterSelect label="Source UTM" value={filters.utmSource || ""} options={options.sources} onChange={(v: any) => onUpdate("utmSource", v)} />
        <FilterSelect label="Medium UTM" value={filters.utmMedium || ""} options={options.mediums} onChange={(v: any) => onUpdate("utmMedium", v)} />
        <FilterSelect label="Campagne UTM" value={filters.utmCampaign || ""} options={options.campaigns} onChange={(v: any) => onUpdate("utmCampaign", v)} />
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">URL contient</label>
          <input
            value={filters.pathContains || ""}
            onChange={(e) => onUpdate("pathContains", e.target.value || undefined)}
            placeholder="ex: /formations"
            className="input text-xs py-1.5"
          />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value || undefined)} className="input text-xs py-1.5">
        <option value="">Tous</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

// ─── KPI Grid ───
function KPIGrid({ kpis, loading }: { kpis: any; loading: boolean }) {
  const c = kpis.current;
  const p = kpis.previous;

  const cards = [
    { icon: Users, label: "Visiteurs uniques", value: c.totalVisitors, previous: p.totalVisitors, format: (v: number) => v.toLocaleString("fr-FR"), color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Globe2, label: "Sessions", value: c.totalSessions, previous: p.totalSessions, format: (v: number) => v.toLocaleString("fr-FR"), color: "text-violet-600", bg: "bg-violet-50" },
    { icon: MousePointer2, label: "Pages vues", value: c.totalPageViews, previous: p.totalPageViews, format: (v: number) => v.toLocaleString("fr-FR"), color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
    { icon: Target, label: "Visiteur → Lead", value: c.conversionRate, previous: p.conversionRate, format: (v: number) => v.toFixed(1) + "%", color: "text-emerald-600", bg: "bg-emerald-50", hint: c.visitorsConverted + " leads créés" },
    { icon: GraduationCap, label: "Visiteur → Étudiant", value: c.studentConversionRate, previous: p.studentConversionRate, format: (v: number) => v.toFixed(1) + "%", color: "text-pink-600", bg: "bg-pink-50", hint: c.visitorsBecomeStudent + " étudiants convertis" },
    { icon: Clock, label: "Temps visible moyen", value: c.avgEngagedMs, previous: p.avgEngagedMs, format: formatDuration, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Layers, label: "Pages / session", value: c.avgPagesPerSession, previous: p.avgPagesPerSession, format: (v: number) => v.toFixed(1), color: "text-indigo-600", bg: "bg-indigo-50" },
    { icon: Activity, label: "Taux de rebond", value: c.bounceRate, previous: p.bounceRate, format: (v: number) => v.toFixed(1) + "%", color: "text-orange-600", bg: "bg-orange-50", inverted: true },
    { icon: Repeat, label: "Sessions / visiteur", value: c.sessionsPerVisitor, previous: p.sessionsPerVisitor, format: (v: number) => v.toFixed(2), color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => <KPICard key={i} {...card} loading={loading} />)}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, previous, format, color, bg, hint, inverted, loading }: any) {
  const delta = previous > 0 ? ((value - previous) / previous) * 100 : 0;
  const hasChange = previous > 0 && Math.abs(delta) > 0.5;
  const isPositive = inverted ? delta < 0 : delta > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 relative">
      {loading && <div className="absolute top-2 right-2"><Loader2 size={12} className="text-gray-300 animate-spin" /></div>}
      <div className="flex items-start justify-between mb-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg, color)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        {hasChange ? (
          <span className={cn("flex items-center gap-0.5 font-medium", isPositive ? "text-emerald-600" : "text-red-600")}>
            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-400 flex items-center gap-0.5"><Minus size={11} /> Stable</span>
        )}
        <span className="text-gray-400">vs précédent</span>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="w-9 h-9 rounded-lg bg-gray-100 mb-3"></div>
          <div className="h-2 w-20 bg-gray-100 rounded mb-2"></div>
          <div className="h-6 w-16 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

// ─── Daily traffic chart ───
function DailyTrafficChart({ data, loading }: { data: any[]; loading: boolean }) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Trafic journalier</h3>
        {loading && <Loader2 size={14} className="text-gray-300 animate-spin" />}
      </div>
      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Aucune donnée sur la période</div>
      ) : (
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formatted}>
              <defs>
                <linearGradient id="grad-sessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-visitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-leads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#e5e7eb" />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} stroke="#e5e7eb" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                labelStyle={{ fontWeight: 600, color: "#111827" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="visitors" name="Visiteurs" stroke="#3b82f6" fill="url(#grad-visitors)" strokeWidth={2} />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#8b5cf6" fill="url(#grad-sessions)" strokeWidth={2} />
              <Area type="monotone" dataKey="leads" name="Leads créés" stroke="#10b981" fill="url(#grad-leads)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Channel report ───
function ChannelReport({ data, dimensions, onDimensionsChange, loading }: any) {
  const toggleDimension = (dim: ChannelDimension) => {
    if (dimensions.includes(dim)) {
      if (dimensions.length === 1) return; // au moins 1 dimension
      onDimensionsChange(dimensions.filter((d: any) => d !== dim));
    } else {
      onDimensionsChange([...dimensions, dim]);
    }
  };

  const totalSessions = data.reduce((s: number, r: any) => s + r.sessions, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Radio size={14} className="text-brand-500" /> Rapport par canal
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Trafic groupé par dimensions</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ALL_DIMENSIONS.map((dim) => (
            <button
              key={dim.key}
              onClick={() => toggleDimension(dim.key)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1",
                dimensions.includes(dim.key)
                  ? "bg-brand-50 border-brand-200 text-brand-700 font-medium"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {dimensions.includes(dim.key) ? null : <Plus size={10} />}
              {dim.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">Aucune donnée</div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-100">
                {dimensions.map((d: ChannelDimension) => (
                  <th key={d} className="px-2 py-2 font-semibold">{ALL_DIMENSIONS.find((x) => x.key === d)?.label || d}</th>
                ))}
                <th className="px-2 py-2 font-semibold text-right">Visiteurs</th>
                <th className="px-2 py-2 font-semibold text-right">Sessions</th>
                <th className="px-2 py-2 font-semibold text-right">Pages vues</th>
                <th className="px-2 py-2 font-semibold text-right">Tps visible</th>
                <th className="px-2 py-2 font-semibold text-right">Leads</th>
                <th className="px-2 py-2 font-semibold text-right">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, i: number) => {
                const sharePct = totalSessions > 0 ? (row.sessions / totalSessions) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {dimensions.map((d: ChannelDimension) => (
                      <td key={d} className="px-2 py-2.5">
                        <span className="text-sm text-gray-900 font-medium">{row.dimensions[d] || "—"}</span>
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-right tabular-nums">{row.visitors.toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] text-gray-400 w-10 text-right">{sharePct.toFixed(1)}%</span>
                        <span className="font-medium">{row.sessions.toLocaleString("fr-FR")}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">{row.pageViews.toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-gray-700">{formatDuration(row.avgEngagedMs)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className={cn("font-medium", row.leads > 0 && "text-emerald-600")}>
                        {row.leads.toLocaleString("fr-FR")}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className={cn("text-xs font-semibold", row.conversionRate > 0 ? "text-emerald-600" : "text-gray-400")}>
                        {row.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Top pages ───
function TopPagesTable({ data, loading }: { data: any[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={14} className="text-brand-500" /> Pages les plus consultées
        </h3>
        {loading && <Loader2 size={14} className="text-gray-300 animate-spin" />}
      </div>
      {data.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">Aucune donnée</div>
      ) : (
        <div className="space-y-2">
          {data.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-[10px] font-bold text-gray-400 w-6">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                <p className="text-[10px] text-gray-500 font-mono truncate">{p.path}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">{p.count}</p>
                <p className="text-[10px] text-gray-400">vues</p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-sm font-medium text-gray-700">{formatDuration(p.avgEngagedMs)}</p>
                <p className="text-[10px] text-gray-400">moy./vue</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conversion funnel ───
function ConversionFunnel({ data }: { data: any }) {
  const max = data.steps[0]?.value || 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Target size={14} className="text-brand-500" /> Funnel de conversion
      </h3>
      <div className="space-y-3">
        {data.steps.map((step: any, i: number) => {
          const widthPct = (step.value / max) * 100;
          const dropFromPrevious = i > 0 ? data.steps[i - 1].value - step.value : 0;
          const dropPct = i > 0 && data.steps[i - 1].value > 0 ? (dropFromPrevious / data.steps[i - 1].value) * 100 : 0;

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-medium text-gray-700 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {step.label}
                </span>
                <div className="flex items-center gap-3">
                  {i > 0 && dropFromPrevious > 0 && (
                    <span className="text-[10px] text-red-500">-{dropPct.toFixed(0)}% drop-off</span>
                  )}
                  <span className="font-bold text-gray-900">{step.value.toLocaleString("fr-FR")}</span>
                  <span className="text-[10px] text-gray-500 w-12 text-right">{step.rate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="bg-gray-100 rounded-full h-7 overflow-hidden relative">
                <div
                  className={cn(
                    "h-full rounded-full transition-all flex items-center px-3 text-[10px] font-semibold text-white",
                    i === 0 ? "bg-blue-500" : i === 1 ? "bg-violet-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.max(widthPct, 5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ───
function getPresetRange(preset: PresetRange): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  switch (preset) {
    case "today": break;
    case "7d": from.setDate(from.getDate() - 6); break;
    case "28d": from.setDate(from.getDate() - 27); break;
    case "90d": from.setDate(from.getDate() - 89); break;
  }

  return { from, to };
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + "s";
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return minutes + "min" + (remainSec > 0 ? " " + remainSec + "s" : "");
  const hours = Math.floor(minutes / 60);
  return hours + "h " + (minutes % 60) + "min";
}