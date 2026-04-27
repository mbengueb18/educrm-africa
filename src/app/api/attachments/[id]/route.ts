import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    const attachment = await prisma.messageAttachment.findUnique({
      where: { id },
      include: {
        message: { select: { organizationId: true } },
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Pièce jointe introuvable" }, { status: 404 });
    }

    // Check organization
    if (attachment.message.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Case 1: outgoing attachment stored in Supabase
    if (attachment.storagePath) {
      const url = await getAttachmentSignedUrl(attachment.storagePath, 3600);
      return NextResponse.redirect(url);
    }

    // Case 2: inbound attachment from Resend
    if (attachment.externalId && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const result = await (resend.emails as any).receiving.attachments.get(attachment.externalId);
        const data = result?.data || result;

        if (data?.download_url) {
          return NextResponse.redirect(data.download_url);
        }
        if (data?.content) {
          // Resend may return base64 content directly
          const buffer = Buffer.from(data.content, "base64");
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": attachment.contentType || "application/octet-stream",
              "Content-Disposition": 'attachment; filename="' + attachment.filename + '"',
            },
          });
        }
      } catch (err: any) {
        console.error("[Attachment] Failed to fetch from Resend", err?.message);
        return NextResponse.json({ error: "Impossible de récupérer la pièce jointe" }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Aucune source de fichier disponible" }, { status: 404 });
  } catch (error: any) {
    console.error("[Attachment GET]", error);
    return NextResponse.json({ error: error.message || "Erreur" }, { status: 500 });
  }
}