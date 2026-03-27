"use client";

import { useState, useTransition, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { School, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/pipeline";
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await signIn("credentials", {
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          redirect: false,
          callbackUrl,
        });

        if (result?.error) {
          toast.error("Email ou mot de passe incorrect");
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      } catch {
        toast.error("Erreur de connexion");
      }
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="absolute bottom-32 right-10 w-96 h-96 rounded-full bg-brand-400/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-accent-400/5 blur-2xl" />
        </div>

        <div className="relative flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent-500 flex items-center justify-center shadow-lg">
              <School size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">EduCRM</h1>
              <p className="text-[11px] text-brand-300 uppercase tracking-[0.2em]">
                Africa
              </p>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Le CRM conçu pour<br />
              <span className="text-accent-400">l&apos;éducation africaine</span>
            </h2>
            <p className="text-brand-200 text-lg leading-relaxed max-w-md">
              Recrutez, inscrivez et accompagnez vos étudiants avec un outil
              pensé pour vos réalités terrain.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                "Pipeline de recrutement",
                "WhatsApp intégré",
                "Suivi des paiements",
                "Mobile Money",
                "Reporting temps réel",
              ].map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1.5 rounded-full bg-white/10 text-sm text-brand-100 backdrop-blur-sm border border-white/10"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-brand-400">
            © 2026 EduCRM Africa — Tous droits réservés
          </p>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-accent-500 text-white flex items-center justify-center">
              <School size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">EduCRM</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">
                Africa
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Bienvenue
            </h2>
            <p className="text-gray-500 mt-1.5">
              Connectez-vous à votre espace EduCRM
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="vous@école.sn"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Mot de passe
                </label>
                <a
                  href="/forgot-password"
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Oublié ?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="input pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="remember" className="text-sm text-gray-600">
                Rester connecté
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full py-3 text-base"
            >
              {isPending ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Pas encore de compte ?{" "}
            <a
              href="/register"
              className="text-brand-600 hover:text-brand-700 font-semibold"
            >
              Demander un accès
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
