"use client";

import { useState, useEffect } from "react";
import { cn, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Send, CheckCircle, Eye, MousePointer, AlertTriangle,
  XCircle, Clock, Users, Mail, BarChart3, FileText, UserCheck,
  Loader2, ChevronRight,
} from "lucide-react";
import { getCampaignRecipients } from "../actions";

interface Recipient {
  id: string;
  leadId: string;
  email: string;
  status: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  bouncedAt: Date | null;
  openCount: number;
  clickCount: number;
  errorMessage: string | null;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  segmentRules: any;
  sentAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  failedCount: number;
  createdBy: { name: string } | null;
  recipients: Recipient[];
  recipientStats: RecipientStats;
}

interface RecipientStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  statusCounts: Record<string, number>;
  pageSize: number;
}

interface Props {
  campaign: Campaign;
  showBranding?: boolean;
}

var STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  DRAFT: { label: "Brouillon", color: "badge-gray", icon: Clock },
  SENDING: { label: "En cours", color: "badge-amber", icon: Loader2 },
  SENT: { label: "Envoyé", color: "badge-green", icon: CheckCircle },
  CANCELLED: { label: "Annulé", color: "badge-red", icon: XCircle },
};

var RECIPIENT_STATUS: Record<string, { label: string; color: string; icon: typeof Send }> = {
  PENDING: { label: "En attente", color: "text-gray-500 bg-gray-50", icon: Clock },
  SENT: { label: "Envoyé", color: "text-blue-600 bg-blue-50", icon: Send },
  DELIVERED: { label: "Délivré", color: "text-emerald-600 bg-emerald-50", icon: CheckCircle },
  OPENED: { label: "Ouvert", color: "text-purple-600 bg-purple-50", icon: Eye },
  CLICKED: { label: "Cliqué", color: "text-indigo-600 bg-indigo-50", icon: MousePointer },
  BOUNCED: { label: "Rebond", color: "text-amber-600 bg-amber-50", icon: AlertTriangle },
  FAILED: { label: "Échoué", color: "text-red-600 bg-red-50", icon: XCircle },
};

var TABS = [
  { key: "overview", label: "Vue d'ensemble", icon: BarChart3 },
  { key: "content", label: "Contenu", icon: FileText },
  { key: "recipients", label: "Destinataires", icon: Users },
];

