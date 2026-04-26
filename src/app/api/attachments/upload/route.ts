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
    const leadId = formData.get("leadId") as string | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    if (!leadId) return NextResponse.json({ error: "leadId requis" }, { status: 400 });

    // Limit: 25 MB (Resend supports up to 40 MB but emails get rejected by many providers above 25)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 25 MB)" }, { status: 400 });
    }

    const { path, size } = await uploadAttachment(
      file,
      file.name,
      session.user.organizationId,
      leadId
    );

    return NextResponse.json({
      success: true,
      path,
      filename: file.name,
      size,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error("[Upload]", error);
    return NextResponse.json({ error: error.message || "Erreur upload" }, { status: 500 });
  }
}