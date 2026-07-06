import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 10 * 1024 * 1024; // 10 Mo
const ALLOWED = [
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "application/zip",
];

function cors(d: any, s: number) {
  return NextResponse.json(d, { status: s, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
export async function OPTIONS() { return cors({}, 204); }

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const form = await prisma.form.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!form) return cors({ error: "Formulaire introuvable ou non publié" }, 404);

    const fd = await request.formData();
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) return cors({ error: "Aucun fichier" }, 400);
    if (file.size > MAX) return cors({ error: "Fichier trop volumineux (max 10 Mo)" }, 400);
    if (file.type && !ALLOWED.includes(file.type)) return cors({ error: "Type de fichier non autorisé" }, 400);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const clean = (file.name || "fichier").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = "form-uploads/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + clean;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from("email-assets").upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) return cors({ error: "Téléversement échoué : " + error.message }, 500);

    const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
    return cors({ success: true, url: data.publicUrl, filename: file.name, size: file.size }, 200);
  } catch (e: any) {
    console.error("[Form upload]", e);
    return cors({ error: e.message || "Erreur serveur" }, 500);
  }
}
