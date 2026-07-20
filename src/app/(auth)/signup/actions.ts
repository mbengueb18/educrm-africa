"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";
import { isDisposableEmail, checkSignupThrottle } from "@/lib/signup-guard";
import { validatePassword } from "@/lib/password-policy";
import { verifyTurnstile } from "@/lib/turnstile";

// Récupère l'IP de l'appelant derrière les proxys Vercel.
async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// Default pipeline stages for a new school
var DEFAULT_STAGES = [
  { name: "Nouveau", order: 1, color: "#3B82F6", isDefault: true, isWon: false, isLost: false },
  { name: "Contacté", order: 2, color: "#F59E0B", isDefault: false, isWon: false, isLost: false },
  { name: "Dossier reçu", order: 3, color: "#8B5CF6", isDefault: false, isWon: false, isLost: false },
  { name: "Entretien", order: 4, color: "#06B6D4", isDefault: false, isWon: false, isLost: false },
  { name: "Admis", order: 5, color: "#10B981", isDefault: false, isWon: false, isLost: false },
  { name: "Perdu", order: 6, color: "#EF4444", isDefault: false, isWon: false, isLost: true },
];

// Retourne { ok, error } (jamais de throw) : Next.js caviarde les messages de throw
// des Server Actions en prod (« Server Components render… ») → l'utilisateur ne verrait
// pas « Cet email est déjà utilisé ». Voir skill talibcrm-server-actions.
export type RegisterResult =
  | { ok: true; organizationId: string; slug: string; email: string }
  | { ok: false; error: string };

