"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  LayoutDashboard,
  Kanban,
  MessageSquare,
  Megaphone,
  GraduationCap,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  School,
  ListTodo,
  Phone,
  CalendarDays,
  Zap,
  Users,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { getTotalUnreadCount } from "@/app/(dashboard)/inbox/actions";
import type { Permission } from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string;   
  icon: typeof LayoutDashboard;
  badge?: string;
  permission: Permission;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "analytics:view" as Permission,
  },
  {
    label: "Prospects",
    href: "/pipeline",
    icon: Kanban,
    permission: "leads:view" as Permission,
  },
  {
    label: "Audiences",
    href: "/audiences",
    icon: Users,
    permission: "leads:view" as Permission,
  },
  {
    label: "Tâches",
    href: "/tasks",
    icon: ListTodo,
    permission: "tasks:view" as Permission,
  },
  {
    label: "Appels",
    href: "/calls",
    icon: Phone,
    permission: "calls:view" as Permission,
  },
  {
    label: "Rendez-vous",
    href: "/appointments",
    icon: CalendarDays,
    permission: "appointments:view" as Permission,
  },
  /* {
    label: "Calendrier",
    href: "/calendar",
    icon: CalendarDays,
    permission: "appointments:view" as Permission,
  },*/
  {
    label: "Boite de réception",
    href: "/inbox",
    icon: MessageSquare,
    permission: "leads:view" as Permission,
  },
  {
    label: "Campagnes Email",
    href: "/campaigns",
    icon: Megaphone,
    permission: "campaigns:view" as Permission,
  },
  {
  label: "Campagnes WhatsApp",
  href: "/whatsapp-campaigns",
  icon: MessageCircle,
  permission: "campaigns:view" as Permission,
  /*badge: "BÊTA",*/
  },
  {
    label: "Étudiants",
    href: "/students",
    icon: GraduationCap,
    permission: "students:view" as Permission,
  },
  /* {
    label: "Paiements",
    href: "/payments",
    icon: CreditCard,
    permission: "payments:view" as Permission,
  },*/
  {
    label: "Workflows",
    href: "/workflows",
    icon: Zap,
    permission: "campaigns:view" as Permission,
  },
  {
    label: "Reporting",
    href: "/analytics",
    icon: BarChart3,
    permission: "analytics:view" as Permission,
  },
];

const bottomItems = [
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
    permission: "settings:view" as Permission,
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { can } = usePermissions();
  const [inboxUnread, setInboxUnread] = useState(0);

  // ─── Fetch nombre de messages non lus pour le badge Inbox ───
  const refreshInboxBadge = useCallback(() => {
    if (!can("leads:view")) return;
    getTotalUnreadCount()
      .then(setInboxUnread)
      .catch(() => {
        // Silent fail
      });
  }, [can]);

  useEffect(() => {
    refreshInboxBadge();
    
    // Refresh quand on revient sur l'onglet (focus)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshInboxBadge();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Refresh toutes les 30 secondes pour rattraper les nouveaux messages
    const interval = setInterval(refreshInboxBadge, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [refreshInboxBadge]);

  // Refresh quand on change de page (par exemple, quand on quitte /inbox/[leadId])
  useEffect(() => {
    refreshInboxBadge();
  }, [pathname, refreshInboxBadge]);

  const visibleNavItems = navItems.filter(function (item) {
    return can(item.permission);
  });
  const visibleBottomItems = bottomItems.filter(function (item) {
    return can(item.permission);
  });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar-bg",
        "transition-[transform,width] duration-300 ease-out",
        // Width
        collapsed ? "w-[72px]" : "w-[var(--sidebar-width)]",
        // Mobile: drawer behavior (hidden off-screen by default)
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: always visible
        "lg:translate-x-0"
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
              TalibCRM
            </h1>
            <p className="text-[10px] text-sidebar-text uppercase tracking-widest">
              Africa
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/analytics" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active shadow-sm"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <div className="relative shrink-0">
                <item.icon
                  size={20}
                  className={cn(
                    "transition-colors",
                    isActive
                      ? "text-accent-400"
                      : "text-sidebar-text group-hover:text-white"
                  )}
                />
                {/* Point rouge en mode collapsed pour signaler les non-lus Inbox */}
                {collapsed && item.href === "/inbox" && inboxUnread > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-sidebar-bg" />
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {/* Badge statique défini dans navItems */}
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
                  {/* Badge dynamique Inbox */}
                  {item.href === "/inbox" && inboxUnread > 0 && (
                    <span
                      className={cn(
                        "min-w-[20px] px-2 py-0.5 text-xs rounded-full font-bold flex items-center justify-center",
                        isActive
                          ? "bg-white text-accent-600"
                          : "bg-accent-500 text-white"
                      )}
                    >
                      {inboxUnread > 99 ? "99+" : inboxUnread}
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
        {visibleBottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onMobileClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* Collapse toggle — desktop only (no sense on mobile drawer) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors w-full"
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