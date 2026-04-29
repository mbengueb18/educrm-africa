import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { DEFAULT_SEQUENCE_STEPS, getStepsOrDefault, replaceVars, type SequenceStep } from "@/lib/sequence-defaults";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0, autoLost: 0 };

  try {
    const orgs = await prisma.organizationSequenceConfig.findMany({
      where: { enabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    for (const orgConfig of orgs) {
      const orgId = orgConfig.organizationId;
      const orgName = orgConfig.organization.name;
      const steps = getStepsOrDefault(orgConfig.steps).filter((s) => s.enabled);

      if (steps.length === 0) continue;

      const leads = await prisma.lead.findMany({
        where: {
          organizationId: orgId,
          isConverted: false,
          stage: {
            name: { not: { in: ["Perdu", "Admis", "Inscrit", "perdu", "admis", "inscrit"] } },
          },
        },
        include: {
          stage: { select: { name: true } },
          sequenceExecutions: { select: { stepName: true } },
        },
      });

      for (const lead of leads) {
        stats.processed++;

        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(lead.createdAt).getTime()) / 86400000
        );

        if (orgConfig.pauseOnReply) {
          const inboundMsg = await prisma.message.findFirst({
            where: { leadId: lead.id, direction: "INBOUND", sentAt: { gt: lead.createdAt } },
          });
          if (inboundMsg) { stats.skipped++; continue; }
        }

        if (orgConfig.pauseOnAppointment) {
          const futureAppt = await prisma.appointment.findFirst({
            where: { leadId: lead.id, status: { in: ["SCHEDULED", "CONFIRMED"] }, startAt: { gte: new Date() } },
          });
          if (futureAppt) { stats.skipped++; continue; }
        }

        const executedSteps = new Set(lead.sequenceExecutions.map((e) => e.stepName));

        for (const step of steps) {
          if (daysSinceCreated < step.daysAfter) break;
          if (executedSteps.has(step.id)) continue;

          try {
            if (step.channel === "EMAIL") {
              if (!lead.email || !step.emailSubject || !step.emailBody) {
                await prisma.sequenceExecution.create({
                  data: { leadId: lead.id, organizationId: orgId, stepName: step.id, status: "SKIPPED" },
                });
                stats.skipped++;
                break;
              }
              await sendEmail({
                to: lead.email,
                toName: lead.firstName + " " + lead.lastName,
                subject: replaceVars(step.emailSubject, lead, orgName),
                body: replaceVars(step.emailBody, lead, orgName),
                organizationId: orgId,
                leadId: lead.id,
              });
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.id, status: "DONE" },
              });
              stats.sent++;
            } else if (step.channel === "WHATSAPP_TASK" || step.channel === "CALL_TASK") {
              const title = replaceVars(step.taskTitle || "", lead, orgName);
              const desc = replaceVars(step.taskDescription || "", lead, orgName);
              await prisma.task.create({
                data: {
                  title: title,
                  type: (step.channel === "CALL_TASK" ? "CALL" : "FOLLOW_UP") as any,
                  priority: (step.taskPriority || "HIGH") as any,
                  status: "TODO",
                  dueDate: new Date(Date.now() + 86400000),
                  leadId: lead.id,
                  assignedToId: lead.assignedToId || (await getDefaultUser(orgId)),
                  organizationId: orgId,
                  description: desc,
                },
              });
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.id, status: "DONE" },
              });
              stats.sent++;
            } else if (step.channel === "AUTO_LOST") {
              const lostStage = await prisma.pipelineStage.findFirst({
                where: { organizationId: orgId, name: { contains: "Perdu", mode: "insensitive" } },
              });
              if (lostStage) {
                await prisma.lead.update({ where: { id: lead.id }, data: { stageId: lostStage.id } });
                await prisma.activity.create({
                  data: {
                    type: "LEAD_STAGE_CHANGED",
                    description: "Lead automatiquement marqué comme perdu (aucune réponse après " + step.daysAfter + " jours)",
                    leadId: lead.id,
                    organizationId: orgId,
                  },
                });
              }
              await prisma.sequenceExecution.create({
                data: { leadId: lead.id, organizationId: orgId, stepName: step.id, status: "DONE" },
              });
              stats.autoLost++;
            }

            break;
          } catch (err: any) {
            console.error("[Cron Sequences] Error for lead " + lead.id + " step " + step.id, err.message);
            await prisma.sequenceExecution.create({
              data: { leadId: lead.id, organizationId: orgId, stepName: step.id, status: "FAILED", metadata: { error: err.message } },
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