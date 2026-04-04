"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  MessageSquare,
  Megaphone,
  GraduationCap,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  School,
  ListTodo,
  Phone,
  CalendarDays,
  Users,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  {
    label: "Dashboard",
    href: "/analytics",
    icon: LayoutDashboard,
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    badge: "12",
  },
  { label: "Tâches",
    href: "/tasks", 
    icon: ListTodo 
  },
  { label: "Appels", 
    href: "/calls", 
    icon: Phone },
  { label: "Rendez-vous", 
    href: "/appointments", 
    icon: CalendarDays },
  {
    label: "Inbox",
    href: "/inbox",
    icon: MessageSquare,
    badge: "3",
  },
  {
  label: "Campagnes",
  href: "/campaigns",
  icon: Megaphone,
  },
  {
    label: "Étudiants",
    href: "/students",
    icon: GraduationCap,
  },
  {
    label: "Paiements",
    href: "/payments",
    icon: CreditCard,
  },
  {
    label: "Reporting",
    href: "/analytics",
    icon: BarChart3,
  },
  { label: "Utilisateurs", 
    href: "/users", 
    icon: Users },
];

const bottomItems = [
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar-bg transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[var(--header-height)] border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-500 text-white shrink-0">
          <School size={20} />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-base font-bold text-white tracking-tight">
              EduCRM
            </h1>
            <p className="text-[10px] text-sidebar-text uppercase tracking-widest">
              Africa
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/analytics" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active shadow-sm"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-accent-400" : "text-sidebar-text group-hover:text-white"
                )}
              />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-full font-semibold",
                        isActive
                          ? "bg-accent-500 text-white"
                          : "bg-white/15 text-sidebar-text"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors w-full"
        >
          <ChevronLeft
            size={20}
            className={cn(
              "shrink-0 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Réduire</span>}
        </button>
      </div>
    </aside>
  );
}
