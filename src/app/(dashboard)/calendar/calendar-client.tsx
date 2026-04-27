"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { getCalendarEvents, rescheduleTask, rescheduleAppointment } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarDays, Filter, Loader2, Users as UsersIcon } from "lucide-react";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const DnDCalendar = withDragAndDrop(Calendar as any) as any;

const locales = { fr: fr };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: function() { return startOfWeek(new Date(), { weekStartsOn: 1 }); },
  getDay,
  locales,
});

const messages = {
  date: "Date", time: "Heure", event: "Événement",
  allDay: "Journée", week: "Semaine", work_week: "Sem. travail", day: "Jour",
  month: "Mois", previous: "Précédent", next: "Suivant", yesterday: "Hier",
  tomorrow: "Demain", today: "Aujourd'hui", agenda: "Agenda",
  noEventsInRange: "Aucun événement sur cette période.",
  showMore: function(total: number) { return "+" + total + " autres"; },
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    type: "task" | "appointment";
    priority?: string;
    apptType?: string;
    lead?: { id: string; firstName: string; lastName: string } | null;
    assignedTo?: { id: string; name: string } | null;
    location?: string | null;
    meetingUrl?: string | null;
  };
}

export function CalendarClient({ users }: { users: { id: string; name: string }[] }) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"all" | "task" | "appointment">("all");

  const loadEvents = useCallback(async function() {
    setLoading(true);
    try {
      const data = await getCalendarEvents({ userId: userFilter || undefined });
      const evts: CalendarEvent[] = [];

      data.tasks.forEach(function(t) {
        if (!t.dueDate) return;
        evts.push({
          id: "task-" + t.id,
          title: "📋 " + t.title,
          start: new Date(t.dueDate),
          end: new Date(new Date(t.dueDate).getTime() + 30 * 60000),
          resource: {
            type: "task",
            priority: t.priority,
            lead: t.lead,
            assignedTo: t.assignedTo,
          },
        });
      });

      data.appointments.forEach(function(a) {
        evts.push({
          id: "appt-" + a.id,
          title: "📅 " + a.title,
          start: new Date(a.startAt),
          end: new Date(a.endAt),
          resource: {
            type: "appointment",
            apptType: a.type,
            lead: a.lead,
            assignedTo: a.assignedTo,
            location: a.location,
            meetingUrl: a.meetingUrl,
          },
        });
      });

      setEvents(evts);
    } catch (e: any) {
      toast.error(e.message || "Erreur de chargement");
    }
    setLoading(false);
  }, [userFilter]);

  useEffect(function() { loadEvents(); }, [loadEvents]);

  const filteredEvents = events.filter(function(e) {
    if (typeFilter === "all") return true;
    return e.resource.type === typeFilter;
  });

  const handleEventDrop = async ({ event, start, end }: any) => {
    const ev = event as CalendarEvent;
    try {
      const id = ev.id.replace(/^(task-|appt-)/, "");
      if (ev.resource.type === "task") {
        await rescheduleTask(id, new Date(start));
      } else {
        await rescheduleAppointment(id, new Date(start), new Date(end));
      }
      // Optimistic update
      setEvents(function(prev) {
        return prev.map(function(e) {
          if (e.id === ev.id) return { ...e, start: new Date(start), end: new Date(end) };
          return e;
        });
      });
      toast.success(ev.resource.type === "task" ? "Tâche déplacée" : "RDV déplacé");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      loadEvents();
    }
  };

  const handleEventResize = async ({ event, start, end }: any) => {
    const ev = event as CalendarEvent;
    if (ev.resource.type !== "appointment") return;
    try {
      const id = ev.id.replace(/^appt-/, "");
      await rescheduleAppointment(id, new Date(start), new Date(end));
      setEvents(function(prev) {
        return prev.map(function(e) {
          if (e.id === ev.id) return { ...e, start: new Date(start), end: new Date(end) };
          return e;
        });
      });
      toast.success("Durée ajustée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      loadEvents();
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const r = event.resource;
    let bg = "#3b82f6";
    let border = "#2563eb";

    if (r.type === "task") {
      if (r.priority === "URGENT") { bg = "#dc2626"; border = "#b91c1c"; }
      else if (r.priority === "HIGH") { bg = "#f59e0b"; border = "#d97706"; }
      else if (r.priority === "MEDIUM") { bg = "#eab308"; border = "#ca8a04"; }
      else { bg = "#94a3b8"; border = "#64748b"; }
    } else {
      bg = "#3b82f6"; border = "#2563eb";
      if (r.apptType === "VIDEO_CALL") { bg = "#8b5cf6"; border = "#7c3aed"; }
      else if (r.apptType === "PHONE") { bg = "#0ea5e9"; border = "#0284c7"; }
    }

    return {
      style: {
        backgroundColor: bg,
        borderColor: border,
        color: "white",
        border: "1px solid " + border,
        borderRadius: "6px",
        padding: "2px 6px",
        fontSize: "11px",
      },
    };
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const ev = event as CalendarEvent;
    if (ev.resource.lead) {
      window.open("/pipeline?leadId=" + ev.resource.lead.id, "_blank");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarDays size={24} className="text-brand-500" /> Calendrier de relance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualisez et gérez tâches et rendez-vous. Cliquer-glisser pour reprogrammer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { k: "all", l: "Tout" },
              { k: "task", l: "Tâches" },
              { k: "appointment", l: "RDV" },
            ].map(function(t) {
              return (
                <button key={t.k} onClick={function() { setTypeFilter(t.k as any); }}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    typeFilter === t.k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}>
                  {t.l}
                </button>
              );
            })}
          </div>

          {/* User filter */}
          <select value={userFilter} onChange={function(e) { setUserFilter(e.target.value); }} className="input text-xs py-1.5">
            <option value="">Tous les commerciaux</option>
            {users.map(function(u) { return <option key={u.id} value={u.id}>{u.name}</option>; })}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 px-1 text-[11px] flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-600"></span>Tâche urgente</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500"></span>Tâche haute</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500"></span>Tâche moyenne</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-400"></span>Tâche basse</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500"></span>RDV physique</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-500"></span>RDV visio</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500"></span>RDV téléphone</span>
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-xl">
            <Loader2 size={32} className="animate-spin text-brand-500" />
          </div>
        )}
        <DnDCalendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectEvent={handleSelectEvent}
          resizable
          selectable={false}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture="fr"
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          step={30}
          timeslots={2}
          min={new Date(0, 0, 0, 7, 0, 0)}
          max={new Date(0, 0, 0, 21, 0, 0)}
          formats={{
            timeGutterFormat: "HH:mm",
            eventTimeRangeFormat: function({ start, end }: any) {
              return format(start, "HH:mm") + " - " + format(end, "HH:mm");
            },
          }}
          style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
        />
      </div>
    </div>
  );
}