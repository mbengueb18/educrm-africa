import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
export const runtime = "nodejs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      organizationId: string;
      organizationSlug: string;
      campusId: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: UserRole;
    organizationId: string;
    campusId: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24h
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organization: { select: { slug: true } } },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          campusId: user.campusId,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.campusId = user.campusId;

        const org = await prisma.organization.findUnique({
          where: { id: user.organizationId },
          select: { slug: true },
        });
        token.organizationSlug = org?.slug ?? "";
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.organizationId = token.organizationId;
      session.user.organizationSlug = token.organizationSlug;
      session.user.campusId = token.campusId;
      return session;
    },
  },
});
