"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Generate student number ───
async function generateStudentNumber(organizationId: string): Promise<string> {
  var year = new Date().getFullYear();
  var prefix = "EDU-" + year + "-";

  var lastStudent = await prisma.student.findFirst({
    where: {
      organizationId,
      studentNumber: { startsWith: prefix },
    },
    orderBy: { studentNumber: "desc" },
    select: { studentNumber: true },
  });

  var nextNum = 1;
  if (lastStudent) {
    var parts = lastStudent.studentNumber.split("-");
    var lastNum = parseInt(parts[parts.length - 1]) || 0;
    nextNum = lastNum + 1;
  }

  return prefix + String(nextNum).padStart(4, "0");
}

// ─── Convert lead to student ───
export async function convertLeadToStudent(data: {
  leadId: string;
  programId: string;
  campusId: string;
  academicYearId?: string;
  // Overrides (can modify info during conversion)
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  // Get the lead
  var lead = await prisma.lead.findFirst({
    where: { id: data.leadId, organizationId: orgId },
  });

  if (!lead) throw new Error("Lead introuvable");
  if (lead.isConverted) throw new Error("Ce lead a déjà été converti");

  // Check program exists
  var program = await prisma.program.findFirst({
    where: { id: data.programId, organizationId: orgId },
  });
  if (!program) throw new Error("Programme introuvable");

  // Check campus exists
  var campus = await prisma.campus.findFirst({
    where: { id: data.campusId, organizationId: orgId },
  });
  if (!campus) throw new Error("Campus introuvable");

  // Generate student number
  var studentNumber = await generateStudentNumber(orgId);

  // Create student
  var student = await prisma.student.create({
    data: {
      studentNumber,
      leadId: lead.id,
      programId: data.programId,
      campusId: data.campusId,
      status: "ACTIVE",
      firstName: data.firstName || lead.firstName,
      lastName: data.lastName || lead.lastName,
      phone: data.phone || lead.phone,
      whatsapp: data.whatsapp || lead.whatsapp,
      email: data.email || lead.email,
      gender: (data.gender || lead.gender) as any || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : lead.dateOfBirth,
      address: data.address || null,
      emergencyContact: data.emergencyContact || null,
      emergencyPhone: data.emergencyPhone || null,
      organizationId: orgId,
    },
  });

  // Create enrollment if academic year provided
  if (data.academicYearId) {
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        academicYearId: data.academicYearId,
        yearOfStudy: 1,
        status: "ENROLLED",
      },
    });
  }

  // Update lead as converted
  var leadUpdate: any = {
    isConverted: true,
    convertedAt: new Date(),
    programId: data.programId,
    campusId: data.campusId,
  };

  await prisma.lead.update({
    where: { id: lead.id },
    data: leadUpdate,
  });

  // Log activity
  await prisma.activity.create({
    data: {
      type: "LEAD_CONVERTED",
      description: "Lead converti en étudiant : " + studentNumber + " — " + program.name,
      userId: session.user.id,
      leadId: lead.id,
      studentId: student.id,
      organizationId: orgId,
      metadata: {
        studentNumber,
        programId: data.programId,
        programName: program.name,
        campusId: data.campusId,
        campusName: campus.name,
      },
    },
  });

  revalidatePath("/pipeline");
  revalidatePath("/students");
  return { success: true, student, studentNumber };
}

// ─── Get conversion prerequisites ───
export async function getConversionData() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  var [programs, campuses, academicYears] = await Promise.all([
    prisma.program.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, code: true, level: true, campusId: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true, isCurrent: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  return { programs, campuses, academicYears };
}