import { Metadata } from "next";
import Link from "next/link";
import { Settings, Building2, Users, Palette, Bell, Plug, Shield, SlidersHorizontal, Database, Bot  } from "lucide-react";

export const metadata: Metadata = { title: "Paramètres" };

const settingsMenu = [
  { label: "Organisation", description: "Nom, logo, paramètres généraux", icon: Building2, href: "/settings/organization" },
  { label: "Équipe", description: "Utilisateurs, rôles et permissions", icon: Users, href: "/settings/users" },
  { label: "Pipeline", description: "Étapes du pipeline de recrutement", icon: Settings, href: "/settings/pipeline" },
  { label: "Champs personnalisés", description: "Champs customs captés depuis les formulaires", icon: SlidersHorizontal, href: "/settings/custom-fields" },
  { label: "Propriétés", description: "Vue d'ensemble de tous les champs collectés", icon: Database, href: "/settings/properties" },
  { label: "Intégrations", description: "Tracking, API, formulaire embarquable", icon: Plug, href: "/settings/integrations" },
  { label: "Chatbot", description: "Activez et personnalisez le chatbot de votre site web", icon: Bot, href: "/settings/chatbot" },
  { label: "Notifications", description: "Alertes, rappels, préférences", icon: Bell, href: "/settings/notifications" },
  { label: "Apparence", description: "Thème, langue, personnalisation", icon: Palette, href: "/settings/appearance" },
  { label: "Sécurité", description: "Mot de passe, 2FA, sessions", icon: Shield, href: "/settings/security" },
];

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configurez votre espace EduCRM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsMenu.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-white rounded-xl p-5 border border-gray-200 text-left hover:shadow-card-hover hover:border-brand-200 transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-brand-50 flex items-center justify-center mb-3 transition-colors">
              <item.icon size={20} className="text-gray-500 group-hover:text-brand-600 transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.label}</h3>
            <p className="text-xs text-gray-500">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}