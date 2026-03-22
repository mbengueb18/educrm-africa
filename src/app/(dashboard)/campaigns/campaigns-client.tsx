"use client";

import { useState, useTransition } from "react";
import { createCampaign, sendCampaign, deleteCampaign, previewSegment, type SegmentRule } from "./actions";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Send, Trash2, Mail, Users, Eye, MousePointer, AlertTriangle,
  Loader2, X, ChevronDown, BarChart3, ArrowRight, Zap, Clock,
  CheckCircle, XCircle, Filter,
} from "lucide-react";
import { EmailEditor, blocksToHtml, type EmailBlock } from "@/components/messaging/email-editor";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  failedCount: number;
  sentAt: Date | null;
  createdAt: Date;
  createdBy: { name: string } | null;
  _count: { recipients: number };
}

interface CampaignsClientProps {
  campaigns: Campaign[];
  stages: { id: string; name: string; color: string }[];
  programs: { id: string; name: string; code: string | null }[];
}

const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" }, { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" }, { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SALON", label: "Salon" }, { value: "REFERRAL", label: "Parrainage" },
  { value: "RADIO", label: "Radio" }, { value: "OTHER", label: "Autre" },
];

const STATUS_STYLES: Record<string, { label: string; color: string; icon: typeof Send }> = {
  DRAFT: { label: "Brouillon", color: "badge-gray", icon: Clock },
  SENDING: { label: "En cours", color: "badge-amber", icon: Loader2 },
  SENT: { label: "Envoye", color: "badge-green", icon: CheckCircle },
  CANCELLED: { label: "Annule", color: "badge-red", icon: XCircle },
};

