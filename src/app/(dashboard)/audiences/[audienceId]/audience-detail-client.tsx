"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelative, formatDateTime, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  deleteAudience,
  updateAudience,
  removeLeadsFromAudience,
  createCampaignFromAudience,
  createWhatsAppCampaignFromAudience,
  getAudienceCampaignStats,
} from "../actions";
import {
  ArrowLeft, Users, Sparkles, Upload, Pencil, Trash2, Plus,
  Search, X, Loader2, Mail, Phone, MoreVertical, Filter,
  FileText, Calendar, ChevronLeft, ChevronRight, Settings, Send, MessageCircle,
} from "lucide-react";
import { RuleBuilder, type FilterGroup } from "@/components/audiences/rule-builder";
import { AddLeadsModal } from "@/components/audiences/add-leads-modal";

interface Audience {
  id: string;
  name: string;
  description: string | null;
  type: "STATIC" | "DYNAMIC" | "IMPORTED";
  color: string | null;
  rules: any;
  importMetadata: any;
  memberCount: number;
  lastEvaluatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  score: number;
  stage: { name: string; color: string } | null;
  program: { name: string } | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: Date;
}

interface AudienceDetailClientProps {
  audience: Audience;
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

const TYPE_LABEL: Record<string, string> = {
  STATIC: "Statique",
  DYNAMIC: "Dynamique",
  IMPORTED: "Import CSV",
};

const TYPE_COLOR: Record<string, string> = {
  STATIC: "bg-blue-50 text-blue-700 border-blue-200",
  DYNAMIC: "bg-violet-50 text-violet-700 border-violet-200",
  IMPORTED: "bg-amber-50 text-amber-700 border-amber-200",
};

const TYPE_ICON: Record<string, typeof Users> = {
  STATIC: Users,
  DYNAMIC: Sparkles,
  IMPORTED: Upload,
};

export function AudienceDetailClient({
  audience,
  leads,
  total,
  page,
  pageSize,
}: AudienceDetailClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(audience.name);
  const [editDescription, setEditDescription] = useState(audience.description || "");
  const [saving, setSaving] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [showChannelChooser, setShowChannelChooser] = useState(false);
  const [channelStats, setChannelStats] = useState<{ total: number; withEmail: number; withWhatsApp: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [creatingEmailCampaign, setCreatingEmailCampaign] = useState(false);
  const [creatingWhatsAppCampaign, setCreatingWhatsAppCampaign] = useState(false);
  const [showAddLeads, setShowAddLeads] = useState(false);

  const TypeIcon = TYPE_ICON[audience.type] || Users;
  const totalPages = Math.ceil(total / pageSize);

  // ─── Édition nom + description ───
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      await updateAudience(audience.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      toast.success("Audience mise à jour");
      setEditing(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  // ─── Lancer une campagne depuis cette audience ───
  // Ouvre le modal de choix de canal
  const handleOpenChannelChooser = async () => {
    if (audience.type === "DYNAMIC") {
      toast.error("Les audiences dynamiques ne peuvent pas être utilisées pour les campagnes");
      return;
    }
    
    const memberCount = audience.memberCount || 0;
    if (memberCount === 0) {
      toast.error("Cette audience est vide. Ajoutez des leads avant de lancer une campagne.");
      return;
    }

    setShowChannelChooser(true);
    setLoadingStats(true);
    setChannelStats(null);
    try {
      const stats = await getAudienceCampaignStats(audience.id);
      setChannelStats(stats);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      setShowChannelChooser(false);
    }
    setLoadingStats(false);
  };

  // Création d'une campagne Email
  const handleCreateEmailCampaign = async () => {
    setCreatingEmailCampaign(true);
    try {
      const campaign = await createCampaignFromAudience(audience.id);
      toast.success("Campagne email créée");
      router.push(`/campaigns/${campaign.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      setCreatingEmailCampaign(false);
    }
  };

  // Création d'une campagne WhatsApp
  const handleCreateWhatsAppCampaign = async () => {
    setCreatingWhatsAppCampaign(true);
    try {
      const campaign = await createWhatsAppCampaignFromAudience(audience.id);
      toast.success("Campagne WhatsApp créée");
      router.push(`/whatsapp-campaigns/${campaign.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      setCreatingWhatsAppCampaign(false);
    }
  };

  // ─── Suppression de l'audience ───
  const handleDeleteAudience = async () => {
    if (!confirm(`Supprimer définitivement l'audience "${audience.name}" ?\n\nLes leads ne seront pas supprimés.`)) return;
    try {
      await deleteAudience(audience.id);
      toast.success("Audience supprimée");
      router.push("/audiences");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  // ─── Sélection multi-leads ───
  const toggleSelectLead = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map(l => l.id)));
    }
  };

  // ─── Sauvegarde des règles dynamiques ───
  const handleSaveRules = async (newRules: FilterGroup) => {
    setSavingRules(true);
    try {
      await updateAudience(audience.id, { rules: newRules });
      toast.success("Règles enregistrées");
      setEditingRules(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSavingRules(false);
  };

  // ─── Retrait des leads sélectionnés ───
  const handleRemoveSelected = async () => {
    if (selectedLeadIds.size === 0) return;
    if (!confirm(`Retirer ${selectedLeadIds.size} lead(s) de cette audience ?`)) return;
    setRemoving(true);
    try {
      await removeLeadsFromAudience(audience.id, Array.from(selectedLeadIds));
      toast.success(`${selectedLeadIds.size} lead(s) retiré(s)`);
      setSelectedLeadIds(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setRemoving(false);
  };

  const isStatic = audience.type === "STATIC" || audience.type === "IMPORTED";
  const importMeta = audience.importMetadata as any;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/audiences"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 mb-3"
        >
          <ArrowLeft size={14} /> Retour aux audiences
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
              TYPE_COLOR[audience.type]
            )}>
              <TypeIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="input text-xl font-bold py-1 px-2 w-full max-w-md"
                    autoFocus
                  />
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Description..."
                    className="input text-sm py-1 px-2 w-full max-w-md min-h-[60px] resize-y"
                    rows={2}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {audience.name}
                    </h1>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      TYPE_COLOR[audience.type]
                    )}>
                      {TYPE_LABEL[audience.type]}
                    </span>
                  </div>
                  {audience.description && (
                    <p className="text-sm text-gray-500">{audience.description}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(audience.name);
                    setEditDescription(audience.description || "");
                  }}
                  className="btn-secondary py-1.5 px-3 text-xs"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  Enregistrer
                </button>
              </>
            ) : (
              <>
                {/* Bouton Lancer une campagne — uniquement pour STATIC/IMPORTED avec des leads */}
                {audience.type !== "DYNAMIC" && (audience.memberCount || 0) > 0 && (
                  <button
                    onClick={handleOpenChannelChooser}
                    className="btn-primary py-1.5 px-3 text-xs"
                    title="Créer une campagne ciblant cette audience"
                  >
                    <Send size={12} />
                    Lancer une campagne
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                  title="Modifier nom et description"
                >
                  <Pencil size={12} /> Modifier
                </button>
                <button
                  onClick={handleDeleteAudience}
                  className="btn-secondary py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  title="Supprimer cette audience"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={12} className="text-brand-500" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Total leads
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{audience.memberCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={12} className="text-emerald-500" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Créée le
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {new Date(audience.createdAt).toLocaleDateString("fr-FR")}
          </p>
          {audience.createdBy && (
            <p className="text-[10px] text-gray-400 mt-0.5">par {audience.createdBy.name}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Filter size={12} className="text-amber-500" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Dernière maj
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">{formatRelative(audience.updatedAt)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TypeIcon size={12} className="text-violet-500" />
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Type
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">{TYPE_LABEL[audience.type]}</p>
        </div>
      </div>

      {/* Metadata import (si applicable) */}
      {audience.type === "IMPORTED" && importMeta && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <FileText size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-1">Informations d'import</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {importMeta.filename && (
                  <div>
                    <span className="text-amber-700">Fichier :</span>{" "}
                    <span className="font-medium text-amber-900">{importMeta.filename}</span>
                  </div>
                )}
                {importMeta.importedAt && (
                  <div>
                    <span className="text-amber-700">Date :</span>{" "}
                    <span className="font-medium text-amber-900">
                      {new Date(importMeta.importedAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                )}
                {importMeta.importedRows !== undefined && (
                  <div>
                    <span className="text-amber-700">Lignes importées :</span>{" "}
                    <span className="font-medium text-amber-900">
                      {importMeta.importedRows} ({importMeta.skippedRows || 0} ignorées)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC : Rule Builder ou aperçu */}
      {audience.type === "DYNAMIC" && (
        <>
          {editingRules ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-violet-600" />
                <h2 className="text-sm font-bold text-gray-900">Configuration des règles</h2>
              </div>
              <RuleBuilder
                initialRules={(audience.rules as FilterGroup) || { operator: "AND", rules: [] }}
                onSave={handleSaveRules}
                onCancel={() => setEditingRules(false)}
              />
            </div>
          ) : (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Sparkles size={16} className="text-violet-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-violet-900 mb-1">Règles dynamiques</p>
                    <p className="text-xs text-violet-700">
                      {audience.rules?.rules?.length > 0
                        ? `${countTotalRules(audience.rules)} règle(s) configurée(s). Les leads sont sélectionnés automatiquement.`
                        : "Aucune règle configurée. Configurez les critères pour peupler cette audience."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingRules(true)}
                  className="btn-secondary py-1.5 px-3 text-xs text-violet-700 border-violet-300 hover:bg-violet-100 shrink-0"
                >
                  <Settings size={12} /> {audience.rules?.rules?.length > 0 ? "Modifier" : "Configurer"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions sur les leads (STATIC uniquement) */}
      {isStatic && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-gray-500">
            {selectedLeadIds.size > 0 ? (
              <span className="text-brand-600 font-semibold">
                {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? "s" : ""} sélectionné{selectedLeadIds.size > 1 ? "s" : ""}
              </span>
            ) : (
              <>{total} lead{total > 1 ? "s" : ""} au total</>
            )}
          </p>
          <div className="flex items-center gap-2">
            {selectedLeadIds.size > 0 && audience.type === "STATIC" && (
              <button
                onClick={handleRemoveSelected}
                disabled={removing}
                className="btn-secondary py-1.5 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                {removing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                Retirer
              </button>
            )}
            {audience.type === "STATIC" && (
              <button
                className="btn-primary py-1.5 px-3 text-xs"
                onClick={() => setShowAddLeads(true)}
              >
                <Plus size={12} /> Ajouter des leads
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tableau des leads */}
      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">Aucun lead dans cette audience</p>
          <p className="text-xs text-gray-400 mt-1">
            {audience.type === "DYNAMIC"
              ? "Configurez les règles pour peupler automatiquement."
              : "Ajoutez des leads pour commencer."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {audience.type === "STATIC" && (
                    <th className="px-3 py-2.5 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Étape</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Filière</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Assigné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                    {audience.type === "STATIC" && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5 hover:text-brand-600">
                        <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {getInitials(lead.firstName + " " + lead.lastName)}
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {lead.firstName} {lead.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-0.5">
                        {lead.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Mail size={10} /> <span className="truncate max-w-[180px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && lead.phone !== "N/A" && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone size={10} /> {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {lead.stage ? (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: (lead.stage.color || "#888") + "20",
                            color: lead.stage.color || "#888",
                            borderColor: (lead.stage.color || "#888") + "40",
                          }}
                        >
                          {lead.stage.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {lead.program ? (
                        <span className="text-xs text-gray-700">{lead.program.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">À qualifier</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        lead.score >= 60 ? "bg-emerald-100 text-emerald-700" :
                        lead.score >= 30 ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-500"
                      )}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {lead.assignedTo ? (
                        <span className="text-xs text-gray-700">{lead.assignedTo.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Page {page} sur {totalPages} · {total} lead{total > 1 ? "s" : ""} au total
              </p>
              <div className="flex items-center gap-1">
                <Link
                  href={`/audiences/${audience.id}?page=${Math.max(1, page - 1)}`}
                  className={cn(
                    "p-1.5 rounded-lg",
                    page <= 1
                      ? "text-gray-300 pointer-events-none"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ChevronLeft size={14} />
                </Link>
                <Link
                  href={`/audiences/${audience.id}?page=${Math.min(totalPages, page + 1)}`}
                  className={cn(
                    "p-1.5 rounded-lg",
                    page >= totalPages
                      ? "text-gray-300 pointer-events-none"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal d'ajout de leads */}
      {showAddLeads && (
        <AddLeadsModal
          audienceId={audience.id}
          audienceName={audience.name}
          onClose={() => setShowAddLeads(false)}
          onAdded={(count) => {
            setShowAddLeads(false);
            router.refresh();
          }}
        />
      )}
      {/* Modal choix du canal de campagne */}
      {showChannelChooser && (
        <ChannelChooserModal
          stats={channelStats}
          loading={loadingStats}
          creatingEmail={creatingEmailCampaign}
          creatingWhatsApp={creatingWhatsAppCampaign}
          audienceName={audience.name}
          onCancel={() => {
            setShowChannelChooser(false);
            setChannelStats(null);
          }}
          onChooseEmail={handleCreateEmailCampaign}
          onChooseWhatsApp={handleCreateWhatsAppCampaign}
        />
      )}
    </div>
  );
}

// ─── Modal de choix du canal de campagne ───
function ChannelChooserModal({
  stats,
  loading,
  creatingEmail,
  creatingWhatsApp,
  audienceName,
  onCancel,
  onChooseEmail,
  onChooseWhatsApp,
}: {
  stats: { total: number; withEmail: number; withWhatsApp: number } | null;
  loading: boolean;
  creatingEmail: boolean;
  creatingWhatsApp: boolean;
  audienceName: string;
  onCancel: () => void;
  onChooseEmail: () => void;
  onChooseWhatsApp: () => void;
}) {
  const isProcessing = creatingEmail || creatingWhatsApp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={isProcessing ? undefined : onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Lancer une campagne</h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            Audience : <span className="font-semibold">{audienceName}</span>
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">Analyse des destinataires...</span>
            </div>
          ) : stats ? (
            <>
              <p className="text-xs text-gray-600 mb-4">
                Choisissez le canal de communication pour cette campagne :
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Email card */}
                <button
                  onClick={onChooseEmail}
                  disabled={isProcessing || stats.withEmail === 0}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all relative",
                    "hover:border-brand-500 hover:bg-brand-50/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white",
                    stats.withEmail === 0 ? "border-gray-200" : "border-gray-300"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Mail size={18} />
                    </div>
                    {creatingEmail && <Loader2 size={14} className="animate-spin text-brand-600" />}
                  </div>

                  <p className="text-sm font-bold text-gray-900 mb-1">Email</p>
                  <p className="text-xs text-gray-500 mb-3">Envoi via Brevo SMTP</p>

                  {stats.withEmail > 0 ? (
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-blue-700">{stats.withEmail}</p>
                      <p className="text-[10px] text-gray-500">
                        destinataire{stats.withEmail > 1 ? "s" : ""} avec email
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-600 font-medium">
                      ⚠ Aucun lead avec email
                    </p>
                  )}
                </button>

                {/* WhatsApp card */}
                <button
                  onClick={onChooseWhatsApp}
                  disabled={isProcessing || stats.withWhatsApp === 0}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all relative",
                    "hover:border-emerald-500 hover:bg-emerald-50/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white",
                    stats.withWhatsApp === 0 ? "border-gray-200" : "border-gray-300"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <MessageCircle size={18} />
                    </div>
                    {creatingWhatsApp && <Loader2 size={14} className="animate-spin text-emerald-600" />}
                  </div>

                  <p className="text-sm font-bold text-gray-900 mb-1">WhatsApp</p>
                  <p className="text-xs text-gray-500 mb-3">Via Meta Cloud API</p>

                  {stats.withWhatsApp > 0 ? (
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-emerald-700">{stats.withWhatsApp}</p>
                      <p className="text-[10px] text-gray-500">
                        destinataire{stats.withWhatsApp > 1 ? "s" : ""} avec WhatsApp
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-600 font-medium">
                      ⚠ Aucun lead avec WhatsApp
                    </p>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 text-center">
                  Audience totale : <span className="font-semibold text-gray-700">{stats.total} lead{stats.total > 1 ? "s" : ""}</span>
                </p>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-[11px] text-blue-800">
                  💡 <strong>Bon à savoir</strong> : WhatsApp a un taux d'ouverture &gt; 90% (vs 20% en email), mais nécessite un template Meta-approuvé. Email permet plus de créativité visuelle.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="btn-secondary py-1.5 px-4 text-xs"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// Compte récursivement le nombre total de règles dans un groupe
function countTotalRules(group: any): number {
  if (!group || !group.rules) return 0;
  let count = 0;
  for (const item of group.rules) {
    if ("operator" in item && "rules" in item) {
      count += countTotalRules(item);
    } else {
      count++;
    }
  }
  return count;
}