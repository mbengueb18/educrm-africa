"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link2, Unlink,
  ChevronDown, Minus, Undo2, Redo2, Eraser,
} from "lucide-react";

interface RichTextBlockProps {
  initialContent: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
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
  { value: "div", label: "Normal" },
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

export function RichTextBlock({ initialContent, placeholder, style, className, onContentChange }: RichTextBlockProps) {
  var editorRef = useRef<HTMLDivElement>(null);
  var [showColorPicker, setShowColorPicker] = useState(false);
  var [showBgColorPicker, setShowBgColorPicker] = useState(false);
  var [showLinkInput, setShowLinkInput] = useState(false);
  var [linkUrl, setLinkUrl] = useState("");
  var [isEmpty, setIsEmpty] = useState(!initialContent);
  var contentSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Set initial content only once on mount
  useEffect(function() {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      setIsEmpty(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sync to parent
  var syncToParent = useCallback(function() {
    if (contentSyncRef.current) clearTimeout(contentSyncRef.current);
    contentSyncRef.current = setTimeout(function() {
      if (editorRef.current) {
        onContentChange(editorRef.current.innerHTML);
      }
    }, 500);
  }, [onContentChange]);

  // Execute command on the editor
  var exec = useCallback(function(command: string, value?: string) {
    // Focus the editor first
    editorRef.current?.focus();

    // Small delay to ensure focus is set
    requestAnimationFrame(function() {
      document.execCommand(command, false, value);
      syncToParent();
    });
  }, [syncToParent]);

  // Direct exec without delay (for buttons that use preventDefault)
  var execDirect = useCallback(function(command: string, value?: string) {
    document.execCommand(command, false, value);
    syncToParent();
  }, [syncToParent]);

  var handleInput = function() {
    if (editorRef.current) {
      var text = editorRef.current.textContent || "";
      setIsEmpty(!text.trim());
      syncToParent();
    }
  };

  var handleBlur = function() {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  };

  // Prevent toolbar from stealing focus
  var preventFocus = function(e: React.MouseEvent) {
    e.preventDefault();
  };

  var handleSelectChange = function(command: string, value: string) {
    // For selects: save selection, re-focus, restore, execute
    var sel = window.getSelection();
    var savedRange: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    editorRef.current?.focus();

    requestAnimationFrame(function() {
      if (savedRange) {
        var sel2 = window.getSelection();
        if (sel2) {
          sel2.removeAllRanges();
          sel2.addRange(savedRange);
        }
      }
      document.execCommand(command, false, value);
      syncToParent();
    });
  };

  var handleLink = function() {
    if (showLinkInput && linkUrl) {
      execDirect("createLink", linkUrl);
      setShowLinkInput(false);
      setLinkUrl("");
    } else {
      setShowLinkInput(true);
    }
  };

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="bg-gray-50/90 border-b border-gray-200 px-2 py-1 flex flex-wrap items-center gap-0.5">
        {/* Heading */}
        <select
          onChange={function(e) { handleSelectChange("formatBlock", e.target.value); }}
          className="h-7 px-1 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer"
          defaultValue="div"
        >
          {HEADING_OPTIONS.map(function(h) {
            return <option key={h.value} value={h.value}>{h.label}</option>;
          })}
        </select>

        {/* Font family */}
        <select
          onChange={function(e) { handleSelectChange("fontName", e.target.value); }}
          className="h-7 px-1 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer w-[76px]"
          defaultValue="Arial, Helvetica, sans-serif"
        >
          {FONT_FAMILIES.map(function(f) {
            return <option key={f.value} value={f.value}>{f.label}</option>;
          })}
        </select>

        {/* Font size */}
        <select
          onChange={function(e) { handleSelectChange("fontSize", e.target.value); }}
          className="h-7 px-1 text-[11px] bg-white border border-gray-200 rounded text-gray-600 outline-none cursor-pointer w-[60px]"
          defaultValue="3"
        >
          {FONT_SIZES.map(function(s) {
            return <option key={s.value} value={s.value}>{s.label}</option>;
          })}
        </select>

        <Sep />

        <Btn icon={Bold} onMouseDown={preventFocus} onClick={function() { execDirect("bold"); }} title="Gras" />
        <Btn icon={Italic} onMouseDown={preventFocus} onClick={function() { execDirect("italic"); }} title="Italique" />
        <Btn icon={Underline} onMouseDown={preventFocus} onClick={function() { execDirect("underline"); }} title="Souligne" />
        <Btn icon={Strikethrough} onMouseDown={preventFocus} onClick={function() { execDirect("strikeThrough"); }} title="Barre" />

        <Sep />

        {/* Text color */}
        <div className="relative">
          <button onMouseDown={preventFocus} onClick={function() { setShowColorPicker(!showColorPicker); setShowBgColorPicker(false); }}
            className="flex items-center gap-0.5 h-7 px-1.5 rounded text-gray-600 hover:bg-gray-200" title="Couleur">
            <span className="text-[11px] font-bold">A</span>
            <div className="w-3.5 h-1 bg-red-500 rounded-sm" />
            <ChevronDown size={9} />
          </button>
          {showColorPicker && (
            <Palette onSelect={function(c) { execDirect("foreColor", c); setShowColorPicker(false); }} onClose={function() { setShowColorPicker(false); }} />
          )}
        </div>

        {/* Bg color */}
        <div className="relative">
          <button onMouseDown={preventFocus} onClick={function() { setShowBgColorPicker(!showBgColorPicker); setShowColorPicker(false); }}
            className="flex items-center gap-0.5 h-7 px-1.5 rounded text-gray-600 hover:bg-gray-200" title="Surlignage">
            <span className="text-[11px] font-bold px-0.5 bg-yellow-200 rounded">A</span>
            <ChevronDown size={9} />
          </button>
          {showBgColorPicker && (
            <Palette onSelect={function(c) { execDirect("hiliteColor", c); setShowBgColorPicker(false); }} onClose={function() { setShowBgColorPicker(false); }} />
          )}
        </div>

        <Sep />

        <Btn icon={AlignLeft} onMouseDown={preventFocus} onClick={function() { execDirect("justifyLeft"); }} title="Gauche" />
        <Btn icon={AlignCenter} onMouseDown={preventFocus} onClick={function() { execDirect("justifyCenter"); }} title="Centre" />
        <Btn icon={AlignRight} onMouseDown={preventFocus} onClick={function() { execDirect("justifyRight"); }} title="Droite" />
        <Btn icon={AlignJustify} onMouseDown={preventFocus} onClick={function() { execDirect("justifyFull"); }} title="Justifier" />

        <Sep />

        <Btn icon={List} onMouseDown={preventFocus} onClick={function() { execDirect("insertUnorderedList"); }} title="Puces" />
        <Btn icon={ListOrdered} onMouseDown={preventFocus} onClick={function() { execDirect("insertOrderedList"); }} title="Numerotee" />

        <Sep />

        <Btn icon={Link2} onMouseDown={preventFocus} onClick={handleLink} title="Lien" />
        <Btn icon={Unlink} onMouseDown={preventFocus} onClick={function() { execDirect("unlink"); }} title="Retirer lien" />

        <Sep />

        <Btn icon={Undo2} onMouseDown={preventFocus} onClick={function() { execDirect("undo"); }} title="Annuler" />
        <Btn icon={Redo2} onMouseDown={preventFocus} onClick={function() { execDirect("redo"); }} title="Retablir" />
        <Btn icon={Eraser} onMouseDown={preventFocus} onClick={function() { execDirect("removeFormat"); }} title="Effacer" />

        {showLinkInput && (
          <div className="flex items-center gap-1 ml-1">
            <input value={linkUrl} onChange={function(e) { setLinkUrl(e.target.value); }}
              placeholder="https://..." className="h-7 px-2 text-[11px] bg-white border border-gray-300 rounded outline-none w-40"
              onKeyDown={function(e) { if (e.key === "Enter") handleLink(); }}
              onClick={function(e) { e.stopPropagation(); }} autoFocus />
            <button onMouseDown={preventFocus} onClick={handleLink} className="h-7 px-2 text-[10px] bg-brand-600 text-white rounded font-medium">OK</button>
            <button onMouseDown={preventFocus} onClick={function() { setShowLinkInput(false); setLinkUrl(""); }} className="h-7 px-1 text-gray-400">
              <Minus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Editor area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className={cn("w-full outline-none leading-relaxed px-5 py-3 min-h-[60px]", className)}
          style={style}
          onInput={handleInput}
          onBlur={handleBlur}
        />
        {isEmpty && placeholder && (
          <div className="absolute top-3 left-5 text-gray-400 pointer-events-none text-sm" style={style}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small components ───
function Btn({ icon: Icon, onClick, onMouseDown, title }: { icon: typeof Bold; onClick: () => void; onMouseDown?: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button onMouseDown={onMouseDown} onClick={onClick}
      className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-200 transition-colors" title={title}>
      <Icon size={14} />
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-300 mx-0.5" />;
}

function Palette({ onSelect, onClose }: { onSelect: (c: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
        <div className="grid grid-cols-5 gap-1" style={{ width: "130px" }}>
          {COLORS.map(function(color) {
            return (
              <button key={color} onMouseDown={function(e) { e.preventDefault(); }} onClick={function() { onSelect(color); }}
                className="w-5 h-5 rounded border border-gray-200 hover:scale-125 transition-transform" style={{ backgroundColor: color }} />
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
          <input type="color" onMouseDown={function(e) { e.stopPropagation(); }} onChange={function(e) { onSelect(e.target.value); }}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0" />
          <span className="text-[10px] text-gray-400">Personnalise</span>
        </div>
      </div>
    </>
  );
}