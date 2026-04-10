"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import {
  User, Mail, Phone, Shield, Building2, MapPin, Calendar,
  Pencil, Check, X, Loader2, Key, Eye, EyeOff, LogOut,
} from "lucide-react";
import { updateProfile, changePassword } from "./actions";

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    avatar: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    campus: { id: string; name: string; city: string } | null;
    organization: { id: string; name: string; slug: string };
  };
}

var ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrateur",
  COMMERCIAL: "Commercial",
  TEACHER: "Enseignant",
  ACCOUNTANT: "Comptable",
  VIEWER: "Lecteur",
};

export function ProfileClient({ user }: ProfileClientProps) {
  var [editMode, setEditMode] = useState(false);
  var [saving, setSaving] = useState(false);
  var [name, setName] = useState(user.name);
  var [phone, setPhone] = useState(user.phone || "");

  // Password change
  var [showPasswordForm, setShowPasswordForm] = useState(false);
  var [currentPassword, setCurrentPassword] = useState("");
  var [newPassword, setNewPassword] = useState("");
  var [confirmPassword, setConfirmPassword] = useState("");
  var [showCurrentPwd, setShowCurrentPwd] = useState(false);
  var [showNewPwd, setShowNewPwd] = useState(false);
  var [changingPwd, setChangingPwd] = useState(false);
  var [activeTab, setActiveTab] = useState<"info" | "security" | "integrations">("info");

  var router = useRouter();

  // Google Calendar
  var [googleConnected, setGoogleConnected] = useState(false);
  var [googleEmail, setGoogleEmail] = useState<string | null>(null);
  var [disconnecting, setDisconnecting] = useState(false);

  useEffect(function() {
    fetch("/api/integrations/google/status").then(function(r) { return r.json(); }).then(function(data) {
      setGoogleConnected(data.connected);
      if (data.email) setGoogleEmail(data.email);
    }).catch(function() {});

    var params = new URLSearchParams(window.location.search);
    if (params.get("google") === "success") {
      setTimeout(function() {
        toast.success("Google Calendar connecté avec succès !");
        setGoogleConnected(true);
      }, 500);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  var handleDisconnectGoogle = async function() {
    if (!confirm("Déconnecter Google Calendar ?")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      setGoogleConnected(false);
      setGoogleEmail(null);
      toast.success("Google Calendar déconnecté");
    } catch {
      toast.error("Erreur lors de la déconnexion");
    }
    setDisconnecting(false);
  };

  var handleSave = async function() {
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      toast.success("Profil mis à jour");
      setEditMode(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setSaving(false);
  };

  var handleCancel = function() {
    setName(user.name);
    setPhone(user.phone || "");
    setEditMode(false);
  };

  var handleChangePassword = async function() {
    if (newPassword.length < 6) { toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères"); return; }
    if (newPassword !== confirmPassword) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setChangingPwd(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success("Mot de passe modifié avec succès");
      setShowPasswordForm(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
    setChangingPwd(false);
  };

  var handleLogout = async function() {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles</p>
      </div>

      {/* Profile banner */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-r from-brand-500 to-brand-700 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center text-2xl font-bold text-brand-700 border-4 border-white">
              {getInitials(user.name)}
            </div>
          </div>
        </div>
        <div className="pt-14 px-6 pb-4">
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
              {ROLE_LABELS[user.role] || user.role}
            </span>
            <span className="text-xs text-gray-500">{user.organization.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-100 px-6">
          {[
            { key: "info" as const, label: "Informations", icon: User },
            { key: "security" as const, label: "Sécurité", icon: Key },
            { key: "integrations" as const, label: "Intégrations", icon: Calendar },
          ].map(function(tab) {
            var Icon = tab.icon;
            return (
              <button key={tab.key} onClick={function() { setActiveTab(tab.key); }}
                className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
                  activeTab === tab.key ? "text-brand-600" : "text-gray-500 hover:text-gray-700"
                )}>
                <Icon size={15} /> {tab.label}
                {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Informations personnelles</h3>
            {editMode ? (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="btn-secondary py-1.5 px-3 text-xs" disabled={saving}><X size={13} /> Annuler</button>
                <button onClick={handleSave} className="btn-primary py-1.5 px-3 text-xs" disabled={saving}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Sauvegarder
                </button>
              </div>
            ) : (
              <button onClick={function() { setEditMode(true); }} className="btn-secondary py-1.5 px-3 text-xs"><Pencil size={13} /> Modifier</button>
            )}
          </div>
          <div className="p-6 space-y-3">
            {editMode ? (
              <>
                <EditField icon={User} label="Nom complet" value={name} onChange={setName} />
                <EditField icon={Phone} label="Téléphone" value={phone} onChange={setPhone} placeholder="+221 7X XXX XX XX" />
                <ReadOnlyField icon={Mail} label="Adresse email" value={user.email} hint="Contactez un administrateur pour changer votre email" />
              </>
            ) : (
              <>
                <InfoField icon={User} label="Nom complet" value={user.name} />
                <InfoField icon={Mail} label="Adresse email" value={user.email} />
                <InfoField icon={Phone} label="Téléphone" value={user.phone || "Non renseigné"} muted={!user.phone} />
                <InfoField icon={Shield} label="Rôle" value={ROLE_LABELS[user.role] || user.role} />
                <InfoField icon={Building2} label="Organisation" value={user.organization.name} />
                {user.campus && <InfoField icon={MapPin} label="Campus" value={user.campus.name + " — " + user.campus.city} />}
                <InfoField icon={Calendar} label="Membre depuis" value={formatDate(user.createdAt)} />
                <InfoField icon={Calendar} label="Dernière connexion" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Première visite"} muted={!user.lastLoginAt} />
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><Key size={16} /> Mot de passe</h3>
            </div>
            <div className="p-6">
              {!showPasswordForm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Modifier votre mot de passe</p>
                    <p className="text-xs text-gray-400 mt-0.5">Utilisez un mot de passe fort et unique</p>
                  </div>
                  <button onClick={function() { setShowPasswordForm(true); }} className="btn-secondary py-2 text-xs">
                    <Key size={13} /> Changer le mot de passe
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe actuel</label>
                    <div className="relative">
                      <input type={showCurrentPwd ? "text" : "password"} value={currentPassword}
                        onChange={function(e) { setCurrentPassword(e.target.value); }}
                        className="input text-sm pr-10" placeholder="Votre mot de passe actuel" />
                      <button type="button" onClick={function() { setShowCurrentPwd(!showCurrentPwd); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Nouveau mot de passe <span className="font-normal text-gray-400">(min. 6 caractères)</span></label>
                    <div className="relative">
                      <input type={showNewPwd ? "text" : "password"} value={newPassword}
                        onChange={function(e) { setNewPassword(e.target.value); }}
                        className="input text-sm pr-10" placeholder="Nouveau mot de passe" />
                      <button type="button" onClick={function() { setShowNewPwd(!showNewPwd); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Confirmer le nouveau mot de passe</label>
                    <input type="password" value={confirmPassword}
                      onChange={function(e) { setConfirmPassword(e.target.value); }}
                      className={cn("input text-sm", confirmPassword && confirmPassword !== newPassword && "border-red-300")}
                      placeholder="Confirmez le mot de passe" />
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button onClick={function() { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                      className="btn-secondary py-2 text-xs">Annuler</button>
                    <button onClick={handleChangePassword}
                      disabled={changingPwd || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                      className="btn-primary py-2 text-xs">
                      {changingPwd ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><LogOut size={16} /> Session</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Déconnexion</p>
                  <p className="text-xs text-gray-400 mt-0.5">Fermer votre session sur cet appareil</p>
                </div>
                <button onClick={handleLogout} className="btn-secondary py-2 text-xs text-red-600 border-red-200 hover:bg-red-50">
                  <LogOut size={13} /> Se déconnecter
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "integrations" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><Calendar size={16} /> Intégrations</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="https://www.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" alt="Google Calendar" className="w-8 h-8" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Google Calendar</p>
                  {googleConnected ? (
                    <p className="text-xs text-emerald-600">Connecté — {googleEmail}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Synchronisez vos rendez-vous et générez des liens Meet</p>
                  )}
                </div>
              </div>
              {googleConnected ? (
                <button onClick={handleDisconnectGoogle} disabled={disconnecting}
                  className="btn-secondary py-2 text-xs text-red-600 border-red-200 hover:bg-red-50">
                  {disconnecting ? <Loader2 size={13} className="animate-spin" /> : null}
                  Déconnecter
                </button>
              ) : (
                <a href="/api/integrations/google/connect?returnTo=/profile" className="btn-primary py-2 text-xs">
                  Connecter
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable components ───
function InfoField({ icon: Icon, label, value, muted }: { icon: typeof User; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <span className={cn("text-sm", muted ? "text-gray-400" : "text-gray-900")}>{value}</span>
    </div>
  );
}

function EditField({ icon: Icon, label, value, onChange, placeholder }: {
  icon: typeof User; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <input type="text" value={value} onChange={function(e) { onChange(e.target.value); }}
        className="input text-sm flex-1" placeholder={placeholder || label} />
    </div>
  );
}

function ReadOnlyField({ icon: Icon, label, value, hint }: {
  icon: typeof User; label: string; value: string; hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <Icon size={16} className="text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <div className="flex-1">
        <span className="text-sm text-gray-400">{value}</span>
        {hint && <p className="text-[10px] text-gray-300 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}