"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link2, Unlink, Type,
  ChevronDown, Minus, Undo2, Redo2, Eraser,
} from "lucide-react";

interface RichTextToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onContentChange: (html: string) => void;
}

var FONT_FAMILIES = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet" },
  { value: "Times New Roman, serif", label: "Times" },
  { value: "Courier New, monospace", label: "Courier" },
  { value: "Tahoma, sans-serif", label: "Tahoma" },
];

var FONT_SIZES = [
  { value: "1", label: "10px" },
  { value: "2", label: "12px" },
  { value: "3", label: "14px" },
  { value: "4", label: "16px" },
  { value: "5", label: "18px" },
  { value: "6", label: "22px" },
  { value: "7", label: "28px" },
];

var HEADING_OPTIONS = [
  { value: "p", label: "Normal" },
  { value: "h1", label: "Titre 1" },
  { value: "h2", label: "Titre 2" },
  { value: "h3", label: "Titre 3" },
];

var COLORS = [
  "#000000", "#333333", "#555555", "#888888", "#AAAAAA",
  "#1B4F72", "#2E86C1", "#3498DB", "#85C1E9",
  "#196F3D", "#27AE60", "#82E0AA",
  "#B7950B", "#F1C40F", "#F9E79F",
  "#A93226", "#E74C3C", "#F5B7B1",
  "#6C3483", "#9B59B6", "#D2B4DE",
  "#E67E22", "#F39C12", "#FAD7A0",
];

