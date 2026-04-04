"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
}) {
  // Validate
  if (!data.schoolName.trim()) throw new Error("Le nom de l'école est requis");
  if (!data.adminName.trim()) throw new Error("Votre nom est requis");
  if (!data.adminEmail.trim()) throw new Error("L'email est requis");
  if (data.adminPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");

  // Check email uniqueness
  var existingUser = await prisma.user.findUnique({
    where: { email: data.adminEmail.toLowerCase().trim() },
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
      plan: "STARTER",
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
      email: data.adminEmail.toLowerCase().trim(),
      name: data.adminName.trim(),
      phone: data.phone || null,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      organizationId: org.id,
      campusId: null,
    },
  });

  // Create default pipeline stages
  for (var stage of DEFAULT_STAGES) {
    await prisma.pipelineStage.create({
      data: {
        ...stage,
        organizationId: org.id,
      },
    });
  }

  // Create default academic year
  var currentYear = new Date().getFullYear();
  var startMonth = new Date().getMonth() >= 8 ? currentYear : currentYear - 1;
  await prisma.academicYear.create({
    data: {
      label: startMonth + "-" + (startMonth + 1),
      startDate: new Date(startMonth, 8, 1),
      endDate: new Date(startMonth + 1, 6, 31),
      isCurrent: true,
      organizationId: org.id,
    },
  });

  return {
    success: true,
    organizationId: org.id,
    slug: org.slug,
    email: admin.email,
  };
}