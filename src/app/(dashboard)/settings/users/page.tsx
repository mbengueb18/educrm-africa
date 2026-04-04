"use client";

import { useState, useMemo, useEffect } from "react";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Search, Plus, Users, Eye, EyeOff,
  Pencil, Trash2, X, Loader2, Check, MoreHorizontal,
  Mail, Phone, Key, Building2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { getUsers, getUserStats, createUser, updateUser, deleteUser, resetUserPassword } from "./actions";

type User = {
  id: string; name: string; email: string; phone: string | null;
  role: string; avatar: string | null; isActive: boolean;
  lastLoginAt: Date | null; createdAt: Date;
  campus: { id: string; name: string; city: string } | null;
  _count: { assignedLeads: number; activities: number; sentMessages: number };
};

var ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  ADMIN: { label: "Administrateur", color: "text-purple-600", bg: "bg-purple-50", desc: "Accès complet" },
  COMMERCIAL: { label: "Commercial", color: "text-blue-600", bg: "bg-blue-50", desc: "Leads, appels, tâches, rendez-vous" },
  TEACHER: { label: "Enseignant", color: "text-emerald-600", bg: "bg-emerald-50", desc: "Notes, présences" },
  ACCOUNTANT: { label: "Comptable", color: "text-amber-600", bg: "bg-amber-50", desc: "Paiements et finances" },
  VIEWER: { label: "Lecteur", color: "text-gray-600", bg: "bg-gray-100", desc: "Consultation uniquement" },
};