export function RichTextToolbar({ editorRef, onContentChange }: RichTextToolbarProps) {
  var [showColorPicker, setShowColorPicker] = useState(false);
  var [showBgColorPicker, setShowBgColorPicker] = useState(false);
  var [showLinkInput, setShowLinkInput] = useState(false);
  var [linkUrl, setLinkUrl] = useState("");

  var exec = useCallback(function(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Trigger content change
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  }, [editorRef, onContentChange]);

  var handleLink = function() {
    if (showLinkInput) {
      if (linkUrl) {
        exec("createLink", linkUrl);
      }
      setShowLinkInput(false);
      setLinkUrl("");
    } else {
      setShowLinkInput(true);
    }
  };

  var handleUnlink = function() {
    exec("unlink");
  };

  var handleHeading = function(value: string) {
    if (value === "p") {
      exec("formatBlock", "p");
    } else {
      exec("formatBlock", value);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-t-lg px-2 py-1.5 flex flex-wrap items-center gap-0.5">
      {/* Heading / block format */}
      <select
        onChange={function(e) { handleHeading(e.target.value); }}
        className="h-7 px-1.5 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer hover:border-gray-300"
        defaultValue="p"
      >
        {HEADING_OPTIONS.map(function(h) {
          return <option key={h.value} value={h.value}>{h.label}</option>;
        })}
      </select>

      {/* Font family */}
      <select
        onChange={function(e) { exec("fontName", e.target.value); }}
        className="h-7 px-1.5 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer hover:border-gray-300 w-20"
        defaultValue="Arial, Helvetica, sans-serif"
      >
        {FONT_FAMILIES.map(function(f) {
          return <option key={f.value} value={f.value}>{f.label}</option>;
        })}
      </select>

      {/* Font size */}
      <select
        onChange={function(e) { exec("fontSize", e.target.value); }}
        className="h-7 px-1.5 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer hover:border-gray-300 w-16"
        defaultValue="3"
      >
        {FONT_SIZES.map(function(s) {
          return <option key={s.value} value={s.value}>{s.label}</option>;
        })}
      </select>

      <Divider />

      {/* Bold, Italic, Underline, Strikethrough */}
      <ToolBtn icon={Bold} onClick={function() { exec("bold"); }} title="Gras" />
      <ToolBtn icon={Italic} onClick={function() { exec("italic"); }} title="Italique" />
      <ToolBtn icon={Underline} onClick={function() { exec("underline"); }} title="Souligne" />
      <ToolBtn icon={Strikethrough} onClick={function() { exec("strikeThrough"); }} title="Barre" />

      <Divider />

      {/* Text color */}
      <div className="relative">
        <button
          onClick={function() { setShowColorPicker(!showColorPicker); setShowBgColorPicker(false); }}
          className="flex items-center gap-0.5 h-7 px-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors"
          title="Couleur du texte"
        >
          <span className="text-[11px] font-bold">A</span>
          <div className="w-4 h-1 bg-red-500 rounded-sm" />
          <ChevronDown size={10} />
        </button>
        {showColorPicker && (
          <ColorGrid
            onSelect={function(color) { exec("foreColor", color); setShowColorPicker(false); }}
            onClose={function() { setShowColorPicker(false); }}
          />
        )}
      </div>

      {/* Background color */}
      <div className="relative">
        <button
          onClick={function() { setShowBgColorPicker(!showBgColorPicker); setShowColorPicker(false); }}
          className="flex items-center gap-0.5 h-7 px-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors"
          title="Couleur de fond"
        >
          <span className="text-[11px] font-bold px-0.5 bg-yellow-200 rounded">A</span>
          <ChevronDown size={10} />
        </button>
        {showBgColorPicker && (
          <ColorGrid
            onSelect={function(color) { exec("hiliteColor", color); setShowBgColorPicker(false); }}
            onClose={function() { setShowBgColorPicker(false); }}
          />
        )}
      </div>

      <Divider />

      {/* Alignment */}
      <ToolBtn icon={AlignLeft} onClick={function() { exec("justifyLeft"); }} title="Aligner a gauche" />
      <ToolBtn icon={AlignCenter} onClick={function() { exec("justifyCenter"); }} title="Centrer" />
      <ToolBtn icon={AlignRight} onClick={function() { exec("justifyRight"); }} title="Aligner a droite" />
      <ToolBtn icon={AlignJustify} onClick={function() { exec("justifyFull"); }} title="Justifier" />

      <Divider />

      {/* Lists */}
      <ToolBtn icon={List} onClick={function() { exec("insertUnorderedList"); }} title="Liste a puces" />
      <ToolBtn icon={ListOrdered} onClick={function() { exec("insertOrderedList"); }} title="Liste numerotee" />

      <Divider />

      {/* Link */}
      <ToolBtn icon={Link2} onClick={handleLink} title="Ajouter un lien" active={showLinkInput} />
      <ToolBtn icon={Unlink} onClick={handleUnlink} title="Retirer le lien" />

      <Divider />

      {/* Undo/Redo */}
      <ToolBtn icon={Undo2} onClick={function() { exec("undo"); }} title="Annuler" />
      <ToolBtn icon={Redo2} onClick={function() { exec("redo"); }} title="Retablir" />

      {/* Clear formatting */}
      <ToolBtn icon={Eraser} onClick={function() { exec("removeFormat"); }} title="Effacer la mise en forme" />

      {/* Link URL input */}
      {showLinkInput && (
        <div className="flex items-center gap-1 ml-2 animate-scale-in">
          <input
            value={linkUrl}
            onChange={function(e) { setLinkUrl(e.target.value); }}
            placeholder="https://..."
            className="h-7 px-2 text-[11px] bg-white border border-gray-300 rounded outline-none w-44 focus:border-brand-500"
            onKeyDown={function(e) { if (e.key === "Enter") handleLink(); }}
            autoFocus
          />
          <button onClick={handleLink} className="h-7 px-2 text-[10px] bg-brand-600 text-white rounded hover:bg-brand-700 font-medium">OK</button>
          <button onClick={function() { setShowLinkInput(false); setLinkUrl(""); }} className="h-7 px-1.5 text-gray-400 hover:text-gray-600">
            <Minus size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon: Icon, onClick, title, active }: { icon: typeof Bold; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onMouseDown={function(e) { e.preventDefault(); }}
      onClick={onClick}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        active ? "bg-brand-100 text-brand-700" : "text-gray-600 hover:bg-gray-200"
      )}
      title={title}
    >
      <Icon size={14} />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-300 mx-0.5" />;
}

function ColorGrid({ onSelect, onClose }: { onSelect: (c: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2 animate-scale-in">
        <div className="grid grid-cols-5 gap-1" style={{ width: "130px" }}>
          {COLORS.map(function(color) {
            return (
              <button
                key={color}
                onClick={function() { onSelect(color); }}
                className="w-5 h-5 rounded border border-gray-200 hover:scale-125 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            );
          })}
        </div>
        {/* Custom color */}
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
          <input
            type="color"
            onChange={function(e) { onSelect(e.target.value); }}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0"
          />
          <span className="text-[10px] text-gray-400">Personnalise</span>
        </div>
      </div>
    </>
  );
}
