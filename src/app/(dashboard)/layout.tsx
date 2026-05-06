import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionProvider } from "@/components/permission-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  var session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEnd = new Date(todayStart.getTime() + 86_400_000);

  var [overdueTasks, dueTodayTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);

  return (
    <PermissionProvider role={session.user.role} userId={session.user.id}>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          organizationSlug: session.user.organizationSlug,
        }}
        overdueTasks={overdueTasks}
        dueTodayTasks={dueTodayTasks}
      >
        {children}
      </DashboardShell>
    </PermissionProvider>
  );
}