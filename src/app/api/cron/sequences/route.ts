import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { DEFAULT_SEQUENCE_STEPS, getStepsOrDefault, replaceVars, type SequenceStep } from "@/lib/sequence-defaults";

export const runtime = "nodejs";
// 300s (plan Pro) : le run quotidien doit pouvoir traiter tout le backlog sans
// perdre silencieusement les derniers steps comme avec 60s.
export const maxDuration = 300;

const TIME_BUDGET_MS = 280_000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0, autoLost: 0, timedOut: false };

  try {
    const orgs = await prisma.organizationSequenceConfig.findMany({
      where: { enabled: true },
      include: { organization: { select: { id: true, name: true } } },
    });

    for (const orgConfig of orgs) {
      if (Date.now() - started > TIME_BUDGET_MS) { stats.timedOut = true; break; }

      const orgId = orgConfig.organizationId;
      const orgName = orgConfig.organization.name;
      const steps = getStepsOrDefault(orgConfig.steps).filter((s) => s.enabled);

      if (steps.length === 0) continue;

      // Pré-filtre SQL : un lead ne peut avoir un step dû qu'à partir du plus petit daysAfter
      const minDaysAfter = Math.min(...steps.map((s) => s.daysAfter));
      const maxCreatedAt = new Date(Date.now() - minDaysAfter * 86400000);

      const leads = await prisma.lead.findMany({
        where: {
          organizationId: orgId,
          isConverted: false,
          createdAt: { lte: maxCreatedAt },
          stage: {
            name: { not: { in: ["Perdu", "Admis", "Inscrit", "perdu", "admis", "inscrit"] } },
          },
        },
        include: {
          stage: { select: { name: true } },
          sequenceExecutions: { select: { stepName: true } },
        },
      });

      if (leads.length === 0) continue;

      // Pauses évaluées en 2 requêtes GROUPÉES pour toute l'org
      // (au lieu de 2 findFirst PAR lead → ~7000 requêtes/run à 3500 leads)
      const leadIds = leads.map((l) => l.id);

      let lastInboundByLead = new Map<string, Date>();
      if (orgConfig.pauseOnReply) {
        const inbound = await prisma.message.groupBy({
          by: ["leadId"],
          where: { leadId: { in: leadIds }, direction: "INBOUND" },
          _max: { sentAt: true },
        });
        lastInboundByLead = new Map(
          inbound.filter((g) => g.leadId && g._max.sentAt).map((g) => [g.leadId as string, g._max.sentAt as Date])
        );
      }

      let leadsWithFutureAppt = new Set<string>();
      if (orgConfig.pauseOnAppointment) {
        const appts = await prisma.appointment.findMany({
          where: { leadId: { in: leadIds }, status: { in: ["SCHEDULED", "CONFIRMED"] }, startAt: { gte: new Date() } },
          select: { leadId: true },
          distinct: ["leadId"],
        });
        leadsWithFutureAppt = new Set(appts.map((a) => a.leadId).filter(Boolean) as string[]);
      }

      for (const lead of leads) {
        if (Date.now() - started > TIME_BUDGET_MS) { stats.timedOut = true; break; }
        stats.processed++;

        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(lead.createdAt).getTime()) / 86400000
        );

        if (orgConfig.pauseOnReply) {
          const lastInbound = lastInboundByLead.get(lead.id);
          if (lastInbound && lastInbound > lead.createdAt) { stats.skipped++; continue; }
        }

        if (orgConfig.pauseOnAppointment && leadsWithFutureAppt.has(lead.id)) {
          stats.skipped++;
          continue;
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

    console.log(JSON.stringify({ scope: "cron/sequences", durationMs: Date.now() - started, ...stats }));
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