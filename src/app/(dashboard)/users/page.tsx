import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUsers, getUserStats } from "./actions";
import { UsersClient } from "./users-client";

export var metadata: Metadata = {
  title: "Utilisateurs",
};

export default async function UsersPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [users, stats, campuses] = await Promise.all([
    getUsers(),
    getUserStats(),
    prisma.campus.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true, city: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <UsersClient
      users={users}
      stats={stats}
      campuses={campuses}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}