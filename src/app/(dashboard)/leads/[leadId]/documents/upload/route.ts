import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: session.user.organizationId },
      select: { id: true, organizationId: true },
    });

    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("type") as string) || "OTHER";

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 25 MB)" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = "leads/" + lead.organizationId + "/" + lead.id + "/" + timestamp + "-" + cleanName;

    const { error: uploadError } = await supabase.storage
      .from("lead-documents")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: "Upload échoué : " + uploadError.message }, { status: 500 });
    }

    const document = await prisma.document.create({
      data: {
        name: file.name,
        type: docType as any,
        url: path,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        leadId: lead.id,
      },
    });

    await prisma.activity.create({
      data: {
        type: "DOCUMENT_UPLOADED",
        description: "Document ajouté : " + file.name,
        userId: session.user.id,
        leadId: lead.id,
        organizationId: lead.organizationId,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error: any) {
    console.error("[Document Upload]", error);
    return NextResponse.json({ error: error.message || "Erreur" }, { status: 500 });
  }
}