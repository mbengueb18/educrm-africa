import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadAttachment } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const campaignId = (formData.get("campaignId") as string | null) || "draft";

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });

    // Limite 25 Mo (au-delà, beaucoup de fournisseurs rejettent l'email)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 25 Mo)" }, { status: 400 });
    }

    // On réutilise uploadAttachment : le 2e segment du chemin sert de dossier campagne
    const { path, size } = await uploadAttachment(
      file,
      file.name,
      session.user.organizationId,
      "campaign_" + campaignId
    );

    return NextResponse.json({
      success: true,
      path: path,
      filename: file.name,
      size: size,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error("[Campaign Attachment Upload]", error);
    return NextResponse.json({ error: error.message || "Erreur upload" }, { status: 500 });
  }
}