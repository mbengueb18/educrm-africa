import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppointments, getAppointmentStats } from "./actions";
import { AppointmentsClient } from "./appointments-client";

export const metadata: Metadata = {
  title: "Rendez-vous",
};

export default async function AppointmentsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [appointments, stats, users, leads] = await Promise.all([
    getAppointments(),
    getAppointmentStats(),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
      select: { id: true, name: true, avatar: true },
    }),
    prisma.lead.findMany({
      where: { organizationId: session.user.organizationId, isConverted: false },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <AppointmentsClient
      appointments={appointments}
      stats={stats}
      users={users}
      leads={leads}
      currentUserId={session.user.id}
    />
  );
}