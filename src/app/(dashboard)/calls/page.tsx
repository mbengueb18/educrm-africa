import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCalls, getCallStats } from "./actions";
import { CallsClient } from "./calls-client";

export const metadata: Metadata = {
  title: "Appels",
};

export default async function CallsPage() {
  var session = await auth();
  if (!session?.user) return null;

  var [calls, stats, users, leads] = await Promise.all([
    getCalls(),
    getCallStats(),
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId, isActive: true, role: { in: ["ADMIN", "COMMERCIAL"] } },
      select: { id: true, name: true, avatar: true },
    }),
    prisma.lead.findMany({
      where: { organizationId: session.user.organizationId, isConverted: false },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <CallsClient
      calls={calls}
      stats={stats}
      users={users}
      leads={leads}
      currentUserId={session.user.id}
    />
  );
}