export function CampaignDetailClient({ campaign, showBranding = true }: Props) {
  var [activeTab, setActiveTab] = useState("overview");
  var statusStyle = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  var StatusIcon = statusStyle.icon;

  // Taux calculés sur les stats agrégées (tous les destinataires), pas sur les compteurs stockés
  // qui peuvent dériver ou sous-compter.
  var s = campaign.recipientStats;
  var openRate = s.sent > 0 ? ((s.opened / s.sent) * 100).toFixed(1) : "0";
  var clickRate = s.opened > 0 ? ((s.clicked / s.opened) * 100).toFixed(1) : "0";
  var deliveryRate = s.sent > 0 ? ((s.delivered / s.sent) * 100).toFixed(1) : "0";
  var bounceRate = s.sent > 0 ? ((s.bounced / s.sent) * 100).toFixed(1) : "0";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Link href="/campaigns" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate min-w-0">{campaign.name}</h1>
            <span className={cn("badge text-[10px] whitespace-nowrap shrink-0", statusStyle.color)}>
              <StatusIcon size={11} className={campaign.status === "SENDING" ? "animate-spin" : ""} />
              {statusStyle.label}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            {campaign.createdBy ? "Par " + campaign.createdBy.name : ""}
            {campaign.sentAt ? " — Envoyé le " + formatDateTime(campaign.sentAt) : " — Créé le " + formatDate(campaign.createdAt)}
          </p>
        </div>
      </div>

      {/* Tabs — horizontal scroll on small screens */}
      <div className="flex border-b border-gray-200 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(function(tab) {
          var TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={function() { setActiveTab(tab.key); }}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-3 text-sm font-medium transition-colors -mb-px whitespace-nowrap shrink-0",
                activeTab === tab.key
                  ? "text-brand-600 border-b-2 border-brand-500"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <TabIcon size={16} className="hidden sm:block" />
              {tab.label}
              {tab.key === "recipients" && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{campaign.recipientStats.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab campaign={campaign} stats={s} openRate={openRate} clickRate={clickRate} deliveryRate={deliveryRate} bounceRate={bounceRate} />}
      {activeTab === "content" && <ContentTab campaign={campaign} showBranding={showBranding} />}
      {activeTab === "recipients" && <RecipientsTab campaignId={campaign.id} initialRecipients={campaign.recipients} stats={s} />}
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ campaign, stats, openRate, clickRate, deliveryRate, bounceRate }: {
  campaign: Campaign; stats: RecipientStats; openRate: string; clickRate: string; deliveryRate: string; bounceRate: string;
}) {
  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Taux d'ouverture" value={openRate + "%"} desc={stats.opened + " / " + stats.sent} color="text-blue-600" bg="bg-blue-50" icon={Eye} />
        <MetricCard label="Taux de clic" value={clickRate + "%"} desc={stats.clicked + " clics"} color="text-purple-600" bg="bg-purple-50" icon={MousePointer} />
        <MetricCard label="Delivrabilite" value={deliveryRate + "%"} desc={stats.delivered + " delivres"} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCircle} />
        <MetricCard label="Taux de rebond" value={bounceRate + "%"} desc={stats.bounced + " rebonds"} color="text-red-500" bg="bg-red-50" icon={AlertTriangle} />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-5">Entonnoir de la campagne</h3>
        <div className="space-y-3">
          <FunnelBar label="Envoyés" value={stats.sent} max={stats.total} color="bg-brand-500" icon={Send} />
          <FunnelBar label="Délivrés" value={stats.delivered} max={stats.total} color="bg-emerald-500" icon={CheckCircle} />
          <FunnelBar label="Ouverts" value={stats.opened} max={stats.total} color="bg-blue-500" icon={Eye} />
          <FunnelBar label="Cliqués" value={stats.clicked} max={stats.total} color="bg-purple-500" icon={MousePointer} />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Detail des statuts</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <StatMini label="Total" value={stats.total} color="text-gray-700" />
          <StatMini label="Envoyés" value={stats.sent} color="text-brand-600" />
          <StatMini label="Délivrés" value={stats.delivered} color="text-emerald-600" />
          <StatMini label="Ouverts" value={stats.opened} color="text-blue-600" />
          <StatMini label="Cliqués" value={stats.clicked} color="text-purple-600" />
          <StatMini label="Échoués" value={stats.failed + stats.bounced} color="text-red-500" />
        </div>
      </div>

      {/* Campaign info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Informations</h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div><span className="text-gray-400">Objet :</span> <span className="text-gray-700 font-medium ml-2">{campaign.subject}</span></div>
          <div><span className="text-gray-400">Cree par :</span> <span className="text-gray-700 ml-2">{campaign.createdBy?.name || "—"}</span></div>
          <div><span className="text-gray-400">Date d'envoi :</span> <span className="text-gray-700 ml-2">{campaign.sentAt ? formatDateTime(campaign.sentAt) : "—"}</span></div>
          <div><span className="text-gray-400">Termine le :</span> <span className="text-gray-700 ml-2">{campaign.completedAt ? formatDateTime(campaign.completedAt) : "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── Content Tab ───
function ContentTab({ campaign, showBranding }: { campaign: Campaign; showBranding?: boolean }) {
  var bodyHtml = "";
  // Try to parse as blocks (new editor format)
  try {
    var parsed = JSON.parse(campaign.body);
    if (Array.isArray(parsed)) {
      // Block format — render preview
      bodyHtml = '<div style="font-family:sans-serif;color:#555;">' +
        parsed.map(function(block: any) {
          switch (block.type) {
            case "text":
            case "footer":
              if ((block.styles?._html === "1") || (block.content || "").includes("<")) {
                return '<div style="font-size:' + (block.styles?.fontSize || (block.type === "footer" ? "12px" : "15px")) + ";color:" + (block.styles?.color || (block.type === "footer" ? "#9ca3af" : "#555")) + ";text-align:" + (block.styles?.textAlign || (block.type === "footer" ? "center" : "left")) + ';line-height:1.6;">' + block.content + "</div>";
              }
              return block.content.split("\n").map(function(line: string) {
                return '<p style="margin:0 0 8px;font-size:' + (block.styles?.fontSize || "15px") + ";color:" + (block.styles?.color || "#555") + ';">' + (line || "&nbsp;") + "</p>";
              }).join("");
            case "heading":
              if ((block.styles?._html === "1") || (block.content || "").includes("<")) {
                return '<div style="font-size:' + (block.styles?.fontSize || "22px") + ";color:" + (block.styles?.color || "#1B4F72") + ";text-align:" + (block.styles?.textAlign || "left") + ';font-weight:700;">' + block.content + "</div>";
              }
              return '<h2 style="margin:0 0 12px;font-size:' + (block.styles?.fontSize || "22px") + ";color:" + (block.styles?.color || "#1B4F72") + ';font-weight:700;">' + block.content + "</h2>";
            case "button":
              return '<div style="text-align:' + (block.styles?.textAlign || "center") + ';padding:12px 0;"><span style="display:inline-block;padding:12px 28px;background:' + (block.styles?.bgColorBtn || block.styles?.bgColor || "#1B4F72") + ";color:" + (block.styles?.color || "white") + ";border-radius:" + (block.styles?.borderRadius || "8px") + ';font-weight:600;font-size:14px;">' + block.content + "</span></div>";
            case "image":
              return block.content ? '<div style="text-align:center;padding:8px 0;"><img src="' + block.content + '" style="max-width:100%;border-radius:8px;" /></div>' : "";
            case "divider":
              return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />';
            case "spacer":
              return '<div style="height:' + (block.styles?.height || "24px") + ';"></div>';
            default: return "";
          }
        }).join("") + "</div>";
    }
  } catch {
    // Plain text format
    bodyHtml = campaign.body.split("\n").map(function(line) {
      return '<p style="margin:0 0 8px;font-size:15px;color:#555;line-height:1.6;">' + (line || "&nbsp;") + "</p>";
    }).join("");
  }

  return (
    <div className="space-y-6">
      {/* Subject */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs text-gray-400 mb-1">Objet de l'email</p>
        <p className="text-base font-semibold text-gray-900">{campaign.subject}</p>
      </div>

      {/* Email preview */}
      <div className="bg-gray-100 rounded-xl p-6">
        <p className="text-xs text-gray-500 mb-3 text-center">Aperçu de l'email</p>
        <div className="max-w-[600px] mx-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div style={{ backgroundColor: "#1B4F72", padding: "20px 28px" }}>
            <p style={{ color: "white", fontSize: "16px", fontWeight: 600, margin: 0 }}>{campaign.subject}</p>
          </div>
          <div className="rich-content p-8" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          {showBranding && (
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-400 text-center">Envoyé via TalibCRM</p>
            </div>
          )}
        </div>
      </div>

      {/* Raw body */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs text-gray-400 mb-2">Corps du message (brut)</p>
        <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-[300px] overflow-y-auto font-mono text-xs">{campaign.body}</pre>
      </div>
    </div>
  );
}

