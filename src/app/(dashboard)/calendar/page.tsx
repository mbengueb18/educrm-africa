import { Metadata } from "next";
import { getCalendarUsers } from "./actions";
import { CalendarClient } from "./calendar-client";

export const metadata: Metadata = {
  title: "Calendrier",
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const users = await getCalendarUsers();
  return <CalendarClient users={users} />;
}