"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";
import { isDisposableEmail, checkSignupThrottle } from "@/lib/signup-guard";

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
}) {
  // Validate
  if (!data.schoolName.trim()) throw new Error("Le nom de l'école est requis");
  if (!data.adminName.trim()) throw new Error("Votre nom est requis");
  if (!data.adminEmail.trim()) throw new Error("L'email est requis");
  if (data.adminPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  if (!data.acceptedTerms) throw new Error("Vous devez accepter les conditions d'utilisation");

  var email = data.adminEmail.toLowerCase().trim();

  // Format email basique
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse email invalide");

  // Anti-abus : bloque les emails jetables
  if (isDisposableEmail(email)) {
    throw new Error("Merci d'utiliser une adresse email professionnelle ou personnelle valide (les adresses jetables ne sont pas acceptées).");
  }

  // Anti-abus : limite le nombre d'inscriptions par IP
  var ip = await getClientIp();
  var throttle = await checkSignupThrottle(ip);
  if (!throttle.allowed) {
    throw new Error("Trop de tentatives d'inscription depuis votre réseau. Réessayez dans une heure.");
  }

  // Check email uniqueness
  var existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) throw new Error("Cet email est déjà utilisé");

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

  // Create organization
  var org = await prisma.organization.create({
    data: {
      name: data.schoolName.trim(),
      slug,
      plan: "ESSENTIEL", // ✅ MODIFIÉ : Plan gratuit par défaut au signup
      settings: {
        schoolType: data.schoolType,
        timezone: "Africa/Dakar",
        currency: "XOF",
        country: data.country,
      },
    },
  });

  // Create default campus
  var campus = await prisma.campus.create({
    data: {
      name: "Campus " + data.city,
      city: data.city.trim(),
      country: data.country,
      phone: data.phone || null,
      organizationId: org.id,
    },
  });

  // Create admin user
  var admin = await prisma.user.create({
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

  // ✅ NOUVEAU : Créer le pipeline par défaut AVANT les stages
  var defaultPipeline = await prisma.pipeline.create({
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

  // Create default pipeline stages (now linked to the default pipeline)
  for (var stage of DEFAULT_STAGES) {
    await prisma.pipelineStage.create({
      data: {
        ...stage,
        organizationId: org.id,
        pipelineId: defaultPipeline.id, // ✅ NOUVEAU : lien avec le pipeline
      },
    });
  }

  // Create academic years: current + upcoming.
  // Les étudiants s'inscrivent généralement pour l'année à venir, on la crée donc dès le départ.
  var currentYear = new Date().getFullYear();
  var startYear = new Date().getMonth() >= 8 ? currentYear : currentYear - 1;
  await prisma.academicYear.createMany({
    data: [
      {
        label: startYear + "-" + (startYear + 1),
        startDate: new Date(startYear, 8, 1),
        endDate: new Date(startYear + 1, 6, 31),
        isCurrent: true,
        organizationId: org.id,
      },
      {
        label: (startYear + 1) + "-" + (startYear + 2),
        startDate: new Date(startYear + 1, 8, 1),
        endDate: new Date(startYear + 2, 6, 31),
        isCurrent: false,
        organizationId: org.id,
      },
    ],
  });

  // Envoi de l'email de vérification (best-effort : n'échoue pas l'inscription).
  try {
    await sendVerificationEmail(admin.id, admin.email, admin.name);
  } catch (err) {
    console.error("[signup] envoi de l'email de vérification échoué:", err);
  }

  return {
    success: true,
    organizationId: org.id,
    slug: org.slug,
    email: admin.email,
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