export async function registerOrganization(data: {
  // School
  schoolName: string;
  schoolType: string;
  city: string;
  country: string;
  phone?: string;
  // Admin
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  // Conditions
  acceptedTerms?: boolean;
  // Anti-robot (Cloudflare Turnstile)
  captchaToken?: string;
}): Promise<RegisterResult> {
  // Validate
  if (!data.schoolName.trim()) return { ok: false, error: "Le nom de l'école est requis" };
  if (!data.adminName.trim()) return { ok: false, error: "Votre nom est requis" };
  if (!data.adminEmail.trim()) return { ok: false, error: "L'email est requis" };
  var pwCheck = validatePassword(data.adminPassword);
  if (!pwCheck.ok) return { ok: false, error: pwCheck.error };
  if (!data.acceptedTerms) return { ok: false, error: "Vous devez accepter les conditions d'utilisation" };

  var email = data.adminEmail.toLowerCase().trim();

  // Format email basique
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Adresse email invalide" };

  // Anti-abus : bloque les emails jetables
  if (isDisposableEmail(email)) {
    return { ok: false, error: "Merci d'utiliser une adresse email professionnelle ou personnelle valide (les adresses jetables ne sont pas acceptées)." };
  }

  var ip = await getClientIp();

  // Anti-robot : CAPTCHA Turnstile (dégradé propre si les clés ne sont pas configurées).
  var captchaOk = await verifyTurnstile(data.captchaToken, ip);
  if (!captchaOk) {
    return { ok: false, error: "Vérification anti-robot échouée. Rechargez la page et réessayez." };
  }

  // Anti-abus : limite le nombre d'inscriptions par IP
  var throttle = await checkSignupThrottle(ip);
  if (!throttle.allowed) {
    return { ok: false, error: "Trop de tentatives d'inscription depuis votre réseau. Réessayez dans une heure." };
  }

  // Check email uniqueness
  var existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) return { ok: false, error: "Cet email est déjà utilisé" };

  // Generate unique slug
  var baseSlug = generateSlug(data.schoolName);
  var slug = baseSlug;
  var slugExists = await prisma.organization.findUnique({ where: { slug } });
  var counter = 1;
  while (slugExists) {
    slug = baseSlug + "-" + counter;
    slugExists = await prisma.organization.findUnique({ where: { slug } });
    counter++;
  }

  // Hash password
  var passwordHash = await bcrypt.hash(data.adminPassword, 12);

  var currentYear = new Date().getFullYear();
  var startYear = new Date().getMonth() >= 8 ? currentYear : currentYear - 1;

  // Création ATOMIQUE : org + campus + admin + pipeline + étapes + années scolaires.
  // Si une étape échoue (ex : email pris entre-temps → contrainte unique), TOUT est
  // annulé → plus d'organisation orpheline sans administrateur.
  var created: { orgId: string; slug: string; adminId: string; adminEmail: string; adminName: string };
  try {
    created = await prisma.$transaction(async function(tx) {
      var org = await tx.organization.create({
        data: {
          name: data.schoolName.trim(),
          slug,
          plan: "ESSENTIEL", // plan gratuit par défaut au signup
          settings: {
            schoolType: data.schoolType,
            timezone: "Africa/Dakar",
            currency: "XOF",
            country: data.country,
          },
        },
      });

      await tx.campus.create({
        data: {
          name: "Campus " + data.city,
          city: data.city.trim(),
          country: data.country,
          phone: data.phone || null,
          organizationId: org.id,
        },
      });

      var admin = await tx.user.create({
        data: {
          email,
          name: data.adminName.trim(),
          phone: data.phone || null,
          passwordHash,
          role: "ADMIN",
          isActive: true,
          organizationId: org.id,
          campusId: null,
        },
      });

      var defaultPipeline = await tx.pipeline.create({
        data: {
          name: "Pipeline principal",
          description: "Votre premier pipeline d'admissions",
          color: "#3B82F6",
          isDefault: true,
          isActive: true,
          order: 0,
          organizationId: org.id,
        },
      });

      // Étapes par défaut, liées au pipeline (createMany → 1 seul aller-retour)
      await tx.pipelineStage.createMany({
        data: DEFAULT_STAGES.map(function(stage) {
          return { ...stage, organizationId: org.id, pipelineId: defaultPipeline.id };
        }),
      });

      // Années scolaires : courante + à venir (les inscriptions visent souvent l'année suivante)
      await tx.academicYear.createMany({
        data: [
          { label: startYear + "-" + (startYear + 1), startDate: new Date(startYear, 8, 1), endDate: new Date(startYear + 1, 6, 31), isCurrent: true, organizationId: org.id },
          { label: (startYear + 1) + "-" + (startYear + 2), startDate: new Date(startYear + 1, 8, 1), endDate: new Date(startYear + 2, 6, 31), isCurrent: false, organizationId: org.id },
        ],
      });

      return { orgId: org.id, slug: org.slug, adminId: admin.id, adminEmail: admin.email, adminName: admin.name };
    }, { timeout: 15000 });
  } catch (err: any) {
    // Contrainte unique email (P2002) via une inscription concurrente → message propre
    if (err?.code === "P2002") return { ok: false, error: "Cet email est déjà utilisé" };
    console.error("[signup] création de l'organisation échouée:", err);
    return { ok: false, error: "La création du compte a échoué. Merci de réessayer." };
  }

  // Envoi de l'email de vérification (best-effort, HORS transaction : appel externe).
  try {
    await sendVerificationEmail(created.adminId, created.adminEmail, created.adminName);
  } catch (err) {
    console.error("[signup] envoi de l'email de vérification échoué:", err);
  }

  return {
    ok: true,
    organizationId: created.orgId,
    slug: created.slug,
    email: created.adminEmail,
  };
}

/**
 * Renvoie l'email de vérification à un utilisateur connecté non vérifié.
 * Utilisé par la bannière de blocage souple.
 */
export async function resendVerificationEmail(): Promise<{ success: boolean; error?: string }> {
  var session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié" };

  var user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return { success: false, error: "Utilisateur introuvable" };
  if (user.emailVerified) return { success: true }; // déjà vérifié

  try {
    await sendVerificationEmail(user.id, user.email, user.name);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Échec de l'envoi" };
  }
}