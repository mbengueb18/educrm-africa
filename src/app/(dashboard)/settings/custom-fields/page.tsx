"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getCustomFields, addCustomField, updateCustomField, deleteCustomField, getUnmappedFields,
  type CustomFieldConfig,
} from "@/lib/custom-fields";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2,
  Eye, EyeOff, Tag, AlertTriangle, Zap, Settings2,
} from "lucide-react";
import Link from "next/link";

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomFieldConfig[]>([]);
  const [unmapped, setUnmapped] = useState<{ field: string; count: number; sampleValue: string }[]>([]);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    getCustomFields().then(setFields).catch(() => {});
    getUnmappedFields().then(setUnmapped).catch(() => {});
  }, []);

  const handleAdd = (field: Omit<CustomFieldConfig, "id" | "order">) => {
    startTransition(async () => {
      try {
        const newField = await addCustomField(field);
        setFields((prev) => [...prev, newField]);
        setShowAddForm(false);
        toast.success(`Champ "${field.label}" ajouté`);
        getUnmappedFields().then(setUnmapped);
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleDelete = (fieldId: string, label: string) => {
    if (!confirm(`Supprimer le champ "${label}" ? Les données existantes seront conservées.`)) return;
    startTransition(async () => {
      try {
        await deleteCustomField(fieldId);
        setFields((prev) => prev.filter((f) => f.id !== fieldId));
        toast.success("Champ supprimé");
        getUnmappedFields().then(setUnmapped);
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  const handleToggle = (fieldId: string, key: "showInCard" | "showInList", value: boolean) => {
    startTransition(async () => {
      try {
        await updateCustomField(fieldId, { [key]: value });
        setFields((prev) => prev.map((f) => f.id === fieldId ? { ...f, [key]: value } : f));
      } catch (e: any) {
        toast.error(e.message);
      }
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Champs personnalisés</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configurez les champs supplémentaires captés depuis les formulaires de votre site
          </p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary text-sm">
          <Plus size={16} /> Ajouter un champ
        </button>
      </div>

      {/* Unmapped fields alert */}
      {unmapped.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              {unmapped.length} champ{unmapped.length > 1 ? "s" : ""} non mappé{unmapped.length > 1 ? "s" : ""} détecté{unmapped.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-amber-700 mb-3">
            Ces champs ont été captés depuis vos formulaires mais ne sont pas encore configurés. Créez un champ personnalisé pour les organiser.
          </p>
          <div className="flex flex-wrap gap-2">
            {unmapped.map((u) => (
              <button
                key={u.field}
                onClick={() => {
                  setShowAddForm(true);
                  // Pre-fill will happen via the form
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-amber-200 text-sm hover:border-amber-400 transition-colors"
              >
                <Tag size={12} className="text-amber-500" />
                <span className="font-medium text-gray-700">{u.field}</span>
                <span className="text-xs text-gray-400">({u.count}x)</span>
                <span className="text-xs text-gray-400 truncate max-w-[120px]">ex: {u.sampleValue}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <AddFieldForm
          onAdd={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={isPending}
          unmappedSuggestions={unmapped}
        />
      )}

      {/* Fields list */}
      {fields.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-[1fr_180px_120px_80px_80px_40px] gap-3 text-xs font-medium text-gray-500">
              <span>Champ</span>
              <span>Champs formulaire mappés</span>
              <span>Type</span>
              <span className="text-center">Carte</span>
              <span className="text-center">Liste</span>
              <span></span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {fields.map((field) => (
              <div key={field.id} className="grid grid-cols-[1fr_180px_120px_80px_80px_40px] gap-3 items-center px-4 py-3 hover:bg-gray-50/50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{field.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{field.key}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {field.mappedFormFields.map((mf) => (
                    <span key={mf} className="badge badge-blue text-[10px]">{mf}</span>
                  ))}
                </div>
                <span className="badge badge-gray text-[10px] w-fit">{field.type}</span>
                <div className="text-center">
                  <button
                    onClick={() => handleToggle(field.id, "showInCard", !field.showInCard)}
                    className={`p-1.5 rounded ${field.showInCard ? "text-brand-600 bg-brand-50" : "text-gray-300"}`}
                  >
                    {field.showInCard ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <div className="text-center">
                  <button
                    onClick={() => handleToggle(field.id, "showInList", !field.showInList)}
                    className={`p-1.5 rounded ${field.showInList ? "text-brand-600 bg-brand-50" : "text-gray-300"}`}
                  >
                    {field.showInList ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => handleDelete(field.id, field.label)}
                  className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : !showAddForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Settings2 size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun champ personnalisé</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Les champs personnalisés vous permettent de capturer des données spécifiques à votre école depuis les formulaires web (niveau d&apos;études, série du Bac, nationalité, etc.)
          </p>
          <button onClick={() => setShowAddForm(true)} className="btn-primary">
            <Plus size={16} /> Créer un champ
          </button>
        </div>
      ) : null}

      {/* How it works */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h3 className="font-semibold text-gray-900 mb-4">Comment ça fonctionne</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">1</div>
            <p>Un formulaire sur votre site contient un champ non reconnu (ex: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">niveau_actuel</code>)</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">2</div>
            <p>Le code de suivi EduCRM capture la valeur et l&apos;envoie comme champ personnalisé</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">3</div>
            <p>Vous configurez ici le mapping : <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">niveau_actuel</code> → &quot;Niveau d&apos;études actuel&quot;</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">4</div>
            <p>Le champ s&apos;affiche dans la fiche lead et peut être visible sur les cartes Kanban</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add field form ───
function AddFieldForm({
  onAdd,
  onCancel,
  isPending,
  unmappedSuggestions,
}: {
  onAdd: (field: Omit<CustomFieldConfig, "id" | "order">) => void;
  onCancel: () => void;
  isPending: boolean;
  unmappedSuggestions: { field: string; count: number; sampleValue: string }[];
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<CustomFieldConfig["type"]>("text");
  const [mappedFields, setMappedFields] = useState("");
  const [options, setOptions] = useState("");
  const [showInCard, setShowInCard] = useState(false);
  const [showInList, setShowInList] = useState(true);

  // Auto-generate key from label
  const handleLabelChange = (v: string) => {
    setLabel(v);
    if (!key || key === toKey(label)) {
      setKey(toKey(v));
    }
  };

  function toKey(s: string) {
    return s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  // Pre-fill from unmapped suggestion
  const fillFromUnmapped = (field: string, sample: string) => {
    setMappedFields((prev) => prev ? `${prev}, ${field}` : field);
    if (!label) {
      // Turn "niveau_actuel" into "Niveau actuel"
      const nice = field.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      setLabel(nice);
      setKey(toKey(nice));
    }
  };

  const handleSubmit = () => {
    if (!label.trim() || !key.trim()) {
      toast.error("Le label et la clé sont requis");
      return;
    }
    onAdd({
      label: label.trim(),
      key: key.trim(),
      type,
      mappedFormFields: mappedFields.split(",").map((s) => s.trim()).filter(Boolean),
      options: type === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      required: false,
      showInCard,
      showInList,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-brand-200 p-6 mb-6 animate-scale-in">
      <h3 className="font-semibold text-gray-900 mb-4">Nouveau champ personnalisé</h3>

      {/* Suggestions from unmapped */}
      {unmappedSuggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Suggestions depuis vos formulaires :</p>
          <div className="flex flex-wrap gap-2">
            {unmappedSuggestions.map((u) => (
              <button
                key={u.field}
                onClick={() => fillFromUnmapped(u.field, u.sampleValue)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-50 rounded-lg text-xs text-brand-700 hover:bg-brand-100 transition-colors"
              >
                <Zap size={11} />
                {u.field}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label (affiché dans le CRM) *
          </label>
          <input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="input"
            placeholder="Niveau d'études actuel"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clé interne *
          </label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="input font-mono text-sm"
            placeholder="niveau_etudes"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
            <option value="text">Texte</option>
            <option value="select">Liste déroulante</option>
            <option value="number">Nombre</option>
            <option value="date">Date</option>
            <option value="email">Email</option>
            <option value="phone">Téléphone</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Noms de champs formulaire (séparés par des virgules)
          </label>
          <input
            value={mappedFields}
            onChange={(e) => setMappedFields(e.target.value)}
            className="input"
            placeholder="niveau_actuel, niveau, education_level"
          />
          <p className="text-[11px] text-gray-400 mt-1">Tous les noms de champs de formulaire qui correspondent à ce champ CRM</p>
        </div>
      </div>

      {type === "select" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Options (séparées par des virgules)
          </label>
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            className="input"
            placeholder="Terminale, Bac, Bac+1, Bac+2, Bac+3, Bac+4, Autre"
          />
        </div>
      )}

      <div className="flex items-center gap-6 mt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInCard} onChange={(e) => setShowInCard(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          Afficher sur les cartes Kanban
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInList} onChange={(e) => setShowInList(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600" />
          Afficher dans la liste étudiants
        </label>
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <button onClick={onCancel} className="btn-secondary" disabled={isPending}>Annuler</button>
        <button onClick={handleSubmit} className="btn-primary" disabled={isPending}>
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Ajouter le champ
        </button>
      </div>
    </div>
  );
}
