"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelative, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Plus, Users, Shield, UserCheck, UserX, Eye, EyeOff,
  Pencil, Trash2, X, Loader2, Check, XCircle, MoreHorizontal,
  Mail, Phone, MapPin, Key, Building2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { createUser, updateUser, deleteUser, resetUserPassword } from "./actions";

type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  campus: { id: string; name: string; city: string } | null;
  _count: { assignedLeads: number; activities: number; sentMessages: number };
};

interface UsersClientProps {
  users: User[];
  stats: { total: number; active: number; inactive: number; admins: number; commercials: number };
  campuses: { id: string; name: string; city: string }[];
  currentUserId: string;
  currentUserRole: string;
}

var ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  ADMIN: { label: "Administrateur", color: "text-purple-600", bg: "bg-purple-50", desc: "Accès complet à toutes les fonctionnalités" },
  COMMERCIAL: { label: "Commercial", color: "text-blue-600", bg: "bg-blue-50", desc: "Gestion des leads, appels, tâches, rendez-vous" },
  TEACHER: { label: "Enseignant", color: "text-emerald-600", bg: "bg-emerald-50", desc: "Notes, présences, emploi du temps" },
  ACCOUNTANT: { label: "Comptable", color: "text-amber-600", bg: "bg-amber-50", desc: "Paiements et suivi financier" },
  VIEWER: { label: "Lecteur", color: "text-gray-600", bg: "bg-gray-100", desc: "Consultation uniquement, aucune modification" },
};

export function UsersClient({ users, stats, campuses, currentUserId, currentUserRole }: UsersClientProps) {
  var [search, setSearch] = useState("");
  var [filterRole, setFilterRole] = useState<string>("");
  var [filterActive, setFilterActive] = useState<string>("active");
  var [showCreateModal, setShowCreateModal] = useState(false);
  var [editingUser, setEditingUser] = useState<User | null>(null);
  var router = useRouter();

  var filtered = useMemo(function() {
    return users.filter(function(u) {
      if (search) {
        var q = search.toLowerCase();
        var match = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || "").includes(q);
        if (!match) return false;
      }
      if (filterRole && u.role !== filterRole) return false;
      if (filterActive === "active" && !u.isActive) return false;
      if (filterActive === "inactive" && u.isActive) return false;
      return true;
    });
  }, [users, search, filterRole, filterActive]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez l'équipe de votre établissement</p>
        </div>
        {currentUserRole === "ADMIN" && (
          <button onClick={function() { setShowCreateModal(true); }} className="btn-primary py-2 text-sm">
            <Plus size={16} /> Nouvel utilisateur
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <MiniStat label="Total" value={stats.total} color="text-gray-700" />
        <MiniStat label="Actifs" value={stats.active} color="text-emerald-600" />
        <MiniStat label="Inactifs" value={stats.inactive} color="text-red-500" highlight={stats.inactive > 0} />
        <MiniStat label="Admins" value={stats.admins} color="text-purple-600" />
        <MiniStat label="Commerciaux" value={stats.commercials} color="text-blue-600" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Rechercher par nom, email..." className="input pl-9 text-sm" value={search} onChange={function(e) { setSearch(e.target.value); }} />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: "active", label: "Actifs" },
            { key: "inactive", label: "Inactifs" },
            { key: "", label: "Tous" },
          ].map(function(f) {
            return (
              <button key={f.key} onClick={function() { setFilterActive(f.key); }}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterActive === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {f.label}
              </button>
            );
          })}
        </div>

        <select value={filterRole} onChange={function(e) { setFilterRole(e.target.value); }} className="input text-xs py-2 w-40">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_CONFIG).map(function(entry) {
            return <option key={entry[0]} value={entry[0]}>{entry[1].label}</option>;
          })}
        </select>

        <span className="text-sm text-gray-500 ml-auto">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</span>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(function(user) {
              return (
                <UserRow
                  key={user.id}
                  user={user}
                  isCurrentUser={user.id === currentUserId}
                  isAdmin={currentUserRole === "ADMIN"}
                  onEdit={function() { setEditingUser(user); }}
                  onRefresh={function() { router.refresh(); }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <UserFormModal
          mode="create"
          campuses={campuses}
          onClose={function(saved) { setShowCreateModal(false); if (saved) router.refresh(); }}
        />
      )}

      {/* Edit modal */}
      {editingUser && (
        <UserFormModal
          mode="edit"
          user={editingUser}
          campuses={campuses}
          currentUserId={currentUserId}
          onClose={function(saved) { setEditingUser(null); if (saved) router.refresh(); }}
        />
      )}
    </div>
  );
}

