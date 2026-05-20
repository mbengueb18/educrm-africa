"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  quickCreateWhatsAppCampaign,
  deleteWhatsAppCampaign,
  sendWhatsAppCampaign,
  getWhatsAppCampaignRecipientStats,
} from "./actions";
import {
  Plus, MessageCircle, Send, Trash2, Users, Eye, CheckCheck,
  Loader2, Clock, CheckCircle, XCircle, AlertTriangle, Tag,
  BarChart3, Target, FileText, Globe,
} from "lucide-react";

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
  template: { metaName: string; language: string; status: string };
  audience: { id: string; name: string; type: string } | null;
  _count: { recipients: number };
}

interface Props {
  campaigns: Campaign[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  DRAFT: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  SENDING: { label: "En cours", color: "bg-amber-50 text-amber-700", icon: Loader2 },
  SENT: { label: "Envoyé", color: "bg-emerald-50 text-emerald-700", icon: CheckCircle },
  CANCELLED: { label: "Annulé", color: "bg-red-50 text-red-700", icon: XCircle },
  FAILED: { label: "Échoué", color: "bg-red-50 text-red-700", icon: XCircle },
};

export function WhatsAppCampaignsClient({ campaigns }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmSendCampaign, setConfirmSendCampaign] = useState<Campaign | null>(null);
  const [confirmStats, setConfirmStats] = useState<{
    total: number;
    withWhatsApp: number;
    withoutWhatsApp: number;
    fromAudience: boolean;
    audienceName?: string;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const c = await quickCreateWhatsAppCampaign();
        router.push(`/whatsapp-campaigns/${c.id}/edit`);
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    startTransition(async () => {
      try {
        await deleteWhatsAppCampaign(id);
        toast.success("Campagne supprimée");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };// Ouvre le modal et charge les stats
  const handleSend = async (campaign: Campaign) => {
    setConfirmSendCampaign(campaign);
    setLoadingStats(true);
    setConfirmStats(null);
    try {
      const stats = await getWhatsAppCampaignRecipientStats(campaign.id);
      setConfirmStats(stats);
    } catch (e: any) {
      toast.error(e.message || "Impossible de charger les stats");
      setConfirmSendCampaign(null);
    }
    setLoadingStats(false);
  };

  // Confirme et envoie
  const handleConfirmSend = () => {
    if (!confirmSendCampaign) return;
    const campaign = confirmSendCampaign;
    setConfirmSendCampaign(null);
    setConfirmStats(null);
    startTransition(async () => {
      try {
        const result = await sendWhatsAppCampaign(campaign.id);
        toast.success(
          `${result.sentCount} message${result.sentCount > 1 ? "s" : ""} envoyé${result.sentCount > 1 ? "s" : ""}` +
            (result.failedCount > 0 ? ` · ${result.failedCount} échoué${result.failedCount > 1 ? "s" : ""}` : "")
        );
        router.refresh();
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Campagnes WhatsApp</h1>
           {/* <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              BÊTA
            </span>*/}  
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Envoyez des messages WhatsApp à vos leads via des templates Meta-approuvés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/whatsapp-templates"
            className="btn-secondary text-sm"
            title="Gérer les templates WhatsApp"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Templates</span>
          </Link>
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="btn-primary text-sm"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            <span className="hidden sm:inline">Nouvelle campagne</span>
            <span className="sm:hidden">Nouvelle</span>
          </button>
        </div>
      </div>

      {/* List */}
      {campaigns.length === 0 ? (
        <EmptyState onCreate={handleCreate} isPending={isPending} />
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onDelete={() => handleDelete(c.id)}
              onSend={() => handleSend(c)}
              isPending={isPending}
            />
          ))}
        </div>
      )}
      {/* Send confirmation modal */}
      {confirmSendCampaign && (
        <SendConfirmModal
          campaign={confirmSendCampaign}
          stats={confirmStats}
          loading={loadingStats}
          isPending={isPending}
          onCancel={() => {
            setConfirmSendCampaign(null);
            setConfirmStats(null);
          }}
          onConfirm={handleConfirmSend}
        />
      )}
    </div>
  );
}

// ─── Empty state ───
function EmptyState({ onCreate, isPending }: { onCreate: () => void; isPending: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <MessageCircle size={32} className="text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune campagne WhatsApp</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
        Créez votre première campagne WhatsApp pour atteindre vos leads avec un taux d'ouverture &gt; 90%. 
        Vous devez avoir au moins un template approuvé par Meta.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Link href="/settings/whatsapp-templates" className="btn-secondary text-sm">
          <FileText size={14} /> Gérer les templates
        </Link>
        <button onClick={onCreate} disabled={isPending} className="btn-primary text-sm">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Créer une campagne
        </button>
      </div>
    </div>
  );
}

// ─── Campaign card ───
function CampaignCard({
  campaign,
  onDelete,
  onSend,
  isPending,
}: {
  campaign: Campaign;
  onDelete: () => void;
  onSend: () => void;
  isPending: boolean;
}) {
  const statusStyle = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = statusStyle.icon;

  const deliveryRate = campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;
  const readRate = campaign.deliveredCount > 0 ? Math.round((campaign.readCount / campaign.deliveredCount) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-card-hover transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate min-w-0">{campaign.name}</h3>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap", statusStyle.color)}>
              <StatusIcon size={10} className={campaign.status === "SENDING" ? "animate-spin" : ""} />
              {statusStyle.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Template badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <Tag size={9} />
              {campaign.template.metaName}
              <Globe size={9} className="ml-0.5" />
              {campaign.template.language.toUpperCase()}
            </span>

            {/* Audience badge */}
            {campaign.audience && (
              <Link
                href={`/audiences/${campaign.audience.id}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
              >
                <Target size={9} />
                {campaign.audience.name}
              </Link>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {campaign.createdBy ? `Par ${campaign.createdBy.name} — ` : ""}
            {campaign.sentAt
              ? `Envoyé le ${formatDate(campaign.sentAt)}`
              : `Créé le ${formatDate(campaign.createdAt)}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {campaign.status === "DRAFT" && (
            <>
              <Link
                href={`/whatsapp-campaigns/${campaign.id}/edit`}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Éditer
              </Link>
              <button
                onClick={onSend}
                disabled={isPending}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                <Send size={13} /> Envoyer
              </button>
              <button
                onClick={onDelete}
                disabled={isPending}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          {campaign.status === "SENT" && (
            <Link
              href={`/whatsapp-campaigns/${campaign.id}`}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <BarChart3 size={13} /> Voir détails
            </Link>
          )}
        </div>
      </div>

      {/* Stats row */}
      {campaign.status === "SENT" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          <MiniMetric label="Envoyés" value={campaign.sentCount} icon={Send} color="text-brand-600" />
          <MiniMetric label="Délivrés" value={campaign.deliveredCount} subtitle={`${deliveryRate}%`} icon={CheckCircle} color="text-emerald-600" />
          <MiniMetric label="Lus" value={campaign.readCount} subtitle={`${readRate}%`} icon={CheckCheck} color="text-blue-600" />
          <MiniMetric label="Échoués" value={campaign.failedCount} icon={AlertTriangle} color="text-red-500" />
        </div>
      )}

      {campaign.status === "DRAFT" && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Users size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">
            {campaign.totalRecipients} destinataire{campaign.totalRecipients !== 1 ? "s" : ""} avec WhatsApp
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Mini metric ───
function MiniMetric({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  subtitle?: string;
  icon: typeof Send;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon size={13} className={color} />
        <span className={cn("text-lg font-bold", color)}>{value}</span>
      </div>
      <p className="text-[10px] text-gray-500">
        {label} {subtitle ? `(${subtitle})` : ""}
      </p>
    </div>
  );
}

// ─── Modal de confirmation d'envoi WhatsApp ───
function SendConfirmModal({
  campaign,
  stats,
  loading,
  isPending,
  onCancel,
  onConfirm,
}: {
  campaign: Campaign;
  stats: {
    total: number;
    withWhatsApp: number;
    withoutWhatsApp: number;
    fromAudience: boolean;
    audienceName?: string;
  } | null;
  loading: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasNoRecipients = stats !== null && stats.withWhatsApp === 0;
  const hasIgnoredLeads = stats !== null && stats.withoutWhatsApp > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageCircle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900">Envoyer la campagne WhatsApp ?</h3>
              <p className="text-xs text-gray-500 truncate mt-0.5">"{campaign.name}"</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Calcul des destinataires...</span>
            </div>
          ) : stats ? (
            <>
              {stats.fromAudience && stats.audienceName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                  <Target size={13} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800">
                    Audience : <span className="font-semibold">{stats.audienceName}</span>
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-4">
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    hasNoRecipients ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      hasNoRecipients ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                    )}
                  >
                    {hasNoRecipients ? <XCircle size={18} /> : <CheckCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      <span className={hasNoRecipients ? "text-red-700" : "text-emerald-700"}>
                        {stats.withWhatsApp}
                      </span>
                      <span className="text-gray-600 font-normal">
                        {" "}
                        destinataire{stats.withWhatsApp > 1 ? "s" : ""}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {hasNoRecipients
                        ? "Aucun lead n'a de numéro WhatsApp"
                        : "recevront le message WhatsApp"}
                    </p>
                  </div>
                </div>

                {hasIgnoredLeads && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-900">
                        {stats.withoutWhatsApp} lead{stats.withoutWhatsApp > 1 ? "s" : ""} sans WhatsApp
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Seront ignoré{stats.withoutWhatsApp > 1 ? "s" : ""}. Renseignez leur numéro pour les inclure.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                Audience totale :{" "}
                <span className="font-semibold text-gray-700">
                  {stats.total} lead{stats.total > 1 ? "s" : ""}
                </span>
              </div>

              {!hasNoRecipients && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[11px] text-blue-800">
                    💡 <strong>Important</strong> : chaque message WhatsApp utilise un template Meta-approuvé. Coûts à votre charge selon votre compte WhatsApp Business.
                  </p>
                </div>
              )}

              {!hasNoRecipients && (
                <p className="text-[11px] text-gray-500 mt-3 text-center">
                  Cette action est irréversible. Les messages seront envoyés immédiatement.
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={isPending} className="btn-secondary py-1.5 px-4 text-xs">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || isPending || hasNoRecipients}
            className="btn-primary py-1.5 px-4 text-xs"
          >
            {isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {stats && stats.withWhatsApp > 0
              ? `Envoyer (${stats.withWhatsApp} message${stats.withWhatsApp > 1 ? "s" : ""})`
              : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}