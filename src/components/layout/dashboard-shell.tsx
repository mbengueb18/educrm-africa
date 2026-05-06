"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface OverdueTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: Date | null;
  lead: { firstName: string; lastName: string } | null;
  assignedTo: { name: string };
}

interface DashboardShellProps {
  user: {
    name: string;
    email: string;
    role: string;
    organizationSlug?: string;
  };
  overdueTasks: OverdueTask[];
  dueTodayTasks: OverdueTask[];
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  overdueTasks,
  dueTodayTasks,
  children,
}: DashboardShellProps) {
  var [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(function () {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return function () {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Auto-close drawer when window crosses to lg breakpoint (>=1024px)
  useEffect(function () {
    if (typeof window === "undefined") return;
    var mq = window.matchMedia("(min-width: 1024px)");
    var handler = function (e: MediaQueryListEvent) {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return function () {
      mq.removeEventListener("change", handler);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={function () {
          setMobileOpen(false);
        }}
      />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={function () {
            setMobileOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-[var(--sidebar-width)] transition-[padding] duration-300">
        <Header
          user={user}
          overdueTasks={overdueTasks}
          dueTodayTasks={dueTodayTasks}
          onMenuClick={function () {
            setMobileOpen(true);
          }}
        />
        <main className="p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}