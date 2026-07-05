"use client";

import { Bell, Search, Plus, ChevronDown, AlertTriangle, Clock, ListTodo, CheckCircle2, Menu, BellRing, CheckCheck } from "lucide-react";
import { getInitials, formatRelative } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/app/(dashboard)/notifications/actions";

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface OverdueTask {
  id: string;
  title: string;
  type: string;
  priority: string;
  dueDate: Date | null;
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
  onMenuClick?: () => void;
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

export function Header({ user, overdueTasks = [], dueTodayTasks = [], onMenuClick }: HeaderProps) {
  var [showNotifs, setShowNotifs] = useState(false);
  var [notifications, setNotifications] = useState<AppNotification[]>([]);
  var [unreadCount, setUnreadCount] = useState(0);
  var seenIdsRef = useRef<Set<string>>(new Set());
  var isFirstLoadRef = useRef(true);
  var audioCtxRef = useRef<any>(null);

  // ─── Bip sonore (Web Audio, aucun fichier externe) ───
  var playBeep = useCallback(function () {
    try {
      var Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      var ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // ignore (autoplay bloqué, etc.)
    }
  }, []);

  // ─── Polling des notifications ───
  var refreshNotifications = useCallback(function () {
    getMyNotifications()
      .then(function (res) {
        setNotifications(res.items as any);
        setUnreadCount(res.count);

        var freshUnread = (res.items as AppNotification[]).filter(function (n) {
          return !n.isRead && !seenIdsRef.current.has(n.id);
        });
        (res.items as AppNotification[]).forEach(function (n) { seenIdsRef.current.add(n.id); });

        // Ne pas biper au tout premier chargement de la session
        if (!isFirstLoadRef.current && freshUnread.length > 0) {
          playBeep();
        }
        isFirstLoadRef.current = false;
      })
      .catch(function () { /* silent */ });
  }, [playBeep]);

  useEffect(function () {
    refreshNotifications();
    var interval = setInterval(refreshNotifications, 30000);
    var onVisible = function () { if (document.visibilityState === "visible") refreshNotifications(); };
    document.addEventListener("visibilitychange", onVisible);
    return function () {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshNotifications]);

  var handleNotifClick = function (n: AppNotification) {
    markNotificationRead(n.id).catch(function () {});
    setNotifications(function (prev) { return prev.map(function (x) { return x.id === n.id ? { ...x, isRead: true } : x; }); });
    setUnreadCount(function (c) { return Math.max(0, c - (n.isRead ? 0 : 1)); });
    setShowNotifs(false);
    if (n.url) window.location.href = n.url;
  };

  var handleMarkAllRead = function () {
    markAllNotificationsRead().catch(function () {});
    setNotifications(function (prev) { return prev.map(function (x) { return { ...x, isRead: true }; }); });
    setUnreadCount(0);
  };

  var totalNotifs = unreadCount + overdueTasks.length + dueTodayTasks.length;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 h-[var(--header-height)] px-3 sm:px-6 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
      {/* Mobile menu button — hidden on desktop */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu size={22} />
      </button>

      <div className="flex items-center gap-3 flex-1 max-w-xl min-w-0">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="input pl-10 bg-gray-50/80 border-gray-100 focus:bg-white"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono hidden sm:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2">
        

        {/* Notifications */}
        <div className="relative">
          <button
            data-tour="notifications"
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
              <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-[calc(var(--header-height)+0.5rem)] sm:top-full sm:mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 sm:w-96 max-h-[480px] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <CheckCheck size={12} /> Tout marquer comme lu
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  {notifications.length === 0 && overdueTasks.length === 0 && dueTodayTasks.length === 0 ? (
                    <div className="py-12 text-center">
                      <CheckCircle2 size={32} className="text-emerald-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Aucune notification</p>
                      <p className="text-xs text-gray-300 mt-0.5">Toutes vos tâches sont à jour</p>
                    </div>
                  ) : (
                    <>
                      {/* App notifications (rappels de tâches, etc.) */}
                      {notifications.length > 0 && (
                        <div>
                          <div className="px-4 py-2 bg-brand-50/50 border-b border-brand-100">
                            <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1">
                              <BellRing size={10} /> Rappels
                            </span>
                          </div>
                          {notifications.map(function (n) {
                            return (
                              <button
                                key={n.id}
                                onClick={function () { handleNotifClick(n); }}
                                className={cn(
                                  "w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50",
                                  !n.isRead && "bg-brand-50/30"
                                )}
                              >
                                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <BellRing size={14} className="text-brand-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm truncate", !n.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-600")}>
                                    {n.title}
                                  </p>
                                  {n.body && <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>}
                                  <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                                </div>
                                {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1.5" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

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
                                  <div className="flex items-center gap-1 mt-1 text-[10px]
                                   text-red-500 font-medium">
                                    <Clock size={10} />
                                    Échéance dépassée : {task.dueDate ? formatRelative(task.dueDate) : ""}
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
                                    Prévu : {task.dueDate ? new Date(task.dueDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}
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

        <div className="relative">
          <button onClick={function() { window.location.href = "/profile"; }}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-1">
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
      </div>
    </header>
  );
}