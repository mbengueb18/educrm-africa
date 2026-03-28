"use client";

import { Bell, Search, Plus, ChevronDown, AlertTriangle, Clock, ListTodo, CheckCircle2 } from "lucide-react";
import { getInitials, formatRelative } from "@/lib/utils";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OverdueTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: Date;
  lead: { firstName: string; lastName: string } | null;
  assignedTo: { name: string };
}

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
    organizationSlug?: string;
  };
  overdueTasks?: OverdueTask[];
  dueTodayTasks?: OverdueTask[];
}

var PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-blue-600",
  HIGH: "text-orange-600",
  URGENT: "text-red-600",
};

var TYPE_LABELS: Record<string, string> = {
  TODO: "À faire",
  CALL: "Appeler",
  EMAIL: "Email",
  MEETING: "RDV",
  FOLLOW_UP: "Relance",
  DOCUMENT: "Document",
  OTHER: "Autre",
};

export function Header({ user, overdueTasks = [], dueTodayTasks = [] }: HeaderProps) {
  var [showNotifs, setShowNotifs] = useState(false);

  var totalNotifs = overdueTasks.length + dueTodayTasks.length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-[var(--header-height)] px-6 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
          onClick={function() { window.dispatchEvent(new CustomEvent("open-new-lead")); }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nouveau lead</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={function() { setShowNotifs(!showNotifs); }}
            className="relative p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} />
            {totalNotifs > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white px-1">
                {totalNotifs > 99 ? "99+" : totalNotifs}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={function() { setShowNotifs(false); }} />
              <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-96 max-h-[480px] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                  {totalNotifs > 0 && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      {totalNotifs} en attente
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  {totalNotifs === 0 ? (
                    <div className="py-12 text-center">
                      <CheckCircle2 size={32} className="text-emerald-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Aucune notification</p>
                      <p className="text-xs text-gray-300 mt-0.5">Toutes vos tâches sont à jour</p>
                    </div>
                  ) : (
                    <>
                      {/* Overdue tasks */}
                      {overdueTasks.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-red-50/50 border-b border-red-100">
                            <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle size={10} /> En retard ({overdueTasks.length})
                            </span>
                          </div>
                          {overdueTasks.map(function(task) {
                            return (
                              <a key={task.id} href="/tasks" onClick={function() { setShowNotifs(false); }}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-red-50/30 transition-colors border-b border-gray-50 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <AlertTriangle size={14} className="text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {task.lead && (
                                      <span className="text-xs text-brand-600">{task.lead.firstName} {task.lead.lastName}</span>
                                    )}
                                    <span className="text-[10px] text-gray-400">{TYPE_LABELS[task.type] || task.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-medium">
                                    <Clock size={10} />
                                    Échéance dépassée : {formatRelative(task.dueDate)}
                                  </div>
                                </div>
                                <span className={cn("text-[10px] font-semibold", PRIORITY_COLORS[task.priority])}>
                                  {task.priority === "URGENT" ? "!!!" : task.priority === "HIGH" ? "!!" : ""}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* Due today tasks */}
                      {dueTodayTasks.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-amber-50/50 border-b border-amber-100">
                            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                              <Clock size={10} /> Aujourd'hui ({dueTodayTasks.length})
                            </span>
                          </div>
                          {dueTodayTasks.map(function(task) {
                            return (
                              <a key={task.id} href="/tasks" onClick={function() { setShowNotifs(false); }}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50/30 transition-colors border-b border-gray-50 cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <Clock size={14} className="text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {task.lead && (
                                      <span className="text-xs text-brand-600">{task.lead.firstName} {task.lead.lastName}</span>
                                    )}
                                    <span className="text-[10px] text-gray-400">{TYPE_LABELS[task.type] || task.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600">
                                    <Clock size={10} />
                                    Prévu : {new Date(task.dueDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                {totalNotifs > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                    <a href="/tasks" onClick={function() { setShowNotifs(false); }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center justify-center gap-1">
                      <ListTodo size={12} /> Voir toutes les tâches
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

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