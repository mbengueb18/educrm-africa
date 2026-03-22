import { Metadata } from "next";
import { getStudents, getStudentStats } from "./actions";
import { StudentsClient } from "./students-client";

export const metadata: Metadata = {
  title: "Étudiants",
};

export default async function StudentsPage() {
  const [students, stats] = await Promise.all([
    getStudents(),
    getStudentStats(),
  ]);

  return <StudentsClient students={students as any} stats={stats} />;
}