export default function UsersSettingsPage() {
  var [users, setUsers] = useState<User[]>([]);
  var [stats, setStats] = useState<any>(null);
  var [loading, setLoading] = useState(true);
  var [search, setSearch] = useState("");
  var [filterRole, setFilterRole] = useState("");
  var [filterActive, setFilterActive] = useState("active");
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingUser, setEditingUser] = useState<User | null>(null);

  var loadData = function() {
    setLoading(true);
    Promise.all([getUsers(), getUserStats()])
      .then(function(r) { setUsers(r[0] as any); setStats(r[1]); })
      .catch(function() { toast.error("Erreur chargement"); })
      .finally(function() { setLoading(false); });
  };

  useEffect(function() { loadData(); }, []);

  var filtered = useMemo(function() {
    return users.filter(function(u) {
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterActive === "active" && !u.isActive) return false;
      if (filterActive === "inactive" && u.isActive) return false;
      return true;
    });
  }, [users, search, filterRole, filterActive]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Équipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez les utilisateurs et les rôles</p>
        </div>
        <button onClick={function() { setShowCreateModal(true); }} className="btn-primary py-2 text-xs"><Plus size={14} /> Nouvel utilisateur</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total", value: stats.total, color: "text-gray-700" },
            { label: "Actifs", value: stats.active, color: "text-emerald-600" },
            { label: "Inactifs", value: stats.inactive, color: "text-red-500" },
            { label: "Admins", value: stats.admins, color: "text-purple-600" },
            { label: "Commerciaux", value: stats.commercials, color: "text-blue-600" },
          ].map(function(s) {
            return (
              <div key={s.label} className={cn("rounded-xl border border-gray-200 bg-white px-4 py-3 text-center", s.value > 0 && s.label === "Inactifs" && "border-red-200 bg-red-50/50")}>
                <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{ key: "active", label: "Actifs" }, { key: "inactive", label: "Inactifs" }, { key: "", label: "Tous" }].map(function(f) {
            return <button key={f.key} onClick={function() { setFilterActive(f.key); }}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", filterActive === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}>{f.label}</button>;
          })}
        </div>
        <select value={filterRole} onChange={function(e) { setFilterRole(e.target.value); }} className="input text-xs py-2 w-40">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_CONFIG).map(function(e) { return <option key={e[0]} value={e[0]}>{e[1].label}</option>; })}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          {filtered.length === 0 ? (
            <div className="py-16 text-center"><Users size={40} className="text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-400">Aucun utilisateur trouvé</p></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(function(user) {
                var roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.VIEWER;
                return (
                  <div key={user.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors group", !user.isActive && "opacity-50")}>
                    <div className={cn("w-10 h-10 rounded-xl text-sm font-bold flex items-center justify-center shrink-0",
                      user.isActive ? "bg-brand-100 text-brand-700" : "bg-gray-200 text-gray-500"
                    )}>{getInitials(user.name)}</div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={function() { setEditingUser(user); }}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", roleConf.bg, roleConf.color)}>{roleConf.label}</span>
                        {!user.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">Inactif</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10} /> {user.email}</span>
                        {user.campus && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={10} /> {user.campus.city}</span>}
                      </div>
                    </div>
                    <div className="text-center shrink-0"><div className="text-sm font-bold text-gray-700">{user._count.assignedLeads}</div><div className="text-[9px] text-gray-400 uppercase">Leads</div></div>
                    <div className="shrink-0 text-right min-w-[80px]">
                      {user.lastLoginAt ? <span className="text-xs text-gray-400">{formatRelative(user.lastLoginAt)}</span> : <span className="text-xs text-gray-300">Jamais</span>}
                    </div>
                    <button onClick={function() { setEditingUser(user); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><Pencil size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCreateModal && <UserModal mode="create" onClose={function(s) { setShowCreateModal(false); if (s) loadData(); }} />}
      {editingUser && <UserModal mode="edit" user={editingUser} onClose={function(s) { setEditingUser(null); if (s) loadData(); }} />}
    </div>
  );
}

function UserModal({ mode, user, onClose }: { mode: "create" | "edit"; user?: User; onClose: (saved?: boolean) => void }) {
  var [name, setName] = useState(user?.name || "");
  var [email, setEmail] = useState(user?.email || "");
  var [phone, setPhone] = useState(user?.phone || "");
  var [role, setRole] = useState(user?.role || "COMMERCIAL");
  var [password, setPassword] = useState("");
  var [showPwd, setShowPwd] = useState(false);
  var [isActive, setIsActive] = useState(user?.isActive ?? true);
  var [saving, setSaving] = useState(false);
  var [showResetPwd, setShowResetPwd] = useState(false);
  var [newPwd, setNewPwd] = useState("");
  var [resetting, setResetting] = useState(false);

  var handleSubmit = async function() {
    if (!name.trim() || !email.trim()) { toast.error("Nom et email requis"); return; }
    if (mode === "create" && password.length < 6) { toast.error("Mot de passe min. 6 caractères"); return; }
    setSaving(true);
    try {
      if (mode === "create") { await createUser({ name, email, password, phone: phone || undefined, role }); toast.success("Utilisateur créé"); }
      else if (user) { await updateUser(user.id, { name, email, phone, role, isActive }); toast.success("Utilisateur mis à jour"); }
      onClose(true);
    } catch (err: any) { toast.error(err.message || "Erreur"); }
    setSaving(false);
  };

  var handleResetPwd = async function() {
    if (!user || newPwd.length < 6) return;
    setResetting(true);
    try { await resetUserPassword(user.id, newPwd); toast.success("Mot de passe réinitialisé"); setShowResetPwd(false); setNewPwd(""); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
    setResetting(false);
  };

  var handleDelete = async function() {
    if (!user || !confirm("Supprimer " + user.name + " ?")) return;
    try { await deleteUser(user.id); toast.success("Supprimé"); onClose(true); }
    catch (err: any) { toast.error(err.message || "Erreur"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={function() { onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">{mode === "create" ? "Nouvel utilisateur" : "Modifier"}</h2>
          <button onClick={function() { onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
            <input type="text" value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" placeholder="Fatou Diop" autoFocus /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label>
            <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} className="input text-sm" /></div>
          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
            <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }} className="input text-sm" placeholder="+221 7X XXX XX XX" /></div>
          {mode === "create" && (
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe *</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={function(e) { setPassword(e.target.value); }} className="input text-sm pr-10" />
                <button type="button" onClick={function() { setShowPwd(!showPwd); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div></div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Rôle *</label>
            <div className="space-y-2">
              {Object.entries(ROLE_CONFIG).map(function(e) {
                var sel = role === e[0];
                return (
                  <button key={e[0]} type="button" onClick={function() { setRole(e[0]); }}
                    className={cn("w-full flex items-start gap-3 p-3 rounded-lg border text-left",
                      sel ? "border-brand-300 bg-brand-50/50" : "border-gray-200 hover:border-gray-300")}>
                    <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                      sel ? "border-brand-600" : "border-gray-300")}>{sel && <div className="w-2 h-2 rounded-full bg-brand-600" />}</div>
                    <div><span className={cn("text-sm font-medium", sel ? "text-brand-700" : "text-gray-700")}>{e[1].label}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{e[1].desc}</p></div>
                  </button>
                );
              })}
            </div>
          </div>
          {mode === "edit" && user && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div><p className="text-sm font-medium text-gray-700">Compte actif</p><p className="text-xs text-gray-400">Un compte inactif ne peut plus se connecter</p></div>
                <button type="button" onClick={function() { setIsActive(!isActive); }}
                  className={cn("w-11 h-6 rounded-full relative", isActive ? "bg-emerald-500" : "bg-gray-300")}>
                  <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform", isActive ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
              <div className="border-t border-gray-100 pt-4">
                {!showResetPwd ? (
                  <button onClick={function() { setShowResetPwd(true); }} className="btn-secondary py-2 text-xs w-full"><Key size={13} /> Réinitialiser le mot de passe</button>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <label className="text-xs font-medium text-amber-700 mb-1 block">Nouveau mot de passe</label>
                    <div className="flex gap-2">
                      <input type="text" value={newPwd} onChange={function(e) { setNewPwd(e.target.value); }} className="input text-sm flex-1" placeholder="Min. 6" />
                      <button onClick={handleResetPwd} disabled={resetting || newPwd.length < 6} className="btn-primary py-2 text-xs">
                        {resetting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} OK</button>
                      <button onClick={function() { setShowResetPwd(false); setNewPwd(""); }} className="btn-secondary py-2 text-xs"><X size={12} /></button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={handleDelete} className="btn-secondary py-2 text-xs w-full text-red-600 border-red-200 hover:bg-red-50"><Trash2 size={13} /> Supprimer</button>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-2xl">
          <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim() || !email.trim()} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Plus size={14} /> : <Check size={14} />}
            {mode === "create" ? "Créer" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}