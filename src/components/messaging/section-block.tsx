"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Type, Image, Square, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface SectionColumn {
  id: string;
  width: string;
  content: string;
  contentType?: "text" | "image" | "button" | "";
}

export interface SectionLayout {
  id: string;
  label: string;
  columns: string[];
}

export var SECTION_LAYOUTS: SectionLayout[] = [
  { id: "1", label: "1 colonne", columns: ["100%"] },
  { id: "2", label: "2 colonnes", columns: ["50%", "50%"] },
  { id: "3", label: "3 colonnes", columns: ["33.33%", "33.33%", "33.33%"] },
  { id: "1-2", label: "1/3 : 2/3", columns: ["33.33%", "66.66%"] },
  { id: "2-1", label: "2/3 : 1/3", columns: ["66.66%", "33.33%"] },
  { id: "4", label: "4 colonnes", columns: ["25%", "25%", "25%", "25%"] },
];

interface SectionBlockProps {
  columns: SectionColumn[];
  bgColor: string;
  padding: string;
  onColumnsChange: (columns: SectionColumn[]) => void;
}

export function SectionBlock({ columns, bgColor, padding, onColumnsChange }: SectionBlockProps) {
  var [activeCol, setActiveCol] = useState<string | null>(null);
  var [showInsert, setShowInsert] = useState<string | null>(null);
  var [showImageInput, setShowImageInput] = useState<string | null>(null);
  var [imageUrl, setImageUrl] = useState("");
  var fileInputRef = useRef<HTMLInputElement>(null);
  var [uploadingCol, setUploadingCol] = useState<string | null>(null);
  var activeFileColRef = useRef<string | null>(null);

  var updateColumn = function(colId: string, content: string, contentType: string) {
    onColumnsChange(columns.map(function(c) {
      return c.id === colId ? { ...c, content: content, contentType: contentType as any } : c;
    }));
  };

  var clearColumn = function(colId: string) {
    updateColumn(colId, "", "");
    setShowInsert(null);
    setShowImageInput(null);
  };

  var insertText = function(colId: string) {
    updateColumn(colId, '<p style="margin:0;font-size:15px;color:#555;line-height:1.6;text-align:center;">Votre texte ici</p>', "text");
    setShowInsert(null);
  };

  var insertButton = function(colId: string) {
    updateColumn(colId, '<div style="text-align:center;padding:8px 0;"><a href="#" style="display:inline-block;padding:12px 28px;background:#1B4F72;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Cliquez ici</a></div>', "button");
    setShowInsert(null);
  };

  var insertImageFromUrl = function(colId: string) {
    if (!imageUrl.trim()) return;
    updateColumn(colId, '<div style="text-align:center;"><img src="' + imageUrl.trim() + '" style="max-width:100%;width:100%;border-radius:6px;display:block;" /></div>', "image");
    setImageUrl("");
    setShowImageInput(null);
  };

  var handleImageUpload = async function(colId: string, file: File) {
    setUploadingCol(colId);
    try {
      var formData = new FormData();
      formData.append("file", file);
      var res = await fetch("/api/upload", { method: "POST", body: formData });
      var data = await res.json();
      if (data.success) {
        updateColumn(colId, '<div style="text-align:center;"><img src="' + data.url + '" style="max-width:100%;width:100%;border-radius:6px;display:block;" /></div>', "image");
        toast.success("Image ajoutee");
      } else {
        toast.error(data.error || "Erreur upload");
      }
    } catch {
      toast.error("Erreur upload");
    }
    setUploadingCol(null);
    setShowImageInput(null);
  };

  return (
    <div
      className="flex gap-2 rounded-lg"
      style={{ backgroundColor: bgColor || "transparent", padding: padding || "12px" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={function(e) {
          var file = e.target.files?.[0];
          if (file && activeFileColRef.current) {
            handleImageUpload(activeFileColRef.current, file);
          }
          e.target.value = "";
        }}
      />

      {columns.map(function(col) {
        var isActive = col.id === activeCol;
        var hasContent = col.content && col.content.trim().length > 0;
        var isInserting = showInsert === col.id;
        var isImageInput = showImageInput === col.id;
        var isUploading = uploadingCol === col.id;

        return (
          <div
            key={col.id}
            style={{ width: col.width }}
            className={cn(
              "relative rounded-lg border-2 transition-all overflow-hidden",
              isActive ? "border-brand-400 bg-white shadow-sm" : "border-dashed border-gray-200 bg-white/80 hover:border-gray-300"
            )}
            onClick={function(e) { e.stopPropagation(); setActiveCol(col.id); }}
          >
            {/* ─── Column has content ─── */}
            {hasContent && (
              <div className="relative group/col">
                {/* Content display */}
                {col.contentType === "text" ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full outline-none p-4 text-sm leading-relaxed min-h-[80px] flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: col.content }}
                    onBlur={function(e) {
                      updateColumn(col.id, e.currentTarget.innerHTML, "text");
                    }}
                  />
                ) : (
                  <div
                    className="p-3 min-h-[80px] flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: col.content }}
                  />
                )}

                {/* Hover overlay with actions */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity z-10">
                  <button
                    onClick={function(e) { e.stopPropagation(); clearColumn(col.id); setShowInsert(col.id); }}
                    className="p-1 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300"
                    title="Changer"
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    onClick={function(e) { e.stopPropagation(); clearColumn(col.id); }}
                    className="p-1 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* ─── Empty column: show insert menu ─── */}
            {!hasContent && !isInserting && !isImageInput && (
              <div className="flex flex-col items-center justify-center min-h-[100px] py-4">
                <button
                  onClick={function(e) { e.stopPropagation(); setShowInsert(col.id); setActiveCol(col.id); }}
                  className="w-10 h-10 bg-gray-100 hover:bg-brand-50 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors"
                >
                  <Plus size={20} />
                </button>
                <p className="text-[10px] text-gray-300 mt-2">Ajouter</p>
              </div>
            )}

            {/* ─── Insert type picker ─── */}
            {isInserting && !isImageInput && (
              <div className="flex flex-col items-center justify-center min-h-[100px] py-4 gap-2">
                <p className="text-[10px] text-gray-500 font-medium">Inserer :</p>
                <div className="flex gap-2">
                  <InsertBtn icon={Type} label="Texte" onClick={function() { insertText(col.id); }} />
                  <InsertBtn icon={Image} label="Image" onClick={function() { setShowImageInput(col.id); }} />
                  <InsertBtn icon={Square} label="Bouton" onClick={function() { insertButton(col.id); }} />
                </div>
                <button onClick={function(e) { e.stopPropagation(); setShowInsert(null); }} className="text-[10px] text-gray-400 hover:text-gray-600 mt-1">
                  Annuler
                </button>
              </div>
            )}

            {/* ─── Image input (URL or upload) ─── */}
            {isImageInput && (
              <div className="flex flex-col items-center justify-center min-h-[100px] py-4 gap-2 px-3">
                <p className="text-xs font-medium text-gray-700">Ajouter une image</p>
                <button
                  onClick={function(e) {
                    e.stopPropagation();
                    activeFileColRef.current = col.id;
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  className="w-full px-3 py-2 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 text-center"
                >
                  {isUploading ? "Upload..." : "Depuis l'ordinateur"}
                </button>
                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400">ou</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="flex gap-1 w-full">
                  <input
                    value={imageUrl}
                    onChange={function(e) { setImageUrl(e.target.value); }}
                    placeholder="https://..."
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:border-brand-500"
                    onClick={function(e) { e.stopPropagation(); }}
                    onKeyDown={function(e) { if (e.key === "Enter") insertImageFromUrl(col.id); }}
                  />
                  <button onClick={function(e) { e.stopPropagation(); insertImageFromUrl(col.id); }} className="px-2 py-1.5 bg-brand-600 text-white text-[10px] rounded">
                    OK
                  </button>
                </div>
                <button onClick={function(e) { e.stopPropagation(); setShowImageInput(null); setShowInsert(col.id); setImageUrl(""); }} className="text-[10px] text-gray-400 hover:text-gray-600">
                  Retour
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InsertBtn({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button
      onClick={function(e) { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
    >
      <Icon size={18} className="text-gray-500" />
      <span className="text-[10px] text-gray-600">{label}</span>
    </button>
  );
}

// ─── Layout picker ───
interface SectionLayoutPickerProps {
  onSelect: (layout: SectionLayout) => void;
  onClose: () => void;
}

export function SectionLayoutPicker({ onSelect, onClose }: SectionLayoutPickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-0 left-full ml-2 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-3 animate-scale-in w-[260px]">
        <p className="text-xs font-semibold text-gray-700 mb-2">Disposition</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SECTION_LAYOUTS.map(function(layout) {
            return (
              <button
                key={layout.id}
                onClick={function() { onSelect(layout); }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all group"
              >
                <div className="flex gap-0.5 w-full h-7">
                  {layout.columns.map(function(width, i) {
                    return <div key={i} style={{ width: width }} className="bg-gray-200 rounded-sm group-hover:bg-brand-300 transition-colors" />;
                  })}
                </div>
                <span className="text-[9px] text-gray-500 group-hover:text-brand-600">{layout.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Helpers ───
export function createSectionColumns(layout: SectionLayout): SectionColumn[] {
  return layout.columns.map(function(width, i) {
    return {
      id: Date.now().toString() + "-col-" + i,
      width: width,
      content: "",
      contentType: "",
    };
  });
}

export function sectionToHtml(columns: SectionColumn[], bgColor: string, padding: string): string {
  var cellsHtml = columns.map(function(col) {
    var widthPct = parseFloat(col.width);
    return '<td style="width:' + widthPct + '%;vertical-align:middle;padding:8px;text-align:center;">' +
      '<div style="font-size:15px;line-height:1.6;color:#555;">' +
      (col.content || "&nbsp;") +
      "</div></td>";
  }).join("");

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="' +
    (bgColor ? "background-color:" + bgColor + ";" : "") +
    (padding ? "padding:" + padding + ";" : "") +
    '"><tr>' + cellsHtml + "</tr></table>";
}