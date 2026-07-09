"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Copy, Check, ExternalLink, Link2, Code, Lock } from "lucide-react";

export function OrientationShareClient({ slug, aiActive }: { slug: string; aiActive: boolean }) {
  const [tab, setTab] = useState<"lien" | "iframe">("lien");
  const [origin, setOrigin] = useState("https://app.talibcrm.com");
  const [copied, setCopied] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const url = origin + "/orientation/" + slug;
  const iframe = '<iframe src="' + url + '" width="100%" height="720" style="border:0;border-radius:12px" title="Test d\'orientation"></iframe>';

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(""), 1500); toast.success("Copié");
    }).catch(() => toast.error("Copie impossible"));
  };

  return (
    <div className="max-w-2xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={15} /> Retour aux paramètres
      </Link>

      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Test d'orientation IA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Un conseiller d'orientation intelligent qui aide vos candidats à choisir leur filière — et crée
            automatiquement un lead dans votre pipeline à la fin du test.
          </p>
        </div>
      </div>

      {/* Statut plan */}
      {aiActive ? (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-5">
          <Check size={14} /> Actif — l'IA d'orientation est disponible sur votre plan.
        </div>
      ) : (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <span>
            <b>Réservé aux plans payants.</b> Le lien reste partageable, mais le test ne démarrera pas tant que
            votre organisation n'a pas accès à l'IA. Passez à un plan supérieur pour l'activer.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100 px-4">
          <button onClick={() => setTab("lien")} className={"py-3 px-3 text-xs font-semibold border-b-2 " + (tab === "lien" ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}>
            <Link2 size={13} className="inline mr-1" /> Lien à partager
          </button>
          <button onClick={() => setTab("iframe")} className={"py-3 px-3 text-xs font-semibold border-b-2 " + (tab === "iframe" ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}>
            <Code size={13} className="inline mr-1" /> Intégrer (iframe)
          </button>
        </div>

        <div className="p-5">
          {tab === "lien" ? (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Partagez ce lien par email, WhatsApp, réseaux sociaux, ou depuis votre site. La page est hébergée par TalibCRM.
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={url} className="input text-sm font-mono flex-1" onFocus={(e) => e.target.select()} />
                <button onClick={() => copy(url, "url")} className="btn-primary py-2 px-3 text-xs shrink-0">
                  {copied === "url" ? <Check size={13} /> : <Copy size={13} />} Copier
                </button>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium mt-3">
                <ExternalLink size={13} /> Ouvrir dans un nouvel onglet
              </a>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Collez ce code dans une page du site de l'école : le test d'orientation s'affiche dans un cadre.
              </p>
              <textarea readOnly value={iframe} rows={3} className="input text-xs font-mono w-full" onFocus={(e) => e.target.select()} />
              <button onClick={() => copy(iframe, "iframe")} className="btn-primary py-2 px-3 text-xs mt-2">
                {copied === "iframe" ? <Check size={13} /> : <Copy size={13} />} Copier le code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
