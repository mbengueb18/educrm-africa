"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomFields, type CustomFieldConfig } from "@/lib/custom-fields";

export interface FieldProperty {
  key: string;
  label: string;
  group: "contact" | "acquisition" | "formation" | "pipeline" | "custom" | "unmapped";
  type: "text" | "email" | "phone" | "select" | "date" | "number" | "json";
  source: "system" | "custom" | "unmapped";
  fillCount: number;
  totalLeads: number;
  fillRate: number;
  sampleValues: string[];
  isEditable: boolean;
  showInCard: boolean;
  showInList: boolean;
  mappedFormFields: string[];
  customFieldId?: string;
}

const SYSTEM_FIELDS: Omit<FieldProperty, "fillCount" | "totalLeads" | "fillRate" | "sampleValues">[] = [
  { key: "firstName", label: "Prénom", group: "contact", type: "text", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["firstName", "first_name", "prenom", "fname"] },
  { key: "lastName", label: "Nom", group: "contact", type: "text", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["lastName", "last_name", "nom", "lname", "surname", "nom_famille"] },
  { key: "phone", label: "Téléphone", group: "contact", type: "phone", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["phone", "téléphone", "tel", "mobile", "portable"] },
  { key: "email", label: "Email", group: "contact", type: "email", source: "system", isEditable: false, showInCard: false, showInList: true, mappedFormFields: ["email", "mail", "courriel"] },
  { key: "whatsapp", label: "WhatsApp", group: "contact", type: "phone", source: "system", isEditable: false, showInCard: false, showInList: false, mappedFormFields: ["whatsapp"] },
  { key: "city", label: "Ville", group: "contact", type: "text", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["city", "ville", "town", "adresse"] },
  { key: "gender", label: "Genre", group: "contact", type: "select", source: "system", isEditable: false, showInCard: false, showInList: false, mappedFormFields: [] },
  { key: "dateOfBirth", label: "Date de naissance", group: "contact", type: "date", source: "system", isEditable: false, showInCard: false, showInList: false, mappedFormFields: [] },
  { key: "source", label: "Source", group: "acquisition", type: "select", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["source"] },
  { key: "sourceDetail", label: "Detail source", group: "acquisition", type: "text", source: "system", isEditable: false, showInCard: false, showInList: false, mappedFormFields: ["sourceDetail", "source_detail", "formName"] },
  { key: "campaignId", label: "Campagne", group: "acquisition", type: "select", source: "system", isEditable: false, showInCard: false, showInList: false, mappedFormFields: [] },
  { key: "programId", label: "Filière souhaitée", group: "formation", type: "select", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: ["filière", "formation", "programme", "programCode"] },
  { key: "campusId", label: "Campus", group: "formation", type: "select", source: "system", isEditable: false, showInCard: false, showInList: true, mappedFormFields: ["campus", "campusCity", "campus_choix"] },
  { key: "stageId", label: "Étape pipeline", group: "pipeline", type: "select", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: [] },
  { key: "score", label: "Score", group: "pipeline", type: "number", source: "system", isEditable: false, showInCard: true, showInList: true, mappedFormFields: [] },
  { key: "assignedToId", label: "Commercial assigne", group: "pipeline", type: "select", source: "system", isEditable: false, showInCard: true, showInList: false, mappedFormFields: [] },
];

