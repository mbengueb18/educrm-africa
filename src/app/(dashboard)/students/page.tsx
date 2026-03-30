import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudents, getStudentStats } from "./actions";
import { StudentsClient } from "./students-client";

export var metadata: Metadata = {
  title: "Étudiants",
};

export default async function StudentsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [students, stats, programs, campuses] = await Promise.all([
    getStudents(),
    getStudentStats(),
    prisma.program.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      select: { id: true, name: true, code: true, level: true },
      orderBy: { name: "asc" },
    }),
    prisma.campus.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <StudentsClient
      students={students}
      stats={stats}
      programs={programs}
      campuses={campuses}
    />
  );
}