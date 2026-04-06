"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ─── Get organization ───
export async function getOrganization() {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  var org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: {
      campuses: {
        select: { id: true, name: true, city: true, country: true, address: true, phone: true },
        orderBy: { name: "asc" },
      },
      programs: {
        select: { id: true, name: true, code: true, level: true, isActive: true, tuitionAmount: true, currency: true },
        orderBy: { name: "asc" },
      },
      academicYears: {
        select: { id: true, label: true, isCurrent: true, startDate: true, endDate: true },
        orderBy: { startDate: "desc" },
      },
      _count: {
        select: { users: true, leads: true, students: true, campuses: true, programs: true },
      },
    },
  });

  return org;
}

// ─── Update organization ───
export async function updateOrganization(data: {
  name?: string;
  logo?: string;
  settings?: Record<string, any>;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.logo !== undefined) updateData.logo = data.logo || null;

  if (data.settings) {
    var org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    });
    var currentSettings = (org?.settings as Record<string, any>) || {};
    updateData.settings = { ...currentSettings, ...data.settings };
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: updateData,
  });

  revalidatePath("/settings/organization");
  revalidatePath("/settings");
  return { success: true };
}

// ─── Campus CRUD ───
export async function createCampus(data: {
  name: string; city: string; country?: string; address?: string; phone?: string; email?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  await prisma.campus.create({
    data: {
      name: data.name.trim(),
      city: data.city.trim(),
      country: data.country?.trim() || undefined,
      address: data.address?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      organizationId: session.user.organizationId,
    },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}

export async function updateCampus(campusId: string, data: {
  name?: string; city?: string; country?: string; address?: string; phone?: string; email?: string;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.city !== undefined) updateData.city = data.city.trim();
  if (data.country !== undefined) updateData.country = data.country.trim() || null;
  if (data.address !== undefined) updateData.address = data.address.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;

  await prisma.campus.update({ where: { id: campusId }, data: updateData });

  revalidatePath("/settings/organization");
  return { success: true };
}

export async function deleteCampus(campusId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var campus = await prisma.campus.findFirst({
    where: { id: campusId, organizationId: session.user.organizationId },
    include: { _count: { select: { students: true, leads: true } } },
  });
  if (!campus) throw new Error("Campus introuvable");
  if (campus._count.students > 0 || campus._count.leads > 0) {
    throw new Error("Impossible : " + campus._count.students + " étudiant(s) et " + campus._count.leads + " lead(s) liés à ce campus");
  }

  await prisma.campus.delete({ where: { id: campusId } });

  revalidatePath("/settings/organization");
  return { success: true };
}

// ─── Program CRUD ───
export async function createProgram(data: {
  name: string; code?: string; level: string; tuitionAmount?: number; currency?: string; campusId?: string; durationMonths?: number;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  await prisma.program.create({
    data: {
      name: data.name.trim(),
      code: data.code?.trim() || undefined,
      level: data.level as any,
      tuitionAmount: data.tuitionAmount || 0,
      currency: data.currency || "XOF",
      durationMonths: data.durationMonths || 12,
      isActive: true,
      campus: { connect: { id: data.campusId } },
      organization: { connect: { id: session.user.organizationId } },
    },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}

export async function updateProgram(programId: string, data: {
  name?: string; code?: string; level?: string; tuitionAmount?: number; currency?: string; isActive?: boolean; durationMonths?: number;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.code !== undefined) updateData.code = data.code.trim() || null;
  if (data.level !== undefined) updateData.level = data.level;
  if (data.tuitionAmount !== undefined) updateData.tuitionAmount = data.tuitionAmount;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.durationMonths !== undefined) updateData.durationMonths = data.durationMonths;

  await prisma.program.update({ where: { id: programId }, data: updateData });

  revalidatePath("/settings/organization");
  return { success: true };
}

export async function deleteProgram(programId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var program = await prisma.program.findFirst({
    where: { id: programId, organizationId: session.user.organizationId },
    include: { _count: { select: { students: true, leads: true } } },
  });
  if (!program) throw new Error("Programme introuvable");
  if (program._count.students > 0 || program._count.leads > 0) {
    throw new Error("Impossible : " + program._count.students + " étudiant(s) et " + program._count.leads + " lead(s) liés");
  }

  await prisma.program.delete({ where: { id: programId } });

  revalidatePath("/settings/organization");
  return { success: true };
}

// ─── Academic Year CRUD ───
export async function createAcademicYear(data: {
  label: string; startDate: string; endDate: string; isCurrent?: boolean;
}) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var orgId = session.user.organizationId;

  if (data.isCurrent) {
    await prisma.academicYear.updateMany({
      where: { organizationId: orgId, isCurrent: true },
      data: { isCurrent: false },
    });
  }

  await prisma.academicYear.create({
    data: {
      label: data.label.trim(),
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isCurrent: data.isCurrent || false,
      organizationId: orgId,
    },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}

export async function setCurrentAcademicYear(yearId: string) {
  var session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  if (session.user.role !== "ADMIN") throw new Error("Réservé aux administrateurs");

  var orgId = session.user.organizationId;

  await prisma.academicYear.updateMany({
    where: { organizationId: orgId, isCurrent: true },
    data: { isCurrent: false },
  });

  await prisma.academicYear.update({
    where: { id: yearId },
    data: { isCurrent: true },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}