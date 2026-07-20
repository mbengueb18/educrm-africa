import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { isLoginThrottled, recordLoginFailure, clearLoginAttempts } from "@/lib/signup-guard";

// Fréquence max de re-vérification de l'utilisateur en base pour révoquer une session
// (désactivation/suppression) et rafraîchir le rôle. 60 s = bon compromis latence/charge.
const REVALIDATE_MS = 60 * 1000;

// IP de l'appelant depuis la requête passée à authorize() (derrière les proxys Vercel).
function ipFromRequest(request: any): string | null {
  try {
    const h = request?.headers;
    if (!h || typeof h.get !== "function") return null;
    const fwd = h.get("x-forwarded-for");
    if (fwd) return String(fwd).split(",")[0].trim();
    return h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // Anti-bruteforce : refuse si trop d'échecs récents depuis cette IP.
        const ip = ipFromRequest(request);
        if (await isLoginThrottled(ip)) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { organization: { select: { slug: true } } },
        });

        if (!user || !user.isActive) {
          await recordLoginFailure(ip);
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) {
          await recordLoginFailure(ip);
          return null;
        }

        // Connexion réussie : on efface le compteur d'échecs et on note la date.
        await clearLoginAttempts(ip);
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
      // ─── Connexion : on renseigne le token depuis l'utilisateur authentifié ───
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
        token.checkedAt = Date.now();
        return token;
      }

      // ─── Requêtes suivantes : révocation quasi-immédiate ───
      // On revérifie l'utilisateur en base au plus une fois toutes les REVALIDATE_MS
      // (évite une requête à CHAQUE lecture de session). Un compte désactivé/supprimé
      // invalide la session → auth() renverra null PARTOUT (pages ET server actions),
      // et les changements de rôle/organisation sont pris en compte sous ~1 min.
      const last = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (Date.now() - last < REVALIDATE_MS) return token;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            isActive: true,
            role: true,
            organizationId: true,
            campusId: true,
            organization: { select: { slug: true } },
          },
        });

        // Compte supprimé ou désactivé → session invalidée.
        if (!dbUser || !dbUser.isActive) return null;

        // Rafraîchit les claims (le rôle/l'organisation ont pu changer).
        token.role = dbUser.role;
        token.organizationId = dbUser.organizationId;
        token.campusId = dbUser.campusId;
        token.organizationSlug = dbUser.organization?.slug ?? "";
        token.checkedAt = Date.now();
        return token;
      } catch (err) {
        // FAIL-OPEN : un incident DB ne doit JAMAIS déconnecter les utilisateurs légitimes.
        console.error("[auth] revalidation de session impossible (fail-open):", err);
        return token;
      }
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
