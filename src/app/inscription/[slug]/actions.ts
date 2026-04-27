"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      programs: {
        where: { isActive: true },
        select: { id: true, name: true, code: true, level: true, durationMonths: true, tuitionAmount: true, currency: true },
        orderBy: { name: "asc" },
      },
      campuses: {
        select: { id: true, name: true, city: true, country: true, address: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

interface InscriptionData {
  // Step 1
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  // Step 2
  programId?: string;
  campusId?: string;
  educationLevel?: string;
  source?: string;
  // Step 3 (documents uploaded separately, paths passed here)
  documents?: { path: string; filename: string; size: number; contentType: string | null }[];
  // UTM tracking
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

export async function submitInscription(slug: string, data: InscriptionData) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("Organisation introuvable");

  // Validate required fields
  if (!data.firstName?.trim()) throw new Error("Prénom requis");
  if (!data.lastName?.trim()) throw new Error("Nom requis");
  if (!data.email?.trim()) throw new Error("Email requis");
  if (!data.phone?.trim()) throw new Error("Téléphone requis");

  // Find default stage
  const defaultStage = await prisma.pipelineStage.findFirst({
    where: { organizationId: org.id, isDefault: true },
  });
  if (!defaultStage) throw new Error("Configuration incomplète");

  // Check duplicate by phone or email
  const existing = await prisma.lead.findFirst({
    where: {
      organizationId: org.id,
      OR: [
        { phone: data.phone.trim() },
        { email: { equals: data.email.trim().toLowerCase(), mode: "insensitive" } },
      ],
    },
  });

  let leadId: string;

  if (existing) {
    // Update existing lead with new info if missing
    const updates: any = {};
    if (!existing.email && data.email) updates.email = data.email.trim().toLowerCase();
    if (!existing.whatsapp && data.whatsapp) updates.whatsapp = data.whatsapp;
    if (!existing.city && data.city) updates.city = data.city;
    if (!existing.programId && data.programId) updates.programId = data.programId;
    if (!existing.campusId && data.campusId) updates.campusId = data.campusId;
    if (!existing.gender && data.gender) updates.gender = data.gender;
    if (!existing.dateOfBirth && data.dateOfBirth) updates.dateOfBirth = new Date(data.dateOfBirth);

    if (Object.keys(updates).length > 0) {
      await prisma.lead.update({ where: { id: existing.id }, data: updates });
    }

    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED" as any,
        description: "Candidature en ligne reçue (lead existant)",
        leadId: existing.id,
        organizationId: org.id,
      },
    });

    leadId = existing.id;
  } else {
    // Build customFields with UTM
    const customFields: any = {};
    if (data.utmSource) customFields._utmSource = data.utmSource;
    if (data.utmMedium) customFields._utmMedium = data.utmMedium;
    if (data.utmCampaign) customFields._utmCampaign = data.utmCampaign;
    if (data.referrer) customFields._referrer = data.referrer;
    if (data.educationLevel) customFields.education_level = data.educationLevel;

    // Create lead
    const newLead = await prisma.lead.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        whatsapp: data.whatsapp?.trim() || data.phone.trim(),
        city: data.city?.trim() || null,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        source: "WEBSITE",
        sourceDetail: "Inscription en ligne",
        programId: data.programId || null,
        campusId: data.campusId || null,
        stageId: defaultStage.id,
        organizationId: org.id,
        customFields,
      },
    });

    await prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        description: "Candidature en ligne : " + data.firstName + " " + data.lastName,
        leadId: newLead.id,
        organizationId: org.id,
      },
    });

    leadId = newLead.id;
  }

  // Save documents if any (link them as documents to the lead)
  if (data.documents && data.documents.length > 0) {
    await prisma.document.createMany({
      data: data.documents.map(function(doc) {
        return {
          name: doc.filename,
          type: "OTHER" as any,
          url: doc.path,
          size: doc.size,
          mimeType: doc.contentType || "application/octet-stream",
          leadId: leadId,
          organizationId: org.id,
        };
      }),
    });
  }

  // Send confirmation email to candidate
  try {
    await sendEmail({
      to: data.email.trim().toLowerCase(),
      toName: data.firstName + " " + data.lastName,
      subject: "Votre candidature a été reçue — " + org.name,
      body:
        "Bonjour " + data.firstName + ",\n\n" +
        "Nous avons bien reçu votre candidature à " + org.name + ".\n\n" +
        "Numéro de dossier : " + leadId.substring(0, 8).toUpperCase() + "\n\n" +
        "Un conseiller vous contactera dans les meilleurs délais pour discuter de votre projet de formation.\n\n" +
        "À très vite,\nL'équipe " + org.name,
      organizationId: org.id,
      leadId: leadId,
    });
  } catch (emailErr) {
    console.error("[Inscription] Failed to send confirmation email", emailErr);
  }

  return {
    success: true,
    leadId: leadId,
    dossierNumber: leadId.substring(0, 8).toUpperCase(),
  };
}