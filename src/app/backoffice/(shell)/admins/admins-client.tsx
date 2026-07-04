"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Loader2, Check, MoreHorizontal, KeyRound, Trash2, Lock } from "lucide-react";
import { createPlatformAdmin, updatePlatformAdmin, resetPlatformAdminPassword, deletePlatformAdmin } from "../../actions";

type Admin = { id: string; email: string; name: string; role: string; isActive: boolean; lastLoginAt: string | Date | null; createdAt: string | Date };

const ROLES = [
  { key: "OWNER", label: "Propriétaire" },
  { key: "ADMIN", label: "Admin" },
  { key: "SUPPORT", label: "Support" },
];
const ROLE_CLS: Record<string, string> = {
  OWNER: "bg-violet-50 text-violet-700",
  ADMIN: "bg-brand-50 text-brand-700",
  SUPPORT: "bg-gray-100 text-gray-600",
};

export function AdminsClient({ admins, currentId, isOwner }: { admins: Admin[]; currentId: string; isOwner: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<any>, ok = "Mis à jour") =>
    startTransition(async () => {
      try { await fn(); toast.success(ok); router.refresh(); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admins plateforme</h1>
        {isOwner && (
          <button onClick={() => setCreating(true)} className="btn-primary py-2 px-4 text-sm"><Plus size={15} /> Nouvel admin</button>
        )}
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-5">Comptes ayant accès au back-office (séparés des utilisateurs des écoles).</p>

      {!isOwner && (
        <div className="mb-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Lock size={13} /> Seul un propriétaire peut créer ou modifier les admins.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500">
                {["Admin", "Rôle", "Statut", "Dernière connexion", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">{getInitials(a.name)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.name}{a.id === currentId && <span className="text-[10px] text-gray-400 font-normal"> (vous)</span>}</p>
                        <p className="text-[11px] text-gray-400">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <select value={a.role} onChange={(e) => act(() => updatePlatformAdmin(a.id, { role: e.target.value }))} disabled={pending}
                        className="input text-xs py-1 w-32">
                        {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", ROLE_CLS[a.role] || ROLE_CLS.SUPPORT)}>{ROLES.find((r) => r.key === a.role)?.label || a.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <button onClick={() => act(() => updatePlatformAdmin(a.id, { isActive: !a.isActive }))} disabled={pending}
                        className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", a.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500")}>
                        {a.isActive ? "Actif" : "Inactif"}
                      </button>
                    ) : (
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", a.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500")}>{a.isActive ? "Actif" : "Inactif"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Jamais"}</td>
                  <td className="px-4 py-3 text-right">
                    {isOwner && <RowMenu admin={a} currentId={currentId} act={act} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <CreateAdminModal onClose={(saved) => { setCreating(false); if (saved) router.refresh(); }} />}
    </div>
  );
}

function RowMenu({ admin, currentId, act }: { admin: Admin; currentId: string; act: (fn: () => Promise<any>, ok?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = 208; // w-52
      const estH = admin.id !== currentId ? 84 : 44;
      const openUp = r.bottom + estH + 8 > window.innerHeight;
      setPos({
        top: openUp ? r.top - estH - 4 : r.bottom + 4,
        left: Math.max(8, r.right - menuW),
      });
    }
    setOpen(!open);
  };

  const resetPwd = () => {
    const pwd = prompt("Nouveau mot de passe (8 caractères min.) pour " + admin.name + " :");
    if (!pwd) return;
    setOpen(false);
    act(() => resetPlatformAdminPassword(admin.id, pwd), "Mot de passe réinitialisé");
  };
  const del = () => {
    setOpen(false);
    if (!confirm("Supprimer l'admin " + admin.name + " ?")) return;
    act(() => deletePlatformAdmin(admin.id), "Admin supprimé");
  };

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><MoreHorizontal size={16} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={{ position: "fixed", top: pos.top, left: pos.left }} className="z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-52 animate-scale-in">
            <button onClick={resetPwd} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50"><KeyRound size={14} /> Réinitialiser le mot de passe</button>
            {admin.id !== currentId && (
              <button onClick={del} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50"><Trash2 size={14} /> Supprimer</button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CreateAdminModal({ onClose }: { onClose: (saved?: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("SUPPORT");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      try { await createPlatformAdmin({ email, name, role, password }); toast.success("Admin créé"); onClose(true); }
      catch (e: any) { toast.error(e.message || "Erreur"); }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Nouvel admin plateforme</p></div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom</label><input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="Awa Diop" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Rôle</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-sm">
                  {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input text-sm" placeholder="awa@talibcrm.com" /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe provisoire</label><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="input text-sm" placeholder="8 caractères minimum" /></div>
          </div>
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
            <button onClick={() => onClose()} className="btn-secondary py-2 px-3 text-xs" disabled={pending}>Annuler</button>
            <button onClick={submit} className="btn-primary py-2 px-4 text-xs" disabled={pending}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Créer</button>
          </div>
        </div>
      </div>
    </>
  );
}
