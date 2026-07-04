"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { Building2, Users, LogOut, ShieldCheck } from "lucide-react";
import { boLogout } from "../actions";

const NAV = [
  { label: "Organisations", href: "/", icon: Building2 },
  { label: "Admins plateforme", href: "/admins", icon: Users },
];

const ROLE_LABEL: Record<string, string> = { OWNER: "Propriétaire", ADMIN: "Admin", SUPPORT: "Support" };

export function BoShell({ name, role, children }: { name: string; role: string; children: React.ReactNode }) {
  const pathname = usePathname();

  const logout = async () => {
    await boLogout().catch(() => {});
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center justify-center">T</div>
            <span className="text-sm font-bold text-gray-900 hidden sm:block">TalibCRM</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={10} /> Back-office</span>
          </div>
          <nav className="flex items-center gap-1 ml-2">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100")}>
                  <n.icon size={15} /> <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-900 leading-tight">{name}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{ROLE_LABEL[role] || role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center">{getInitials(name)}</div>
            <button onClick={logout} title="Se déconnecter" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
