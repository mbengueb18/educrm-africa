"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X, Download, FileSpreadsheet, Check, Loader2,
  ChevronDown, ChevronUp,
} from "lucide-react";

interface ExportCSVModalProps {
  open: boolean;
  onClose: () => void;
  crmFields?: any[];
}

var DEFAULT_FIELDS = [
  { key: "firstName", label: "Prenom", group: "Contact", checked: true },
  { key: "lastName", label: "Nom", group: "Contact", checked: true },
  { key: "phone", label: "Telephone", group: "Contact", checked: true },
  { key: "email", label: "Email", group: "Contact", checked: true },
  { key: "whatsapp", label: "WhatsApp", group: "Contact", checked: false },
  { key: "city", label: "Ville", group: "Contact", checked: true },
  { key: "gender", label: "Genre", group: "Contact", checked: false },
  { key: "dateOfBirth", label: "Date de naissance", group: "Contact", checked: false },
  { key: "source", label: "Source", group: "Acquisition", checked: true },
  { key: "sourceDetail", label: "Detail source", group: "Acquisition", checked: false },
  { key: "programName", label: "Filiere", group: "Formation", checked: true },
  { key: "campusCity", label: "Campus", group: "Formation", checked: true },
  { key: "stageName", label: "Etape", group: "Pipeline", checked: true },
  { key: "score", label: "Score", group: "Pipeline", checked: true },
  { key: "assignedToName", label: "Assigne a", group: "Pipeline", checked: false },
  { key: "createdAt", label: "Date creation", group: "Pipeline", checked: true },
  { key: "isConverted", label: "Converti", group: "Pipeline", checked: false },
];

export function ExportCSVModal({ open, onClose, crmFields }: ExportCSVModalProps) {
  // Build fields list from dynamic props or defaults
  var allFields = DEFAULT_FIELDS.map(function(f) { return { ...f }; });

  // Add custom fields from crmFields
  if (crmFields) {
    crmFields.forEach(function(cf: any) {
      if (cf.source === "custom" || cf.source === "unmapped") {
        var exists = allFields.some(function(f) { return f.key === cf.key; });
        if (!exists) {
          allFields.push({
            key: "custom_" + cf.key,
            label: cf.label,
            group: "Personnalises",
            checked: false,
          });
        }
      }
    });
  }

  var [fields, setFields] = useState(allFields);
  var [exporting, setExporting] = useState(false);
  var [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  var toggleField = function(key: string) {
    setFields(fields.map(function(f) {
      return f.key === key ? { ...f, checked: !f.checked } : f;
    }));
  };

  var selectAll = function() {
    setFields(fields.map(function(f) { return { ...f, checked: true }; }));
  };

  var deselectAll = function() {
    setFields(fields.map(function(f) { return { ...f, checked: false }; }));
  };

  var toggleGroup = function(group: string) {
    var groupFields = fields.filter(function(f) { return f.group === group; });
    var allChecked = groupFields.every(function(f) { return f.checked; });
    setFields(fields.map(function(f) {
      return f.group === group ? { ...f, checked: !allChecked } : f;
    }));
  };

  var toggleCollapse = function(group: string) {
    setCollapsedGroups(function(prev) {
      var next = { ...prev };
      next[group] = !next[group];
      return next;
    });
  };

  var selectedCount = fields.filter(function(f) { return f.checked; }).length;

  // Build groups
  var groups: string[] = [];
  fields.forEach(function(f) {
    if (groups.indexOf(f.group) === -1) groups.push(f.group);
  });

  var handleExport = async function() {
    var selected = fields.filter(function(f) { return f.checked; });
    if (selected.length === 0) {
      toast.error("Selectionnez au moins un champ");
      return;
    }

    setExporting(true);
    try {
      var fieldKeys = selected.map(function(f) { return f.key; }).join(",");
      var res = await fetch("/api/leads/export?fields=" + encodeURIComponent(fieldKeys));
      if (!res.ok) throw new Error("Erreur export");
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "leads-educrm-" + new Date().toISOString().split("T")[0] + ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(selected.length + " champs exportes");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'export");
    }
    setExporting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-brand-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Exporter les leads</h2>
              <p className="text-xs text-gray-500">Choisissez les champs a inclure dans le CSV</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Select all / none */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs text-gray-500">{selectedCount} / {fields.length} champs selectionnes</span>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium">Tout selectionner</button>
            <span className="text-gray-300">|</span>
            <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700">Tout deselectionner</button>
          </div>
        </div>

        {/* Fields list by group */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {groups.map(function(group) {
            var groupFields = fields.filter(function(f) { return f.group === group; });
            var checkedCount = groupFields.filter(function(f) { return f.checked; }).length;
            var allChecked = checkedCount === groupFields.length;
            var isCollapsed = collapsedGroups[group];

            return (
              <div key={group} className="mb-3">
                {/* Group header */}
                <div className="flex items-center justify-between py-2">
                  <button onClick={function() { toggleCollapse(group); }} className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900">
                    {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    {group}
                    <span className="text-gray-400 font-normal normal-case">({checkedCount}/{groupFields.length})</span>
                  </button>
                  <button
                    onClick={function() { toggleGroup(group); }}
                    className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                      allChecked ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {allChecked ? "Deselectionner" : "Tout cocher"}
                  </button>
                </div>

                {/* Fields */}
                {!isCollapsed && (
                  <div className="space-y-1 ml-1">
                    {groupFields.map(function(field) {
                      return (
                        <label key={field.key} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={field.checked}
                            onChange={function() { toggleField(field.key); }}
                            className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">{field.label}</span>
                          </div>
                          {field.checked && (
                            <Check size={14} className="text-brand-500 shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="btn-secondary py-2 text-sm">
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={selectedCount === 0 || exporting}
            className={cn("btn-primary py-2 text-sm", selectedCount === 0 && "opacity-50 cursor-not-allowed")}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exporter {selectedCount} champs
          </button>
        </div>
      </div>
    </div>
  );
}