// ─── Recipients Tab ───
function RecipientsTab({ campaignId, initialRecipients, stats }: { campaignId: string; initialRecipients: Recipient[]; stats: RecipientStats }) {
  var PAGE_SIZE = stats.pageSize || 50;
  var [filterStatus, setFilterStatus] = useState<string>("");
  var [searchInput, setSearchInput] = useState("");
  var [search, setSearch] = useState("");
  var [page, setPage] = useState(1);
  var [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  var [total, setTotal] = useState(stats.total);
  var [loading, setLoading] = useState(false);

  // Compteurs par statut : agrégés côté serveur sur TOUS les destinataires.
  var statusCounts = stats.statusCounts;

  // Debounce de la recherche → retour à la page 1.
  useEffect(function() {
    var t = setTimeout(function() {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return function() { clearTimeout(t); };
  }, [searchInput]);

  // Vue par défaut (page 1, sans filtre ni recherche) : déjà fournie par le serveur (SSR) →
  // aucune requête. Toute autre combinaison charge la page correspondante à la demande.
  var isDefault = page === 1 && !filterStatus && !search;

  useEffect(function() {
    if (isDefault) {
      setRecipients(initialRecipients);
      setTotal(stats.total);
      setLoading(false);
      return;
    }
    var cancelled = false;
    setLoading(true);
    getCampaignRecipients(campaignId, {
      page: page,
      pageSize: PAGE_SIZE,
      status: filterStatus || undefined,
      search: search || undefined,
    })
      .then(function(res: any) {
        if (cancelled) return;
        setRecipients(res.recipients as Recipient[]);
        setTotal(res.total);
      })
      .catch(function() {
        if (!cancelled) toast.error("Impossible de charger les destinataires");
      })
      .finally(function() {
        if (!cancelled) setLoading(false);
      });
    return function() { cancelled = true; };
  }, [campaignId, page, filterStatus, search, isDefault, PAGE_SIZE, initialRecipients, stats.total]);

  var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  var from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  var to = Math.min(page * PAGE_SIZE, total);

  function selectStatus(key: string) {
    setFilterStatus(filterStatus === key ? "" : key);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={function() { setFilterStatus(""); setPage(1); }}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            !filterStatus ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          )}
        >
          Tous ({stats.total})
        </button>
        {Object.entries(RECIPIENT_STATUS).map(function(entry) {
          var key = entry[0];
          var config = entry[1];
          var count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={function() { selectStatus(key); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                filterStatus === key ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          placeholder="Rechercher par email..."
          className="input text-sm"
          value={searchInput}
          onChange={function(e) { setSearchInput(e.target.value); }}
        />
        {loading && <Loader2 size={15} className="animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />}
      </div>

      {/* Mobile cards (< md) */}
      <div className={cn("md:hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden transition-opacity", loading && "opacity-50")}>
        {recipients.map(function(recipient) {
          var st = RECIPIENT_STATUS[recipient.status] || RECIPIENT_STATUS.PENDING;
          var StIcon = st.icon;
          return (
            <div key={recipient.id} className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-700 truncate flex-1 min-w-0">{recipient.email}</p>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 whitespace-nowrap", st.color)}>
                  <StIcon size={10} />
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 flex-wrap">
                {recipient.sentAt && <span>Envoyé : {formatDateTime(recipient.sentAt)}</span>}
                {recipient.openedAt && <span className="text-blue-600">Ouvert : {formatDateTime(recipient.openedAt)}</span>}
                {recipient.clickedAt && <span className="text-purple-600">Cliqué : {formatDateTime(recipient.clickedAt)}</span>}
                {recipient.openCount > 1 && <span className="text-gray-700 font-medium">{recipient.openCount} ouvertures</span>}
                {recipient.clickCount > 1 && <span className="text-gray-700 font-medium">{recipient.clickCount} clics</span>}
              </div>
            </div>
          );
        })}
        {!loading && recipients.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Aucun destinataire</p>
          </div>
        )}
      </div>

      {/* Desktop table (>= md) */}
      <div className={cn("hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity", loading && "opacity-50")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Statut</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Envoyé</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Délivré</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Ouvert</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Cliqué</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Ouvertures</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Clics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipients.map(function(recipient) {
                var st = RECIPIENT_STATUS[recipient.status] || RECIPIENT_STATUS.PENDING;
                var StIcon = st.icon;
                return (
                  <tr key={recipient.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{recipient.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", st.color)}>
                        <StIcon size={10} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{recipient.sentAt ? formatDateTime(recipient.sentAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{recipient.deliveredAt ? formatDateTime(recipient.deliveredAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{recipient.openedAt ? formatDateTime(recipient.openedAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{recipient.clickedAt ? formatDateTime(recipient.clickedAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 font-medium">{recipient.openCount > 0 ? recipient.openCount + "x" : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 font-medium">{recipient.clickCount > 0 ? recipient.clickCount + "x" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && recipients.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Aucun destinataire</p>
          </div>
        )}
      </div>

      {/* Pagination — centrée, comme la vue Pipeline */}
      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 mb-2">
          <button
            onClick={function() { setPage(Math.max(1, page - 1)); }}
            disabled={page <= 1 || loading}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-xs text-gray-600">Page {page} / {totalPages}</span>
          <button
            onClick={function() { setPage(Math.min(totalPages, page + 1)); }}
            disabled={page >= totalPages || loading}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
          <span className="text-xs text-gray-400">{from} – {to} sur {total}</span>
        </div>
      )}
    </div>
  );
}

// ─── Components ───
function MetricCard({ label, value, desc, color, bg, icon: Icon }: { label: string; value: string; desc: string; color: string; bg: string; icon: typeof Send }) {
  return (
    <div className={cn("rounded-xl p-5", bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <p className="text-xs text-gray-600">{label}</p>
      </div>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

function FunnelBar({ label, value, max, color, icon: Icon }: { label: string; value: number; max: number; color: string; icon: typeof Send }) {
  var pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 shrink-0">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all flex items-center pl-3", color)} style={{ width: Math.max(pct, 2) + "%" }}>
          {pct > 15 && <span className="text-[10px] text-white font-bold">{value}</span>}
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-700 w-16 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center bg-gray-50 rounded-lg py-3">
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}