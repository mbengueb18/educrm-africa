"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { formatUsd, formatXof, type WhatsAppCostEstimate } from "@/lib/whatsapp/pricing";
import {
  ArrowLeft, Send, CheckCheck, Check, Clock, XCircle, AlertTriangle,
  MessageCircle, Users, FileText, BarChart3, Target, Tag, Globe,
  Search, Eye, Wallet,
} from "lucide-react";

interface Recipient {
  id: string;
  leadId: string;
  whatsappNumber: string;
  status: string;
  metaMessageId: string | null;
  variableValues: any;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    whatsapp: string | null;
    email: string | null;
  };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  sentAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  createdBy: { name: string } | null;
  template: { metaName: string; language: string; category: string; bodyText: string; status: string };
  audience: { id: string; name: string; type: string } | null;
  recipients: Recipient[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "En attente", color: "text-gray-500 bg-gray-50", icon: Clock },
  SENT: { label: "Envoyé", color: "text-blue-600 bg-blue-50", icon: Check },
  DELIVERED: { label: "Délivré", color: "text-emerald-600 bg-emerald-50", icon: CheckCheck },
  READ: { label: "Lu", color: "text-blue-700 bg-blue-50", icon: CheckCheck },
  FAILED: { label: "Échoué", color: "text-red-600 bg-red-50", icon: XCircle },
};

const TABS = [
  { key: "overview", label: "Vue d'ensemble", icon: BarChart3 },
  { key: "template", label: "Template envoyé", icon: FileText },
  { key: "recipients", label: "Destinataires", icon: Users },
];

