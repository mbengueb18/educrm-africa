"use client";

import { useState } from "react";
import { createSupportTicket } from "@/app/(dashboard)/support/actions";
import { toast } from "sonner";
import { Bug, Sparkles, HelpCircle, Loader2, Check, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

var TYPES = [
  { value: "BUG", label: "Bug", icon: Bug, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  { value: "IMPROVEMENT", label: "Amélioration", icon: Sparkles, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  { value: "QUESTION", label: "Question", icon: HelpCircle, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
];

var PRIORITIES = [
  { value: "LOW", label: "Basse" },
  { value: "MEDIUM", label: "Moyenne" },
  { value: "HIGH", label: "Haute" },
];

export function SupportForm({ onSuccess, compact }: SupportFormProps) {
  var [type, setType] = useState("BUG");
  var [priority, setPriority] = useState("MEDIUM");
  var [title, setTitle] = useState("");
  var [description, setDescription] = useState("");
  var [screenshot, setScreenshot] = useState<File | null>(null);
  var [submitting, setSubmitting] = useState(false);

  var handleFile = function(e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files?.[0] || null;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }
    setScreenshot(file);
  };

  var handleSubmit = async function() {
    if (!title.trim()) { toast.error("Le titre est requis"); return; }
    if (!description.trim()) { toast.error("La description est requise"); return; }

    setSubmitting(true);
    try {
      var res = await createSupportTicket({
        type: type as any,
        priority: priority as any,
        title: title.trim(),
        description: description.trim(),
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
        screenshot: screenshot,
      });

      if (res.success) {
        toast.success("Merci ! Votre message a bien été envoyé.");
        setTitle(""); setDescription(""); setScreenshot(null); setType("BUG"); setPriority("MEDIUM");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Erreur lors de l'envoi");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {/* Type */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Type de demande</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(function(t) {
            var Icon = t.icon;
            var active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={function() { setType(t.value); }}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border transition-colors text-xs font-medium",
                  active ? t.bg + " " + t.color : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                <Icon size={18} className={active ? t.color : "text-gray-400"} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priorité */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Priorité</label>
        <div className="flex gap-2">
          {PRIORITIES.map(function(p) {
            var active = priority === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={function() { setPriority(p.value); }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  active ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Titre */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Titre</label>
        <input
          type="text"
          value={title}
          onChange={function(e) { setTitle(e.target.value); }}
          placeholder="Résumez en quelques mots"
          className="input text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description</label>
        <textarea
          value={description}
          onChange={function(e) { setDescription(e.target.value); }}
          placeholder="Décrivez le problème ou votre suggestion. Pour un bug, indiquez les étapes pour le reproduire."
          className="input text-sm min-h-[120px] resize-y"
        />
      </div>

      {/* Capture d'écran */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Capture d'écran (optionnel)</label>
        {screenshot ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <ImageIcon size={16} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-700 truncate flex-1">{screenshot.name}</span>
            <button type="button" onClick={function() { setScreenshot(null); }} className="text-gray-400 hover:text-red-500">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
            <ImageIcon size={16} className="text-gray-400" />
            <span className="text-xs text-gray-500">Joindre une image (max 5 Mo)</span>
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full py-2.5 text-sm justify-center"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Envoyer
      </button>
    </div>
  );
}