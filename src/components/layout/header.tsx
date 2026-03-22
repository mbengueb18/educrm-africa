"use client";

import { Bell, Search, Plus, ChevronDown } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useState } from "react";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
    organizationSlug?: string;
  };
}

export function Header({ user }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-[var(--header-height)] px-6 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Rechercher un lead, étudiant, paiement..."
            className="input pl-10 bg-gray-50/80 border-gray-100 focus:bg-white"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn-primary py-2 px-3 text-xs"
          onClick={() => window.dispatchEvent(new CustomEvent("open-new-lead"))}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nouveau lead</span>
        </button>

        <button className="relative p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
        </button>

        <button className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-1">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
            {getInitials(user.name)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {user.role === "ADMIN" ? "Administrateur" : user.role}
            </p>
          </div>
          <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