export function CampaignsClient({ campaigns, stages, programs }: CampaignsClientProps) {
  var [showCreate, setShowCreate] = useState(false);
  var [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  var [isPending, startTransition] = useTransition();
  var router = useRouter();

  var handleDelete = function(id: string) {
    if (!confirm("Supprimer cette campagne ?")) return;
    startTransition(async function() {
      try {
        await deleteCampaign(id);
        toast.success("Campagne supprimee");
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  var handleSend = function(campaign: Campaign) {
    if (!confirm("Envoyer cette campagne a " + campaign.totalRecipients + " destinataires ? Cette action est irreversible.")) return;
    startTransition(async function() {
      try {
        var result = await sendCampaign(campaign.id);
        toast.success(result.sentCount + " emails envoyes");
        router.refresh();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Campagnes email</h1>
          <p className="text-sm text-gray-500 mt-1">Creez et gerez vos campagnes de communication</p>
        </div>
        <button onClick={function() { setShowCreate(true); }} className="btn-primary text-sm">
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateCampaignModal
          stages={stages}
          programs={programs}
          onClose={function() { setShowCreate(false); }}
          onCreated={function() { setShowCreate(false); router.refresh(); }}
        />
      )}

      {/* Campaign detail/report */}
      {selectedCampaign && (
        <CampaignReport campaign={selectedCampaign} onClose={function() { setSelectedCampaign(null); }} />
      )}

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-brand-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune campagne</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Creez votre premiere campagne email pour communiquer avec vos leads.
          </p>
          <button onClick={function() { setShowCreate(true); }} className="btn-primary">
            <Plus size={16} /> Creer une campagne
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(function(campaign) {
            var style = STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT;
            var StatusIcon = style.icon;
            var openRate = campaign.sentCount > 0 ? Math.round((campaign.openedCount / campaign.sentCount) * 100) : 0;
            var clickRate = campaign.openedCount > 0 ? Math.round((campaign.clickedCount / campaign.openedCount) * 100) : 0;

            return (
              <div key={campaign.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{campaign.name}</h3>
                      <span className={cn("badge text-[10px]", style.color)}>
                        <StatusIcon size={11} className={campaign.status === "SENDING" ? "animate-spin" : ""} />
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{campaign.subject}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {campaign.createdBy ? "Par " + campaign.createdBy.name + " — " : ""}
                      {campaign.sentAt ? "Envoye le " + formatDate(campaign.sentAt) : "Cree le " + formatDate(campaign.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {campaign.status === "DRAFT" && (
                      <>
                        <button
                          onClick={function() { handleSend(campaign); }}
                          disabled={isPending}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          <Send size={13} /> Envoyer
                        </button>
                        <button
                          onClick={function() { handleDelete(campaign.id); }}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                    {campaign.status === "SENT" && (
                      <Link
                        href={"/campaigns/" + campaign.id}
                        className="btn-secondary py-1.5 px-3 text-xs"
                      >
                        <BarChart3 size={13} /> Voir details
                      </Link>
                    )}
                  </div>
                </div>

                {/* Stats row for sent campaigns */}
                {campaign.status === "SENT" && (
                  <div className="grid grid-cols-5 gap-3 pt-3 border-t border-gray-100">
                    <MiniMetric label="Envoyes" value={campaign.sentCount} icon={Send} color="text-brand-600" />
                    <MiniMetric label="Delivres" value={campaign.deliveredCount} icon={CheckCircle} color="text-emerald-600" />
                    <MiniMetric label="Ouverts" value={campaign.openedCount} subtitle={openRate + "%"} icon={Eye} color="text-blue-600" />
                    <MiniMetric label="Cliques" value={campaign.clickedCount} subtitle={clickRate + "%"} icon={MousePointer} color="text-purple-600" />
                    <MiniMetric label="Rebonds" value={campaign.bouncedCount} icon={AlertTriangle} color="text-red-500" />
                  </div>
                )}

                {campaign.status === "DRAFT" && (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Users size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500">{campaign.totalRecipients} destinataires dans le segment</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Mini metric for campaign row ───
function MiniMetric({ label, value, subtitle, icon: Icon, color }: { label: string; value: number; subtitle?: string; icon: typeof Send; color: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon size={13} className={color} />
        <span className={cn("text-lg font-bold", color)}>{value}</span>
      </div>
      <p className="text-[10px] text-gray-500">{label} {subtitle ? "(" + subtitle + ")" : ""}</p>
    </div>
  );
}

// ─── Campaign Report Modal ───
function CampaignReport({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  var openRate = campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1) : "0";
  var clickRate = campaign.openedCount > 0 ? ((campaign.clickedCount / campaign.openedCount) * 100).toFixed(1) : "0";
  var deliveryRate = campaign.sentCount > 0 ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1) : "0";
  var bounceRate = campaign.sentCount > 0 ? ((campaign.bouncedCount / campaign.sentCount) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl mx-4 max-h-[85vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{campaign.name}</h2>
            <p className="text-sm text-gray-500">{campaign.subject}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Taux d'ouverture" value={openRate + "%"} desc={campaign.openedCount + " / " + campaign.sentCount} color="text-blue-600" bg="bg-blue-50" />
            <MetricCard label="Taux de clic" value={clickRate + "%"} desc={campaign.clickedCount + " clics"} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard label="Delivrabilite" value={deliveryRate + "%"} desc={campaign.deliveredCount + " delivres"} color="text-emerald-600" bg="bg-emerald-50" />
            <MetricCard label="Taux de rebond" value={bounceRate + "%"} desc={campaign.bouncedCount + " rebonds"} color="text-red-500" bg="bg-red-50" />
          </div>

          {/* Funnel visualization */}
          <div className="bg-gray-50 rounded-xl p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Entonnoir de la campagne</h4>
            <div className="space-y-2">
              <FunnelBar label="Envoyes" value={campaign.sentCount} max={campaign.sentCount} color="bg-brand-500" />
              <FunnelBar label="Delivres" value={campaign.deliveredCount} max={campaign.sentCount} color="bg-emerald-500" />
              <FunnelBar label="Ouverts" value={campaign.openedCount} max={campaign.sentCount} color="bg-blue-500" />
              <FunnelBar label="Cliques" value={campaign.clickedCount} max={campaign.sentCount} color="bg-purple-500" />
            </div>
          </div>

          {/* Detailed breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Detail des statuts</h4>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              <StatusRow label="Envoyes" value={campaign.sentCount} icon={Send} color="text-brand-600" />
              <StatusRow label="Delivres" value={campaign.deliveredCount} icon={CheckCircle} color="text-emerald-600" />
              <StatusRow label="Ouverts (uniques)" value={campaign.openedCount} icon={Eye} color="text-blue-600" />
              <StatusRow label="Cliques (uniques)" value={campaign.clickedCount} icon={MousePointer} color="text-purple-600" />
              <StatusRow label="Rebonds" value={campaign.bouncedCount} icon={AlertTriangle} color="text-amber-600" />
              <StatusRow label="Echoues" value={campaign.failedCount} icon={XCircle} color="text-red-500" />
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700">
              Les statistiques d'ouverture et de clic sont mises a jour automatiquement via les webhooks Brevo.
              Configurez le webhook dans Brevo &gt; Parametres &gt; Webhooks avec l'URL de votre application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, desc, color, bg }: { label: string; value: string; desc: string; color: string; bg: string }) {
  return (
    <div className={cn("rounded-xl p-4", bg)}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  var pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-white rounded-full overflow-hidden border border-gray-200">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: pct + "%" }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-16 text-right">{value} ({pct.toFixed(0)}%)</span>
    </div>
  );
}

function StatusRow({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Send; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className={color} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className={cn("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}

// ─── Create Campaign Modal ───
function CreateCampaignModal({ stages, programs, onClose, onCreated }: {
  stages: { id: string; name: string; color: string }[];
  programs: { id: string; name: string; code: string | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  var [step, setStep] = useState(1);
  var [name, setName] = useState("");
  var [subject, setSubject] = useState("");
  var [body, setBody] = useState("");
  var [rules, setRules] = useState<SegmentRule[]>([]);
  var [previewData, setPreviewData] = useState<{ count: number; leads: any[] } | null>(null);
  var [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>([]);
  var [isPending, startTransition] = useTransition();

  var addRule = function() {
    setRules([...rules, { field: "stageId", operator: "equals", value: "" }]);
  };

  var updateRule = function(index: number, updates: Partial<SegmentRule>) {
    setRules(rules.map(function(r, i) { return i === index ? { ...r, ...updates } : r; }));
  };

  var removeRule = function(index: number) {
    setRules(rules.filter(function(_, i) { return i !== index; }));
  };

  var handlePreview = function() {
    startTransition(async function() {
      try {
        var data = await previewSegment(rules);
        setPreviewData(data);
      } catch (e: any) { toast.error(e.message); }
    });
  };

  var handleCreate = function() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Nom, objet et message sont requis");
      return;
    }
    startTransition(async function() {
      try {
        await createCampaign({ name: name, subject: subject, body: body, segmentRules: rules });
        toast.success("Campagne creee");
        onCreated();
      } catch (e: any) { toast.error(e.message); }
    });
  };

  var FIELD_OPTIONS = [
    { value: "stageId", label: "Etape pipeline", type: "select", options: stages.map(function(s) { return { value: s.id, label: s.name }; }) },
    { value: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
    { value: "programId", label: "Filiere", type: "select", options: programs.map(function(p) { return { value: p.id, label: (p.code ? p.code + " — " : "") + p.name }; }) },
    { value: "score", label: "Score", type: "number", options: [] },
    { value: "city", label: "Ville", type: "text", options: [] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl mx-4 max-h-[88vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nouvelle campagne email</h2>
            <p className="text-sm text-gray-500">Etape {step} sur 2</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-gray-100">
          <button onClick={function() { setStep(1); }} className={cn("flex-1 py-3 text-xs font-medium", step === 1 ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}>
            1. Audience & segment
          </button>
          <button onClick={function() { if (step > 1) setStep(2); }} className={cn("flex-1 py-3 text-xs font-medium", step === 2 ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}>
            2. Contenu de l'email
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-5">
              {/* Campaign name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la campagne</label>
                <input value={name} onChange={function(e) { setName(e.target.value); }} className="input" placeholder="Relance leads inactifs — Mars 2026" />
              </div>

              {/* Segmentation rules */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Criteres de segmentation</label>
                  <button onClick={addRule} className="btn-secondary py-1 px-2 text-xs">
                    <Plus size={12} /> Ajouter un critere
                  </button>
                </div>

                {rules.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500">Aucun critere — tous les leads avec email seront inclus</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rules.map(function(rule, index) {
                      var fieldDef = FIELD_OPTIONS.find(function(f) { return f.value === rule.field; });
                      return (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                          {index > 0 && <span className="text-xs text-gray-400 font-medium">ET</span>}
                          <select value={rule.field} onChange={function(e) { updateRule(index, { field: e.target.value, value: "" }); }} className="input text-sm py-1.5 w-36">
                            {FIELD_OPTIONS.map(function(f) { return <option key={f.value} value={f.value}>{f.label}</option>; })}
                          </select>
                          <select value={rule.operator} onChange={function(e) { updateRule(index, { operator: e.target.value }); }} className="input text-sm py-1.5 w-28">
                            <option value="equals">est</option>
                            <option value="not_equals">n'est pas</option>
                            {(fieldDef?.type === "text") && <option value="contains">contient</option>}
                            {(fieldDef?.type === "number") && <><option value="gt">sup. a</option><option value="lt">inf. a</option><option value="gte">sup. ou egal</option></>}
                          </select>
                          {fieldDef?.options && fieldDef.options.length > 0 ? (
                            <select value={rule.value} onChange={function(e) { updateRule(index, { value: e.target.value }); }} className="input text-sm py-1.5 flex-1">
                              <option value="">Choisir...</option>
                              {fieldDef.options.map(function(o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
                            </select>
                          ) : (
                            <input value={rule.value} onChange={function(e) { updateRule(index, { value: e.target.value }); }} className="input text-sm py-1.5 flex-1" placeholder="Valeur..." />
                          )}
                          <button onClick={function() { removeRule(index); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Preview */}
                <button onClick={handlePreview} disabled={isPending} className="btn-secondary py-2 text-xs mt-3 w-full justify-center">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  Previsualiser le segment
                </button>

                {previewData && (
                  <div className="bg-brand-50 rounded-xl p-4 mt-3 animate-scale-in">
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={16} className="text-brand-600" />
                      <span className="text-sm font-semibold text-brand-800">{previewData.count} lead{previewData.count > 1 ? "s" : ""} dans ce segment</span>
                    </div>
                    {previewData.count > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
                        {previewData.leads.slice(0, 20).map(function(l: any) {
                          return <span key={l.id} className="text-[10px] px-2 py-0.5 bg-white rounded-full text-gray-600 border border-brand-200">{l.firstName} {l.lastName}</span>;
                        })}
                        {previewData.count > 20 && <span className="text-[10px] text-brand-600">+{previewData.count - 20} autres</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet de l'email</label>
                <input value={subject} onChange={function(e) { setSubject(e.target.value); }} className="input" placeholder="Ne manquez pas la rentree 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenu de l'email</label>
                <EmailEditor
                  onChange={function(blocks, html) {
                    setEmailBlocks(blocks);
                    setBody(JSON.stringify(blocks));
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary" disabled={isPending}>Annuler</button>
          <div className="flex items-center gap-3">
            {step === 1 && (
              <button onClick={function() { setStep(2); }} className="btn-primary" disabled={!name.trim()}>
                Suivant <ArrowRight size={14} />
              </button>
            )}
            {step === 2 && (
              <>
                <button onClick={function() { setStep(1); }} className="btn-secondary">Retour</button>
                <button onClick={handleCreate} disabled={isPending || !subject.trim() || !body.trim()} className="btn-primary">
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Creer la campagne
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
