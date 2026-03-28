import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTasks, getTaskStats } from "./actions";
import { TasksClient } from "./tasks-client";

export const metadata: Metadata = {
  title: "Tâches",
};

export default async function TasksPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [tasks, stats, users, leads] = await Promise.all([
    getTasks(),
    getTaskStats(),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
      select: { id: true, name: true, avatar: true },
    }),
    prisma.lead.findMany({
      where: { organizationId: session.user.organizationId, isConverted: false },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <TasksClient
      tasks={tasks}
      stats={stats}
      users={users}
      leads={leads}
      currentUserId={session.user.id}
    />
  );
}