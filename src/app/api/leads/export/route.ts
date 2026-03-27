import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    var session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get selected fields from query
    var url = new URL(request.url);
    var fieldsParam = url.searchParams.get("fields") || "";
    var selectedFields = fieldsParam ? fieldsParam.split(",") : [];

    // If no fields specified, export all default fields
    if (selectedFields.length === 0) {
      selectedFields = [
        "firstName", "lastName", "phone", "email", "city",
        "source", "programName", "stageName", "score", "createdAt",
      ];
    }

    var leads = await prisma.lead.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        stage: { select: { name: true } },
        program: { select: { name: true, code: true } },
        campus: { select: { name: true, city: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Field mapping: key -> { header, getValue }
    var fieldMap: Record<string, { header: string; getValue: (l: any) => string }> = {
      firstName: { header: "Prenom", getValue: function(l) { return l.firstName; } },
      lastName: { header: "Nom", getValue: function(l) { return l.lastName; } },
      phone: { header: "Téléphone", getValue: function(l) { return l.phone; } },
      email: { header: "Email", getValue: function(l) { return l.email || ""; } },
      whatsapp: { header: "WhatsApp", getValue: function(l) { return l.whatsapp || ""; } },
      city: { header: "Ville", getValue: function(l) { return l.city || ""; } },
      gender: { header: "Genre", getValue: function(l) { return l.gender === "MALE" ? "Homme" : l.gender === "FEMALE" ? "Femme" : l.gender || ""; } },
      dateOfBirth: { header: "Date de naissance", getValue: function(l) { return l.dateOfBirth ? new Date(l.dateOfBirth).toISOString().split("T")[0] : ""; } },
      source: { header: "Source", getValue: function(l) { return l.source; } },
      sourceDetail: { header: "Detail source", getValue: function(l) { return l.sourceDetail || ""; } },
      programName: { header: "Filière", getValue: function(l) { return l.program?.name || ""; } },
      campusCity: { header: "Campus", getValue: function(l) { return l.campus?.city || ""; } },
      stageName: { header: "Étape", getValue: function(l) { return l.stage?.name || ""; } },
      score: { header: "Score", getValue: function(l) { return String(l.score); } },
      assignedToName: { header: "Assigne a", getValue: function(l) { return l.assignedTo?.name || ""; } },
      createdAt: { header: "Date création", getValue: function(l) { return l.createdAt.toISOString().split("T")[0]; } },
      isConverted: { header: "Converti", getValue: function(l) { return l.isConverted ? "Oui" : "Non"; } },
    };

    // Add custom field extractors for any custom_ prefixed fields
    selectedFields.forEach(function(key) {
      if (key.startsWith("custom_") && !fieldMap[key]) {
        var customKey = key.replace("custom_", "");
        fieldMap[key] = {
          header: customKey.replace(/[_-]/g, " ").replace(/^\w/, function(c) { return c.toUpperCase(); }),
          getValue: function(l) {
            var custom = (l.customFields as any) || {};
            return custom[customKey] || "";
          },
        };
      }
    });

    // Filter to only selected fields that exist
    var activeFields = selectedFields.filter(function(key) { return fieldMap[key]; });

    // Build headers
    var headers = activeFields.map(function(key) { return fieldMap[key].header; });

    // Build rows
    var rows = leads.map(function(l) {
      return activeFields.map(function(key) {
        return fieldMap[key].getValue(l);
      });
    });

    // Build CSV with BOM for Excel
    var csvContent = "\uFEFF" + headers.join(";") + "\n" +
      rows.map(function(row) {
        return row.map(function(cell) {
          if (cell.includes(";") || cell.includes('"') || cell.includes("\n")) {
            return '"' + cell.replace(/"/g, '""') + '"';
          }
          return cell;
        }).join(";");
      }).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads-educrm-' + new Date().toISOString().split("T")[0] + '.csv"',
      },
    });
  } catch (error: any) {
    console.error("[Export]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}