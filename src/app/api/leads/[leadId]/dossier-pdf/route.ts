// Génère le dossier de candidature PDF d'un lead (synthèse + pièces concaténées),
// le dépose sur Supabase Storage et renvoie une URL signée de téléchargement.
// (Le PDF peut dépasser la limite de réponse Vercel → jamais renvoyé inline.)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAndUploadDossierPdf } from "@/lib/dossier-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
    const { leadId } = await params;

    const result = await generateAndUploadDossierPdf(leadId, session.user.organizationId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e: any) {
    console.error("[Dossier PDF]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
