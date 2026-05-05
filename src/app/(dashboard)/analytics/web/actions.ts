"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface AnalyticsFilters {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  pathContains?: string;
}

// ─── Get KPIs (avec comparaison période précédente) ───
export async function getWebAnalyticsKPIs(range: DateRange, filters: AnalyticsFilters = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  // Période actuelle
  const current = await computeKPIs(orgId, range, filters);

  // Période précédente (même durée)
  const durationMs = range.to.getTime() - range.from.getTime();
  const prevRange: DateRange = {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime()),
  };
  const previous = await computeKPIs(orgId, prevRange, filters);

  return {
    current,
    previous,
    range,
    prevRange,
  };
}

async function computeKPIs(orgId: string, range: DateRange, filters: AnalyticsFilters) {
  // Conditions de filtre sur Session
  const sessionWhere: any = {
    organizationId: orgId,
    startedAt: { gte: range.from, lte: range.to },
  };
  if (filters.utmSource) sessionWhere.utmSource = filters.utmSource;
  if (filters.utmMedium) sessionWhere.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) sessionWhere.utmCampaign = filters.utmCampaign;

  // Toutes les sessions de la période avec leurs pageviews
  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    include: {
      pageViews: filters.pathContains
        ? { where: { path: { contains: filters.pathContains } } }
        : true,
      visitor: { select: { id: true, leadId: true } },
    },
  });

  // Filtrage si pathContains : ne garder que les sessions avec au moins une pageview matchant
  const filteredSessions = filters.pathContains
    ? sessions.filter((s) => s.pageViews.length > 0)
    : sessions;

  const totalSessions = filteredSessions.length;
  const totalPageViews = filteredSessions.reduce((sum, s) => sum + s.pageViews.length, 0);
  const uniqueVisitorIds = new Set(filteredSessions.map((s) => s.visitorDbId));
  const totalVisitors = uniqueVisitorIds.size;

  // Sessions liées à un lead (info contextuelle)
  const sessionsWithLead = filteredSessions.filter((s) => s.visitor.leadId !== null).length;

  // Visiteurs uniques devenus leads
  const visitorsWithLead = new Set<string>();
  const leadIdsForVisitors = new Set<string>();
  for (const s of filteredSessions) {
    if (s.visitor.leadId) {
      visitorsWithLead.add(s.visitorDbId);
      leadIdsForVisitors.add(s.visitor.leadId);
    }
  }
  const totalVisitorsConverted = visitorsWithLead.size;

  // Visiteur → Lead (capture)
  const conversionRate = totalVisitors > 0 ? (totalVisitorsConverted / totalVisitors) * 100 : 0;

  // Visiteur → Étudiant (conversion finale)
  let totalVisitorsBecomeStudent = 0;
  if (leadIdsForVisitors.size > 0) {
    const convertedLeads = await prisma.lead.findMany({
      where: {
        id: { in: Array.from(leadIdsForVisitors) },
        organizationId: orgId,
        isConverted: true,
      },
      select: { id: true },
    });
    const convertedLeadIds = new Set(convertedLeads.map((l) => l.id));
    // Count visitors whose lead is converted
    for (const s of filteredSessions) {
      if (s.visitor.leadId && convertedLeadIds.has(s.visitor.leadId)) {
        totalVisitorsBecomeStudent++;
      }
    }
    // dédoubler par visiteur unique
    const studentVisitors = new Set<string>();
    for (const s of filteredSessions) {
      if (s.visitor.leadId && convertedLeadIds.has(s.visitor.leadId)) {
        studentVisitors.add(s.visitorDbId);
      }
    }
    totalVisitorsBecomeStudent = studentVisitors.size;
  }
  const studentConversionRate = totalVisitors > 0 ? (totalVisitorsBecomeStudent / totalVisitors) * 100 : 0;

  // Temps visible moyen (par session)
  const totalEngagedMs = filteredSessions.reduce((sum, s) => sum + s.engagedTimeMs, 0);
  const avgEngagedMs = totalSessions > 0 ? Math.round(totalEngagedMs / totalSessions) : 0;

  // Pages par session
  const avgPagesPerSession = totalSessions > 0 ? totalPageViews / totalSessions : 0;

  // Taux de rebond : sessions avec 1 seule pageview
  const bouncedSessions = filteredSessions.filter((s) => s.pageViews.length <= 1).length;
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

  // Sessions par visiteur
  const sessionsPerVisitor = totalVisitors > 0 ? totalSessions / totalVisitors : 0;

  return {
    totalVisitors,
    totalSessions,
    totalPageViews,
    sessionsWithLead,
    visitorsConverted: totalVisitorsConverted,
    visitorsBecomeStudent: totalVisitorsBecomeStudent,
    conversionRate,
    studentConversionRate,
    avgEngagedMs,
    avgPagesPerSession,
    bounceRate,
    sessionsPerVisitor,
  };
}

