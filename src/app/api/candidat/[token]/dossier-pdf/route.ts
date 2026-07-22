// Téléchargement du dossier de candidature PDF par le candidat (portail, token).
// Même génération que côté CRM (service partagé) — URL signée, jamais de PDF inline.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAndUploadDossierPdf } from "@/lib/dossier-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const t = await prisma.leadPortalToken.findUnique({
      where: { token },
      select: { leadId: true, organizationId: true, expiresAt: true },
    });
    if (!t || t.expiresAt < new Date()) return NextResponse.json({ ok: false, error: "Lien invalide ou expiré" }, { status: 401 });

    const result = await generateAndUploadDossierPdf(t.leadId, t.organizationId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e: any) {
    console.error("[Portal dossier PDF]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
