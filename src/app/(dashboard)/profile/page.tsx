import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";

export var metadata: Metadata = {
  title: "Mon profil",
};

export default async function ProfilePage() {
  var session = await auth();
  if (!session?.user) return null;

  var user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      campus: { select: { id: true, name: true, city: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!user) return null;

  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        campus: user.campus,
        organization: user.organization,
      }}
    />
  );
}