// ─── Top pages ───
export async function getTopPages(range: DateRange, filters: AnalyticsFilters = {}, limit = 10) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const where: any = {
    organizationId: orgId,
    viewedAt: { gte: range.from, lte: range.to },
  };
  if (filters.pathContains) where.path = { contains: filters.pathContains };

  // Filtres session via relation
  const sessionFilter: any = {};
  if (filters.utmSource) sessionFilter.utmSource = filters.utmSource;
  if (filters.utmMedium) sessionFilter.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) sessionFilter.utmCampaign = filters.utmCampaign;
  if (Object.keys(sessionFilter).length > 0) {
    where.session = sessionFilter;
  }

  const pageViews = await prisma.pageView.findMany({
    where,
    select: { path: true, title: true, engagedTimeMs: true },
  });

  const grouped: Record<string, { count: number; title: string; totalEngagedMs: number }> = {};
  for (const pv of pageViews) {
    if (!grouped[pv.path]) {
      grouped[pv.path] = { count: 0, title: pv.title || pv.path, totalEngagedMs: 0 };
    }
    grouped[pv.path].count++;
    grouped[pv.path].totalEngagedMs += pv.engagedTimeMs || 0;
  }

  return Object.entries(grouped)
    .map(([path, data]) => ({
      path,
      ...data,
      avgEngagedMs: data.count > 0 ? Math.round(data.totalEngagedMs / data.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Top sources ───
export async function getTopSources(range: DateRange, filters: AnalyticsFilters = {}, limit = 10) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const where: any = {
    organizationId: orgId,
    startedAt: { gte: range.from, lte: range.to },
  };
  if (filters.utmSource) where.utmSource = filters.utmSource;
  if (filters.utmMedium) where.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) where.utmCampaign = filters.utmCampaign;

  const sessions = await prisma.session.findMany({
    where,
    select: {
      utmSource: true,
      utmMedium: true,
      referrer: true,
      visitor: { select: { leadId: true } },
    },
  });

  // Détermine le canal (channel grouping)
  const grouped: Record<string, { sessions: number; leads: number; label: string }> = {};
  for (const s of sessions) {
    let key = "direct";
    let label = "Direct";

    if (s.utmSource) {
      key = "utm_" + s.utmSource;
      label = s.utmSource;
      if (s.utmMedium) label += " / " + s.utmMedium;
    } else if (s.referrer) {
      try {
        const host = new URL(s.referrer).hostname.replace(/^www\./, "");
        key = "ref_" + host;
        label = host;
      } catch {
        key = "ref_unknown";
        label = "Referrer inconnu";
      }
    }

    if (!grouped[key]) grouped[key] = { sessions: 0, leads: 0, label };
    grouped[key].sessions++;
    if (s.visitor.leadId) grouped[key].leads++;
  }

  return Object.entries(grouped)
    .map(([key, data]) => ({
      key,
      ...data,
      conversionRate: data.sessions > 0 ? (data.leads / data.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

// ─── Sessions par jour (graphique) ───
export async function getDailyTraffic(range: DateRange, filters: AnalyticsFilters = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const where: any = {
    organizationId: orgId,
    startedAt: { gte: range.from, lte: range.to },
  };
  if (filters.utmSource) where.utmSource = filters.utmSource;
  if (filters.utmMedium) where.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) where.utmCampaign = filters.utmCampaign;

  const sessions = await prisma.session.findMany({
    where,
    select: {
      startedAt: true,
      pageviewCount: true,
      visitor: { select: { id: true, leadId: true } },
    },
  });

  // Group by day
  const byDay: Record<string, { sessions: number; visitors: Set<string>; pageViews: number; leads: number }> = {};

  // Initialiser tous les jours de la période (pour avoir des 0 propres)
  const cur = new Date(range.from);
  cur.setHours(0, 0, 0, 0);
  while (cur <= range.to) {
    const key = cur.toISOString().split("T")[0];
    byDay[key] = { sessions: 0, visitors: new Set(), pageViews: 0, leads: 0 };
    cur.setDate(cur.getDate() + 1);
  }

  for (const s of sessions) {
    const key = s.startedAt.toISOString().split("T")[0];
    if (!byDay[key]) byDay[key] = { sessions: 0, visitors: new Set(), pageViews: 0, leads: 0 };
    byDay[key].sessions++;
    byDay[key].visitors.add(s.visitor.id);
    byDay[key].pageViews += s.pageviewCount;
    if (s.visitor.leadId) byDay[key].leads++;
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      sessions: data.sessions,
      visitors: data.visitors.size,
      pageViews: data.pageViews,
      leads: data.leads,
    }));
}

// ─── Funnel de conversion ───
export async function getConversionFunnel(range: DateRange, filters: AnalyticsFilters = {}) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const sessionWhere: any = {
    organizationId: orgId,
    startedAt: { gte: range.from, lte: range.to },
  };
  if (filters.utmSource) sessionWhere.utmSource = filters.utmSource;
  if (filters.utmMedium) sessionWhere.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) sessionWhere.utmCampaign = filters.utmCampaign;

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    select: { visitorDbId: true, visitor: { select: { leadId: true } } },
  });

  // Étape 1 : Visiteurs uniques
  const visitorIds = new Set(sessions.map((s) => s.visitorDbId));
  const totalVisitors = visitorIds.size;

  // Étape 2 : Visiteurs avec un lead
  const visitorsWithLead = new Set<string>();
  for (const s of sessions) {
    if (s.visitor.leadId) visitorsWithLead.add(s.visitorDbId);
  }
  const totalLeads = visitorsWithLead.size;

  // Étape 3 : Étudiants convertis (parmi les leads attachés à des visitors)
  const leadIds = sessions
    .filter((s) => s.visitor.leadId)
    .map((s) => s.visitor.leadId as string);

  const convertedLeads = leadIds.length > 0
    ? await prisma.lead.count({
        where: {
          id: { in: leadIds },
          organizationId: orgId,
          isConverted: true,
        },
      })
    : 0;

  return {
    steps: [
      {
        label: "Visiteurs uniques",
        value: totalVisitors,
        rate: 100,
      },
      {
        label: "Leads créés",
        value: totalLeads,
        rate: totalVisitors > 0 ? (totalLeads / totalVisitors) * 100 : 0,
      },
      {
        label: "Étudiants convertis",
        value: convertedLeads,
        rate: totalVisitors > 0 ? (convertedLeads / totalVisitors) * 100 : 0,
      },
    ],
  };
}

