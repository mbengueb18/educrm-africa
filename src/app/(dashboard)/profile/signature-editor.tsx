"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Check, Sparkles, ImagePlus } from "lucide-react";
import { RichTextBlock } from "@/components/messaging/rich-text-block";
import { getMyEmailSignature, updateEmailSignature } from "./actions";

type Data = {
  signature: string;
  enabled: boolean;
  profile: { name: string; phone: string; role: string };
  org: { name: string; logo: string | null };
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Administrateur",
  ADMIN: "Administrateur",
  COMMERCIAL: "Conseiller admission",
};

function buildTemplate(d: Data): string {
  const role = ROLE_LABELS[d.profile.role] || "";
  let html = "";
  if (d.org.logo) {
    html += '<img src="' + d.org.logo + '" alt="' + (d.org.name || "") + '" style="height:44px;margin-bottom:8px" /><br>';
  }
  html += "<strong>" + (d.profile.name || "Votre nom") + "</strong>";
  if (role) html += "<br>" + role;
  if (d.org.name) html += '<br><span style="color:#2471A3">' + d.org.name + "</span>";
  if (d.profile.phone) html += "<br>Tél : " + d.profile.phone;
  return html;
}

export function SignatureEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [html, setHtml] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyEmailSignature()
      .then((d) => { setData(d as Data); setHtml(d.signature || ""); setEnabled(d.enabled); setResetKey((k) => k + 1); })
      .catch(() => toast.error("Impossible de charger la signature"));
  }, []);

  const generate = () => {
    if (!data) return;
    setHtml(buildTemplate(data));
    setResetKey((k) => k + 1);
    toast.message("Modèle généré — personnalisez-le à votre convenance");
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Upload échoué");
      setHtml((prev) => prev + '<br><img src="' + d.url + '" style="max-height:90px;margin-top:6px" />');
      setResetKey((k) => k + 1);
      toast.success("Image ajoutée à la signature");
    } catch (e: any) {
      toast.error(e.message || "Erreur upload");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = () => {
    setSaving(true);
    (async () => {
      try {
        await updateEmailSignature({ signature: html, enabled });
        toast.success("Signature enregistrée");
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
      setSaving(false);
    })();
  };

  if (!data) {
    return <div className="p-8 text-center"><Loader2 size={22} className="animate-spin text-brand-500 mx-auto" /></div>;
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Votre signature est ajoutée automatiquement en bas de vos emails (individuels et campagnes). Vous pourrez la retirer ponctuellement lors de l'envoi.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <button type="button" onClick={() => setEnabled(!enabled)}
            className={"relative w-9 h-5 rounded-full transition-colors " + (enabled ? "bg-brand-600" : "bg-gray-300")}>
            <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all " + (enabled ? "left-4" : "left-0.5")} />
          </button>
          <span className="text-sm font-medium text-gray-700">Activer ma signature</span>
        </label>
        <div className="flex items-center gap-2">
          <button onClick={generate} className="btn-secondary py-1.5 px-3 text-xs"><Sparkles size={13} /> Générer</button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary py-1.5 px-3 text-xs">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Image / logo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <RichTextBlock
          key={resetKey}
          initialContent={html}
          placeholder="Nom, rôle, école, téléphone…"
          onContentChange={(h: string) => setHtml(h)}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-2">« Générer » insère un modèle (avec le logo de l'école si disponible). « Image / logo » ajoute une image que vous pouvez ensuite déplacer.</p>

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Aperçu</p>
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <p className="text-sm text-gray-400 italic mb-3">… votre message …</p>
          <div className="border-t border-gray-200 pt-3" style={{ color: "#555555", fontSize: 13, lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: html || '<span style="color:#d1d5db">Signature vide</span>' }} />
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={save} disabled={saving} className="btn-primary py-2 px-4 text-sm">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
        </button>
      </div>
    </div>
  );
}
