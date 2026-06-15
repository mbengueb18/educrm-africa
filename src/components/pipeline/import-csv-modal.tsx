"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X, Upload, FileSpreadsheet, ArrowRight, ArrowLeft,
  Check, AlertCircle, Loader2, Zap, Eye, Users, Plus,
} from "lucide-react";
import { importLeadsFromCSV } from "@/app/(dashboard)/pipeline/actions";
import { createAudienceFromImport } from "@/app/(dashboard)/audiences/actions";
import { addCustomField } from "@/lib/custom-fields";

interface ImportCSVModalProps {
  open: boolean;
  onClose: (imported?: boolean) => void;
  programs: { id: string; name: string }[];
  crmFields?: any[];
}

interface CSVColumn {
  name: string;
  samples: string[];
  mappedTo: string | null;
  autoMapped: boolean;
}

// Parseur CSV robuste : gère les guillemets, séparateurs et sauts de ligne dans les cellules
function parseCSVText(text: string, sep: string): string[][] {
  var rows: string[][] = [];
  var field = "";
  var row: string[] = [];
  var inQuotes = false;
  var i = 0;
  // Normalise les fins de ligne Windows/Mac
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < text.length) {
    var char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // guillemet échappé ("")
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === sep) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  // Dernier champ / dernière ligne
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Retire les lignes entièrement vides
  return rows.filter(function(r) {
    return r.some(function(c) { return c.trim() !== ""; });
  });
}

