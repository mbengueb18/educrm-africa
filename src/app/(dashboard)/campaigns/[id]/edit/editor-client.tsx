"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateCampaignDraft, previewSegment, type SegmentRule } from "../../actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Eye, Send, Users, Plus, X, Loader2,
  Type, Heading1, Square, Image, Video, Minus, Columns2,
  Trash2, GripVertical, ChevronUp, ChevronDown, Code,
  AlignLeft, AlignCenter, AlignRight, Palette, Check, Clock,
  MousePointer, Link2, LayoutGrid,
} from "lucide-react";
import { RichTextBlock } from "@/components/messaging/rich-text-block";
import { SectionBlock, SectionLayoutPicker, createSectionColumns, sectionToHtml, SECTION_LAYOUTS, type SectionColumn } from "@/components/messaging/section-block";

interface EmailBlock {
  id: string;
  type: "text" | "heading" | "button" | "image" | "divider" | "spacer" | "video" | "section";
  content: string;
  styles: Record<string, string>;
  columns?: SectionColumn[];
}

interface CampaignEditorClientProps {
  campaign: {
    id: string;
    name: string;
    subject: string;
    body: string;
    status: string;
    segmentRules: any;
    totalRecipients: number;
  };
  stages: { id: string; name: string; color: string }[];
  programs: { id: string; name: string; code: string | null }[];
}

var SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Site web" }, { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" }, { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SALON", label: "Salon" }, { value: "REFERRAL", label: "Parrainage" },
];

var BRAND_COLOR = "#1B4F72";

