import { PrismaClient, UserRole, ProgramLevel, LeadSource, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding EduCRM database...\n");

  // ─── Organization ───
  const org = await prisma.organization.create({
    data: {
      name: "Institut Supérieur de Management de Dakar",
      slug: "ism-dakar",
      plan: "GROWTH",
      settings: {
        timezone: "Africa/Dakar",
        currency: "XOF",
        academicCalendar: "october-july",
        language: "fr",
      },
    },
  });
  console.log(`✅ Organization: ${org.name}`);

  // ─── Campuses ───
  const campusDakar = await prisma.campus.create({
    data: {
      name: "Campus Dakar — Plateau",
      city: "Dakar",
      country: "SN",
      address: "12 Rue Félix Faure, Plateau, Dakar",
      phone: "+221 33 822 XX XX",
      organizationId: org.id,
    },
  });

  const campusAbidjan = await prisma.campus.create({
    data: {
      name: "Campus Abidjan — Cocody",
      city: "Abidjan",
      country: "CI",
      address: "Boulevard de l'Université, Cocody, Abidjan",
      phone: "+225 27 22 XX XX XX",
      organizationId: org.id,
    },
  });
  console.log(`✅ 2 campuses created`);

  // ─── Programs ───
  const programs = await Promise.all([
    prisma.program.create({
      data: {
        name: "BTS Comptabilité & Gestion",
        code: "BTS-CG",
        level: ProgramLevel.BTS,
        durationMonths: 24,
        tuitionAmount: 850000,
        campusId: campusDakar.id,
        organizationId: org.id,
      },
    }),
    prisma.program.create({
      data: {
        name: "Licence Marketing Digital",
        code: "L-MKTD",
        level: ProgramLevel.LICENCE,
        durationMonths: 12,
        tuitionAmount: 1200000,
        campusId: campusDakar.id,
        organizationId: org.id,
      },
    }),
    prisma.program.create({
      data: {
        name: "Master Management des Organisations",
        code: "M-MGT",
        level: ProgramLevel.MASTER,
        durationMonths: 24,
        tuitionAmount: 1800000,
        campusId: campusDakar.id,
        organizationId: org.id,
      },
    }),
    prisma.program.create({
      data: {
        name: "BTS Commerce International",
        code: "BTS-CI",
        level: ProgramLevel.BTS,
        durationMonths: 24,
        tuitionAmount: 900000,
        campusId: campusAbidjan.id,
        organizationId: org.id,
      },
    }),
    prisma.program.create({
      data: {
        name: "Licence Informatique de Gestion",
        code: "L-IG",
        level: ProgramLevel.LICENCE,
        durationMonths: 12,
        tuitionAmount: 1350000,
        campusId: campusDakar.id,
        organizationId: org.id,
      },
    }),
  ]);
  console.log(`✅ ${programs.length} programs created`);

  // ─── Academic Year ───
  const academicYear = await prisma.academicYear.create({
    data: {
      label: "2025-2026",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: true,
      organizationId: org.id,
    },
  });
  console.log(`✅ Academic year: ${academicYear.label}`);

  // ─── Users ───
  const passwordHash = await bcrypt.hash("demo2026", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@ism-dakar.sn",
      name: "Abdoulaye Ndiaye",
      phone: "+221 77 500 00 01",
      passwordHash,
      role: UserRole.ADMIN,
      organizationId: org.id,
    },
  });

  const commercial1 = await prisma.user.create({
    data: {
      email: "fatou@ism-dakar.sn",
      name: "Fatou Diop",
      phone: "+221 77 500 00 02",
      passwordHash,
      role: UserRole.COMMERCIAL,
      organizationId: org.id,
      campusId: campusDakar.id,
    },
  });

  const commercial2 = await prisma.user.create({
    data: {
      email: "moussa@ism-dakar.sn",
      name: "Moussa Ba",
      phone: "+221 77 500 00 03",
      passwordHash,
      role: UserRole.COMMERCIAL,
      organizationId: org.id,
      campusId: campusDakar.id,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      email: "awa@ism-dakar.sn",
      name: "Awa Sow",
      phone: "+221 77 500 00 04",
      passwordHash,
      role: UserRole.ACCOUNTANT,
      organizationId: org.id,
    },
  });
  console.log(`✅ 4 users created (password: demo2026)`);

  // ─── Pipeline Stages ───
  const stages = await Promise.all([
    prisma.pipelineStage.create({
      data: { name: "Nouveau", order: 1, color: "#6366F1", isDefault: true, organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Contacté", order: 2, color: "#3B82F6", organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Dossier reçu", order: 3, color: "#F59E0B", organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Entretien", order: 4, color: "#8B5CF6", organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Admis", order: 5, color: "#10B981", organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Inscrit", order: 6, color: "#059669", isWon: true, organizationId: org.id },
    }),
    prisma.pipelineStage.create({
      data: { name: "Perdu", order: 7, color: "#EF4444", isLost: true, organizationId: org.id },
    }),
  ]);
  console.log(`✅ ${stages.length} pipeline stages created`);

  // ─── Campaigns ───
  const campaigns = await Promise.all([
    prisma.campaign.create({
      data: { name: "Salon de l'Étudiant Dakar 2026", type: "SALON", organizationId: org.id },
    }),
    prisma.campaign.create({
      data: { name: "Facebook Ads — Rentrée Oct 2026", type: "SOCIAL_MEDIA", organizationId: org.id },
    }),
    prisma.campaign.create({
      data: { name: "Parrainage Anciens Élèves", type: "REFERRAL", organizationId: org.id },
    }),
  ]);
  console.log(`✅ ${campaigns.length} campaigns created`);

  // ─── Leads ───
  const leadData = [
    { firstName: "Amadou", lastName: "Diallo", phone: "+221 77 123 45 01", city: "Dakar", source: LeadSource.FACEBOOK, score: 85, stageIdx: 4, programIdx: 1, assignedTo: commercial1.id, gender: Gender.MALE },
    { firstName: "Mariama", lastName: "Bah", phone: "+221 76 234 56 02", city: "Thiès", source: LeadSource.SALON, score: 72, stageIdx: 3, programIdx: 0, assignedTo: commercial2.id, gender: Gender.FEMALE },
    { firstName: "Ousmane", lastName: "Seck", phone: "+221 78 345 67 03", city: "Saint-Louis", source: LeadSource.WEBSITE, score: 65, stageIdx: 2, programIdx: 2, assignedTo: commercial1.id, gender: Gender.MALE },
    { firstName: "Aïssatou", lastName: "Ndiaye", phone: "+221 77 456 78 04", city: "Dakar", source: LeadSource.INSTAGRAM, score: 58, stageIdx: 1, programIdx: 1, assignedTo: commercial2.id, gender: Gender.FEMALE },
    { firstName: "Ibrahima", lastName: "Fall", phone: "+221 76 567 89 05", city: "Kaolack", source: LeadSource.REFERRAL, score: 90, stageIdx: 4, programIdx: 4, assignedTo: commercial1.id, gender: Gender.MALE },
    { firstName: "Khadija", lastName: "Touré", phone: "+221 77 678 90 06", city: "Ziguinchor", source: LeadSource.RADIO, score: 35, stageIdx: 0, programIdx: 0, gender: Gender.FEMALE },
    { firstName: "Cheikh", lastName: "Mbaye", phone: "+221 78 789 01 07", city: "Dakar", source: LeadSource.WALK_IN, score: 78, stageIdx: 3, programIdx: 2, assignedTo: commercial2.id, gender: Gender.MALE },
    { firstName: "Rokhaya", lastName: "Gueye", phone: "+221 77 890 12 08", city: "Mbour", source: LeadSource.WHATSAPP, score: 42, stageIdx: 1, programIdx: 3, gender: Gender.FEMALE },
    { firstName: "Mamadou", lastName: "Diop", phone: "+221 76 901 23 09", city: "Dakar", source: LeadSource.FACEBOOK, score: 68, stageIdx: 2, programIdx: 4, assignedTo: commercial1.id, gender: Gender.MALE },
    { firstName: "Fatimata", lastName: "Sy", phone: "+221 77 012 34 10", city: "Tambacounda", source: LeadSource.PARTNER, score: 55, stageIdx: 1, programIdx: 1, gender: Gender.FEMALE },
    { firstName: "Abdou", lastName: "Kane", phone: "+221 78 111 22 11", city: "Dakar", source: LeadSource.WEBSITE, score: 82, stageIdx: 4, programIdx: 2, assignedTo: commercial2.id, gender: Gender.MALE },
    { firstName: "Dienaba", lastName: "Cissé", phone: "+221 77 222 33 12", city: "Rufisque", source: LeadSource.SALON, score: 47, stageIdx: 0, programIdx: 0, gender: Gender.FEMALE },
    { firstName: "Modou", lastName: "Faye", phone: "+221 76 333 44 13", city: "Louga", source: LeadSource.PHONE_CALL, score: 60, stageIdx: 2, programIdx: 3, assignedTo: commercial1.id, gender: Gender.MALE },
    { firstName: "Yacine", lastName: "Sarr", phone: "+221 77 444 55 14", city: "Dakar", source: LeadSource.INSTAGRAM, score: 38, stageIdx: 0, programIdx: 1, gender: Gender.FEMALE },
    { firstName: "Papa", lastName: "Dieng", phone: "+221 78 555 66 15", city: "Diourbel", source: LeadSource.REFERRAL, score: 73, stageIdx: 3, programIdx: 4, assignedTo: commercial2.id, gender: Gender.MALE },
    { firstName: "Coumba", lastName: "Thiam", phone: "+225 07 88 11 22", city: "Abidjan", source: LeadSource.FACEBOOK, score: 66, stageIdx: 2, programIdx: 3, assignedTo: commercial1.id, gender: Gender.FEMALE },
    { firstName: "Sékou", lastName: "Konaté", phone: "+225 05 77 33 44", city: "Abidjan", source: LeadSource.WEBSITE, score: 51, stageIdx: 1, programIdx: 3, gender: Gender.MALE },
    { firstName: "Aminata", lastName: "Traoré", phone: "+225 01 66 55 77", city: "Bouaké", source: LeadSource.SALON, score: 44, stageIdx: 0, programIdx: 3, gender: Gender.FEMALE },
  ];

  const leads = await Promise.all(
    leadData.map((ld, i) =>
      prisma.lead.create({
        data: {
          firstName: ld.firstName,
          lastName: ld.lastName,
          phone: ld.phone,
          whatsapp: ld.phone,
          email: `${ld.firstName.toLowerCase()}.${ld.lastName.toLowerCase()}@email.com`,
          city: ld.city,
          gender: ld.gender,
          source: ld.source,
          score: ld.score,
          stageId: stages[ld.stageIdx].id,
          programId: programs[ld.programIdx].id,
          campusId: ld.city === "Abidjan" || ld.city === "Bouaké" ? campusAbidjan.id : campusDakar.id,
          assignedToId: ld.assignedTo || null,
          campaignId: i % 3 === 0 ? campaigns[0].id : i % 3 === 1 ? campaigns[1].id : campaigns[2].id,
          organizationId: org.id,
          createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        },
      })
    )
  );
  console.log(`✅ ${leads.length} leads created`);

  // ─── Activities ───
  const activities = leads.slice(0, 10).map((lead, i) =>
    prisma.activity.create({
      data: {
        type: "LEAD_CREATED",
        description: `Lead créé: ${leadData[i].firstName} ${leadData[i].lastName}`,
        userId: admin.id,
        leadId: lead.id,
        organizationId: org.id,
      },
    })
  );
  await Promise.all(activities);
  console.log(`✅ ${activities.length} activities logged`);

  console.log("\n🎉 Seed complete!\n");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Login credentials:                      ║");
  console.log("║  Email: admin@ism-dakar.sn               ║");
  console.log("║  Password: demo2026                      ║");
  console.log("╚══════════════════════════════════════════╝");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