// ─── Récupérer les valeurs uniques pour filtres ───
export async function getFilterOptions(range: DateRange) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const sessions = await prisma.session.findMany({
    where: {
      organizationId: orgId,
      startedAt: { gte: range.from, lte: range.to },
    },
    select: { utmSource: true, utmMedium: true, utmCampaign: true },
  });

  const sources = new Set<string>();
  const mediums = new Set<string>();
  const campaigns = new Set<string>();

  for (const s of sessions) {
    if (s.utmSource) sources.add(s.utmSource);
    if (s.utmMedium) mediums.add(s.utmMedium);
    if (s.utmCampaign) campaigns.add(s.utmCampaign);
  }

  return {
    sources: Array.from(sources).sort(),
    mediums: Array.from(mediums).sort(),
    campaigns: Array.from(campaigns).sort(),
  };
}

// ─── Rapport par canal multi-dimensions (style GA4) ───
export type ChannelDimension = "source" | "medium" | "campaign" | "channel" | "referrer";

export async function getChannelReport(
  range: DateRange,
  filters: AnalyticsFilters = {},
  dimensions: ChannelDimension[] = ["source", "medium"],
  limit = 25
) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const orgId = session.user.organizationId;

  const where: any = {
    organizationId: orgId,
    startedAt: { gte: range.from, lte: range.to },
  };
  if (filters.utmSource) where.utmSource = filters.utmSource;
  if (filters.utmMedium) where.utmMedium = filters.utmMedium;
  if (filters.utmCampaign) where.utmCampaign = filters.utmCampaign;

  const sessions = await prisma.session.findMany({
    where,
    select: {
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      referrer: true,
      pageviewCount: true,
      engagedTimeMs: true,
      visitorDbId: true,
      visitor: { select: { leadId: true } },
    },
  });

  // Helper : déterminer le channel grouping (style GA4)
  const computeChannel = (s: any): string => {
    if (s.utmMedium === "cpc" || s.utmMedium === "ppc") {
      if (s.utmSource === "google") return "Paid Search";
      if (s.utmSource === "facebook" || s.utmSource === "instagram") return "Paid Social";
      return "Paid Other";
    }
    if (s.utmMedium === "email") return "Email";
    if (s.utmMedium === "organic" || (s.utmSource === "google" && !s.utmMedium)) return "Organic Search";
    if (s.utmMedium === "social" || ["facebook", "instagram", "twitter", "linkedin", "tiktok"].includes(s.utmSource || "")) return "Organic Social";
    if (s.utmMedium === "referral" || s.referrer) return "Referral";
    if (s.utmSource || s.utmMedium || s.utmCampaign) return "Other";
    return "Direct";
  };

  // Helper : extraire le hostname du referrer
  const referrerHost = (ref: string | null): string => {
    if (!ref) return "";
    try { return new URL(ref).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  };

  // Construire la clé composite selon les dimensions choisies
  const buildKey = (s: any): string => {
    return dimensions.map((dim) => {
      switch (dim) {
        case "source": return s.utmSource || "(direct)";
        case "medium": return s.utmMedium || "(none)";
        case "campaign": return s.utmCampaign || "(not set)";
        case "channel": return computeChannel(s);
        case "referrer": return referrerHost(s.referrer) || "(direct)";
      }
    }).join(" / ");
  };

  // Agréger
  const grouped: Record<string, {
    key: string;
    dimensions: Record<string, string>;
    visitors: Set<string>;
    sessions: number;
    pageViews: number;
    engagedMs: number;
    leads: number;
  }> = {};

  for (const s of sessions) {
    const key = buildKey(s);
    if (!grouped[key]) {
      const dimValues: Record<string, string> = {};
      dimensions.forEach((dim) => {
        switch (dim) {
          case "source": dimValues[dim] = s.utmSource || "(direct)"; break;
          case "medium": dimValues[dim] = s.utmMedium || "(none)"; break;
          case "campaign": dimValues[dim] = s.utmCampaign || "(not set)"; break;
          case "channel": dimValues[dim] = computeChannel(s); break;
          case "referrer": dimValues[dim] = referrerHost(s.referrer) || "(direct)"; break;
        }
      });
      grouped[key] = {
        key,
        dimensions: dimValues,
        visitors: new Set(),
        sessions: 0,
        pageViews: 0,
        engagedMs: 0,
        leads: 0,
      };
    }
    grouped[key].visitors.add(s.visitorDbId);
    grouped[key].sessions++;
    grouped[key].pageViews += s.pageviewCount;
    grouped[key].engagedMs += s.engagedTimeMs;
    if (s.visitor.leadId) grouped[key].leads++;
  }

  return Object.values(grouped)
    .map((g) => ({
      key: g.key,
      dimensions: g.dimensions,
      visitors: g.visitors.size,
      sessions: g.sessions,
      pageViews: g.pageViews,
      avgEngagedMs: g.sessions > 0 ? Math.round(g.engagedMs / g.sessions) : 0,
      leads: g.leads,
      conversionRate: g.sessions > 0 ? (g.leads / g.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}