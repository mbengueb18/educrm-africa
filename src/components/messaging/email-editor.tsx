"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Image, Link2, Square, Minus, Columns2, Trash2,
  GripVertical, ChevronUp, ChevronDown, Plus, Eye, Code,
  Palette, Video, List, ListOrdered, Heading1, Heading2,
} from "lucide-react";

// ─── Block types ───
export interface EmailBlock {
  id: string;
  type: "text" | "heading" | "button" | "image" | "divider" | "spacer" | "columns" | "video";
  content: string;
  styles: Record<string, string>;
  children?: EmailBlock[];
}

interface EmailEditorProps {
  initialBlocks?: EmailBlock[];
  onChange: (blocks: EmailBlock[], html: string) => void;
  brandColor?: string;
}

const DEFAULT_BLOCKS: EmailBlock[] = [
  { id: "1", type: "text", content: "Bonjour {{prenom}},", styles: { fontSize: "16px", color: "#2C3E50" } },
  { id: "2", type: "text", content: "Ecrivez votre message ici...", styles: { fontSize: "15px", color: "#555555" } },
  { id: "3", type: "text", content: "Cordialement,\nL'equipe d'admission", styles: { fontSize: "15px", color: "#555555" } },
];

export function EmailEditor({ initialBlocks, onChange, brandColor = "#1B4F72" }: EmailEditorProps) {
  var [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks || DEFAULT_BLOCKS);
  var [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  var [draggedId, setDraggedId] = useState<string | null>(null);
  var [previewMode, setPreviewMode] = useState(false);

  var selectedBlock = blocks.find(function(b) { return b.id === selectedBlockId; });

  var updateBlocks = function(newBlocks: EmailBlock[]) {
    setBlocks(newBlocks);
    onChange(newBlocks, blocksToHtml(newBlocks, brandColor));
  };

  var addBlock = function(type: EmailBlock["type"], afterId?: string) {
    var newBlock: EmailBlock = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      type: type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type, brandColor),
    };
    var newBlocks: EmailBlock[];
    if (afterId) {
      var idx = blocks.findIndex(function(b) { return b.id === afterId; });
      newBlocks = [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];
    } else {
      newBlocks = [...blocks, newBlock];
    }
    updateBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  var updateBlock = function(id: string, updates: Partial<EmailBlock>) {
    var newBlocks = blocks.map(function(b) {
      return b.id === id ? { ...b, ...updates } : b;
    });
    updateBlocks(newBlocks);
  };

  var deleteBlock = function(id: string) {
    updateBlocks(blocks.filter(function(b) { return b.id !== id; }));
    setSelectedBlockId(null);
  };

  var moveBlock = function(id: string, direction: "up" | "down") {
    var idx = blocks.findIndex(function(b) { return b.id === id; });
    if (direction === "up" && idx > 0) {
      var newBlocks = [...blocks];
      var temp = newBlocks[idx - 1];
      newBlocks[idx - 1] = newBlocks[idx];
      newBlocks[idx] = temp;
      updateBlocks(newBlocks);
    } else if (direction === "down" && idx < blocks.length - 1) {
      var newBlocks2 = [...blocks];
      var temp2 = newBlocks2[idx + 1];
      newBlocks2[idx + 1] = newBlocks2[idx];
      newBlocks2[idx] = temp2;
      updateBlocks(newBlocks2);
    }
  };

  // Drag and drop
  var handleDragStart = function(id: string) { setDraggedId(id); };
  var handleDragOver = function(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
  };
  var handleDrop = function(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    var fromIdx = blocks.findIndex(function(b) { return b.id === draggedId; });
    var toIdx = blocks.findIndex(function(b) { return b.id === targetId; });
    var newBlocks = [...blocks];
    var moved = newBlocks.splice(fromIdx, 1)[0];
    newBlocks.splice(toIdx, 0, moved);
    updateBlocks(newBlocks);
    setDraggedId(null);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <ToolbarButton icon={Type} label="Texte" onClick={function() { addBlock("text"); }} />
          <ToolbarButton icon={Heading1} label="Titre" onClick={function() { addBlock("heading"); }} />
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton icon={Square} label="Bouton" onClick={function() { addBlock("button"); }} />
          <ToolbarButton icon={Image} label="Image" onClick={function() { addBlock("image"); }} />
          <ToolbarButton icon={Video} label="Video" onClick={function() { addBlock("video"); }} />
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton icon={Minus} label="Séparateur" onClick={function() { addBlock("divider"); }} />
          <ToolbarButton icon={Columns2} label="Espacement" onClick={function() { addBlock("spacer"); }} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={function() { setPreviewMode(!previewMode); }}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              previewMode ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-200"
            )}
          >
            {previewMode ? <Code size={13} /> : <Eye size={13} />}
            {previewMode ? "Editer" : "Aperçu"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] divide-x divide-gray-200" style={{ minHeight: "420px" }}>
        {/* Canvas */}
        <div className="p-5 bg-gray-100 overflow-y-auto" style={{ maxHeight: "520px" }}>
          {previewMode ? (
            <div className="max-w-[580px] mx-auto bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div style={{ backgroundColor: brandColor, padding: "20px 28px" }}>
                <p style={{ color: "white", fontSize: "16px", fontWeight: 600, margin: 0 }}>Aperçu de l'email</p>
              </div>
              <div className="p-6" dangerouslySetInnerHTML={{ __html: blocksToPreviewHtml(blocks, brandColor) }} />
            </div>
          ) : (
            <div className="max-w-[580px] mx-auto space-y-1">
              {blocks.map(function(block, idx) {
                var isSelected = block.id === selectedBlockId;
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={function() { handleDragStart(block.id); }}
                    onDragOver={function(e) { handleDragOver(e, block.id); }}
                    onDrop={function(e) { handleDrop(e, block.id); }}
                    onClick={function() { setSelectedBlockId(block.id); }}
                    className={cn(
                      "group relative bg-white rounded-lg border-2 transition-all cursor-pointer",
                      isSelected ? "border-brand-500 shadow-sm" : "border-transparent hover:border-gray-300",
                      draggedId === block.id && "opacity-40"
                    )}
                  >
                    {/* Block controls */}
                    <div className={cn(
                      "absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                      isSelected && "opacity-100"
                    )}>
                      <button className="p-0.5 rounded text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} />
                      </button>
                    </div>

                    {/* Block renderer */}
                    <BlockRenderer
                      block={block}
                      isSelected={isSelected}
                      brandColor={brandColor}
                      onUpdate={function(updates) { updateBlock(block.id, updates); }}
                    />

                    {/* Add block between */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={function(e) { e.stopPropagation(); addBlock("text", block.id); }}
                        className="w-5 h-5 bg-brand-600 rounded-full text-white flex items-center justify-center shadow-sm hover:bg-brand-700"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {blocks.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <Type size={28} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Cliquez sur les boutons ci-dessus pour ajouter du contenu</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Properties panel */}
        <div className="p-4 bg-white overflow-y-auto" style={{ maxHeight: "520px" }}>
          {selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              brandColor={brandColor}
              onUpdate={function(updates) { updateBlock(selectedBlock!.id, updates); }}
              onDelete={function() { deleteBlock(selectedBlock!.id); }}
              onMove={function(dir) { moveBlock(selectedBlock!.id, dir); }}
            />
          ) : (
            <div className="text-center py-8">
              <Palette size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sélectionnez un bloc pour modifier ses proprietes</p>
            </div>
          )}
        </div>
      </div>

      {/* Variables bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-200">
        <span className="text-[10px] text-gray-400">Variables :</span>
        {["{{prenom}}", "{{nom}}", "{{email}}"].map(function(v) {
          return (
            <button
              key={v}
              onClick={function() {
                if (selectedBlock && (selectedBlock.type === "text" || selectedBlock.type === "heading")) {
                  updateBlock(selectedBlock.id, { content: selectedBlock.content + " " + v });
                }
              }}
              className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100 transition-colors"
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Block Renderer ───
function BlockRenderer({ block, isSelected, brandColor, onUpdate }: {
  block: EmailBlock; isSelected: boolean; brandColor: string; onUpdate: (u: Partial<EmailBlock>) => void;
}) {
  switch (block.type) {
    case "text":
      return (
        <div className="px-4 py-3">
          <textarea
            value={block.content}
            onChange={function(e) { onUpdate({ content: e.target.value }); }}
            className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
            style={{ color: block.styles.color || "#555", fontSize: block.styles.fontSize || "15px", textAlign: (block.styles.textAlign as any) || "left" }}
            rows={Math.max(2, block.content.split("\n").length)}
            placeholder="Ecrivez votre texte..."
          />
        </div>
      );
    case "heading":
      return (
        <div className="px-4 py-3">
          <input
            value={block.content}
            onChange={function(e) { onUpdate({ content: e.target.value }); }}
            className="w-full bg-transparent border-none outline-none font-bold"
            style={{ color: block.styles.color || brandColor, fontSize: block.styles.fontSize || "22px", textAlign: (block.styles.textAlign as any) || "left" }}
            placeholder="Votre titre..."
          />
        </div>
      );
    case "button":
      return (
        <div className="px-4 py-4" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          <div
            className="inline-block px-6 py-3 rounded-lg font-semibold text-sm cursor-default"
            style={{ backgroundColor: block.styles.bgColor || brandColor, color: block.styles.color || "white", borderRadius: block.styles.borderRadius || "8px" }}
          >
            {block.content || "Cliquez ici"}
          </div>
        </div>
      );
    case "image":
      return (
        <div className="px-4 py-3" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          {block.content ? (
            <img src={block.content} alt="" className="max-w-full rounded-lg" style={{ maxHeight: "300px", width: block.styles.width || "100%" }} />
          ) : (
            <div className="bg-gray-100 rounded-lg py-8 px-4 text-center border-2 border-dashed border-gray-300">
              <Image size={28} className="text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Ajoutez l'URL de l'image dans les proprietes</p>
            </div>
          )}
        </div>
      );
    case "video":
      return (
        <div className="px-4 py-3" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          <div className="bg-gray-900 rounded-lg py-10 px-4 text-center relative overflow-hidden">
            <Video size={36} className="text-white/60 mx-auto mb-2" />
            <p className="text-xs text-white/60">{block.content || "URL de la video"}</p>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/40" />
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="px-4 py-4">
          <hr style={{ borderColor: block.styles.color || "#e5e7eb", borderWidth: block.styles.borderWidth || "1px", borderStyle: (block.styles.borderStyle as any) || "solid" }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.styles.height || "24px" }} className="relative"><div className="absolute inset-0 flex items-center justify-center"><span className="text-[9px] text-gray-300">{block.styles.height || "24px"}</span></div></div>;
    default:
      return <div className="p-4 text-sm text-gray-400">Bloc inconnu</div>;
  }
}

// ─── Block Properties Panel ───
function BlockProperties({ block, brandColor, onUpdate, onDelete, onMove }: {
  block: EmailBlock; brandColor: string;
  onUpdate: (u: Partial<EmailBlock>) => void; onDelete: () => void; onMove: (d: "up" | "down") => void;
}) {
  var updateStyle = function(key: string, value: string) {
    onUpdate({ styles: { ...block.styles, [key]: value } });
  };

  var BLOCK_LABELS: Record<string, string> = {
    text: "Texte", heading: "Titre", button: "Bouton", image: "Image",
    video: "Video", divider: "Séparateur", spacer: "Espacement", columns: "Colonnes",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">{BLOCK_LABELS[block.type] || block.type}</h4>
        <div className="flex items-center gap-1">
          <button onClick={function() { onMove("up"); }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronUp size={14} /></button>
          <button onClick={function() { onMove("down"); }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><ChevronDown size={14} /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Content */}
      {(block.type === "button") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Texte du bouton</label>
          <input value={block.content} onChange={function(e) { onUpdate({ content: e.target.value }); }} className="input text-sm" />
        </div>
      )}

      {(block.type === "button") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Lien (URL)</label>
          <input value={block.styles.href || ""} onChange={function(e) { updateStyle("href", e.target.value); }} className="input text-sm" placeholder="https://..." />
        </div>
      )}

      {(block.type === "image") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">URL de l'image</label>
          <input value={block.content} onChange={function(e) { onUpdate({ content: e.target.value }); }} className="input text-sm" placeholder="https://..." />
        </div>
      )}

      {(block.type === "video") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">URL de la video (YouTube, etc.)</label>
          <input value={block.content} onChange={function(e) { onUpdate({ content: e.target.value }); }} className="input text-sm" placeholder="https://youtube.com/..." />
        </div>
      )}

      {/* Colors */}
      {(block.type === "text" || block.type === "heading") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Couleur du texte</label>
          <div className="flex items-center gap-2">
            <input type="color" value={block.styles.color || "#555555"} onChange={function(e) { updateStyle("color", e.target.value); }} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
            <input value={block.styles.color || "#555555"} onChange={function(e) { updateStyle("color", e.target.value); }} className="input text-xs font-mono flex-1" />
          </div>
        </div>
      )}

      {(block.type === "button") && (
        <>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Couleur du bouton</label>
            <div className="flex items-center gap-2">
              <input type="color" value={block.styles.bgColor || brandColor} onChange={function(e) { updateStyle("bgColor", e.target.value); }} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
              <input value={block.styles.bgColor || brandColor} onChange={function(e) { updateStyle("bgColor", e.target.value); }} className="input text-xs font-mono flex-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Couleur du texte</label>
            <div className="flex items-center gap-2">
              <input type="color" value={block.styles.color || "#ffffff"} onChange={function(e) { updateStyle("color", e.target.value); }} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
              <input value={block.styles.color || "#ffffff"} onChange={function(e) { updateStyle("color", e.target.value); }} className="input text-xs font-mono flex-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Rayon bordure</label>
            <select value={block.styles.borderRadius || "8px"} onChange={function(e) { updateStyle("borderRadius", e.target.value); }} className="input text-sm">
              <option value="0px">Carre</option>
              <option value="4px">Leger</option>
              <option value="8px">Moyen</option>
              <option value="20px">Arrondi</option>
              <option value="50px">Pilule</option>
            </select>
          </div>
        </>
      )}

      {/* Font size */}
      {(block.type === "text" || block.type === "heading") && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Taille de police</label>
          <select value={block.styles.fontSize || "15px"} onChange={function(e) { updateStyle("fontSize", e.target.value); }} className="input text-sm">
            <option value="12px">Petit (12px)</option>
            <option value="14px">Normal (14px)</option>
            <option value="15px">Moyen (15px)</option>
            <option value="16px">Grand (16px)</option>
            <option value="18px">Tres grand (18px)</option>
            <option value="22px">Titre (22px)</option>
            <option value="28px">Gros titre (28px)</option>
          </select>
        </div>
      )}

      {/* Alignment */}
      {block.type !== "spacer" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Alignement</label>
          <div className="flex items-center gap-1">
            {[
              { value: "left", icon: AlignLeft },
              { value: "center", icon: AlignCenter },
              { value: "right", icon: AlignRight },
            ].map(function(opt) {
              return (
                <button
                  key={opt.value}
                  onClick={function() { updateStyle("textAlign", opt.value); }}
                  className={cn("p-2 rounded-md transition-colors",
                    (block.styles.textAlign || "left") === opt.value ? "bg-brand-50 text-brand-600" : "text-gray-400 hover:bg-gray-100"
                  )}
                >
                  <opt.icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Image width */}
      {block.type === "image" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Largeur</label>
          <select value={block.styles.width || "100%"} onChange={function(e) { updateStyle("width", e.target.value); }} className="input text-sm">
            <option value="100%">Pleine largeur</option>
            <option value="75%">75%</option>
            <option value="50%">50%</option>
            <option value="200px">Petite (200px)</option>
          </select>
        </div>
      )}

      {/* Spacer height */}
      {block.type === "spacer" && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Hauteur</label>
          <select value={block.styles.height || "24px"} onChange={function(e) { updateStyle("height", e.target.value); }} className="input text-sm">
            <option value="8px">XS (8px)</option>
            <option value="16px">S (16px)</option>
            <option value="24px">M (24px)</option>
            <option value="40px">L (40px)</option>
            <option value="60px">XL (60px)</option>
          </select>
        </div>
      )}

      {/* Divider style */}
      {block.type === "divider" && (
        <>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Couleur</label>
            <div className="flex items-center gap-2">
              <input type="color" value={block.styles.color || "#e5e7eb"} onChange={function(e) { updateStyle("color", e.target.value); }} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
              <input value={block.styles.color || "#e5e7eb"} onChange={function(e) { updateStyle("color", e.target.value); }} className="input text-xs font-mono flex-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Style</label>
            <select value={block.styles.borderStyle || "solid"} onChange={function(e) { updateStyle("borderStyle", e.target.value); }} className="input text-sm">
              <option value="solid">Solide</option>
              <option value="dashed">Tirets</option>
              <option value="dotted">Points</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toolbar Button ───
function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors" title={label}>
      <Icon size={14} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ─── Helpers ───
function getDefaultContent(type: EmailBlock["type"]): string {
  switch (type) {
    case "text": return "";
    case "heading": return "Votre titre ici";
    case "button": return "Cliquez ici";
    case "image": return "";
    case "video": return "";
    case "divider": return "";
    case "spacer": return "";
    default: return "";
  }
}

function getDefaultStyles(type: EmailBlock["type"], brandColor: string): Record<string, string> {
  switch (type) {
    case "text": return { fontSize: "15px", color: "#555555", textAlign: "left" };
    case "heading": return { fontSize: "22px", color: brandColor, textAlign: "left" };
    case "button": return { bgColor: brandColor, color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" };
    case "image": return { textAlign: "center", width: "100%" };
    case "video": return { textAlign: "center" };
    case "divider": return { color: "#e5e7eb", borderWidth: "1px", borderStyle: "solid" };
    case "spacer": return { height: "24px" };
    default: return {};
  }
}

function blocksToPreviewHtml(blocks: EmailBlock[], brandColor: string): string {
  return blocks.map(function(block) {
    switch (block.type) {
      case "text":
        var paragraphs = block.content.split("\n").map(function(line) {
          return '<p style="margin:0 0 8px;line-height:1.6;font-size:' + (block.styles.fontSize || "15px") + ";color:" + (block.styles.color || "#555") + ";text-align:" + (block.styles.textAlign || "left") + ';">' + (line || "&nbsp;") + "</p>";
        }).join("");
        return paragraphs;
      case "heading":
        return '<h2 style="margin:0 0 12px;font-size:' + (block.styles.fontSize || "22px") + ";color:" + (block.styles.color || brandColor) + ";text-align:" + (block.styles.textAlign || "left") + ";font-weight:700;" + '">' + block.content + "</h2>";
      case "button":
        return '<div style="text-align:' + (block.styles.textAlign || "center") + ';padding:8px 0;"><a href="' + (block.styles.href || "#") + '" style="display:inline-block;padding:12px 28px;background:' + (block.styles.bgColor || brandColor) + ";color:" + (block.styles.color || "white") + ";border-radius:" + (block.styles.borderRadius || "8px") + ';text-decoration:none;font-weight:600;font-size:14px;">' + block.content + "</a></div>";
      case "image":
        return block.content ? '<div style="text-align:' + (block.styles.textAlign || "center") + ';padding:8px 0;"><img src="' + block.content + '" alt="" style="max-width:100%;width:' + (block.styles.width || "100%") + ';border-radius:8px;" /></div>' : "";
      case "video":
        return block.content ? '<div style="text-align:center;padding:8px 0;"><a href="' + block.content + '" style="display:inline-block;padding:16px 32px;background:#333;color:white;border-radius:8px;text-decoration:none;">Regarder la video</a></div>' : "";
      case "divider":
        return '<hr style="border:none;border-top:' + (block.styles.borderWidth || "1px") + " " + (block.styles.borderStyle || "solid") + " " + (block.styles.color || "#e5e7eb") + ';margin:16px 0;" />';
      case "spacer":
        return '<div style="height:' + (block.styles.height || "24px") + ';"></div>';
      default:
        return "";
    }
  }).join("");
}

export function blocksToHtml(blocks: EmailBlock[], brandColor: string): string {
  var content = blocksToPreviewHtml(blocks, brandColor);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8f9fa;padding:40px 0;">' +
    '<div style="max-width:580px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    "</div></body></html>";
}
