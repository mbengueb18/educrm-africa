"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { RichTextBlock } from "@/components/messaging/rich-text-block";
import { SOCIAL_NETWORKS, getSocialNet, socialBadgeHtml } from "@/lib/social-icons";
import { SIGNATURE_SLOT, signatureSlotIndex, FOOTER_BLOCK_START, FOOTER_BLOCK_END } from "@/lib/email-slots";
import {
  AlignLeft, AlignCenter, AlignRight,
  Type, Image as ImageIcon, Square, Minus, Columns2, Trash2,
  GripVertical, ChevronUp, ChevronDown, Plus, Eye, Code, Copy, X,
  Palette, Video, Heading1, Undo2, Redo2,
  Share2, Smartphone, Monitor, Settings2, Upload, Loader2,
} from "lucide-react";

// ─── Block types ───
export interface EmailBlock {
  id: string;
  type:
    | "text" | "heading" | "button" | "image" | "divider" | "spacer"
    | "columns" | "video" | "social" | "footer" | "settings";
  content: string;
  styles: Record<string, string>;
  children?: EmailBlock[];
}

export interface OrgInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface EmailEditorProps {
  initialBlocks?: EmailBlock[];
  onChange: (blocks: EmailBlock[], html: string) => void;
  brandColor?: string;
  orgInfo?: OrgInfo;
}

// Construit le footer prérempli avec les infos de l'organisation.
function buildFooterContent(orgInfo?: OrgInfo): string {
  if (!orgInfo) {
    return "<div><strong>Votre établissement</strong></div><div>Adresse — Ville</div><div>contact@ecole.com</div>";
  }
  const lines: string[] = [];
  if (orgInfo.name) lines.push("<strong>" + escapeHtml(orgInfo.name) + "</strong>");
  if (orgInfo.address) lines.push(escapeHtml(orgInfo.address));
  const contact: string[] = [];
  if (orgInfo.phone) contact.push(escapeHtml(orgInfo.phone));
  if (orgInfo.email) contact.push(escapeHtml(orgInfo.email));
  if (contact.length) lines.push(contact.join(" &middot; "));
  if (orgInfo.website) {
    const url = /^https?:\/\//i.test(orgInfo.website) ? orgInfo.website : "https://" + orgInfo.website;
    lines.push('<a href="' + url + '">' + escapeHtml(orgInfo.website) + "</a>");
  }
  if (!lines.length) lines.push("<strong>Votre établissement</strong>");
  return lines.map((l) => "<div>" + l + "</div>").join("");
}

// Blocs par défaut d'un nouvel email. Le bloc réseaux sociaux + footer ne sont
// ajoutés que si orgInfo est fourni (contexte éditeur de templates), pour ne pas
// encombrer les emails 1-to-1 / campagnes rapides.
function buildDefaultBlocks(brandColor: string, orgInfo?: OrgInfo): EmailBlock[] {
  const texts: EmailBlock[] = [
    { id: genId(), type: "text", content: "Bonjour {{prenom}},", styles: { fontSize: "16px", color: "#000000" } },
    { id: genId(), type: "text", content: "Ecrivez votre message ici...", styles: { fontSize: "15px", color: "#000000" } },
    { id: genId(), type: "text", content: "Cordialement,\nL'equipe d'admission", styles: { fontSize: "15px", color: "#000000" } },
  ];
  if (!orgInfo) return texts;
  return [
    ...texts,
    { id: genId(), type: "divider", content: "", styles: getDefaultStyles("divider", brandColor) },
    {
      id: genId(),
      type: "social",
      content: JSON.stringify([
        { network: "facebook", url: "" },
        { network: "instagram", url: "" },
        { network: "youtube", url: "" },
        { network: "whatsapp", url: "" },
      ]),
      styles: getDefaultStyles("social", brandColor),
    },
    {
      id: genId(),
      type: "footer",
      content: buildFooterContent(orgInfo),
      styles: { fontSize: "12px", color: "#9ca3af", textAlign: "center", _html: "1" },
    },
  ];
}

const SETTINGS_ID = "__settings__";

