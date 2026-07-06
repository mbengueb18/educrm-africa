"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Link2, Code, ExternalLink, Copy, Check } from "lucide-react";

export function ShareModal({ slug, published, onClose }: { slug: string; published: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"lien" | "iframe" | "js">("lien");
  const [origin, setOrigin] = useState("https://app.talibcrm.com");
  const [copied, setCopied] = useState<string>("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const url = origin + "/f/" + slug;
  const iframe = '<iframe src="' + url + '?embed=1" width="100%" height="640" style="border:0;border-radius:12px" title="Formulaire"></iframe>';
  const jsSnippet = '<div id="talib-form"></div>\n<script src="' + origin + "/api/forms/" + slug + '/embed.js" async></script>';

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(""), 1500); toast.success("Copié");
    }).catch(() => toast.error("Copie impossible"));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Diffuser le formulaire</p>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>

          {!published && (
            <div className="mx-5 mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Ce formulaire est en <b>brouillon</b> — publiez-le pour qu'il soit accessible.
            </div>
          )}

          <div className="flex border-b border-gray-100 mt-3 px-5">
            <button onClick={() => setTab("lien")} className={"py-2.5 px-3 text-xs font-semibold border-b-2 " + (tab === "lien" ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}><Link2 size={13} className="inline mr-1" /> Lien</button>
            <button onClick={() => setTab("iframe")} className={"py-2.5 px-3 text-xs font-semibold border-b-2 " + (tab === "iframe" ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}><Code size={13} className="inline mr-1" /> iframe</button>
            <button onClick={() => setTab("js")} className={"py-2.5 px-3 text-xs font-semibold border-b-2 " + (tab === "js" ? "text-brand-600 border-brand-500" : "text-gray-500 border-transparent")}><Code size={13} className="inline mr-1" /> Snippet JS</button>
          </div>

          <div className="p-5">
            {tab === "lien" ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Partagez ce lien par email, WhatsApp, réseaux sociaux… La page est hébergée par TalibCRM.</p>
                <div className="flex items-center gap-2">
                  <input readOnly value={url} className="input text-sm font-mono flex-1" onFocus={(e) => e.target.select()} />
                  <button onClick={() => copy(url, "url")} className="btn-primary py-2 px-3 text-xs shrink-0">{copied === "url" ? <Check size={13} /> : <Copy size={13} />} Copier</button>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium mt-3"><ExternalLink size={13} /> Ouvrir dans un nouvel onglet</a>
              </>
            ) : tab === "iframe" ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Collez ce code dans une page du site de l'école : le formulaire s'affiche dans un cadre.</p>
                <textarea readOnly value={iframe} rows={3} className="input text-xs font-mono w-full" onFocus={(e) => e.target.select()} />
                <button onClick={() => copy(iframe, "iframe")} className="btn-primary py-2 px-3 text-xs mt-2">{copied === "iframe" ? <Check size={13} /> : <Copy size={13} />} Copier le code</button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Intégration <b>native</b> : le formulaire s'affiche directement dans la page (sans cadre), adopte sa largeur et hérite du style TalibCRM. Placez la balise <code className="bg-gray-100 px-1 rounded">&lt;div id="talib-form"&gt;</code> où vous voulez le formulaire.</p>
                <textarea readOnly value={jsSnippet} rows={3} className="input text-xs font-mono w-full" onFocus={(e) => e.target.select()} />
                <button onClick={() => copy(jsSnippet, "js")} className="btn-primary py-2 px-3 text-xs mt-2">{copied === "js" ? <Check size={13} /> : <Copy size={13} />} Copier le code</button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
