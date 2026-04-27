import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const BUCKET = "lead-documents";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slug = formData.get("slug") as string | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "Organisation requise" }, { status: 400 });

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 10 MB)" }, { status: 400 });
    }

    // Allowed types
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorisé (PDF, JPG, PNG uniquement)" }, { status: 400 });
    }

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `inscriptions/${slug}/${timestamp}-${cleanName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) throw new Error("Upload échoué : " + uploadError.message);

    return NextResponse.json({
      success: true,
      path,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    });
  } catch (error: any) {
    console.error("[Inscription Upload]", error);
    return NextResponse.json({ error: error.message || "Erreur upload" }, { status: 500 });
  }
}