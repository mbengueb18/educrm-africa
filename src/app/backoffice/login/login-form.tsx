"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { boLogin } from "../actions";

export function BoLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await boLogin(email, password);
      if (res.success) {
        window.location.href = "/"; // rechargement complet pour lire la nouvelle session
      } else {
        setError(res.error || "Identifiants invalides");
        setLoading(false);
      }
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white font-bold flex items-center justify-center">T</div>
          <div>
            <p className="text-base font-bold text-gray-900 leading-tight">TalibCRM</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 flex items-center gap-1"><ShieldCheck size={11} /> Back-office</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Connexion plateforme</h1>
          <p className="text-xs text-gray-500 mb-5">Accès réservé aux administrateurs de la plateforme.</p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input text-sm" placeholder="admin@talibcrm.com" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input text-sm" placeholder="••••••••" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm justify-center">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