// Variables de fusion réellement supportées au rendu (voir src/lib/campaign-html.ts)
const MERGE_VARS = [
  { v: "{{prenom}}", label: "Prénom" },
  { v: "{{nom}}", label: "Nom" },
  { v: "{{email}}", label: "Email" },
];

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ═══════════════════════════════════════════════════════════
//  Main editor
// ═══════════════════════════════════════════════════════════
export function EmailEditor({ initialBlocks, onChange, brandColor = "#1B4F72", orgInfo }: EmailEditorProps) {
  // Calcule les blocs de départ une seule fois (évite de régénérer des ids à chaque rendu)
  const initialRef = useRef<EmailBlock[] | null>(null);
  if (initialRef.current === null) {
    initialRef.current = initialBlocks && initialBlocks.length ? initialBlocks : buildDefaultBlocks(brandColor, orgInfo);
  }
  const initial = initialRef.current;
  const initialSettings = (initial.find((b) => b.type === "settings")?.styles) || {};
  const initialContent = initial.filter((b) => b.type !== "settings");

  const [blocks, setBlocks] = useState<EmailBlock[]>(initialContent);
  const [settings, setSettings] = useState<Record<string, string>>(initialSettings);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Historique undo/redo
  const past = useRef<{ blocks: EmailBlock[]; settings: Record<string, string> }[]>([]);
  const future = useRef<{ blocks: EmailBlock[]; settings: Record<string, string> }[]>([]);
  const [histTick, setHistTick] = useState(0);

  // API d'insertion de variable de l'éditeur riche du bloc actuellement sélectionné
  const activeEditorApiRef = useRef<{ insertVariable: (v: string) => void } | null>(null);

  const selectedBlock = selectedBlockId === SETTINGS_ID
    ? undefined
    : blocks.find((b) => b.id === selectedBlockId);

  const toFull = useCallback((content: EmailBlock[], s: Record<string, string>): EmailBlock[] => {
    const hasSettings = s && Object.keys(s).length > 0;
    return hasSettings
      ? [{ id: SETTINGS_ID, type: "settings", content: "", styles: s }, ...content]
      : content;
  }, []);

  const emit = useCallback((content: EmailBlock[], s: Record<string, string>) => {
    const full = toFull(content, s);
    onChange(full, blocksToHtml(full, brandColor));
  }, [onChange, brandColor, toFull]);

  // Mutate = applique un nouvel état + émet, SANS pousser dans l'historique
  const mutate = useCallback((content: EmailBlock[], s?: Record<string, string>) => {
    const nextSettings = s !== undefined ? s : settings;
    setBlocks(content);
    if (s !== undefined) setSettings(s);
    emit(content, nextSettings);
  }, [settings, emit]);

  // Commit = snapshot + mutate (changements discrets : ajout, style, réordonnancement…)
  const commit = useCallback((content: EmailBlock[], s?: Record<string, string>) => {
    past.current.push({ blocks, settings });
    if (past.current.length > 80) past.current.shift();
    future.current = [];
    const nextSettings = s !== undefined ? s : settings;
    setBlocks(content);
    if (s !== undefined) setSettings(s);
    emit(content, nextSettings);
    setHistTick((t) => t + 1);
  }, [blocks, settings, emit]);

  // Édition live d'un bloc (frappe dans le texte riche) : pas de snapshot par frappe
  const updateBlockLive = (id: string, updates: Partial<EmailBlock>) => {
    mutate(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ blocks, settings });
    setBlocks(prev.blocks);
    setSettings(prev.settings);
    emit(prev.blocks, prev.settings);
    setHistTick((t) => t + 1);
  }, [blocks, settings, emit]);

  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    past.current.push({ blocks, settings });
    setBlocks(nxt.blocks);
    setSettings(nxt.settings);
    emit(nxt.blocks, nxt.settings);
    setHistTick((t) => t + 1);
  }, [blocks, settings, emit]);

  // Raccourcis clavier undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const addBlock = (type: EmailBlock["type"], afterId?: string) => {
    const newBlock: EmailBlock = {
      id: genId(),
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type, brandColor),
      children: type === "columns" ? getDefaultColumns(brandColor) : undefined,
    };
    let next: EmailBlock[];
    if (afterId) {
      const idx = blocks.findIndex((b) => b.id === afterId);
      next = [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];
    } else {
      next = [...blocks, newBlock];
    }
    commit(next);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<EmailBlock>) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const clone: EmailBlock = { ...blocks[idx], id: genId(), styles: { ...blocks[idx].styles } };
    const next = [...blocks.slice(0, idx + 1), clone, ...blocks.slice(idx + 1)];
    commit(next);
    setSelectedBlockId(clone.id);
  };

  const deleteBlock = (id: string) => {
    commit(blocks.filter((b) => b.id !== id));
    setSelectedBlockId(null);
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (direction === "up" && idx > 0) {
      const next = [...blocks];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      commit(next);
    } else if (direction === "down" && idx < blocks.length - 1) {
      const next = [...blocks];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      commit(next);
    }
  };

  // Drag & drop réordonnancement
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const fromIdx = blocks.findIndex((b) => b.id === draggedId);
    const toIdx = blocks.findIndex((b) => b.id === targetId);
    const next = [...blocks];
    const moved = next.splice(fromIdx, 1)[0];
    next.splice(toIdx, 0, moved);
    commit(next);
    setDraggedId(null);
  };

  const updateSettings = (updates: Record<string, string>) => {
    const merged = { ...settings, ...updates };
    // Nettoie les clés vides pour ne pas écrire un bloc settings inutile
    Object.keys(merged).forEach((k) => { if (!merged[k]) delete merged[k]; });
    commit(blocks, merged);
  };

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  const bodyBg = settings.bodyBg || "#f3f4f6";
  const contentBg = settings.contentBg || "#ffffff";
  const contentWidth = parseInt(settings.contentWidth || "600", 10);
  const canvasWidth = previewDevice === "mobile" ? 380 : contentWidth;
  const contentFont = fontStack(settings.fontFamily);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-0.5 flex-wrap">
          <ToolbarButton icon={Type} label="Texte" onClick={() => addBlock("text")} />
          <ToolbarButton icon={Heading1} label="Titre" onClick={() => addBlock("heading")} />
          <Sep />
          <ToolbarButton icon={Square} label="Bouton" onClick={() => addBlock("button")} />
          <ToolbarButton icon={ImageIcon} label="Image" onClick={() => addBlock("image")} />
          <ToolbarButton icon={Video} label="Vidéo" onClick={() => addBlock("video")} />
          <ToolbarButton icon={Columns2} label="Colonnes" onClick={() => addBlock("columns")} />
          <Sep />
          <ToolbarButton icon={Minus} label="Séparateur" onClick={() => addBlock("divider")} />
          <ToolbarButton icon={ChevronDown} label="Espace" onClick={() => addBlock("spacer")} />
          <ToolbarButton icon={Share2} label="Réseaux" onClick={() => addBlock("social")} />
          <ToolbarButton icon={AlignCenter} label="Footer" onClick={() => addBlock("footer")} />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Annuler (Ctrl+Z)"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Rétablir (Ctrl+Y)"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 size={15} />
          </button>
          <Sep />
          <button
            onClick={() => { setSelectedBlockId(SETTINGS_ID); setPreviewMode(false); }}
            title="Réglages de l'email"
            className={cn("flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
              selectedBlockId === SETTINGS_ID ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-200")}
          >
            <Settings2 size={13} /> Style
          </button>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              previewMode ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-200")}
          >
            {previewMode ? <Code size={13} /> : <Eye size={13} />}
            {previewMode ? "Éditer" : "Aperçu"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] divide-x divide-gray-200" style={{ minHeight: "440px" }}>
        {/* ─── Canvas ─── */}
        <div className="overflow-y-auto" style={{ maxHeight: "600px", background: previewMode ? bodyBg : "#f1f2f4" }}>
          {previewMode && (
            <div className="flex items-center justify-center gap-1 py-2 sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-gray-200">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs", previewDevice === "desktop" ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100")}
              ><Monitor size={13} /> Ordinateur</button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs", previewDevice === "mobile" ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100")}
              ><Smartphone size={13} /> Mobile</button>
            </div>
          )}

          <div className="p-5">
            {previewMode ? (
              <div
                className="mx-auto rounded-lg shadow-sm overflow-hidden transition-all"
                style={{ width: canvasWidth, maxWidth: "100%", background: contentBg }}
              >
                <div className="rich-content" style={{ padding: "32px", fontFamily: contentFont }} dangerouslySetInnerHTML={{ __html: blocksToPreviewHtml(blocks, brandColor) }} />
              </div>
            ) : (
              <div className="mx-auto space-y-1.5 transition-all" style={{ width: contentWidth, maxWidth: "100%" }}>
                {blocks.map((block) => {
                  const isSelected = block.id === selectedBlockId;
                  return (
                    <div
                      key={block.id}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => handleDrop(e, block.id)}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={cn(
                        "group relative rounded-lg border-2 transition-all cursor-pointer",
                        isSelected ? "border-brand-500 shadow-sm" : "border-transparent hover:border-gray-300",
                        draggedId === block.id && "opacity-40"
                      )}
                      style={{ background: contentBg }}
                    >
                      {/* Poignée de drag */}
                      <div className={cn(
                        "absolute -left-7 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                        isSelected && "opacity-100"
                      )}>
                        <button
                          draggable
                          onDragStart={() => setDraggedId(block.id)}
                          onDragEnd={() => setDraggedId(null)}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                          title="Déplacer"
                        >
                          <GripVertical size={15} />
                        </button>
                      </div>

                      {/* Actions rapides */}
                      <div className={cn(
                        "absolute -right-1 -top-3 flex items-center gap-0.5 bg-white rounded-md border border-gray-200 shadow-sm px-0.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                        isSelected && "opacity-100"
                      )}>
                        <IconBtn icon={ChevronUp} title="Monter" onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }} />
                        <IconBtn icon={ChevronDown} title="Descendre" onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }} />
                        <IconBtn icon={Copy} title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }} />
                        <IconBtn icon={Trash2} title="Supprimer" danger onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }} />
                      </div>

                      <BlockRenderer
                        block={block}
                        brandColor={brandColor}
                        isSelected={isSelected}
                        fontFamily={contentFont}
                        onUpdate={(updates) => updateBlock(block.id, updates)}
                        onUpdateLive={(updates) => updateBlockLive(block.id, updates)}
                        onEditorReady={isSelected ? (api) => { activeEditorApiRef.current = api; } : undefined}
                      />

                      {/* Ajouter en dessous */}
                      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); addBlock("text", block.id); }}
                          className="w-6 h-6 bg-brand-600 rounded-full text-white flex items-center justify-center shadow hover:bg-brand-700"
                          title="Ajouter un bloc"
                        >
                          <Plus size={13} />
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
        </div>

        {/* ─── Panneau propriétés ─── */}
        <div className="p-4 bg-white overflow-y-auto" style={{ maxHeight: "600px" }}>
          {selectedBlockId === SETTINGS_ID ? (
            <SettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setSelectedBlockId(null)} />
          ) : selectedBlock ? (
            <BlockProperties
              block={selectedBlock}
              brandColor={brandColor}
              onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
              onDelete={() => deleteBlock(selectedBlock.id)}
              onDuplicate={() => duplicateBlock(selectedBlock.id)}
              onMove={(dir) => moveBlock(selectedBlock.id, dir)}
            />
          ) : (
            <div className="text-center py-10">
              <Palette size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sélectionnez un bloc pour modifier ses propriétés</p>
              <button
                onClick={() => setSelectedBlockId(SETTINGS_ID)}
                className="mt-4 inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <Settings2 size={13} /> Régler le style global de l'email
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Barre variables ─── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-200 flex-wrap">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Variables</span>
        {MERGE_VARS.map((mv) => (
          <button
            key={mv.v}
            onClick={() => {
              // Insère au curseur via l'API de l'éditeur riche sélectionné, sinon repli
              if (activeEditorApiRef.current) {
                activeEditorApiRef.current.insertVariable(mv.v);
              } else if (selectedBlock && (selectedBlock.type === "text" || selectedBlock.type === "heading" || selectedBlock.type === "footer")) {
                updateBlock(selectedBlock.id, { content: selectedBlock.content + " " + mv.v, styles: { ...selectedBlock.styles, _html: "1" } });
              }
            }}
            className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100 transition-colors"
            title={"Insérer " + mv.label}
          >
            {mv.v}
          </button>
        ))}
        <span className="text-[10px] text-gray-300 ml-auto">Sélectionnez un texte puis insérez</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Block renderer (canvas)
// ═══════════════════════════════════════════════════════════
function BlockRenderer({ block, brandColor, isSelected, fontFamily, onUpdate, onUpdateLive, onEditorReady }: {
  block: EmailBlock; brandColor: string; isSelected: boolean; fontFamily: string;
  onUpdate: (u: Partial<EmailBlock>) => void;
  onUpdateLive: (u: Partial<EmailBlock>) => void;
  onEditorReady?: (api: { insertVariable: (v: string) => void }) => void;
}) {
  const wrapStyle: React.CSSProperties = {
    background: block.styles.blockBg || undefined,
    padding: block.styles.padY ? block.styles.padY + " 0" : undefined,
  };

  switch (block.type) {
    case "text":
      return (
        <div style={wrapStyle}>
          <RichTextBlock
            key={block.id}
            initialContent={block.styles._html === "1" ? block.content : plainToHtml(block.content)}
            placeholder="Écrivez votre texte…"
            style={{ color: block.styles.color || "#000000", fontSize: block.styles.fontSize || "15px", textAlign: (block.styles.textAlign as any) || "left", fontFamily }}
            onContentChange={(html) => onUpdateLive({ content: html, styles: { ...block.styles, _html: "1" } })}
            onReady={onEditorReady}
          />
        </div>
      );
    case "footer":
      return (
        <div style={wrapStyle}>
          <RichTextBlock
            key={block.id}
            initialContent={block.styles._html === "1" ? block.content : plainToHtml(block.content)}
            placeholder="Mentions légales, adresse, désinscription…"
            style={{ color: block.styles.color || "#9ca3af", fontSize: block.styles.fontSize || "12px", textAlign: (block.styles.textAlign as any) || "center", fontFamily }}
            onContentChange={(html) => onUpdateLive({ content: html, styles: { ...block.styles, _html: "1" } })}
            onReady={onEditorReady}
          />
        </div>
      );
    case "heading":
      return (
        <div style={wrapStyle}>
          <RichTextBlock
            key={block.id}
            initialContent={block.styles._html === "1" ? block.content : plainToHtml(block.content)}
            placeholder="Votre titre…"
            className="font-bold"
            style={{ color: block.styles.color || brandColor, fontSize: block.styles.fontSize || "22px", textAlign: (block.styles.textAlign as any) || "left", fontFamily }}
            onContentChange={(html) => onUpdateLive({ content: html, styles: { ...block.styles, _html: "1" } })}
            onReady={onEditorReady}
          />
        </div>
      );
    case "button":
      return (
        <div className="px-4 py-4" style={{ ...wrapStyle, textAlign: (block.styles.textAlign as any) || "center" }}>
          <span
            className="inline-block font-semibold text-sm cursor-default"
            style={{
              backgroundColor: block.styles.bgColorBtn || block.styles.bgColor || brandColor,
              color: block.styles.color || "white",
              borderRadius: block.styles.borderRadius || "8px",
              padding: block.styles.btnPad || "12px 28px",
              width: block.styles.fullWidth === "1" ? "100%" : undefined,
              textAlign: "center",
            }}
          >
            {block.content || "Cliquez ici"}
          </span>
        </div>
      );
    case "image":
      return (
        <div className="px-4 py-3" style={{ ...wrapStyle, textAlign: (block.styles.textAlign as any) || "center" }}>
          {block.content ? (
            <img src={block.content} alt={block.styles.alt || ""} className="inline-block max-w-full rounded-lg" style={{ maxHeight: "340px", width: block.styles.width || "100%", borderRadius: block.styles.imgRadius || "8px" }} />
          ) : (
            <div className="bg-gray-100 rounded-lg py-8 px-4 text-center border-2 border-dashed border-gray-300">
              <ImageIcon size={28} className="text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Importez une image ou collez son URL dans les propriétés</p>
            </div>
          )}
        </div>
      );
    case "video":
      return (
        <div className="px-4 py-3" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          <div className="rounded-lg py-10 px-4 text-center relative overflow-hidden" style={{ background: "#111827" }}>
            {block.styles.thumb ? <img src={block.styles.thumb} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" /> : null}
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center mx-auto mb-2">
                <Video size={26} className="text-gray-900" />
              </div>
              <p className="text-xs text-white/70 truncate max-w-[240px] mx-auto">{block.content || "URL de la vidéo (YouTube…)"}</p>
            </div>
          </div>
        </div>
      );
    case "columns":
      return <ColumnsRenderer block={block} brandColor={brandColor} fontFamily={fontFamily} onUpdateLive={onUpdateLive} />;
    case "social":
      return (
        <div className="px-4 py-4" style={{ textAlign: (block.styles.textAlign as any) || "center" }}>
          <SocialRow block={block} />
        </div>
      );
    case "divider":
      return (
        <div className="px-4 py-4" style={wrapStyle}>
          <hr style={{ borderColor: block.styles.color || "#e5e7eb", borderTopWidth: block.styles.borderWidth || "1px", borderStyle: (block.styles.borderStyle as any) || "solid", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />
        </div>
      );
    case "spacer":
      return (
        <div style={{ height: block.styles.height || "24px", background: block.styles.blockBg || undefined }} className="relative">
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-[9px] text-gray-300">{block.styles.height || "24px"}</span></div>
        </div>
      );
    default:
      return <div className="p-4 text-sm text-gray-400">Bloc inconnu</div>;
  }
}

function ColumnsRenderer({ block, brandColor, fontFamily, onUpdateLive }: { block: EmailBlock; brandColor: string; fontFamily: string; onUpdateLive: (u: Partial<EmailBlock>) => void }) {
  const cols = block.children && block.children.length === 2 ? block.children : getDefaultColumns(brandColor);
  const updateCol = (i: number, updates: Partial<EmailBlock>) => {
    const next = [cols[0], cols[1]].map((c, idx) => (idx === i ? { ...c, ...updates } : c));
    onUpdateLive({ children: next });
  };
  const gap = parseInt(block.styles.gap || "16", 10);
  return (
    <div className="px-3 py-3 flex" style={{ gap, background: block.styles.blockBg || undefined }}>
      {cols.map((col, i) => (
        <div key={i} className="flex-1 min-w-0">
          {col.type === "image" ? (
            col.content ? (
              <img src={col.content} alt="" className="max-w-full rounded" style={{ width: "100%" }} />
            ) : (
              <div className="bg-gray-100 rounded py-6 text-center border-2 border-dashed border-gray-300 text-[11px] text-gray-400">Image (URL dans propriétés)</div>
            )
          ) : (
            <RichTextBlock
              key={col.id}
              initialContent={col.styles._html === "1" ? col.content : plainToHtml(col.content)}
              placeholder="Colonne…"
              style={{ color: col.styles.color || "#000000", fontSize: col.styles.fontSize || "14px", textAlign: (col.styles.textAlign as any) || "left", fontFamily }}
              onContentChange={(html) => updateCol(i, { content: html, styles: { ...col.styles, _html: "1" } })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SocialRow({ block }: { block: EmailBlock }) {
  const items = parseSocial(block.content);
  const size = parseInt(block.styles.iconSize || "34", 10);
  if (!items.length) {
    return <p className="text-xs text-gray-400">Ajoutez vos réseaux dans les propriétés</p>;
  }
  return (
    <div className="inline-flex items-center gap-2">
      {items.map((it, i) => {
        const net = getSocialNet(it.network);
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center rounded-full"
            style={{ width: size, height: size, background: net?.color || "#666" }}
            title={net?.label || it.network}
          >
            {net && (
              <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill={net.iconColor || "#ffffff"}>
                <path d={net.path} />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Properties panels
// ═══════════════════════════════════════════════════════════
function BlockProperties({ block, brandColor, onUpdate, onDelete, onDuplicate, onMove }: {
  block: EmailBlock; brandColor: string;
  onUpdate: (u: Partial<EmailBlock>) => void; onDelete: () => void; onDuplicate: () => void; onMove: (d: "up" | "down") => void;
}) {
  const updateStyle = (key: string, value: string) => onUpdate({ styles: { ...block.styles, [key]: value } });

  const LABELS: Record<string, string> = {
    text: "Texte", heading: "Titre", button: "Bouton", image: "Image",
    video: "Vidéo", divider: "Séparateur", spacer: "Espacement",
    columns: "Colonnes", social: "Réseaux sociaux", footer: "Pied de page",
  };
  const isTextual = block.type === "text" || block.type === "heading" || block.type === "footer";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">{LABELS[block.type] || block.type}</h4>
        <div className="flex items-center gap-0.5">
          <IconBtn icon={ChevronUp} title="Monter" onClick={() => onMove("up")} />
          <IconBtn icon={ChevronDown} title="Descendre" onClick={() => onMove("down")} />
          <IconBtn icon={Copy} title="Dupliquer" onClick={onDuplicate} />
          <IconBtn icon={Trash2} title="Supprimer" danger onClick={onDelete} />
        </div>
      </div>

      {block.type === "button" && (
        <>
          <Field label="Texte du bouton">
            <input value={block.content} onChange={(e) => onUpdate({ content: e.target.value })} className="input text-sm" />
          </Field>
          <Field label="Lien (URL)">
            <input value={block.styles.href || ""} onChange={(e) => updateStyle("href", e.target.value)} className="input text-sm" placeholder="https://..." />
          </Field>
          <ColorField label="Couleur du bouton" value={block.styles.bgColorBtn || block.styles.bgColor || brandColor} onChange={(v) => updateStyle("bgColorBtn", v)} />
          <ColorField label="Couleur du texte" value={block.styles.color || "#ffffff"} onChange={(v) => updateStyle("color", v)} />
          <Field label="Rayon des angles">
            <select value={block.styles.borderRadius || "8px"} onChange={(e) => updateStyle("borderRadius", e.target.value)} className="input text-sm">
              <option value="0px">Carré</option>
              <option value="4px">Léger</option>
              <option value="8px">Moyen</option>
              <option value="20px">Arrondi</option>
              <option value="50px">Pilule</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={block.styles.fullWidth === "1"} onChange={(e) => updateStyle("fullWidth", e.target.checked ? "1" : "")} />
            Bouton pleine largeur
          </label>
        </>
      )}

      {block.type === "image" && (
        <>
          <ImageUpload
            value={block.content}
            onChange={(url) => onUpdate({ content: url })}
          />
          <Field label="Texte alternatif (accessibilité)">
            <input value={block.styles.alt || ""} onChange={(e) => updateStyle("alt", e.target.value)} className="input text-sm" placeholder="Description de l'image" />
          </Field>
          <Field label="Lien au clic (optionnel)">
            <input value={block.styles.href || ""} onChange={(e) => updateStyle("href", e.target.value)} className="input text-sm" placeholder="https://..." />
          </Field>
          <Field label="Largeur">
            <select value={block.styles.width || "100%"} onChange={(e) => updateStyle("width", e.target.value)} className="input text-sm">
              <option value="100%">Pleine largeur</option>
              <option value="75%">75%</option>
              <option value="50%">50%</option>
              <option value="200px">Petite (200px)</option>
              <option value="120px">Logo (120px)</option>
            </select>
          </Field>
          <Field label="Arrondi">
            <select value={block.styles.imgRadius || "8px"} onChange={(e) => updateStyle("imgRadius", e.target.value)} className="input text-sm">
              <option value="0px">Aucun</option>
              <option value="8px">Léger</option>
              <option value="16px">Moyen</option>
              <option value="9999px">Cercle</option>
            </select>
          </Field>
        </>
      )}

      {block.type === "video" && (
        <>
          <Field label="URL de la vidéo (YouTube, Vimeo…)">
            <input value={block.content} onChange={(e) => onUpdate({ content: e.target.value })} className="input text-sm" placeholder="https://youtube.com/..." />
          </Field>
          <Field label="Image de couverture (URL)">
            <input value={block.styles.thumb || ""} onChange={(e) => updateStyle("thumb", e.target.value)} className="input text-sm" placeholder="https://... (miniature)" />
          </Field>
        </>
      )}

      {block.type === "columns" && (
        <>
          <ColumnConfig block={block} onUpdate={onUpdate} />
          <Field label="Écart entre colonnes">
            <select value={block.styles.gap || "16"} onChange={(e) => updateStyle("gap", e.target.value)} className="input text-sm">
              <option value="8">Serré</option>
              <option value="16">Normal</option>
              <option value="28">Large</option>
            </select>
          </Field>
        </>
      )}

      {block.type === "social" && (
        <>
          <SocialConfig block={block} onUpdate={onUpdate} />
          <Field label="Taille des icônes">
            <select value={block.styles.iconSize || "34"} onChange={(e) => updateStyle("iconSize", e.target.value)} className="input text-sm">
              <option value="28">Petite</option>
              <option value="34">Moyenne</option>
              <option value="44">Grande</option>
            </select>
          </Field>
        </>
      )}

      {isTextual && (
        <>
          <ColorField label="Couleur du texte" value={block.styles.color || (block.type === "footer" ? "#9ca3af" : block.type === "heading" ? brandColor : "#000000")} onChange={(v) => updateStyle("color", v)} />
          <Field label="Taille de police">
            <select value={block.styles.fontSize || (block.type === "heading" ? "22px" : block.type === "footer" ? "12px" : "15px")} onChange={(e) => updateStyle("fontSize", e.target.value)} className="input text-sm">
              <option value="12px">Petit (12px)</option>
              <option value="14px">Normal (14px)</option>
              <option value="15px">Moyen (15px)</option>
              <option value="16px">Grand (16px)</option>
              <option value="18px">Très grand (18px)</option>
              <option value="22px">Titre (22px)</option>
              <option value="28px">Gros titre (28px)</option>
              <option value="34px">Énorme (34px)</option>
            </select>
          </Field>
        </>
      )}

      {/* Alignement (blocs alignables) */}
      {block.type !== "spacer" && block.type !== "divider" && (
        <Field label="Alignement">
          <div className="flex items-center gap-1">
            {[{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateStyle("textAlign", opt.value)}
                  className={cn("p-2 rounded-md transition-colors", (block.styles.textAlign || (block.type === "footer" || block.type === "button" || block.type === "social" ? "center" : "left")) === opt.value ? "bg-brand-50 text-brand-600" : "text-gray-400 hover:bg-gray-100")}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {block.type === "spacer" && (
        <Field label="Hauteur">
          <select value={block.styles.height || "24px"} onChange={(e) => updateStyle("height", e.target.value)} className="input text-sm">
            <option value="8px">XS (8px)</option>
            <option value="16px">S (16px)</option>
            <option value="24px">M (24px)</option>
            <option value="40px">L (40px)</option>
            <option value="60px">XL (60px)</option>
          </select>
        </Field>
      )}

      {block.type === "divider" && (
        <>
          <ColorField label="Couleur" value={block.styles.color || "#e5e7eb"} onChange={(v) => updateStyle("color", v)} />
          <Field label="Style">
            <select value={block.styles.borderStyle || "solid"} onChange={(e) => updateStyle("borderStyle", e.target.value)} className="input text-sm">
              <option value="solid">Solide</option>
              <option value="dashed">Tirets</option>
              <option value="dotted">Points</option>
            </select>
          </Field>
          <Field label="Épaisseur">
            <select value={block.styles.borderWidth || "1px"} onChange={(e) => updateStyle("borderWidth", e.target.value)} className="input text-sm">
              <option value="1px">Fin</option>
              <option value="2px">Moyen</option>
              <option value="3px">Épais</option>
            </select>
          </Field>
        </>
      )}

      {/* Style de bloc (fond + espacement) — pour blocs à conteneur */}
      {(block.type === "text" || block.type === "heading" || block.type === "footer" || block.type === "button" || block.type === "image" || block.type === "columns") && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Fond du bloc</p>
          <ColorField label="Couleur de fond" value={block.styles.blockBg || "#ffffff"} onChange={(v) => updateStyle("blockBg", v)} allowClear onClear={() => updateStyle("blockBg", "")} />
          <Field label="Espacement vertical">
            <select value={block.styles.padY || ""} onChange={(e) => updateStyle("padY", e.target.value)} className="input text-sm">
              <option value="">Aucun</option>
              <option value="8px">Petit</option>
              <option value="16px">Moyen</option>
              <option value="28px">Grand</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ settings, onUpdate, onClose }: { settings: Record<string, string>; onUpdate: (u: Record<string, string>) => void; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Settings2 size={15} /> Style de l'email</h4>
        <IconBtn icon={X} title="Fermer" onClick={onClose} />
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">Réglages appliqués à tout l'email (fond, largeur, police).</p>

      <ColorField label="Fond de la page" value={settings.bodyBg || "#f3f4f6"} onChange={(v) => onUpdate({ bodyBg: v })} />
      <ColorField label="Fond du contenu" value={settings.contentBg || "#ffffff"} onChange={(v) => onUpdate({ contentBg: v })} />
      <Field label="Largeur du contenu">
        <select value={settings.contentWidth || "600"} onChange={(e) => onUpdate({ contentWidth: e.target.value })} className="input text-sm">
          <option value="520">Étroit (520px)</option>
          <option value="600">Standard (600px)</option>
          <option value="680">Large (680px)</option>
        </select>
      </Field>
      <Field label="Police">
        <select value={settings.fontFamily || "system"} onChange={(e) => onUpdate({ fontFamily: e.target.value })} className="input text-sm">
          <option value="system">Système (par défaut)</option>
          <optgroup label="Sans serif">
            <option value="arial">Arial</option>
            <option value="helvetica">Helvetica</option>
            <option value="verdana">Verdana</option>
            <option value="tahoma">Tahoma</option>
            <option value="trebuchet">Trebuchet MS</option>
            <option value="lucida">Lucida Sans</option>
            <option value="century">Century Gothic</option>
          </optgroup>
          <optgroup label="Serif">
            <option value="georgia">Georgia</option>
            <option value="times">Times New Roman</option>
            <option value="palatino">Palatino</option>
            <option value="garamond">Garamond</option>
          </optgroup>
          <optgroup label="Monospace">
            <option value="courier">Courier New</option>
          </optgroup>
        </select>
      </Field>
    </div>
  );
}

// ─── Config colonnes ───
function ColumnConfig({ block, onUpdate }: { block: EmailBlock; onUpdate: (u: Partial<EmailBlock>) => void }) {
  const cols = block.children && block.children.length === 2 ? block.children : getDefaultColumns("#1B4F72");
  const setColType = (i: number, type: "text" | "image") => {
    const next = cols.map((c, idx) => (idx === i ? { ...c, type } : c));
    onUpdate({ children: next });
  };
  const setColContent = (i: number, content: string) => {
    const next = cols.map((c, idx) => (idx === i ? { ...c, content } : c));
    onUpdate({ children: next });
  };
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-2.5 space-y-2">
          <p className="text-[11px] font-medium text-gray-500">Colonne {i + 1}</p>
          <div className="flex gap-1">
            {(["text", "image"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setColType(i, t)}
                className={cn("flex-1 text-[11px] py-1 rounded", cols[i].type === t ? "bg-brand-50 text-brand-600 font-medium" : "bg-gray-100 text-gray-500")}
              >
                {t === "text" ? "Texte" : "Image"}
              </button>
            ))}
          </div>
          {cols[i].type === "image" && (
            <input value={cols[i].content} onChange={(e) => setColContent(i, e.target.value)} className="input text-xs" placeholder="URL de l'image" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Config réseaux sociaux ───
function SocialConfig({ block, onUpdate }: { block: EmailBlock; onUpdate: (u: Partial<EmailBlock>) => void }) {
  const items = parseSocial(block.content);
  const set = (next: { network: string; url: string }[]) => onUpdate({ content: JSON.stringify(next) });
  const add = (network: string) => {
    if (items.find((it) => it.network === network)) return;
    set([...items, { network, url: "" }]);
  };
  const update = (i: number, url: string) => set(items.map((it, idx) => (idx === i ? { ...it, url } : it)));
  const remove = (i: number) => set(items.filter((_, idx) => idx !== i));
  const available = SOCIAL_NETWORKS.filter((n) => !items.find((it) => it.network === n.key));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const net = getSocialNet(it.network);
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: net?.color || "#666" }}>
              {net && <svg width={13} height={13} viewBox="0 0 24 24" fill={net.iconColor || "#ffffff"}><path d={net.path} /></svg>}
            </span>
            <input value={it.url} onChange={(e) => update(i, e.target.value)} className="input text-xs flex-1" placeholder={(net?.label || it.network) + " URL"} />
            <button onClick={() => remove(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        );
      })}
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) add(e.target.value); }}
          className="input text-xs"
        >
          <option value="">+ Ajouter un réseau…</option>
          {available.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
        </select>
      )}
    </div>
  );
}

// ─── Upload image ───
function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Échec de l'upload");
      onChange(data.url);
    } catch (e: any) {
      setErr(e.message || "Erreur");
    }
    setUploading(false);
  };

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">Image</label>
      {value && (
        <div className="mb-2 rounded-lg overflow-hidden border border-gray-200">
          <img src={value} alt="" className="w-full max-h-32 object-contain bg-gray-50" />
        </div>
      )}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg py-4 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
      >
        {uploading ? (
          <span className="inline-flex items-center gap-2 text-xs text-gray-500"><Loader2 size={14} className="animate-spin" /> Envoi…</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Upload size={14} /> Glisser-déposer ou cliquer</span>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>
      {err && <p className="text-[11px] text-red-500 mt-1">{err}</p>}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input text-xs mt-2" placeholder="…ou collez une URL" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Small UI helpers
// ═══════════════════════════════════════════════════════════
function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors" title={label}>
      <Icon size={14} />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
function Sep() { return <div className="w-px h-5 bg-gray-300 mx-1" />; }
function IconBtn({ icon: Icon, title, onClick, danger }: { icon: typeof Type; title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) {
  return <button onClick={onClick} title={title} className={cn("p-1 rounded hover:bg-gray-100 text-gray-400", danger && "hover:bg-red-50 hover:text-red-500")}><Icon size={14} /></button>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-gray-500 block mb-1">{label}</label>{children}</div>;
}
function ColorField({ label, value, onChange, allowClear, onClear }: { label: string; value: string; onChange: (v: string) => void; allowClear?: boolean; onClear?: () => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value.startsWith("#") ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border border-gray-200 cursor-pointer shrink-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="input text-xs font-mono flex-1 min-w-0" />
        {allowClear && <button onClick={onClear} className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0">Aucun</button>}
      </div>
    </Field>
  );
}

// ═══════════════════════════════════════════════════════════
//  Defaults & helpers
// ═══════════════════════════════════════════════════════════
function getDefaultContent(type: EmailBlock["type"]): string {
  switch (type) {
    case "heading": return "Votre titre ici";
    case "button": return "Cliquez ici";
    case "footer": return "Vous recevez cet email car vous avez manifesté un intérêt pour nos programmes.\nÉcole — Adresse — Ville";
    case "social": return "[]";
    default: return "";
  }
}
function getDefaultStyles(type: EmailBlock["type"], brandColor: string): Record<string, string> {
  switch (type) {
    case "text": return { fontSize: "15px", color: "#000000", textAlign: "left" };
    case "heading": return { fontSize: "22px", color: brandColor, textAlign: "left" };
    case "footer": return { fontSize: "12px", color: "#9ca3af", textAlign: "center" };
    case "button": return { bgColorBtn: brandColor, color: "#ffffff", textAlign: "center", borderRadius: "8px", href: "#" };
    case "image": return { textAlign: "center", width: "100%", imgRadius: "8px" };
    case "video": return { textAlign: "center" };
    case "columns": return { gap: "16", textAlign: "left" };
    case "social": return { textAlign: "center", iconSize: "34" };
    case "divider": return { color: "#e5e7eb", borderWidth: "1px", borderStyle: "solid" };
    case "spacer": return { height: "24px" };
    default: return {};
  }
}
function getDefaultColumns(brandColor: string): EmailBlock[] {
  return [
    { id: genId(), type: "text", content: "", styles: { fontSize: "14px", color: "#000000", textAlign: "left" } },
    { id: genId(), type: "text", content: "", styles: { fontSize: "14px", color: "#000000", textAlign: "left" } },
  ];
}

function parseSocial(content: string): { network: string; url: string }[] {
  try {
    const arr = JSON.parse(content || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function fontStack(font?: string): string {
  switch (font) {
    case "arial": return "Arial, Helvetica, sans-serif";
    case "helvetica": return "Helvetica, Arial, sans-serif";
    case "verdana": return "Verdana, Geneva, sans-serif";
    case "tahoma": return "Tahoma, Geneva, sans-serif";
    case "trebuchet": return "'Trebuchet MS', Helvetica, sans-serif";
    case "lucida": return "'Lucida Sans Unicode', 'Lucida Grande', sans-serif";
    case "century": return "'Century Gothic', 'Apple Gothic', sans-serif";
    case "georgia": return "Georgia, 'Times New Roman', serif";
    case "times": return "'Times New Roman', Times, serif";
    case "palatino": return "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
    case "garamond": return "Garamond, 'Times New Roman', serif";
    case "courier": return "'Courier New', Courier, monospace";
    default: return "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif";
  }
}

// Convertit un texte brut (ancien format) en HTML pour le contentEditable
function plainToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}
function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Nettoyage léger du HTML produit par le contentEditable (usage interne)
function sanitizeHtml(html: string): string {
  return (html || "")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\scontenteditable\s*=\s*"[^"]*"/gi, "");
}
function isRich(block: EmailBlock): boolean { return block.styles._html === "1"; }

// ─── Rendu HTML d'un bloc (email-safe) ───
function renderTextual(block: EmailBlock, fallbackColor: string, fallbackSize: string, fallbackAlign: string): string {
  const align = block.styles.textAlign || fallbackAlign;
  const fs = block.styles.fontSize || fallbackSize;
  const col = block.styles.color || fallbackColor;
  const weight = block.type === "heading" ? "font-weight:700;" : "";
  if (isRich(block)) {
    return '<div style="font-size:' + fs + ";color:" + col + ";text-align:" + align + ";line-height:1.6;" + weight + '">' + sanitizeHtml(block.content) + "</div>";
  }
  if (block.type === "heading") {
    return '<h2 style="margin:0 0 12px;font-size:' + fs + ";color:" + col + ";text-align:" + align + ';font-weight:700;">' + escapeHtml(block.content) + "</h2>";
  }
  // texte / footer brut : paragraphes
  return block.content.split("\n").map((line) =>
    '<p style="margin:0 0 8px;line-height:1.6;font-size:' + fs + ";color:" + col + ";text-align:" + align + ';">' + (escapeHtml(line) || "&nbsp;") + "</p>"
  ).join("");
}

function wrapBlock(html: string, block: EmailBlock): string {
  const bg = block.styles.blockBg;
  const py = block.styles.padY;
  if (!bg && !py) return html;
  return '<div style="' + (bg ? "background:" + bg + ";" : "") + (py ? "padding:" + py + " 0;" : "") + '">' + html + "</div>";
}

function renderBlockHtml(block: EmailBlock, brandColor: string): string {
  switch (block.type) {
    case "text":
      return wrapBlock(renderTextual(block, "#000000", "15px", "left"), block);
    case "footer":
      return wrapBlock(renderTextual(block, "#9ca3af", "12px", "center"), block);
    case "heading":
      return wrapBlock(renderTextual(block, brandColor, "22px", "left"), block);
    case "button": {
      const bg = block.styles.bgColorBtn || block.styles.bgColor || brandColor;
      const full = block.styles.fullWidth === "1";
      return wrapBlock(
        '<div style="text-align:' + (block.styles.textAlign || "center") + ';padding:8px 0;">' +
        '<a href="' + (block.styles.href || "#") + '" style="' + (full ? "display:block;" : "display:inline-block;") +
        (block.styles.btnPad ? "padding:" + block.styles.btnPad + ";" : "padding:12px 28px;") +
        "background:" + bg + ";color:" + (block.styles.color || "white") + ";border-radius:" + (block.styles.borderRadius || "8px") +
        ';text-decoration:none;font-weight:600;font-size:14px;text-align:center;">' + escapeHtml(block.content) + "</a></div>",
        block
      );
    }
    case "image": {
      if (!block.content) return "";
      const img = '<img src="' + block.content + '" alt="' + escapeHtml(block.styles.alt || "") + '" style="max-width:100%;width:' + (block.styles.width || "100%") + ";border-radius:" + (block.styles.imgRadius || "8px") + ';display:inline-block;" />';
      const linked = block.styles.href ? '<a href="' + block.styles.href + '">' + img + "</a>" : img;
      return wrapBlock('<div style="text-align:' + (block.styles.textAlign || "center") + ';padding:8px 0;">' + linked + "</div>", block);
    }
    case "video": {
      if (!block.content) return "";
      const cover = block.styles.thumb
        ? '<img src="' + block.styles.thumb + '" alt="" style="max-width:100%;border-radius:8px;display:block;margin:0 auto;" />'
        : '<div style="background:#111827;color:#fff;padding:22px 32px;border-radius:8px;display:inline-block;">▶ Regarder la vidéo</div>';
      return '<div style="text-align:center;padding:8px 0;"><a href="' + block.content + '" style="text-decoration:none;">' + cover + "</a></div>";
    }
    case "columns": {
      const cols = block.children && block.children.length === 2 ? block.children : getDefaultColumns(brandColor);
      const gap = parseInt(block.styles.gap || "16", 10);
      const cell = (c: EmailBlock) => {
        if (c.type === "image") {
          return c.content ? '<img src="' + c.content + '" alt="" style="max-width:100%;width:100%;border-radius:6px;display:block;" />' : "";
        }
        return renderTextual(c, "#555", "14px", "left");
      };
      return wrapBlock(
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>' +
        '<td valign="top" style="width:50%;padding-right:' + gap / 2 + 'px;">' + cell(cols[0]) + "</td>" +
        '<td valign="top" style="width:50%;padding-left:' + gap / 2 + 'px;">' + cell(cols[1]) + "</td>" +
        "</tr></table>",
        block
      );
    }
    case "social": {
      const items = parseSocial(block.content).filter((it) => it.url);
      if (!items.length) return "";
      const size = parseInt(block.styles.iconSize || "34", 10);
      const badges = items.map((it) => {
        const net = getSocialNet(it.network);
        return net ? socialBadgeHtml(net, it.url, size) : "";
      }).join("");
      return '<div style="text-align:' + (block.styles.textAlign || "center") + ';padding:12px 0;">' + badges + "</div>";
    }
    case "divider":
      return wrapBlock('<hr style="border:none;border-top:' + (block.styles.borderWidth || "1px") + " " + (block.styles.borderStyle || "solid") + " " + (block.styles.color || "#e5e7eb") + ';margin:16px 0;" />', block);
    case "spacer":
      return '<div style="height:' + (block.styles.height || "24px") + ";" + (block.styles.blockBg ? "background:" + block.styles.blockBg + ";" : "") + '"></div>';
    default:
      return "";
  }
}

export function blocksToPreviewHtml(blocks: EmailBlock[], brandColor: string): string {
  const content = blocks.filter((b) => b.type !== "settings");
  const slotIdx = signatureSlotIndex(content);
  let html = content
    .map((b, i) => {
      const inner = renderBlockHtml(b, brandColor);
      const wrapped = b.type === "footer" ? FOOTER_BLOCK_START + inner + FOOTER_BLOCK_END : inner;
      return (i === slotIdx ? SIGNATURE_SLOT : "") + wrapped;
    })
    .join("");
  // Pas de section de bas (réseaux/footer) : marqueur en fin de contenu (DANS la carte).
  if (slotIdx === -1) html += SIGNATURE_SLOT;
  return html;
}

export function blocksToHtml(blocks: EmailBlock[], brandColor: string): string {
  const settings = blocks.find((b) => b.type === "settings")?.styles || {};
  const bodyBg = settings.bodyBg || "#f8f9fa";
  const contentBg = settings.contentBg || "#ffffff";
  const width = settings.contentWidth || "600";
  const font = fontStack(settings.fontFamily);
  const content = blocksToPreviewHtml(blocks, brandColor);
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;font-family:' + font + ";background:" + bodyBg + ';padding:40px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:' + bodyBg + ';"><tr><td align="center">' +
    '<div style="max-width:' + width + "px;margin:0 auto;background:" + contentBg + ';border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    '<div style="padding:32px;">' + content + "</div>" +
    "</div></td></tr></table></body></html>";
}
