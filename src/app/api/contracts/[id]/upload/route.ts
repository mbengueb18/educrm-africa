import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-storage";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { CONTRACTS_BUCKET } from "@/lib/contracts/template";
import { getPlanLimits } from "@/lib/plans/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
const CONTRACT_ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];
const CONTRACTS_INBOX = "contact@talibcrm.com";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (!CONTRACT_ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { organization: { select: { name: true } } },
    });
    if (!contract || contract.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }
    if (contract.status === "VALIDE") {
      return NextResponse.json({ error: "Ce contrat est déjà validé et ne peut plus être modifié" }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (max 15 Mo)" }, { status: 400 });

    const cleanName = (file.name || "contrat-signe").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${contract.organizationId}/${contract.id}/${Date.now()}-${cleanName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Remplace l'éventuel fichier précédent (statut ré-uploadé).
    if (contract.signedPath) {
      await supabaseAdmin.storage.from(CONTRACTS_BUCKET).remove([contract.signedPath]).catch(() => {});
    }

    const { error: upErr } = await supabaseAdmin.storage
      .from(CONTRACTS_BUCKET)
      .upload(path, buffer, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
    if (upErr) return NextResponse.json({ error: "Téléversement échoué : " + upErr.message }, { status: 500 });

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        signedPath: path,
        signedFileName: file.name || cleanName,
        signedSize: file.size,
        signedMime: file.type || "application/octet-stream",
        signedAt: new Date(),
        uploadedById: session.user.id,
        uploadedByName: session.user.name || null,
        status: "SIGNE_RECU",
      },
    });

    // Notification + archivage à l'équipe TalibCRM (pièce jointe = contrat signé).
    const planName = getPlanLimits(contract.plan).name;
    const orgName = contract.organization.name;
    await sendTransactionalEmail({
      to: CONTRACTS_INBOX,
      replyTo: session.user.email,
      subject: `Contrat signé reçu — ${orgName} (${planName}) · ${contract.reference}`,
      html: `<p>Un contrat signé vient d'être déposé depuis le CRM.</p>
        <ul>
          <li><b>Organisation :</b> ${orgName}</li>
          <li><b>Offre :</b> ${planName}</li>
          <li><b>Référence :</b> ${contract.reference}</li>
          <li><b>Déposé par :</b> ${session.user.name || "—"} (${session.user.email})</li>
        </ul>
        <p>Le contrat signé est en pièce jointe. Retrouvez-le et validez-le dans le back-office → Contrats.</p>`,
      text: `Contrat signé reçu.\nOrganisation : ${orgName}\nOffre : ${planName}\nRéférence : ${contract.reference}\nDéposé par : ${session.user.name || "—"} (${session.user.email})\nLe contrat signé est en pièce jointe.`,
      attachments: [{ filename: file.name || `${contract.reference}.pdf`, content: buffer, contentType: file.type || undefined }],
    }).catch((e) => {
      // L'échec d'email ne doit pas casser l'upload : le fichier est déjà archivé.
      console.error("[contracts] envoi email contact@ échoué:", e);
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[contracts upload]", e);
    return NextResponse.json({ error: e?.message || "Erreur upload" }, { status: 500 });
  }
}