export function WhatsAppCampaignDetailClient({
  campaign,
  spentEstimate,
}: {
  campaign: Campaign;
  // Dépense Meta estimée, calculée côté serveur sur tous les destinataires
  // délivrés/lus (seuls messages facturés par Meta)
  spentEstimate: WhatsAppCostEstimate | null;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const deliveryRate = campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;
  const readRate = campaign.deliveredCount > 0 ? Math.round((campaign.readCount / campaign.deliveredCount) * 100) : 0;
  const failRate = campaign.totalRecipients > 0 ? Math.round((campaign.failedCount / campaign.totalRecipients) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/whatsapp-campaigns" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate min-w-0">{campaign.name}</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-emerald-50 text-emerald-700">
              <CheckCheck size={11} />
              Envoyé
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            {campaign.createdBy ? `Par ${campaign.createdBy.name}` : ""}
            {campaign.sentAt ? ` — Envoyé le ${formatDateTime(campaign.sentAt)}` : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors -mb-px whitespace-nowrap",
                activeTab === tab.key
                  ? "text-emerald-600 border-b-2 border-emerald-500"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <TabIcon size={16} />
              {tab.label}
              {tab.key === "recipients" && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {campaign.recipients.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <OverviewTab campaign={campaign} deliveryRate={deliveryRate} readRate={readRate} failRate={failRate} spentEstimate={spentEstimate} />
      )}
      {activeTab === "template" && <TemplateTab campaign={campaign} />}
      {activeTab === "recipients" && <RecipientsTab recipients={campaign.recipients} />}
    </div>
  );
}

// ─── Overview ───
function OverviewTab({
  campaign,
  deliveryRate,
  readRate,
  failRate,
  spentEstimate,
}: {
  campaign: Campaign;
  deliveryRate: number;
  readRate: number;
  failRate: number;
  spentEstimate: WhatsAppCostEstimate | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Envoyés" value={campaign.sentCount.toString()} desc={`/ ${campaign.totalRecipients} dest.`} color="text-blue-600" bg="bg-blue-50" icon={Send} />
        <MetricCard label="Délivrés" value={`${deliveryRate}%`} desc={`${campaign.deliveredCount} délivrés`} color="text-emerald-600" bg="bg-emerald-50" icon={CheckCheck} />
        <MetricCard label="Lus" value={`${readRate}%`} desc={`${campaign.readCount} lus`} color="text-blue-700" bg="bg-blue-50" icon={Eye} />
        <MetricCard label="Échecs" value={`${failRate}%`} desc={`${campaign.failedCount} échoués`} color="text-red-600" bg="bg-red-50" icon={AlertTriangle} />
        <MetricCard
          label="Dépense Meta"
          value={spentEstimate ? `≈ ${formatXof(spentEstimate.totalXof)}` : "0 FCFA"}
          desc={spentEstimate
            ? `${formatUsd(spentEstimate.totalUsd)} · ${spentEstimate.messageCount} msg délivré${spentEstimate.messageCount > 1 ? "s" : ""}`
            : "Aucun message délivré facturé"}
          color="text-violet-600"
          bg="bg-violet-50"
          icon={Wallet}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-5">Entonnoir WhatsApp</h3>
        <div className="space-y-3">
          <FunnelBar label="Envoyés" value={campaign.sentCount} max={campaign.totalRecipients} color="bg-brand-500" />
          <FunnelBar label="Délivrés" value={campaign.deliveredCount} max={campaign.totalRecipients} color="bg-emerald-500" />
          <FunnelBar label="Lus" value={campaign.readCount} max={campaign.totalRecipients} color="bg-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Informations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <InfoRow label="Template" value={
            <span className="inline-flex items-center gap-1.5">
              <Tag size={11} className="text-blue-600" />
              <span className="font-mono">{campaign.template.metaName}</span>
              <Globe size={10} className="text-gray-400" />
              <span>{campaign.template.language.toUpperCase()}</span>
            </span>
          } />
          {campaign.audience && (
            <InfoRow label="Audience" value={
              <Link href={`/audiences/${campaign.audience.id}`} className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                <Target size={11} />
                {campaign.audience.name}
              </Link>
            } />
          )}
          <InfoRow label="Créée par" value={campaign.createdBy?.name || "—"} />
          <InfoRow label="Envoi" value={campaign.sentAt ? formatDateTime(campaign.sentAt) : "—"} />
          <InfoRow label="Terminée" value={campaign.completedAt ? formatDateTime(campaign.completedAt) : "—"} />
          {spentEstimate && (
            <InfoRow
              label="Dépense Meta estimée"
              value={spentEstimate.breakdown
                .map(l => `${l.count} msg ${l.marketLabel} × ${l.rateUsd.toLocaleString("fr-FR", { minimumFractionDigits: 4 })} $`)
                .join(" · ")}
            />
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700">
          💡 Les statuts <strong>Délivré</strong> et <strong>Lu</strong> sont mis à jour automatiquement via les webhooks Meta dès que le destinataire reçoit/lit le message.
          La <strong>dépense Meta</strong> est une estimation calculée sur les messages délivrés (grille tarifaire Meta par pays et catégorie de template) — le montant exact facturé est visible dans votre Gestionnaire WhatsApp Business.
        </p>
      </div>
    </div>
  );
}

// ─── Template tab ───
function TemplateTab({ campaign }: { campaign: Campaign }) {
  // Aperçu du template avec demo values
  const demoValues: Record<string, string> = {
    "lead.firstName": "Fatou",
    "lead.lastName": "Diallo",
    "lead.programName": "MBA Marketing Digital",
  };

  const renderText = (text: string) => {
    return text.replace(/\{\{(lead|custom|audience)\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, prefix, field) => {
      const key = `${prefix}.${field}`;
      return demoValues[key] || `[${field}]`;
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <p className="text-xs text-gray-400">Template utilisé :</p>
          <span className="font-mono text-sm font-semibold text-gray-900">{campaign.template.metaName}</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {campaign.template.category}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
            {campaign.template.language.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#e5ddd5] to-[#e5ddd5]/60 rounded-xl p-8">
        <p className="text-xs text-gray-500 mb-3 text-center">Aperçu du message reçu</p>
        <div className="max-w-[280px] ml-auto bg-[#dcf8c6] rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
            {renderText(campaign.template.bodyText)}
          </div>
          <div className="px-3 pb-1 text-right">
            <span className="text-[10px] text-gray-500">10:30 ✓✓</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs text-gray-400 mb-2">Texte brut du template</p>
        <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 font-mono text-xs">{campaign.template.bodyText}</pre>
      </div>
    </div>
  );
}

// ─── Recipients tab ───
function RecipientsTab({ recipients }: { recipients: Recipient[] }) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const filtered = recipients.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const fullName = `${r.lead.firstName} ${r.lead.lastName}`.toLowerCase();
      return fullName.includes(q) || r.whatsappNumber.includes(q);
    }
    return true;
  });

  const statusCounts: Record<string, number> = {};
  for (const r of recipients) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus("")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            !filterStatus
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          )}
        >
          Tous ({recipients.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                filterStatus === key
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par nom ou numéro..."
          className="input text-sm pl-9 w-full"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Lead</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Numéro</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Statut</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Envoyé</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Délivré</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Lu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => {
                const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                const StIcon = st.icon;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/pipeline/${r.lead.id}`} className="font-medium text-gray-700 hover:text-emerald-600">
                        {r.lead.firstName} {r.lead.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{r.whatsappNumber}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", st.color)}>
                        <StIcon size={10} />
                        {st.label}
                      </span>
                      {r.errorMessage && (
                        <div className="text-[10px] text-red-600 mt-1">{r.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.sentAt ? formatDateTime(r.sentAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.deliveredAt ? formatDateTime(r.deliveredAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.readAt ? formatDateTime(r.readAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">Aucun destinataire</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───
function MetricCard({ label, value, desc, color, bg, icon: Icon }: any) {
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

function FunnelBar({ label, value, max, color }: any) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all flex items-center pl-3", color)} style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct > 15 && <span className="text-[10px] text-white font-bold">{value}</span>}
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-700 w-14 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <span className="text-gray-400">{label} :</span>{" "}
      <span className="text-gray-700 ml-1">{value}</span>
    </div>
  );
}