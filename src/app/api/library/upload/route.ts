import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "email-attachments";
const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = ((formData.get("name") as string) || "").trim();
    const category = (((formData.get("category") as string) || "Autre").trim()) || "Autre";
    const description = ((formData.get("description") as string) || "").trim() || null;

    if (!file || file.size === 0) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (max 15 Mo)" }, { status: 400 });

    const cleanName = (file.name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${session.user.organizationId}/library/${Date.now()}-${cleanName}`;

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) return NextResponse.json({ error: "Téléversement échoué : " + error.message }, { status: 500 });

    await prisma.libraryDocument.create({
      data: {
        organizationId: session.user.organizationId,
        name: name || file.name || "Document",
        description,
        category,
        path,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedById: session.user.id,
        uploadedByName: session.user.name || "—",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[Library upload]", e);
    return NextResponse.json({ error: e.message || "Erreur upload" }, { status: 500 });
  }
}
