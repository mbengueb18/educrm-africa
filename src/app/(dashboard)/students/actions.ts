"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get all students ───
export async function getStudents() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.student.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      program: { select: { id: true, name: true, code: true, level: true, tuitionAmount: true } },
      campus: { select: { id: true, name: true, city: true } },
      lead: { select: { source: true } },
      _count: { select: { payments: true, attendances: true, grades: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Convert lead to student ───
export async function convertLeadToStudent(leadId: string, programId: string, campusId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  // Get lead
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead introuvable");
  if (lead.isConverted) throw new Error("Ce lead est déjà converti");

  // Get current academic year
  const academicYear = await prisma.academicYear.findFirst({
    where: { organizationId, isCurrent: true },
  });
  if (!academicYear) throw new Error("Aucune année académique active");

  // Get "Inscrit" stage
  const inscritStage = await prisma.pipelineStage.findFirst({
    where: { organizationId, isWon: true },
  });

  // Generate student number
  const count = await prisma.student.count({ where: { organizationId } });
  const year = new Date().getFullYear();
  const studentNumber = `EDU-${year}-${String(count + 1).padStart(4, "0")}`;

  // Transaction: create student + update lead + create enrollment + create payment plan
  const student = await prisma.$transaction(async (tx) => {
    // Create student
    const student = await tx.student.create({
      data: {
        studentNumber,
        leadId,
        programId,
        campusId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        email: lead.email,
        gender: lead.gender,
        dateOfBirth: lead.dateOfBirth,
        organizationId,
      },
    });

    // Mark lead as converted
    await tx.lead.update({
      where: { id: leadId },
      data: {
        isConverted: true,
        convertedAt: new Date(),
        stageId: inscritStage?.id || lead.stageId,
      },
    });

    // Create enrollment
    await tx.enrollment.create({
      data: {
        studentId: student.id,
        academicYearId: academicYear.id,
        yearOfStudy: 1,
      },
    });

    // Get program tuition to create payment plan
    const program = await tx.program.findUnique({ where: { id: programId } });
    if (program) {
      const tranches = 3;
      const amount = Math.round(program.tuitionAmount / tranches);
      const now = new Date();

      for (let i = 0; i < tranches; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + i * 2); // Every 2 months

        await tx.payment.create({
          data: {
            studentId: student.id,
            academicYearId: academicYear.id,
            label: i === 0 ? "Frais d'inscription + Tranche 1" : `Tranche ${i + 1}`,
            amount,
            dueDate,
            status: "PENDING",
            organizationId,
          },
        });
      }
    }

    // Log activity
    await tx.activity.create({
      data: {
        type: "LEAD_CONVERTED",
        description: `${lead.firstName} ${lead.lastName} converti en étudiant (${studentNumber})`,
        userId: session.user.id,
        leadId,
        studentId: student.id,
        organizationId,
      },
    });

    return student;
  });

  revalidatePath("/pipeline");
  revalidatePath("/students");
  revalidatePath("/payments");

  return student;
}

// ─── Get student detail ───
export async function getStudentDetail(studentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  return prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      campus: true,
      lead: { select: { source: true, sourceDetail: true, campaign: { select: { name: true } } } },
      enrollments: {
        include: { academicYear: true },
        orderBy: { enrolledAt: "desc" },
      },
      payments: {
        orderBy: { dueDate: "asc" },
      },
      grades: {
        include: { subject: true },
        orderBy: { createdAt: "desc" },
      },
      attendances: {
        orderBy: { date: "desc" },
        take: 30,
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });
}

// ─── Get student stats ───
export async function getStudentStats() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const { organizationId } = session.user;

  const [total, active, graduated, suspended] = await Promise.all([
    prisma.student.count({ where: { organizationId } }),
    prisma.student.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.student.count({ where: { organizationId, status: "GRADUATED" } }),
    prisma.student.count({ where: { organizationId, status: "SUSPENDED" } }),
  ]);

  return { total, active, graduated, suspended };
}
