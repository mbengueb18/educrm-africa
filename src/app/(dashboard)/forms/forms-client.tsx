"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, FileText, Loader2, Share2, Pencil, Trash2, BarChart3, FolderOpen } from "lucide-react";
import { createForm, deleteForm } from "./actions";
import { ShareModal } from "./share-modal";

type FormRow = { id: string; name: string; slug: string; status: string; submissionsCount: number; createdAt: string | Date; updatedAt: string | Date };

export function FormsClient({ forms }: { forms: FormRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [share, setShare] = useState<FormRow | null>(null);

  const create = () => startTransition(async () => {
    try { const r = await createForm(); router.push("/forms/" + r.id + "/edit"); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  });
  const del = (f: FormRow) => {
    if (!confirm("Supprimer « " + f.name + " » ? Les soumissions liées seront perdues.")) return;
    startTransition(async () => {
      try { await deleteForm(f.id); toast.success("Formulaire supprimé"); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Formulaires</h1>
        <button onClick={create} disabled={pending} className="btn-primary py-2 px-4 text-sm">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Nouveau formulaire
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-5">Créez des formulaires pour collecter des leads (site web, webinaire, événement…).</p>

      {forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun formulaire pour l'instant</p>
          <button onClick={create} disabled={pending} className="btn-primary py-2 text-xs mt-4"><Plus size={14} /> Créer un formulaire</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {forms.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">{f.name}</p>
                  <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (f.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{f.status === "PUBLISHED" ? "Publié" : "Brouillon"}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">/f/{f.slug}</p>
              </div>
              <div className="text-center px-2">
                <p className="text-lg font-extrabold text-gray-900 leading-none">{f.submissionsCount}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Soumissions</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={"/forms/" + f.id + "/submissions"} className="btn-secondary py-1.5 px-2.5 text-xs" title="Soumissions"><BarChart3 size={13} /></Link>
                <button onClick={() => setShare(f)} className="btn-secondary py-1.5 px-2.5 text-xs"><Share2 size={13} /> Diffuser</button>
                <Link href={"/forms/" + f.id + "/edit"} className="btn-secondary py-1.5 px-2.5 text-xs"><Pencil size={13} /> Éditer</Link>
                <button onClick={() => del(f)} className="btn-secondary py-1.5 px-2.5 text-xs text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {share && <ShareModal slug={share.slug} published={share.status === "PUBLISHED"} onClose={() => setShare(null)} />}
    </div>
  );
}