// ─── User Row ───
function UserRow({ user, isCurrentUser, isAdmin, onEdit, onRefresh }: {
  user: User; isCurrentUser: boolean; isAdmin: boolean; onEdit: () => void; onRefresh: () => void;
}) {
  var [showMenu, setShowMenu] = useState(false);
  var [toggling, setToggling] = useState(false);
  var roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.VIEWER;

  var handleToggleActive = async function() {
    setToggling(true);
    setShowMenu(false);
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      toast.success(user.isActive ? "Utilisateur désactivé" : "Utilisateur réactivé");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setToggling(false);
  };

  var handleDelete = async function() {
    if (!confirm("Supprimer " + user.name + " ? Ses leads seront désassignés.")) return;
    setShowMenu(false);
    try {
      await deleteUser(user.id);
      toast.success("Utilisateur supprimé");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  };

  return (
    <div className={cn("flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors group", !user.isActive && "opacity-50")}>
      {/* Avatar */}
      <div className={cn("w-10 h-10 rounded-xl text-sm font-bold flex items-center justify-center shrink-0",
        user.isActive ? "bg-brand-100 text-brand-700" : "bg-gray-200 text-gray-500"
      )}>
        {getInitials(user.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
          {isCurrentUser && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">Vous</span>
          )}
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", roleConf.bg, roleConf.color)}>
            {roleConf.label}
          </span>
          {!user.isActive && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">Inactif</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={10} /> {user.email}</span>
          {user.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} /> {user.phone}</span>}
          {user.campus && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={10} /> {user.campus.city}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0 text-center">
        <div>
          <div className="text-sm font-bold text-gray-700">{user._count.assignedLeads}</div>
          <div className="text-[9px] text-gray-400 uppercase">Leads</div>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-700">{user._count.activities}</div>
          <div className="text-[9px] text-gray-400 uppercase">Actions</div>
        </div>
      </div>

      {/* Last login */}
      <div className="shrink-0 text-right min-w-[80px]">
        {user.lastLoginAt ? (
          <span className="text-xs text-gray-400">{formatRelative(user.lastLoginAt)}</span>
        ) : (
          <span className="text-xs text-gray-300">Jamais connecté</span>
        )}
      </div>

      {/* Actions */}
      {isAdmin && !isCurrentUser && (
        <div className="shrink-0">
          <button onClick={function(e) { e.stopPropagation(); setShowMenu(!showMenu); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={function() { setShowMenu(false); }} />
              <div className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-52 animate-scale-in" style={{ right: "2rem" }}>
                <button onClick={function() { setShowMenu(false); onEdit(); }} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                  <Pencil size={14} /> Modifier
                </button>
                <button onClick={handleToggleActive} disabled={toggling} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                  {user.isActive ? <ToggleRight size={14} className="text-red-500" /> : <ToggleLeft size={14} className="text-emerald-500" />}
                  {toggling ? "..." : user.isActive ? "Désactiver" : "Réactiver"}
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── User Form Modal ───
function UserFormModal({ mode, user, campuses, currentUserId, onClose }: {
  mode: "create" | "edit";
  user?: User;
  campuses: { id: string; name: string; city: string }[];
  currentUserId?: string;
  onClose: (saved?: boolean) => void;
}) {
  var [name, setName] = useState(user?.name || "");
  var [email, setEmail] = useState(user?.email || "");
  var [phone, setPhone] = useState(user?.phone || "");
  var [role, setRole] = useState(user?.role || "COMMERCIAL");
  var [campusId, setCampusId] = useState(user?.campus?.id || "");
  var [password, setPassword] = useState("");
  var [showPassword, setShowPassword] = useState(false);
  var [isActive, setIsActive] = useState(user?.isActive ?? true);
  var [saving, setSaving] = useState(false);

  // Reset password
  var [showResetPassword, setShowResetPassword] = useState(false);
  var [newPassword, setNewPassword] = useState("");
  var [resetting, setResetting] = useState(false);

  var handleSubmit = async function() {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    if (!email.trim()) { toast.error("L'email est requis"); return; }
    if (mode === "create" && password.length < 6) { toast.error("Le mot de passe doit contenir au moins 6 caractères"); return; }

    setSaving(true);
    try {
      if (mode === "create") {
        await createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          role,
          campusId: campusId || undefined,
        });
        toast.success("Utilisateur créé");
      } else if (user) {
        await updateUser(user.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
          campusId: campusId || null,
          isActive,
        });
        toast.success("Utilisateur mis à jour");
      }
      onClose(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  var handleResetPassword = async function() {
    if (newPassword.length < 6) { toast.error("Le mot de passe doit contenir au moins 6 caractères"); return; }
    if (!user) return;
    setResetting(true);
    try {
      await resetUserPassword(user.id, newPassword);
      toast.success("Mot de passe réinitialisé");
      setShowResetPassword(false);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setResetting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={function() { onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-900">{mode === "create" ? "Nouvel utilisateur" : "Modifier l'utilisateur"}</h2>
          <button onClick={function() { onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom complet *</label>
            <input type="text" value={name} onChange={function(e) { setName(e.target.value); }} className="input text-sm" placeholder="Fatou Diop" autoFocus />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Adresse email *</label>
            <input type="email" value={email} onChange={function(e) { setEmail(e.target.value); }} className="input text-sm" placeholder="fatou@ecole.com" />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
            <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value); }} className="input text-sm" placeholder="+221 7X XXX XX XX" />
          </div>

          {/* Password (create only) */}
          {mode === "create" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe * <span className="font-normal text-gray-400">(min. 6 caractères)</span></label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={function(e) { setPassword(e.target.value); }}
                  className="input text-sm pr-10" placeholder="••••••••" />
                <button type="button" onClick={function() { setShowPassword(!showPassword); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Rôle *</label>
            <div className="space-y-2">
              {Object.entries(ROLE_CONFIG).filter(function(entry) { return entry[0] !== "SUPER_ADMIN"; }).map(function(entry) {
                var isSelected = role === entry[0];
                return (
                  <button key={entry[0]} type="button" onClick={function() { setRole(entry[0]); }}
                    className={cn("w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                      isSelected ? "border-brand-300 bg-brand-50/50" : "border-gray-200 hover:border-gray-300"
                    )}>
                    <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                      isSelected ? "border-brand-600" : "border-gray-300"
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-brand-600" />}
                    </div>
                    <div>
                      <span className={cn("text-sm font-medium", isSelected ? "text-brand-700" : "text-gray-700")}>{entry[1].label}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{entry[1].desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campus */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Campus <span className="font-normal text-gray-400">(laisser vide = accès à tous)</span></label>
            <select value={campusId} onChange={function(e) { setCampusId(e.target.value); }} className="input text-sm">
              <option value="">Tous les campus</option>
              {campuses.map(function(c) { return <option key={c.id} value={c.id}>{c.name} — {c.city}</option>; })}
            </select>
          </div>

          {/* Active toggle (edit only) */}
          {mode === "edit" && user && user.id !== currentUserId && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-700">Compte actif</p>
                <p className="text-xs text-gray-400">Un compte inactif ne peut plus se connecter</p>
              </div>
              <button type="button" onClick={function() { setIsActive(!isActive); }}
                className={cn("w-11 h-6 rounded-full transition-colors relative", isActive ? "bg-emerald-500" : "bg-gray-300")}>
                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                  isActive ? "left-[22px]" : "left-0.5"
                )} />
              </button>
            </div>
          )}

          {/* Reset password (edit only) */}
          {mode === "edit" && user && (
            <div className="border-t border-gray-100 pt-4">
              {!showResetPassword ? (
                <button onClick={function() { setShowResetPassword(true); }} className="btn-secondary py-2 text-xs w-full">
                  <Key size={13} /> Réinitialiser le mot de passe
                </button>
              ) : (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <label className="text-xs font-medium text-amber-700 mb-1 block">Nouveau mot de passe</label>
                  <div className="flex gap-2">
                    <input type="text" value={newPassword} onChange={function(e) { setNewPassword(e.target.value); }}
                      className="input text-sm flex-1" placeholder="Min. 6 caractères" />
                    <button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6} className="btn-primary py-2 text-xs">
                      {resetting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} OK
                    </button>
                    <button onClick={function() { setShowResetPassword(false); setNewPassword(""); }} className="btn-secondary py-2 text-xs">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 rounded-b-2xl">
          <button onClick={function() { onClose(); }} className="btn-secondary py-2 text-sm">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim() || !email.trim()} className="btn-primary py-2 text-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Plus size={14} /> : <Check size={14} />}
            {mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Stat ───
function MiniStat({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white px-4 py-3 text-center", highlight && "border-red-200 bg-red-50/50")}>
      <div className={cn("text-xl font-bold", color)}>{value}</div>
      <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}