export function ImportCSVModal({ open, onClose, programs, crmFields }: ImportCSVModalProps) {

  // ─── Build CRM fields from dynamic properties or fallback ───
  var CRM_FIELDS: any[] = (crmFields || []).map(function(f: any) {
    return {
      key: f.key,
      label: f.label,
      group: f.group === "contact" ? "Contact" :
             f.group === "acquisition" ? "Acquisition" :
             f.group === "formation" ? "Formation" :
             f.group === "pipeline" ? "Pipeline" :
             f.group === "custom" ? "Personnalisés" :
             f.group === "unmapped" ? "Non mappes" : f.group,
      required: f.key === "firstName" || f.key === "lastName",
      source: f.source,
    };
  }).filter(function(f: any) {
    var excludeKeys = ["stageId", "assignedToId", "campaignId", "score", "isConverted", "convertedAt"];
    return !excludeKeys.includes(f.key);
  });

  if (CRM_FIELDS.length === 0) {
    CRM_FIELDS = [
      { key: "firstName", label: "Prénom", group: "Contact", required: true, source: "system" },
      { key: "lastName", label: "Nom", group: "Contact", required: true, source: "system" },
      { key: "phone", label: "Téléphone", group: "Contact", required: false, source: "system" },
      { key: "email", label: "Email", group: "Contact", required: false, source: "system" },
      { key: "whatsapp", label: "WhatsApp", group: "Contact", required: false, source: "system" },
      { key: "city", label: "Ville", group: "Contact", required: false, source: "system" },
      { key: "source", label: "Source", group: "Acquisition", required: false, source: "system" },
      { key: "sourceDetail", label: "Detail source", group: "Acquisition", required: false, source: "system" },
      { key: "programId", label: "Filière", group: "Formation", required: false, source: "system" },
      { key: "campusId", label: "Campus", group: "Formation", required: false, source: "system" },
    ];
  }

  // Champs custom créés à la volée pendant cet import (ajoutés à la liste des cibles)
  var [extraFields, setExtraFields] = useState<any[]>([]);
  var ALL_FIELDS = CRM_FIELDS.concat(extraFields);

  var fieldGroups: string[] = [];
  ALL_FIELDS.forEach(function(f: any) {
    if (fieldGroups.indexOf(f.group) === -1) fieldGroups.push(f.group);
  });

  // ─── Auto-mapping dictionary ───
  var AUTO_MAP: Record<string, string> = {
    "prenom": "firstName", "prénom": "firstName", "firstname": "firstName", "first_name": "firstName", "fname": "firstName", "first name": "firstName",
    "nom": "lastName", "lastname": "lastName", "last_name": "lastName", "lname": "lastName", "surname": "lastName", "last name": "lastName", "nom de famille": "lastName",
    "telephone": "phone", "téléphone": "phone", "phone": "phone", "tel": "phone", "mobile": "phone", "portable": "phone", "numero": "phone", "numéro": "phone",
    "email": "email", "e-mail": "email", "mail": "email", "courriel": "email", "adresse email": "email", "adresse mail": "email",
    "whatsapp": "whatsapp", "wa": "whatsapp",
    "ville": "city", "city": "city", "adresse": "city", "localite": "city", "localité": "city",
    "source": "source", "origine": "source", "canal": "source",
    "filiere": "programCode", "filière": "programCode", "formation": "programCode", "programme": "programCode", "program": "programCode", "cursus": "programCode",
    "detail": "sourceDetail", "detail source": "sourceDetail", "source detail": "sourceDetail", "commentaire": "sourceDetail",
  };

  CRM_FIELDS.forEach(function(f: any) {
    var labelLower = f.label.toLowerCase();
    if (!AUTO_MAP[labelLower]) AUTO_MAP[labelLower] = f.key;
    var keyLower = f.key.toLowerCase();
    if (!AUTO_MAP[keyLower]) AUTO_MAP[keyLower] = f.key;
  });

  // ─── State ───
  var [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  var [file, setFile] = useState<File | null>(null);
  var [rawText, setRawText] = useState<string>("");
  var [separator, setSeparator] = useState(";");
  var [columns, setColumns] = useState<CSVColumn[]>([]);
  var [dataRows, setDataRows] = useState<string[][]>([]);
  var [importing, setImporting] = useState(false);
  var [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
    audienceId?: string;
    audienceName?: string;
  } | null>(null);
  var [createAudience, setCreateAudience] = useState(false);
  var [audienceName, setAudienceName] = useState("");
  var [creatingForCol, setCreatingForCol] = useState<number | null>(null);
  var [newFieldLabel, setNewFieldLabel] = useState("");
  var [newFieldType, setNewFieldType] = useState<"text" | "number" | "date" | "email" | "phone" | "select">("text");
  var [creatingField, setCreatingField] = useState(false);
  var fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Step 1: File upload ───
  var handleFileSelect = function(e: React.ChangeEvent<HTMLInputElement>) {
    var f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    var fileNameWithoutExt = f.name.replace(/\.[^.]+$/, "");
    setAudienceName("Import — " + fileNameWithoutExt);
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = ev.target?.result as string;
      // Détecte le séparateur sur la première ligne (avant le premier saut de ligne)
      var firstLine = text.split("\n")[0] || "";
      var sepDetected = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
      setSeparator(sepDetected);
      // Stocke le texte brut complet pour re-parser si on change de séparateur
      setRawText(text);
      parseWithSeparator(text, sepDetected);
    };
    reader.readAsText(f);
  };

  var parseWithSeparator = function(text: string, sep: string) {
    var allRows = parseCSVText(text, sep);
    if (allRows.length < 2) {
      toast.error("Le fichier doit contenir au moins un en-tete et une ligne de données");
      return;
    }

    var headerCells = allRows[0].map(function(h) { return h.trim(); });
    var rows = allRows.slice(1).map(function(r) {
      return r.map(function(c) { return c.trim(); });
    });
    setDataRows(rows);

    var usedFields = new Set<string>();
    var cols: CSVColumn[] = headerCells.map(function(name, idx) {
      var samples = rows.slice(0, 5).map(function(r) { return r[idx] || ""; }).filter(function(s) { return s; });
      var normalized = name.toLowerCase().trim();
      var autoField = AUTO_MAP[normalized] || null;
      if (autoField && usedFields.has(autoField)) autoField = null;
      if (autoField) usedFields.add(autoField);
      return { name: name, samples: samples, mappedTo: autoField, autoMapped: autoField !== null };
    });
    setColumns(cols);
    setStep(2);
  };

  var handleSeparatorChange = function(newSep: string) {
    setSeparator(newSep);
    if (rawText) parseWithSeparator(rawText, newSep);
  };
  

  // ─── Step 2: Field mapping ───
  var handleMapField = function(colIndex: number, fieldKey: string | null) {
    setColumns(columns.map(function(col, i) {
      if (i !== colIndex) {
        if (fieldKey && col.mappedTo === fieldKey) return { ...col, mappedTo: null, autoMapped: false };
        return col;
      }
      return { ...col, mappedTo: fieldKey, autoMapped: false };
    }));
  };

  var handleCreateField = async function(colIndex: number) {
    if (!newFieldLabel.trim()) { toast.error("Donnez un nom au champ"); return; }
    setCreatingField(true);
    try {
      // key générée à partir du label (slug simple)
      var key = newFieldLabel.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

      var created = await addCustomField({
        label: newFieldLabel.trim(),
        key: key,
        type: newFieldType,
        mappedFormFields: [],
        required: false,
        showInCard: false,
        showInList: true,
        target: "custom",
      });

      // Ajoute le champ à la liste des cibles (groupe Personnalisés)
      setExtraFields(function(prev) {
        return prev.concat([{
          key: created.key,
          label: created.label,
          group: "Personnalisés",
          required: false,
          source: "custom",
        }]);
      });

      // Mappe automatiquement la colonne vers ce nouveau champ
      handleMapField(colIndex, created.key);

      toast.success('Champ "' + created.label + '" créé');
      setCreatingForCol(null);
      setNewFieldLabel("");
      setNewFieldType("text");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création du champ");
    }
    setCreatingField(false);
  };

  var mappedCount = columns.filter(function(c) { return c.mappedTo; }).length;
  var hasFirstName = columns.some(function(c) { return c.mappedTo === "firstName"; });
  var hasLastName = columns.some(function(c) { return c.mappedTo === "lastName"; });
  var hasContact = columns.some(function(c) { return c.mappedTo === "phone" || c.mappedTo === "email"; });
  var canProceed = hasFirstName && hasLastName && hasContact;

  // ─── Step 3: Preview ───
  var getPreviewData = function() {
    return dataRows.slice(0, 10).map(function(row) {
      var mapped: Record<string, string> = {};
      columns.forEach(function(col, idx) {
        if (col.mappedTo && row[idx]) mapped[col.mappedTo] = row[idx];
      });
      return mapped;
    });
  };

  // ─── Step 4: Import ───
  var handleImport = async function() {
    setImporting(true);
    setStep(4);
    try {
      var rows = dataRows.map(function(row) {
        var mapped: any = {};
        columns.forEach(function(col, idx) {
          if (col.mappedTo && row[idx]) mapped[col.mappedTo] = row[idx];
        });
        return mapped;
      }).filter(function(r) { return r.firstName || r.lastName; });

      var res: any = await importLeadsFromCSV(rows);

      // Création optionnelle d'une audience à partir des leads importés
      var audienceData: { audienceId?: string; audienceName?: string } = {};
      if (createAudience && audienceName.trim() && res.createdLeadIds && res.createdLeadIds.length > 0) {
        try {
          var audience = await createAudienceFromImport(
            audienceName.trim(),
            res.createdLeadIds,
            {
              filename: file?.name || undefined,
              importedRows: res.created,
              skippedRows: res.skipped,
            }
          );
          audienceData.audienceId = audience.id;
          audienceData.audienceName = audience.name;
        } catch (audErr: any) {
          // L'erreur d'audience ne doit pas bloquer le succès de l'import
          toast.error("Audience non créée : " + (audErr.message || "erreur"));
        }
      }

      setResult({ ...res, ...audienceData });
    } catch (err: any) {
      setResult({ created: 0, skipped: 0, errors: [err.message || "Erreur import"] });
    }
    setImporting(false);
  };

  var resetAndClose = function(imported?: boolean) {
    setStep(1); setFile(null); setRawText(""); setColumns([]); setDataRows([]); setResult(null);
    setCreateAudience(false); setAudienceName("");
    onClose(imported);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={function() { resetAndClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-brand-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Importer des leads</h2>
              <p className="text-xs text-gray-500">
                {step === 1 && "Sélectionnez votre fichier CSV"}
                {step === 2 && "Mappez les colonnes avec les champs du CRM"}
                {step === 3 && "Vérifiez les données avant l'import"}
                {step === 4 && "Import en cours..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(function(s) {
                return (
                  <div key={s} className={cn("flex items-center gap-1")}>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                      s < step ? "bg-brand-600 text-white" :
                      s === step ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500" :
                      "bg-gray-100 text-gray-400"
                    )}>
                      {s < step ? <Check size={14} /> : s}
                    </div>
                    {s < 4 && <div className={cn("w-6 h-0.5", s < step ? "bg-brand-400" : "bg-gray-200")} />}
                  </div>
                );
              })}
            </div>
            <button onClick={function() { resetAndClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-full max-w-md">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-brand-400 hover:bg-brand-50/50 transition-colors cursor-pointer"
                  onClick={function() { fileInputRef.current?.click(); }}
                >
                  <Upload size={40} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Glissez votre fichier CSV ici</p>
                  <p className="text-xs text-gray-400 mb-4">ou cliquez pour parcourir</p>
                  <button className="btn-primary py-2 px-4 text-sm mx-auto">Choisir un fichier</button>
                  <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileSelect} />
                </div>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-2">Format attendu :</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Fichier CSV ou TXT avec séparateur virgule (,) ou point-virgule (;)</p>
                    <p>La premiere ligne doit contenir les en-tetes de colonnes</p>
                  </div>
                  <div className="mt-3 p-2 bg-white rounded border border-gray-200 font-mono text-[10px] text-gray-500">
                    Prenom;Nom;Téléphone;Email;Ville;Filière<br />
                    Fatou;Diallo;+221771234567;fatou@email.com;Dakar;Marketing Digital
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-brand-600" />
                  <span className="text-sm font-medium text-gray-700">{file?.name}</span>
                  <span className="text-xs text-gray-400">{dataRows.length} lignes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Séparateur :</span>
                  <select value={separator} onChange={function(e) { handleSeparatorChange(e.target.value); }} className="text-xs border border-gray-200 rounded px-2 py-1">
                    <option value=";">Point-virgule (;)</option>
                    <option value=",">Virgule (,)</option>
                    <option value={"\t"}>Tabulation</option>
                  </select>
                </div>
              </div>

              {columns.some(function(c) { return c.autoMapped; }) && (
                <div className="flex items-center gap-2 mb-4 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <Zap size={14} className="text-emerald-600" />
                  <span className="text-xs text-emerald-700">{columns.filter(function(c) { return c.autoMapped; }).length} colonnes mappées automatiquement</span>
                </div>
              )}

              {!canProceed && (
                <div className="flex items-start gap-2 mb-4 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-700">
                    {!hasFirstName && <p>Mappez une colonne vers "Prenom" (requis)</p>}
                    {!hasLastName && <p>Mappez une colonne vers "Nom" (requis)</p>}
                    {!hasContact && <p>Mappez une colonne vers "Téléphone" ou "Email" (au moins un requis)</p>}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 w-[30%]">Colonne du fichier</th>
                      <th className="text-center text-xs text-gray-400 px-2 py-3 w-[30px]"></th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 w-[35%]">Champ EduCRM</th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 w-[35%]">Aperçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map(function(col, idx) {
                      return (
                        <tr key={idx} className={cn("border-t border-gray-100", col.mappedTo ? "bg-white" : "bg-gray-50/50")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", col.mappedTo ? "bg-emerald-500" : "bg-gray-300")} />
                              <span className="text-sm font-medium text-gray-800">{col.name}</span>
                            </div>
                          </td>
                          <td className="text-center px-2 py-3">
                            <ArrowRight size={14} className={cn(col.mappedTo ? "text-brand-500" : "text-gray-300")} />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={col.mappedTo || ""}
                              onChange={function(e) {
                                if (e.target.value === "__create__") {
                                  setCreatingForCol(idx);
                                  setNewFieldLabel(col.name); // pré-remplir avec le nom de la colonne
                                } else {
                                  handleMapField(idx, e.target.value || null);
                                }
                              }}
                              className={cn(
                                "w-full text-sm border rounded-lg px-3 py-2 outline-none transition-colors",
                                col.mappedTo ? "border-brand-300 bg-brand-50 text-brand-800 font-medium" : "border-gray-200 bg-white text-gray-500"
                              )}
                            >
                              <option value="">— Ne pas importer —</option>
                              <option value="__create__">➕ Créer un champ personnalisé</option>
                              {fieldGroups.map(function(group) {
                                var groupFields = ALL_FIELDS.filter(function(f: any) { return f.group === group; });
                                return (
                                  <optgroup key={group} label={group}>
                                    {groupFields.map(function(f: any) {
                                      var isUsed = columns.some(function(c, ci) { return ci !== idx && c.mappedTo === f.key; });
                                      return (
                                        <option key={f.key} value={f.key} disabled={isUsed}>
                                          {f.label} {f.required ? "*" : ""} {isUsed ? "(déjà mappé)" : ""}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                );
                              })}
                            </select>
                            {col.autoMapped && (
                              <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 mt-1"><Zap size={9} /> Auto-détecté</span>
                            )}
                            {creatingForCol === idx && (
                              <div className="mt-2 p-2.5 bg-brand-50 border border-brand-200 rounded-lg space-y-2">
                                <input
                                  type="text"
                                  value={newFieldLabel}
                                  onChange={function(e) { setNewFieldLabel(e.target.value); }}
                                  placeholder="Nom du champ"
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
                                  autoFocus
                                />
                                <select
                                  value={newFieldType}
                                  onChange={function(e) { setNewFieldType(e.target.value as any); }}
                                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                                >
                                  <option value="text">Texte</option>
                                  <option value="number">Nombre</option>
                                  <option value="date">Date</option>
                                  <option value="email">Email</option>
                                  <option value="phone">Téléphone</option>
                                  <option value="select">Liste</option>
                                </select>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={function() { handleCreateField(idx); }}
                                    disabled={creatingField || !newFieldLabel.trim()}
                                    className="btn-primary py-1.5 px-3 text-xs flex-1 justify-center"
                                  >
                                    {creatingField ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                    Créer et mapper
                                  </button>
                                  <button
                                    type="button"
                                    onClick={function() { setCreatingForCol(null); setNewFieldLabel(""); }}
                                    className="btn-secondary py-1.5 px-3 text-xs"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-400 space-y-0.5">
                              {col.samples.slice(0, 3).map(function(s, si) {
                                return <div key={si} className="truncate max-w-[180px]">{s}</div>;
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                <span>{mappedCount} / {columns.length} colonnes mappées</span>
                <span>{dataRows.length} leads à importer</span>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4 p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <Eye size={14} className="text-blue-600" />
                <span className="text-xs text-blue-700">Aperçu des 10 premiers leads. Vérifiez que les données sont correctement mappees.</span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2.5">#</th>
                      {columns.filter(function(c) { return c.mappedTo; }).map(function(col) {
                        var fieldDef = ALL_FIELDS.find(function(f: any) { return f.key === col.mappedTo; });
                        return <th key={col.mappedTo} className="text-left text-xs font-semibold text-gray-600 px-3 py-2.5">{fieldDef?.label || col.mappedTo}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {getPreviewData().map(function(row, idx) {
                      return (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                          {columns.filter(function(c) { return c.mappedTo; }).map(function(col) {
                            var val = row[col.mappedTo!] || "";
                            return <td key={col.mappedTo} className="px-3 py-2 text-xs text-gray-700">{val || <span className="text-gray-300">—</span>}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="text-xs text-gray-500"><span className="font-medium text-gray-700">{dataRows.length}</span> leads avec <span className="font-medium text-gray-700">{mappedCount}</span> champs</div>
                <div className="text-xs text-gray-400">Les doublons seront ignores automatiquement</div>
              </div>

              {/* Option : créer une audience */}
              <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createAudience}
                    onChange={(e) => setCreateAudience(e.target.checked)}
                    className="rounded border-violet-300 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-violet-600" />
                      <p className="text-sm font-semibold text-violet-900">
                        Créer une audience avec ces leads
                      </p>
                    </div>
                    <p className="text-xs text-violet-700 mt-1">
                      Les leads importés seront regroupés dans une audience statique réutilisable pour vos campagnes.
                    </p>
                    {createAudience && (
                      <div className="mt-3">
                        <label className="text-[10px] font-semibold text-violet-800 uppercase tracking-wider mb-1 block">
                          Nom de l'audience
                        </label>
                        <input
                          type="text"
                          value={audienceName}
                          onChange={(e) => setAudienceName(e.target.value)}
                          placeholder="Ex: Import Salon Septembre 2025"
                          className="input text-sm py-1.5 px-2 w-full bg-white border-violet-300"
                        />
                        <p className="text-[10px] text-violet-600 mt-1">
                          {audienceName.trim() ? `L'audience "${audienceName.trim()}" sera créée` : "Un nom est requis pour créer l'audience"}
                        </p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-12">
              {importing ? (
                <div className="text-center">
                  <Loader2 size={40} className="text-brand-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-700">Import en cours...</p>
                  <p className="text-xs text-gray-400 mt-1">{dataRows.length} leads à traiter</p>
                </div>
              ) : result ? (
                <div className="text-center w-full max-w-md">
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4", result.created > 0 ? "bg-emerald-100" : "bg-red-100")}>
                    {result.created > 0 ? <Check size={32} className="text-emerald-600" /> : <AlertCircle size={32} className="text-red-600" />}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Import terminé</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-700">{result.created}</div>
                      <div className="text-xs text-emerald-600">Leads créés</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-500">{result.skipped}</div>
                      <div className="text-xs text-gray-400">Ignores</div>
                    </div>
                  </div>

                  {/* Bandeau audience créée */}
                  {result.audienceId && result.audienceName && (
                    <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                        <Users size={18} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-semibold text-violet-900">Audience créée</p>
                        <p className="text-sm font-bold text-violet-700 truncate">{result.audienceName}</p>
                      </div>
                      <a
                        href={`/audiences/${result.audienceId}`}
                        className="btn-secondary py-1.5 px-3 text-xs text-violet-700 border-violet-300 hover:bg-violet-100 shrink-0"
                      >
                        Voir
                      </a>
                    </div>
                  )}

                  {result.errors.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3 text-left mb-4 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium text-red-700 mb-1">Erreurs :</p>
                      {result.errors.slice(0, 10).map(function(err, i) { return <p key={i} className="text-xs text-red-600">{err}</p>; })}
                    </div>
                  )}
                  <button onClick={function() { resetAndClose(result!.created > 0); }} className="btn-primary py-2.5 px-6 text-sm w-full">
                    Fermer et voir le pipeline
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {step > 1 && step < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button onClick={function() { setStep((step - 1) as any); }} className="btn-secondary py-2 text-sm">
              <ArrowLeft size={14} /> Retour
            </button>
            <div className="flex items-center gap-2">
              {step === 2 && (
                <button onClick={function() { setStep(3); }} disabled={!canProceed} className={cn("btn-primary py-2 text-sm", !canProceed && "opacity-50 cursor-not-allowed")}>
                  Aperçu <ArrowRight size={14} />
                </button>
              )}
              {step === 3 && (
                <button onClick={handleImport} className="btn-primary py-2 text-sm">
                  <Upload size={14} /> Importer {dataRows.length} leads
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}