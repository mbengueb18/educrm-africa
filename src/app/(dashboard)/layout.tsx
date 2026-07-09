import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionProvider } from "@/components/permission-provider";
import { SupportBubble } from "@/components/support/support-bubble";
import { AnalyticsPageView } from "@/components/analytics/analytics-page-view";
import { CallReturnPrompt } from "@/components/calls/call-return-prompt";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { VerifyEmailBanner } from "@/components/onboarding/verify-email-banner";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { getOnboardingProgress } from "@/lib/onboarding-progress";

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

  // Un commercial ne voit dans son bell que SES tâches. Les admins gardent la vue globale.
  var isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  var assigneeFilter = isAdmin ? {} : { assignedToId: session.user.id };

  var [overdueTasks, dueTodayTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...assigneeFilter,
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
        ...assigneeFilter,
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

  var org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { plan: true },
  });

  // Blocage souple : bannière tant que l'email de l'utilisateur n'est pas vérifié.
  var currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true, email: true },
  });
  var needsEmailVerification = currentUser != null && currentUser.emailVerified == null;

  // Checklist de premier démarrage (progression déduite des vraies données).
  var onboardingProgress = await getOnboardingProgress(session.user.organizationId, session.user.id);

  return (
    <PermissionProvider role={session.user.role} userId={session.user.id}>
      <AnalyticsPageView
        orgId={session.user.organizationId}
        userId={session.user.id}
        userRole={session.user.role}
        plan={org?.plan}
      />
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
        {needsEmailVerification && currentUser?.email && (
          <VerifyEmailBanner email={currentUser.email} />
        )}
        {children}
      </DashboardShell>
      <SupportBubble />
      <CallReturnPrompt />
      <OnboardingTour userId={session.user.id} />
      <OnboardingChecklist progress={onboardingProgress} />
    </PermissionProvider>
  );
}