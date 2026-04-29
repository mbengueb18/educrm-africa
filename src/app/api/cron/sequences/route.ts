import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const STEPS = [
  { name: "J1_email", daysAfter: 1, channel: "EMAIL" },
  { name: "J3_whatsapp", daysAfter: 3, channel: "WHATSAPP_TASK" },
  { name: "J7_call_task", daysAfter: 7, channel: "CALL_TASK" },
  { name: "J14_last_chance", daysAfter: 14, channel: "EMAIL" },
  { name: "J21_auto_lost", daysAfter: 21, channel: "AUTO_LOST" },
];

const TEMPLATES: Record<string, { subject?: string; body: string }> = {
  J1_email: {
    subject: "{prenom}, votre projet de formation à {ecole}",
    body:
      "Bonjour {prenom},\n\n" +
      "J'espère que vous allez bien.\n\n" +
      "Vous avez manifesté votre intérêt pour {ecole} il y a 24h, et je voulais m'assurer que vous avez bien reçu nos premières informations.\n\n" +
      "Avez-vous quelques questions sur la filière, les frais, ou souhaitez-vous prendre rendez-vous avec un conseiller ?\n\n" +
      "N'hésitez pas à me répondre directement à cet email.\n\n" +
      "Bien cordialement,\nL'équipe {ecole}",
  },
  J14_last_chance: {
    subject: "Souhaitez-vous toujours rejoindre {ecole}, {prenom} ?",
    body:
      "Bonjour {prenom},\n\n" +
      "Cela fait deux semaines que nous n'avons pas eu l'occasion d'échanger ensemble.\n\n" +
      "Souhaitez-vous toujours poursuivre votre projet de formation à {ecole} ?\n\n" +
      "Sans réponse de votre part dans les prochains jours, votre dossier sera clôturé. " +
      "Vous pouvez toujours nous recontacter ultérieurement si vous changez d'avis.\n\n" +
      "Bien cordialement,\nL'équipe {ecole}",
  },
};

function replaceVars(text: string, lead: any, orgName: string) {
  return text
    .replace(/{prenom}/g, lead.firstName || "")
    .replace(/{nom}/g, lead.lastName || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{ecole}/g, orgName);
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel adds it automatically)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    autoLost: 0,
  };

  try {
    // Get all organizations with sequence enabled
    const orgs = await prisma.organizationSequenceConfig.findMany({
      where: { enabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    for (const orgConfig of orgs) {
      const orgId = orgConfig.organizationId;
      const orgName = orgConfig.organization.name;

      // Get all active leads (not converted, not lost)
      const leads = await prisma.lead.findMany({
        where: {
          organizationId: orgId,
          isConverted: false,
          stage: {
            name: {
              not: { in: ["Perdu", "Admis", "Inscrit", "perdu", "admis", "inscrit"] },
            },
          },
        },
        include: {
          stage: { select: { name: true, order: true } },
          sequenceExecutions: { select: { stepName: true } },
        },
      });

      for (const lead of leads) {
        stats.processed++;

        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(lead.createdAt).getTime()) / 86400000
        );

        // Pause on reply: check if lead has any INBOUND message after creation
        if (orgConfig.pauseOnReply) {
          const inboundMsg = await prisma.message.findFirst({
            where: { leadId: lead.id, direction: "INBOUND", sentAt: { gt: lead.createdAt } },
          });
          if (inboundMsg) { stats.skipped++; continue; }
        }

        // Pause on appointment
        if (orgConfig.pauseOnAppointment) {
          const futureAppt = await prisma.appointment.findFirst({
            where: { leadId: lead.id, status: { in: ["SCHEDULED", "CONFIRMED"] }, startAt: { gte: new Date() } },
          });
          if (futureAppt) { stats.skipped++; continue; }
        }

        const executedSteps = new Set(lead.sequenceExecutions.map((e) => e.stepName));

        // Determine the next step to execute
        for (const step of STEPS) {
          if (daysSinceCreated < step.daysAfter) break;
          if (executedSteps.has(step.name)) continue;

          // Execute this step
          try {
            if (step.channel === "EMAIL") {
              const tpl = TEMPLATES[step.name];
              if (!tpl || !lead.email) {
                await prisma.sequenceExecution.create({
                  data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "SKIPPED" },
                });
                stats.skipped++;
                break;
              }
              await sendEmail({
                to: lead.email,
                toName: lead.firstName + " " + lead.lastName,
                subject: replaceVars(tpl.subject!, lead, orgName),
                body: replaceVars(tpl.body, lead, orgName),
                organizationId: orgId,
                leadId: lead.id,
              });
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "DONE" },
              });
              stats.sent++;
            } else if (step.channel === "WHATSAPP_TASK") {
              // Create a task for the assigned commercial to send WhatsApp
              await prisma.task.create({
                data: {
                  title: "💬 Relance WhatsApp pour " + lead.firstName + " " + lead.lastName,
                  type: "FOLLOW_UP" as any,
                  priority: "HIGH" as any,
                  status: "TODO",
                  dueDate: new Date(Date.now() + 86400000),
                  leadId: lead.id,
                  assignedToId: lead.assignedToId || (await getDefaultUser(orgId)),
                  organizationId: orgId,
                  description: "Relance auto J3 — Envoyer un message WhatsApp à ce lead silencieux",
                },
              });
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "DONE" },
              });
              stats.sent++;
            } else if (step.channel === "CALL_TASK") {
              await prisma.task.create({
                data: {
                  title: "📞 Appel URGENT pour " + lead.firstName + " " + lead.lastName,
                  type: "CALL" as any,
                  priority: "URGENT" as any,
                  status: "TODO",
                  dueDate: new Date(Date.now() + 86400000),
                  leadId: lead.id,
                  assignedToId: lead.assignedToId || (await getDefaultUser(orgId)),
                  organizationId: orgId,
                  description: "Relance auto J7 — Lead silencieux depuis 7 jours, appeler en priorité",
                },
              });
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "DONE" },
              });
              stats.sent++;
            } else if (step.channel === "AUTO_LOST") {
              const lostStage = await prisma.pipelineStage.findFirst({
                where: { organizationId: orgId, name: { contains: "Perdu", mode: "insensitive" } },
              });
              if (lostStage) {
                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { stageId: lostStage.id },
                });
                await prisma.activity.create({
                  data: {
                    type: "LEAD_STAGE_CHANGED",
                    description: "Lead automatiquement marqué comme perdu (aucune réponse après 21 jours)",
                    leadId: lead.id,
                    organizationId: orgId,
                  },
                });
              }
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "DONE" },
              });
              stats.autoLost++;
            }

            break; // Only execute one step per lead per cron run
          } catch (err: any) {
            console.error("[Cron Sequences] Error for lead " + lead.id + " step " + step.name, err.message);
            await prisma.sequenceExecution.create({
              data: { leadId: lead.id, organizationId: orgId, stepName: step.name, status: "FAILED", metadata: { error: err.message } },
            }).catch(() => {});
            stats.errors++;
            break;
          }
        }
      }
    }

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("[Cron Sequences] Fatal error", error);
    return NextResponse.json({ error: error.message, stats }, { status: 500 });
  }
}

async function getDefaultUser(orgId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { organizationId: orgId, role: { in: ["ADMIN", "COMMERCIAL"] }, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("No active user in org " + orgId);
  return user.id;
}