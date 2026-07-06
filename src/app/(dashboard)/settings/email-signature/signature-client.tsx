"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Check, Sparkles, Mail } from "lucide-react";
import { RichTextBlock } from "@/components/messaging/rich-text-block";
import { updateEmailSignature } from "./actions";

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

export function SignatureClient({ data }: { data: Data }) {
  const router = useRouter();
  const [html, setHtml] = useState(data.signature || "");
  const [enabled, setEnabled] = useState(data.enabled);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const generate = () => {
    const tpl = buildTemplate(data);
    setHtml(tpl);
    setResetKey((k) => k + 1); // remonte l'éditeur avec le nouveau contenu
    toast.message("Modèle généré — personnalisez-le à votre convenance");
  };

  const save = () => {
    setSaving(true);
    (async () => {
      try {
        await updateEmailSignature({ signature: html, enabled });
        toast.success("Signature enregistrée");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Erreur");
      }
      setSaving(false);
    })();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/settings" className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={18} /></Link>
        <span className="text-xs text-gray-400">Paramètres › Signature email</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Signature email</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Votre signature est ajoutée automatiquement en bas de vos emails (individuels et campagnes). Vous pourrez la retirer ponctuellement lors de l'envoi.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <button type="button" onClick={() => setEnabled(!enabled)}
              className={"relative w-9 h-5 rounded-full transition-colors " + (enabled ? "bg-brand-600" : "bg-gray-300")}>
              <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all " + (enabled ? "left-4" : "left-0.5")} />
            </button>
            <span className="text-sm font-medium text-gray-700">Activer ma signature</span>
          </label>
          <button onClick={generate} className="btn-secondary py-1.5 px-3 text-xs">
            <Sparkles size={13} /> Générer depuis mon profil
          </button>
        </div>

        <div className="p-5">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Contenu de la signature</label>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <RichTextBlock
              key={resetKey}
              initialContent={html}
              placeholder="Nom, rôle, école, téléphone…"
              onContentChange={(h: string) => setHtml(h)}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Astuce : « Générer » insère un modèle (avec le logo de l'école si disponible) que vous pouvez ensuite modifier.</p>
        </div>

        <div className="px-5 pb-5">
          <p className="text-xs font-medium text-gray-500 mb-2">Aperçu</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-sm text-gray-400 italic mb-3">… votre message …</p>
            <div className="border-t border-gray-200 pt-3" style={{ color: "#555555", fontSize: 13, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: html || '<span style="color:#d1d5db">Signature vide</span>' }} />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary py-2 px-4 text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
          </button>
        </div>
      </div>

      <div className="mt-4 bg-brand-50/40 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5"><Mail size={13} /> Où s'applique la signature ?</p>
        <ul className="text-xs text-gray-600 space-y-1 list-disc pl-5">
          <li><b>Emails individuels</b> (fiche prospect, boîte de réception) — case « Ajouter ma signature » cochée par défaut.</li>
          <li><b>Campagnes</b> — option activée par défaut dans l'éditeur, désactivable par campagne.</li>
        </ul>
      </div>
    </div>
  );
}