export async function getAllFieldProperties(): Promise<{
  fields: FieldProperty[];
  totalLeads: number;
  groups: { key: string; label: string; count: number }[];
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");

  const organizationId = session.user.organizationId;

  const leads = await prisma.lead.findMany({
    where: { organizationId },
    select: {
      firstName: true, lastName: true, phone: true, email: true,
      whatsapp: true, city: true, gender: true, dateOfBirth: true,
      source: true, sourceDetail: true, campaignId: true,
      programId: true, campusId: true, stageId: true, score: true,
      assignedToId: true, customFields: true,
    },
  });

  const totalLeads = leads.length;

  if (totalLeads === 0) {
    return {
      fields: SYSTEM_FIELDS.map(function(f) {
        return { ...f, fillCount: 0, totalLeads: 0, fillRate: 0, sampleValues: [] };
      }),
      totalLeads: 0,
      groups: [],
    };
  }
  var customFieldsConfig = await getCustomFields();
  var systemFields: FieldProperty[] = SYSTEM_FIELDS.map(function(field) {
    var fillCount = 0;
    var samples: string[] = [];
    for (var i = 0; i < leads.length; i++) {
      var value = (leads[i] as any)[field.key];
      if (value !== null && value !== undefined && value !== "" && value !== 0) {
        fillCount++;
        if (samples.length < 3) samples.push(String(value).slice(0, 50));
      }
    }

    // Check if a custom field overrides visibility for this system field
    var customOverride = customFieldsConfig.find(function(cf) {
      return cf.key.toLowerCase() === field.key.toLowerCase() ||
        cf.mappedFormFields.some(function(mf) { return mf.toLowerCase() === field.key.toLowerCase(); });
    });

    return {
      ...field,
      fillCount: fillCount,
      totalLeads: totalLeads,
      fillRate: Math.round((fillCount / totalLeads) * 100),
      sampleValues: samples,
      showInCard: customOverride ? customOverride.showInCard : field.showInCard,
      showInList: customOverride ? customOverride.showInList : field.showInList,
    };
  });

  var customFieldCounts: Record<string, { count: number; samples: string[]; rawKey: string }> = {};

  for (var i = 0; i < leads.length; i++) {
    var custom = (leads[i].customFields as Record<string, any>) || {};
    var keys = Object.keys(custom);
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var val = custom[key];
      if (key.startsWith("_") || !val) continue;
      if (!customFieldCounts[key]) {
        customFieldCounts[key] = { count: 0, samples: [], rawKey: key };
      }
      customFieldCounts[key].count++;
      if (customFieldCounts[key].samples.length < 3) {
        customFieldCounts[key].samples.push(String(val).slice(0, 50));
      }
    }
  }

  var configuredKeys = new Set<string>();
  var customFields: FieldProperty[] = customFieldsConfig.map(function(cf) {
    configuredKeys.add(cf.key.toLowerCase());
    cf.mappedFormFields.forEach(function(mf) { configuredKeys.add(mf.toLowerCase()); });

    var fillCount = 0;
    var samples: string[] = [];
    var cfcKeys = Object.keys(customFieldCounts);
    for (var k = 0; k < cfcKeys.length; k++) {
      var rawKey = cfcKeys[k];
      var data = customFieldCounts[rawKey];
      if (rawKey.toLowerCase() === cf.key.toLowerCase() || cf.mappedFormFields.some(function(mf) { return mf.toLowerCase() === rawKey.toLowerCase(); })) {
        fillCount += data.count;
        samples = samples.concat(data.samples).slice(0, 3);
      }
    }

    return {
      key: cf.key,
      label: cf.label,
      group: "custom" as const,
      type: cf.type,
      source: "custom" as const,
      fillCount: fillCount,
      totalLeads: totalLeads,
      fillRate: Math.round((fillCount / totalLeads) * 100),
      sampleValues: samples,
      isEditable: true,
      showInCard: cf.showInCard,
      showInList: cf.showInList,
      mappedFormFields: cf.mappedFormFields,
      customFieldId: cf.id,
    };
  });

  var unmappedEntries = Object.entries(customFieldCounts).filter(function(entry) {
    return !configuredKeys.has(entry[0].toLowerCase());
  });

  var unmappedFields: FieldProperty[] = unmappedEntries.map(function(entry) {
    var key = entry[0];
    var data = entry[1];
    return {
      key: key,
      label: key.replace(/[_-]/g, " ").replace(/^\w/, function(c) { return c.toUpperCase(); }),
      group: "unmapped" as const,
      type: "text" as const,
      source: "unmapped" as const,
      fillCount: data.count,
      totalLeads: totalLeads,
      fillRate: Math.round((data.count / totalLeads) * 100),
      sampleValues: data.samples,
      isEditable: true,
      showInCard: false,
      showInList: false,
      mappedFormFields: [],
    };
  });

  var allFields = systemFields.concat(customFields).concat(unmappedFields);

  var groupLabels: Record<string, string> = {
    contact: "Contact",
    acquisition: "Acquisition",
    formation: "Formation",
    pipeline: "Pipeline",
    custom: "Personnalisés",
    unmapped: "Non mappes",
  };

  var groupCounts: Record<string, number> = {};
  for (var g = 0; g < allFields.length; g++) {
    var grp = allFields[g].group;
    groupCounts[grp] = (groupCounts[grp] || 0) + 1;
  }

  var groups = Object.entries(groupCounts).map(function(entry) {
    return { key: entry[0], label: groupLabels[entry[0]] || entry[0], count: entry[1] };
  });

  return { fields: allFields, totalLeads: totalLeads, groups: groups };
}