export function CampaignEditorClient({ campaign, stages, programs }: CampaignEditorClientProps) {
  var router = useRouter();
  // Global selection tracking — saves selection continuously



  // Parse existing data
  var initialBlocks: EmailBlock[] = [];
  try {
    var parsed = JSON.parse(campaign.body);
    if (Array.isArray(parsed)) initialBlocks = parsed;
  } catch {
    if (campaign.body) {
      initialBlocks = [{ id: "1", type: "text", content: campaign.body, styles: { fontSize: "15px", color: "#555555" } }];
    }
  }

  var initialRules: SegmentRule[] = [];
  try {
    if (campaign.segmentRules) {
      initialRules = campaign.segmentRules as SegmentRule[];
    }
  } catch {}

  var [name, setName] = useState(campaign.name);
  var [subject, setSubject] = useState(campaign.subject);
  var [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks.length > 0 ? initialBlocks : []);
  var [rules, setRules] = useState<SegmentRule[]>(initialRules);
  var [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  var [previewMode, setPreviewMode] = useState(false);
  var [activePanel, setActivePanel] = useState<"content" | "audience">("content");
  var [saving, setSaving] = useState(false);
  var [lastSaved, setLastSaved] = useState<Date | null>(null);
  var [previewData, setPreviewData] = useState<{ count: number } | null>(
    campaign.totalRecipients > 0 ? { count: campaign.totalRecipients } : null
  );
  var [showSectionPicker, setShowSectionPicker] = useState(false);

  var selectedBlock = blocks.find(function(b) { return b.id === selectedBlockId; });

  // ─── Auto-save every 5 seconds ───
  var saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  var doSave = useCallback(async function() {
    setSaving(true);
    try {
      await updateCampaignDraft(campaign.id, {
        name: name,
        subject: subject,
        body: JSON.stringify(blocks),
        segmentRules: rules,
      });
      setLastSaved(new Date());
    } catch (e) {
      // silent fail for auto-save
    }
    setSaving(false);
  }, [campaign.id, name, subject, blocks, rules]);

  useEffect(function() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(doSave, 3000);
    return function() {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [name, subject, blocks, rules, doSave]);

  // ─── Block operations ───
  var addBlock = function(type: EmailBlock["type"]) {
    var newBlock: EmailBlock = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      type: type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type),
    };
    var idx = selectedBlockId ? blocks.findIndex(function(b) { return b.id === selectedBlockId; }) + 1 : blocks.length;
    var newBlocks = [...blocks.slice(0, idx), newBlock, ...blocks.slice(idx)];
    setBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  var addSection = function(layoutId: string) {
    var layout = SECTION_LAYOUTS.find(function(l) { return l.id === layoutId; });
    if (!layout) return;
    var newBlock: EmailBlock = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
      type: "section",
      content: layoutId,
      styles: { bgColor: "", padding: "12px" },
      columns: createSectionColumns(layout),
    };
    var idx = selectedBlockId ? blocks.findIndex(function(b) { return b.id === selectedBlockId; }) + 1 : blocks.length;
    setBlocks([...blocks.slice(0, idx), newBlock, ...blocks.slice(idx)]);
    setSelectedBlockId(newBlock.id);
    setShowSectionPicker(false);
  };

  var updateBlock = function(id: string, updates: Partial<EmailBlock>) {
    setBlocks(blocks.map(function(b) { return b.id === id ? { ...b, ...updates } : b; }));
  };

  var updateStyle = function(id: string, key: string, value: string) {
    var block = blocks.find(function(b) { return b.id === id; });
    if (!block) return;
    updateBlock(id, { styles: { ...block.styles, [key]: value } });
  };

  var deleteBlock = function(id: string) {
    setBlocks(blocks.filter(function(b) { return b.id !== id; }));
    setSelectedBlockId(null);
  };

  var moveBlock = function(id: string, dir: "up" | "down") {
    var idx = blocks.findIndex(function(b) { return b.id === id; });
    if (dir === "up" && idx > 0) {
      var nb = [...blocks]; var t = nb[idx - 1]; nb[idx - 1] = nb[idx]; nb[idx] = t; setBlocks(nb);
    } else if (dir === "down" && idx < blocks.length - 1) {
      var nb2 = [...blocks]; var t2 = nb2[idx + 1]; nb2[idx + 1] = nb2[idx]; nb2[idx] = t2; setBlocks(nb2);
    }
  };

  // ─── Segment preview ───
  var handlePreview = function() {
    previewSegment(rules).then(function(data) {
      setPreviewData(data);
    }).catch(function() {});
  };

  var FIELD_OPTIONS = [
    { value: "stageId", label: "Étape", type: "select", options: stages.map(function(s) { return { value: s.id, label: s.name }; }) },
    { value: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
    { value: "programId", label: "Filière", type: "select", options: programs.map(function(p) { return { value: p.id, label: p.name }; }) },
    { value: "score", label: "Score", type: "number", options: [] },
    { value: "city", label: "Ville", type: "text", options: [] },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <input
            value={name}
            onChange={function(e) { setName(e.target.value); }}
            className="text-lg font-bold text-gray-900 border-none outline-none bg-transparent focus:ring-0 w-64"
            placeholder="Nom de la campagne"
          />
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            {saving ? (
              <><Loader2 size={12} className="animate-spin" /> Sauvegarde...</>
            ) : lastSaved ? (
              <><Check size={12} className="text-emerald-500" /> Sauvegarde auto</>
            ) : (
              <><Clock size={12} /> Brouillon</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={function() { doSave(); toast.success("Sauvegarde"); }} className="btn-secondary py-1.5 text-xs">
            <Save size={13} /> Sauvegarder
          </button>
          <Link href={"/campaigns"} className="btn-primary py-1.5 text-xs">
            <ArrowLeft size={13} /> Retour aux campagnes
          </Link>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={function() { setActivePanel("content"); }}
          className={cn("flex-1 py-2.5 text-xs font-medium text-center", activePanel === "content" ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}
        >
          Contenu de l'email
        </button>
        <button
          onClick={function() { setActivePanel("audience"); }}
          className={cn("flex-1 py-2.5 text-xs font-medium text-center", activePanel === "audience" ? "text-brand-600 border-b-2 border-brand-500" : "text-gray-500")}
        >
          Audience ({previewData?.count ?? "?"} destinataires)
        </button>
      </div>

      {activePanel === "content" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: block palette */}
          <div className="w-16 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0">
            <PaletteBtn icon={Type} label="Texte" onClick={function() { addBlock("text"); }} />
            <PaletteBtn icon={Heading1} label="Titre" onClick={function() { addBlock("heading"); }} />
            <PaletteBtn icon={Square} label="Bouton" onClick={function() { addBlock("button"); }} />
            <PaletteBtn icon={Image} label="Image" onClick={function() { addBlock("image"); }} />
            <PaletteBtn icon={Video} label="Video" onClick={function() { addBlock("video"); }} />
            <PaletteBtn icon={Minus} label="Ligne" onClick={function() { addBlock("divider"); }} />
            <PaletteBtn icon={Columns2} label="Espace" onClick={function() { addBlock("spacer"); }} />
            <div className="relative">
            <PaletteBtn icon={LayoutGrid} label="Section" onClick={function() { setShowSectionPicker(!showSectionPicker); }} />
              {showSectionPicker && (
                <SectionLayoutPicker
                  onSelect={function(layout) { addSection(layout.id); }}
                  onClose={function() { setShowSectionPicker(false); }}
                />
              )}
            </div>
          </div>

          {/* Center: canvas */}
          <div className="flex-1 bg-gray-100 overflow-y-auto p-6">
            {/* Subject */}
            <div className="max-w-[620px] mx-auto mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Objet de l'email</label>
              <input
                value={subject}
                onChange={function(e) { setSubject(e.target.value); }}
                className="w-full px-4 py-2.5 bg-white rounded-lg border border-gray-200 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Objet de votre email..."
              />
            </div>

            {/* Email canvas */}
            <div className="max-w-[620px] mx-auto">
              {previewMode ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div style={{ backgroundColor: BRAND_COLOR, padding: "20px 28px" }}>
                    <p style={{ color: "white", fontSize: "16px", fontWeight: 600, margin: 0 }}>{subject || "Objet de l'email"}</p>
                  </div>
                  <div className="p-8" dangerouslySetInnerHTML={{ __html: blocksToPreviewHtml(blocks) }} />
                  <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">Envoye via EduCRM Africa</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {blocks.map(function(block) {
                    var isSelected = block.id === selectedBlockId;
                    return (
                      <div
                        key={block.id}
                        onClick={function(e) { e.stopPropagation(); setSelectedBlockId(block.id); }}
                        className={cn(
                          "relative bg-white rounded-lg border-2 transition-all group",
                          isSelected ? "border-brand-500 shadow-md" : "border-transparent hover:border-gray-200"
                        )}
                      >
                        {/* Quick actions on hover */}
                        {isSelected && (
                          <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-white rounded-lg shadow-sm border border-gray-200 px-1 py-0.5 z-10">
                            <button onClick={function(e) { e.stopPropagation(); moveBlock(block.id, "up"); }} className="p-0.5 rounded text-gray-400 hover:text-gray-600"><ChevronUp size={13} /></button>
                            <button onClick={function(e) { e.stopPropagation(); moveBlock(block.id, "down"); }} className="p-0.5 rounded text-gray-400 hover:text-gray-600"><ChevronDown size={13} /></button>
                            <div className="w-px h-3 bg-gray-200 mx-0.5" />
                            <button onClick={function(e) { e.stopPropagation(); deleteBlock(block.id); }} className="p-0.5 rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                          </div>
                        )}

                        {/* Block content */}
                        <BlockContent block={block} onUpdate={function(u) { updateBlock(block.id, u); }} />

                        {/* Insert between */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 z-10">
                          <button
                            onClick={function(e) { e.stopPropagation(); setSelectedBlockId(block.id); addBlock("text"); }}
                            className="w-5 h-5 bg-brand-600 rounded-full text-white flex items-center justify-center shadow hover:bg-brand-700"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {blocks.length === 0 && (
                    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
                      <Type size={32} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-400 mb-1">Commencez a creer votre email</p>
                      <p className="text-xs text-gray-400">Utilisez la palette a gauche pour ajouter des blocs</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Toggle preview */}
            <div className="max-w-[620px] mx-auto mt-4 text-center">
              <button
                onClick={function() { setPreviewMode(!previewMode); }}
                className="btn-secondary py-1.5 text-xs mx-auto"
              >
                {previewMode ? <><Code size={13} /> Mode edition</> : <><Eye size={13} /> Aperçu email</>}
              </button>
            </div>
          </div>

          {/* Right: properties */}
          <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
            {selectedBlock ? (
              <div className="p-4 space-y-4">
                <h4 className="text-sm font-semibold text-gray-700">
                  {({ text: "Texte", heading: "Titre", button: "Bouton", image: "Image", divider: "Séparateur", spacer: "Espace" } as any)[selectedBlock.type]}
                </h4>

                {/* Content for button */}
                {selectedBlock.type === "button" && (
                  <>
                    <PropField label="Texte du bouton">
                      <input value={selectedBlock.content} onChange={function(e) { updateBlock(selectedBlock!.id, { content: e.target.value }); }} className="input text-sm" />
                    </PropField>
                    <PropField label="Lien (URL)">
                      <input value={selectedBlock.styles.href || ""} onChange={function(e) { updateStyle(selectedBlock!.id, "href", e.target.value); }} className="input text-sm" placeholder="https://..." />
                    </PropField>
                  </>
                )}

                {/* Image URL */}
                {selectedBlock.type === "image" && (
                  <>
                    <PropField label="URL de l'image">
                      <input value={selectedBlock.content} onChange={function(e) { updateBlock(selectedBlock!.id, { content: e.target.value }); }} className="input text-sm" placeholder="https://exemple.com/image.jpg" />
                    </PropField>
                    <PropField label="Ou uploader depuis votre ordinateur">
                      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-brand-50 text-brand-600 text-xs rounded-lg cursor-pointer hover:bg-brand-100 transition-colors">
                        <Image size={14} />
                        Choisir un fichier
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async function(e) {
                            var file = e.target.files?.[0];
                            if (!file) return;
                            var formData = new FormData();
                            formData.append("file", file);
                            try {
                              var res = await fetch("/api/upload", { method: "POST", body: formData });
                              var data = await res.json();
                              if (data.success) {
                                updateBlock(selectedBlock!.id, { content: data.url });
                                toast.success("Image uploadee");
                              } else {
                                toast.error(data.error);
                              }
                            } catch { toast.error("Erreur upload"); }
                          }}
                        />
                      </label>
                    </PropField>
                    {selectedBlock.content && (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <img src={selectedBlock.content} alt="" className="w-full h-auto" onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                    <PropField label="Largeur">
                      <select value={selectedBlock.styles.width || "100%"} onChange={function(e) { updateStyle(selectedBlock!.id, "width", e.target.value); }} className="input text-sm">
                        <option value="100%">Pleine largeur</option>
                        <option value="75%">75%</option>
                        <option value="50%">50%</option>
                        <option value="200px">Petite</option>
                      </select>
                    </PropField>
                  </>
                )}

                {/* Video URL */}
                {selectedBlock.type === "video" && (
                  <>
                    <PropField label="URL de la video (YouTube, Vimeo)">
                      <input value={selectedBlock.content} onChange={function(e) { updateBlock(selectedBlock!.id, { content: e.target.value }); }} className="input text-sm" placeholder="https://youtube.com/watch?v=..." />
                    </PropField>
                    <PropField label="Image miniature (optionnel)">
                      <input value={selectedBlock.styles.thumbnail || ""} onChange={function(e) { updateStyle(selectedBlock!.id, "thumbnail", e.target.value); }} className="input text-sm" placeholder="https://img.youtube.com/..." />
                      {selectedBlock.content && selectedBlock.content.includes("youtube.com") && (
                        <button
                          onClick={function() {
                            var videoId = selectedBlock!.content.match(/[?&]v=([^&]+)/)?.[1] || "";
                            if (videoId) {
                              updateStyle(selectedBlock!.id, "thumbnail", "https://img.youtube.com/vi/" + videoId + "/maxresdefault.jpg");
                            }
                          }}
                          className="text-xs text-brand-600 hover:text-brand-700 mt-1"
                        >
                          Auto-détectér la miniature YouTube
                        </button>
                      )}
                    </PropField>
                    <PropField label="Largeur">
                      <select value={selectedBlock.styles.width || "100%"} onChange={function(e) { updateStyle(selectedBlock!.id, "width", e.target.value); }} className="input text-sm">
                        <option value="100%">Pleine largeur</option>
                        <option value="75%">75%</option>
                        <option value="50%">50%</option>
                      </select>
                    </PropField>
                  </>
                )}

                {/* Colors */}
                {(selectedBlock.type === "text" || selectedBlock.type === "heading") && (
                  <>
                    <PropField label="Couleur du texte">
                      <div className="flex gap-2">
                        <input type="color" value={selectedBlock.styles.color || "#555"} onChange={function(e) { updateStyle(selectedBlock!.id, "color", e.target.value); }} className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
                        <input value={selectedBlock.styles.color || "#555"} onChange={function(e) { updateStyle(selectedBlock!.id, "color", e.target.value); }} className="input text-xs font-mono flex-1" />
                      </div>
                    </PropField>
                    <PropField label="Taille">
                      <select value={selectedBlock.styles.fontSize || "15px"} onChange={function(e) { updateStyle(selectedBlock!.id, "fontSize", e.target.value); }} className="input text-sm">
                        <option value="12px">Petit</option>
                        <option value="14px">Normal</option>
                        <option value="15px">Moyen</option>
                        <option value="16px">Grand</option>
                        <option value="18px">Tres grand</option>
                        <option value="22px">Titre</option>
                        <option value="28px">Gros titre</option>
                      </select>
                    </PropField>
                  </>
                )}

                {/* Button colors */}
                {selectedBlock.type === "button" && (
                  <>
                    <PropField label="Couleur du bouton">
                      <div className="flex gap-2">
                        <input type="color" value={selectedBlock.styles.bgColor || BRAND_COLOR} onChange={function(e) { updateStyle(selectedBlock!.id, "bgColor", e.target.value); }} className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
                        <input value={selectedBlock.styles.bgColor || BRAND_COLOR} onChange={function(e) { updateStyle(selectedBlock!.id, "bgColor", e.target.value); }} className="input text-xs font-mono flex-1" />
                      </div>
                    </PropField>
                    <PropField label="Forme">
                      <select value={selectedBlock.styles.borderRadius || "8px"} onChange={function(e) { updateStyle(selectedBlock!.id, "borderRadius", e.target.value); }} className="input text-sm">
                        <option value="0px">Carre</option>
                        <option value="4px">Leger</option>
                        <option value="8px">Moyen</option>
                        <option value="50px">Pilule</option>
                      </select>
                    </PropField>
                  </>
                )}

                {/* Spacer height */}
                {selectedBlock.type === "spacer" && (
                  <PropField label="Hauteur">
                    <select value={selectedBlock.styles.height || "24px"} onChange={function(e) { updateStyle(selectedBlock!.id, "height", e.target.value); }} className="input text-sm">
                      <option value="8px">XS</option><option value="16px">S</option>
                      <option value="24px">M</option><option value="40px">L</option><option value="60px">XL</option>
                    </select>
                  </PropField>
                )}

                {/* Divider */}
                {selectedBlock.type === "divider" && (
                  <PropField label="Style">
                    <select value={selectedBlock.styles.borderStyle || "solid"} onChange={function(e) { updateStyle(selectedBlock!.id, "borderStyle", e.target.value); }} className="input text-sm">
                      <option value="solid">Solide</option><option value="dashed">Tirets</option><option value="dotted">Points</option>
                    </select>
                  </PropField>
                )}

                {/* Section properties */}
                {selectedBlock.type === "section" && (
                  <>
                    <PropField label="Disposition">
                      <div className="grid grid-cols-3 gap-1.5">
                        {SECTION_LAYOUTS.map(function(layout) {
                          var isActive = selectedBlock!.content === layout.id;
                          return (
                            <button
                              key={layout.id}
                              onClick={function() {
                                var newCols = createSectionColumns(layout);
                                // Preserve existing content if possible
                                var oldCols = selectedBlock!.columns || [];
                                for (var i = 0; i < Math.min(newCols.length, oldCols.length); i++) {
                                  newCols[i].content = oldCols[i].content;
                                }
                                updateBlock(selectedBlock!.id, { content: layout.id, columns: newCols });
                              }}
                              className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                                isActive ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <div className="flex gap-0.5 w-full h-5">
                                {layout.columns.map(function(w, i) {
                                  return <div key={i} style={{ width: w }} className={cn("rounded-sm", isActive ? "bg-brand-400" : "bg-gray-300")} />;
                                })}
                              </div>
                              <span className="text-[9px] text-gray-500">{layout.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </PropField>
                    <PropField label="Couleur de fond">
                      <div className="flex gap-2">
                        <input type="color" value={selectedBlock.styles.bgColor || "#ffffff"} onChange={function(e) { updateStyle(selectedBlock!.id, "bgColor", e.target.value); }} className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
                        <input value={selectedBlock.styles.bgColor || ""} onChange={function(e) { updateStyle(selectedBlock!.id, "bgColor", e.target.value); }} className="input text-xs font-mono flex-1" placeholder="Transparent" />
                      </div>
                    </PropField>
                    <PropField label="Espacement interne">
                      <select value={selectedBlock.styles.padding || "12px"} onChange={function(e) { updateStyle(selectedBlock!.id, "padding", e.target.value); }} className="input text-sm">
                        <option value="0px">Aucun</option>
                        <option value="8px">Petit</option>
                        <option value="12px">Moyen</option>
                        <option value="20px">Grand</option>
                        <option value="32px">Tres grand</option>
                      </select>
                    </PropField>
                  </>
                )}

                {/* Alignment (all except spacer) */}
                {selectedBlock.type !== "spacer" && (
                  <PropField label="Alignement">
                    <div className="flex gap-1">
                      {[{ v: "left", i: AlignLeft }, { v: "center", i: AlignCenter }, { v: "right", i: AlignRight }].map(function(opt) {
                        return (
                          <button key={opt.v} onClick={function() { updateStyle(selectedBlock!.id, "textAlign", opt.v); }}
                            className={cn("p-2 rounded-lg transition-colors", (selectedBlock!.styles.textAlign || "left") === opt.v ? "bg-brand-50 text-brand-600" : "text-gray-400 hover:bg-gray-100")}>
                            <opt.i size={15} />
                          </button>
                        );
                      })}
                    </div>
                  </PropField>
                )}

                {/* Variables */}
                {(selectedBlock.type === "text" || selectedBlock.type === "heading") && (
                  <PropField label="Inserer une variable">
                    <div className="flex flex-wrap gap-1">
                      {["{{prenom}}", "{{nom}}", "{{email}}"].map(function(v) {
                        return (
                          <button key={v} onClick={function() { updateBlock(selectedBlock!.id, { content: selectedBlock!.content + " " + v }); }}
                            className="text-[10px] px-2 py-1 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100">
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </PropField>
                )}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Palette size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Cliquez sur un bloc pour modifier ses proprietes</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Audience panel */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Criteres de segmentation</h3>
                <button onClick={function() { setRules([...rules, { field: "stageId", operator: "equals", value: "" }]); }} className="btn-secondary py-1 px-2 text-xs">
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {rules.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-6 text-center">
                  <Users size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun critere — tous les leads avec email seront inclus</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map(function(rule, index) {
                    var fieldDef = FIELD_OPTIONS.find(function(f) { return f.value === rule.field; });
                    return (
                      <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-gray-200">
                        {index > 0 && <span className="text-xs text-gray-400 font-medium w-6 shrink-0">ET</span>}
                        {index === 0 && <span className="w-6 shrink-0" />}
                        <select value={rule.field} onChange={function(e) { var nr = [...rules]; nr[index] = { ...nr[index], field: e.target.value, value: "" }; setRules(nr); }} className="input text-sm py-1.5 w-32">
                          {FIELD_OPTIONS.map(function(f) { return <option key={f.value} value={f.value}>{f.label}</option>; })}
                        </select>
                        <select value={rule.operator} onChange={function(e) { var nr = [...rules]; nr[index] = { ...nr[index], operator: e.target.value }; setRules(nr); }} className="input text-sm py-1.5 w-24">
                          <option value="equals">est</option>
                          <option value="not_equals">n'est pas</option>
                          {fieldDef?.type === "text" && <option value="contains">contient</option>}
                          {fieldDef?.type === "number" && <><option value="gt">sup. a</option><option value="lt">inf. a</option></>}
                        </select>
                        {fieldDef?.options && fieldDef.options.length > 0 ? (
                          <select value={rule.value} onChange={function(e) { var nr = [...rules]; nr[index] = { ...nr[index], value: e.target.value }; setRules(nr); }} className="input text-sm py-1.5 flex-1">
                            <option value="">Choisir...</option>
                            {fieldDef.options.map(function(o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
                          </select>
                        ) : (
                          <input value={rule.value} onChange={function(e) { var nr = [...rules]; nr[index] = { ...nr[index], value: e.target.value }; setRules(nr); }} className="input text-sm py-1.5 flex-1" placeholder="Valeur..." />
                        )}
                        <button onClick={function() { setRules(rules.filter(function(_, i) { return i !== index; })); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={handlePreview} className="btn-secondary py-2 text-xs mt-3 w-full justify-center">
                <Eye size={14} /> Compter les destinataires
              </button>

              {previewData && (
                <div className="bg-brand-50 rounded-xl p-4 mt-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-brand-600" />
                    <span className="text-sm font-semibold text-brand-800">{previewData.count} destinataire{previewData.count > 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Block Content Renderer ───
function BlockContent({ block, onUpdate }: { block: EmailBlock; onUpdate: (u: Partial<EmailBlock>) => void }) {
  var fileInputRef = useRef<HTMLInputElement>(null);
  var [uploading, setUploading] = useState(false);

  var handleImageUpload = async function(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      var formData = new FormData();
      formData.append("file", file);
      var res = await fetch("/api/upload", { method: "POST", body: formData });
      var data = await res.json();
      if (data.success) {
        onUpdate({ content: data.url });
        toast.success("Image uploadee");
      } else {
        toast.error(data.error || "Erreur upload");
      }
    } catch (err) {
      toast.error("Erreur upload");
    }
    setUploading(false);
  };

  switch (block.type) {
    case "text":
      return (
        <RichTextBlock
          key={block.id}
          initialContent={block.content}
          placeholder="Ecrivez votre texte..."
          style={{ color: block.styles.color || "#555", fontSize: block.styles.fontSize || "15px", textAlign: (block.styles.textAlign as any) || "left" }}
          onContentChange={function(html) { onUpdate({ content: html }); }}
        />
      );
    case "heading":
      return (
        <RichTextBlock
          key={block.id}
          initialContent={block.content}
          placeholder="Votre titre..."
          className="font-bold"
          style={{ color: block.styles.color || "#1B4F72", fontSize: block.styles.fontSize || "22px", textAlign: (block.styles.textAlign as any) || "left" }}
          onContentChange={function(html) { onUpdate({ content: html }); }}
        />
      );
    case "button":
      return (
        <div className="px-5 py-4" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          <span className="inline-block px-7 py-3 font-semibold text-sm" style={{ backgroundColor: block.styles.bgColor || BRAND_COLOR, color: block.styles.color || "white", borderRadius: block.styles.borderRadius || "8px" }}>
            {block.content || "Bouton"}
          </span>
        </div>
      );
    case "image":
      return (
        <div className="px-5 py-3" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          {block.content ? (
            <div className="relative group/img inline-block">
              <img src={block.content} alt="" className="rounded-lg" style={{ maxWidth: "100%", width: block.styles.width || "100%" }} onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
              <button
                onClick={function(e) { e.stopPropagation(); onUpdate({ content: "" }); }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg py-8 border-2 border-dashed border-gray-200 text-center">
              <Image size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-xs text-gray-400 mb-3">Ajoutez une image</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={function(e) { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 transition-colors"
                  disabled={uploading}
                >
                  {uploading ? "Upload..." : "Depuis mon ordinateur"}
                </button>
                <span className="text-xs text-gray-400">ou collez l'URL a droite</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          )}
        </div>
      );
    case "video":
      return (
        <div className="px-5 py-3" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          {block.content ? (
            <a href={block.content} target="_blank" rel="noopener noreferrer" className="inline-block relative group/vid" onClick={function(e) { e.preventDefault(); }}>
              <div className="bg-gray-900 rounded-lg overflow-hidden" style={{ width: block.styles.width || "100%", minHeight: "200px" }}>
                {block.styles.thumbnail ? (
                  <img src={block.styles.thumbnail} alt="" className="w-full h-auto opacity-80" />
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <Video size={48} className="text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-l-red-600 ml-1" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 truncate max-w-[300px] mx-auto">{block.content}</p>
            </a>
          ) : (
            <div className="bg-gray-900 rounded-lg py-10 border-2 border-dashed border-gray-700 text-center">
              <Video size={36} className="text-white/40 mx-auto mb-3" />
              <p className="text-xs text-white/50 mb-1">Ajoutez une video</p>
              <p className="text-[10px] text-white/30">Collez l'URL YouTube ou Vimeo dans le panneau a droite</p>
            </div>
          )}
        </div>
      );
    case "divider":
      return <div className="px-5 py-4"><hr style={{ borderColor: block.styles.color || "#e5e7eb", borderStyle: (block.styles.borderStyle as any) || "solid" }} /></div>;
    case "spacer":
      return <div style={{ height: block.styles.height || "24px" }} className="flex items-center justify-center"><span className="text-[9px] text-gray-300">{block.styles.height || "24px"}</span></div>;
    case "section":
      return (
        <SectionBlock
          columns={block.columns || []}
          bgColor={block.styles.bgColor || ""}
          padding={block.styles.padding || "12px"}
          onColumnsChange={function(cols) { onUpdate({ columns: cols }); }}
        />
      );
      default:
      return null;
  }
}

function PaletteBtn({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-gray-500 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all w-14" title={label}>
      <Icon size={18} />
      <span className="text-[9px]">{label}</span>
    </button>
  );
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ─── Helpers ───
function getDefaultContent(type: string): string {
  if (type === "heading") return "Votre titre";
  if (type === "button") return "Cliquez ici";
  return "";
}

function getDefaultStyles(type: string): Record<string, string> {
  switch (type) {
    case "text": return { fontSize: "15px", color: "#555555", textAlign: "left" };
    case "heading": return { fontSize: "22px", color: BRAND_COLOR, textAlign: "left" };
    case "button": return { bgColor: BRAND_COLOR, color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" };
    case "image": return { textAlign: "center", width: "100%" };
    case "video": return { textAlign: "center", width: "100%", thumbnail: "" };
    case "divider": return { color: "#e5e7eb", borderStyle: "solid" };
    case "spacer": return { height: "24px" };
    case "section": return { bgColor: "", padding: "12px" };
    default: return {};
  }
}

function blocksToPreviewHtml(blocks: EmailBlock[]): string {
  return blocks.map(function(b) {
    switch (b.type) {
      case "text": return b.content.split("\n").map(function(l) { return '<p style="margin:0 0 8px;line-height:1.6;font-size:' + (b.styles.fontSize || "15px") + ";color:" + (b.styles.color || "#555") + ";text-align:" + (b.styles.textAlign || "left") + ';">' + (l || "&nbsp;") + "</p>"; }).join("");
      case "heading": return '<h2 style="margin:0 0 12px;font-size:' + (b.styles.fontSize || "22px") + ";color:" + (b.styles.color || BRAND_COLOR) + ";font-weight:700;text-align:" + (b.styles.textAlign || "left") + ';">' + b.content + "</h2>";
      case "button": return '<div style="text-align:' + (b.styles.textAlign || "center") + ';padding:8px 0;"><a href="' + (b.styles.href || "#") + '" style="display:inline-block;padding:12px 28px;background:' + (b.styles.bgColor || BRAND_COLOR) + ";color:" + (b.styles.color || "#fff") + ";border-radius:" + (b.styles.borderRadius || "8px") + ';text-decoration:none;font-weight:600;font-size:14px;">' + b.content + "</a></div>";
      case "image": return b.content ? '<div style="text-align:' + (b.styles.textAlign || "center") + ';"><img src="' + b.content + '" style="max-width:100%;width:' + (b.styles.width || "100%") + ';border-radius:8px;" /></div>' : "";
      case "video":
      var thumbUrl = b.styles.thumbnail || "";
      var videoUrl = b.content || "#";
      if (!thumbUrl && videoUrl.includes("youtube.com")) {
        var vid = videoUrl.match(/[?&]v=([^&]+)/)?.[1] || "";
        if (vid) thumbUrl = "https://img.youtube.com/vi/" + vid + "/hqdefault.jpg";
      }
      return '<div style="text-align:' + (b.styles.textAlign || "center") + ';padding:8px 0;"><a href="' + videoUrl + '" style="display:inline-block;position:relative;text-decoration:none;">' +
        (thumbUrl ? '<img src="' + thumbUrl + '" style="max-width:100%;width:' + (b.styles.width || "100%") + ';border-radius:8px;display:block;" />' : '<div style="width:400px;height:225px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;">&#9654;</span></div>') +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;background:rgba(255,255,255,0.9);border-radius:50%;display:flex;align-items:center;justify-content:center;"><span style="font-size:24px;color:#e74c3c;margin-left:4px;">&#9654;</span></div>' +
        "</a></div>";
      case "divider": return '<hr style="border:none;border-top:1px ' + (b.styles.borderStyle || "solid") + " " + (b.styles.color || "#e5e7eb") + ';margin:16px 0;" />';
      case "spacer": return '<div style="height:' + (b.styles.height || "24px") + ';"></div>';
      case "section":
        if (!b.columns) return "";
        return sectionToHtml(b.columns, b.styles.bgColor || "", b.styles.padding || "12px");
      default: return "";
    }
  }).join("");
}
