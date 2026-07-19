import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const TYPE_LABELS: Record<string, string> = {
  TODO: "À faire",
  CALL: "Appel",
  EMAIL: "Email",
  MEETING: "Rendez-vous",
  FOLLOW_UP: "Relance",
  DOCUMENT: "Document",
  OTHER: "Autre",
};

function formatDateTimeFr(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { processed: 0, notified: 0, emailed: 0, errors: 0 };

  try {
    const now = new Date();

    // Rappels échus, non encore notifiés, sur des tâches encore ouvertes
    const dueTasks = await prisma.task.findMany({
      where: {
        reminderAt: { not: null, lte: now },
        reminderSentAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    });

    for (const task of dueTasks) {
      try {
        // Claim ATOMIQUE avant envoi : si un tick concurrent a déjà pris cette tâche
        // (reminderSentAt non nul), count = 0 → on passe. Élimine les doubles rappels.
        const claimed = await prisma.task.updateMany({
          where: { id: task.id, reminderSentAt: null },
          data: { reminderSentAt: now },
        });
        if (claimed.count === 0) continue;

        const leadName = task.lead ? task.lead.firstName + " " + task.lead.lastName : null;
        const typeLabel = TYPE_LABELS[task.type] || task.type;
        const dueStr = formatDateTimeFr(task.dueDate);

        const notifTitle = "Rappel : " + task.title;
        const notifBody =
          typeLabel +
          (leadName ? " — " + leadName : "") +
          (dueStr ? " · échéance " + dueStr : "");

        // 1) Notification in-app
        await prisma.notification.create({
          data: {
            userId: task.assignedToId,
            organizationId: task.organizationId,
            type: "TASK_REMINDER",
            title: notifTitle,
            body: notifBody,
            taskId: task.id,
            leadId: task.leadId,
            url: "/tasks",
          },
        });
        stats.notified++;

        // 2) Notification email (si l'utilisateur a un email)
        if (task.assignedTo?.email) {
          const emailBody =
            "Bonjour " + (task.assignedTo.name || "") + ",\n\n" +
            "Rappel pour votre tâche :\n\n" +
            "• " + task.title + "\n" +
            "• Type : " + typeLabel + "\n" +
            (leadName ? "• Contact : " + leadName + "\n" : "") +
            (dueStr ? "• Échéance : " + dueStr + "\n" : "") +
            (task.description ? "\n" + task.description + "\n" : "") +
            "\nConnectez-vous à TalibCRM pour la traiter.";

          const res = await sendEmail({
            to: task.assignedTo.email,
            toName: task.assignedTo.name || undefined,
            subject: notifTitle,
            body: emailBody,
            organizationId: task.organizationId,
            isHtml: false,
          });
          if (res.success) stats.emailed++;
        }

        // (reminderSentAt déjà posé par le claim atomique en tête de boucle)
        stats.processed++;
      } catch (err: any) {
        console.error("[Task reminder] " + task.id, err?.message);
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("[Cron Task Reminders]", error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}
