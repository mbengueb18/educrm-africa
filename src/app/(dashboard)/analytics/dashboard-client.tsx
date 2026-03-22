"use client";

import { StatCard } from "@/components/ui/stat-card";
import {
  Users,
  GraduationCap,
  Banknote,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { formatCompactCFA } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardClientProps {
  stats: {
    totalLeads: number;
    totalStudents: number;
    totalRevenue: number;
    overduePayments: number;
    newLeadsMonth: number;
  };
  funnel: { name: string; count: number; color: string }[];
  sourceBreakdown: { source: string; count: number }[];
  leadsPerDay: { date: string; count: number }[];
}

const SOURCE_COLORS: Record<string, string> = {
  FACEBOOK: "#1877F2",
  INSTAGRAM: "#E4405F",
  WHATSAPP: "#25D366",
  WEBSITE: "#2E86C1",
  SALON: "#F39C12",
  REFERRAL: "#8B5CF6",
  RADIO: "#EF4444",
  PHONE_CALL: "#6366F1",
  WALK_IN: "#10B981",
  PARTNER: "#EC4899",
  OTHER: "#9CA3AF",
};

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Site web",
  SALON: "Salon",
  REFERRAL: "Parrainage",
  RADIO: "Radio",
  PHONE_CALL: "Appel",
  WALK_IN: "Visite",
  PARTNER: "Partenaire",
  OTHER: "Autre",
};

export function DashboardClient({
  stats,
  funnel,
  sourceBreakdown,
  leadsPerDay,
}: DashboardClientProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total leads"
          value={stats.totalLeads}
          change={12}
          changeLabel="vs mois dern."
          icon={Users}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="Étudiants inscrits"
          value={stats.totalStudents}
          icon={GraduationCap}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="CA encaissé"
          value={formatCompactCFA(stats.totalRevenue)}
          change={8}
          changeLabel="vs mois dern."
          icon={Banknote}
          iconColor="text-accent-600"
          iconBg="bg-accent-50"
        />
        <StatCard
          label="Impayés"
          value={stats.overduePayments}
          change={-5}
          changeLabel="vs mois dern."
          icon={AlertTriangle}
          iconColor="text-danger-500"
          iconBg="bg-red-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Leads trend */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-card border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Nouveaux leads
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">30 derniers jours</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <TrendingUp size={16} />
              {stats.newLeadsMonth} ce mois
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={leadsPerDay}>
              <defs>
                <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E86C1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#2E86C1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).getDate().toString()}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                labelFormatter={(v) =>
                  new Date(v).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2E86C1"
                strokeWidth={2}
                fill="url(#leadGradient)"
                name="Leads"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-xl p-5 shadow-card border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Sources d&apos;acquisition
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={sourceBreakdown.map((s) => ({
                  ...s,
                  label: SOURCE_LABELS[s.source] || s.source,
                }))}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {sourceBreakdown.map((s, i) => (
                  <Cell
                    key={s.source}
                    fill={SOURCE_COLORS[s.source] || "#9CA3AF"}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {sourceBreakdown.slice(0, 5).map((s) => (
              <div key={s.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        SOURCE_COLORS[s.source] || "#9CA3AF",
                    }}
                  />
                  <span className="text-xs text-gray-600">
                    {SOURCE_LABELS[s.source] || s.source}
                  </span>
                </div>
                <span className="text-xs font-semibold text-gray-900">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-xl p-5 shadow-card border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Entonnoir du pipeline
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={funnel} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #E5E7EB",
              }}
            />
            <Bar dataKey="count" name="Leads" radius={[0, 6, 6, 0]}>
              {funnel.map((entry, i) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
