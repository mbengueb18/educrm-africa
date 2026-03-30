"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get all students ───
export async function getStudents(filters?: {
  status?: string;
  programId?: string;
  campusId?: string;
  search?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var where: any = { organizationId: session.user.organizationId };

  if (filters?.status) where.status = filters.status;
  if (filters?.programId) where.programId = filters.programId;
  if (filters?.campusId) where.campusId = filters.campusId;
  if (filters?.search) {
    var q = filters.search;
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { studentNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  var students = await prisma.student.findMany({
    where,
    include: {
      program: { select: { id: true, name: true, code: true, level: true } },
      campus: { select: { id: true, name: true, city: true } },
      lead: { select: { id: true, source: true, sourceDetail: true } },
      _count: { select: { payments: true, enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return students;
}

// ─── Get student detail ───
export async function getStudentDetail(studentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var student = await prisma.student.findFirst({
    where: { id: studentId, organizationId: session.user.organizationId },
    include: {
      program: { select: { id: true, name: true, code: true, level: true, tuitionAmount: true, currency: true, durationMonths: true } },
      campus: { select: { id: true, name: true, city: true } },
      lead: { select: { id: true, source: true, sourceDetail: true, createdAt: true } },
      enrollments: {
        include: { academicYear: { select: { id: true, label: true, isCurrent: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      payments: {
        orderBy: { dueDate: "asc" },
        take: 20,
      },
      activities: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  return student;
}

// ─── Get student stats ───
export async function getStudentStats() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var orgId = session.user.organizationId;

  var [total, active, suspended, graduated, withdrawn, thisMonth] = await Promise.all([
    prisma.student.count({ where: { organizationId: orgId } }),
    prisma.student.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.student.count({ where: { organizationId: orgId, status: "SUSPENDED" } }),
    prisma.student.count({ where: { organizationId: orgId, status: "GRADUATED" } }),
    prisma.student.count({ where: { organizationId: orgId, status: { in: ["WITHDRAWN", "EXPELLED"] } } }),
    prisma.student.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  return { total, active, suspended, graduated, withdrawn, thisMonth };
}

// ─── Update student ───
export async function updateStudent(studentId: string, data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  gender?: string;
  dateOfBirth?: string | null;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status?: string;
  programId?: string;
  campusId?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var updateData: any = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp || null;
  if (data.gender !== undefined) updateData.gender = data.gender || null;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact || null;
  if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.programId !== undefined) updateData.programId = data.programId;
  if (data.campusId !== undefined) updateData.campusId = data.campusId;

  var student = await prisma.student.update({
    where: { id: studentId },
    data: updateData,
  });

  revalidatePath("/students");
  return { success: true, student };
}

// ─── Delete student ───
export async function deleteStudent(studentId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  // Get student to un-convert the lead
  var student = await prisma.student.findFirst({
    where: { id: studentId, organizationId: session.user.organizationId },
    select: { leadId: true },
  });

  // Delete related records
  await prisma.enrollment.deleteMany({ where: { studentId } });
  await prisma.payment.deleteMany({ where: { studentId } });
  await prisma.attendance.deleteMany({ where: { studentId } });
  await prisma.grade.deleteMany({ where: { studentId } });
  await prisma.document.deleteMany({ where: { studentId } });
  await prisma.activity.deleteMany({ where: { studentId } });

  await prisma.student.delete({ where: { id: studentId } });

  // Revert lead conversion
  if (student?.leadId) {
    await prisma.lead.update({
      where: { id: student.leadId },
      data: { isConverted: false, convertedAt: null },
    });
  }

  revalidatePath("/students");
  revalidatePath("/pipeline");
  return { success: true };
}