"use server";

// Actions du dossier de candidature côté conseiller.
// Convention { ok, error } (les throw sont caviardés par Next en prod).

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { DossierChecklist } from "@/lib/candidature";

// Rouvre un dossier verrouillé (complet) pour permettre au candidat de remplacer une pièce.
export async function reopenDossier(leadId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.organizationId) return { ok: false, error: "Non authentifié" };
  const orgId = session.user.organizationId;

  const submission = await prisma.formSubmission.findFirst({
    where: { leadId, organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: { id: true, checklist: true },
  });
  if (!submission) return { ok: false, error: "Aucune candidature pour ce prospect" };

  const checklist = submission.checklist as DossierChecklist | null;
  if (!checklist || !checklist.locked) return { ok: false, error: "Le dossier n'est pas verrouillé" };

  await prisma.formSubmission.update({
    where: { id: submission.id },
    data: { checklist: { ...checklist, locked: false, lockedAt: undefined } as any },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE_ADDED",
      description: "Dossier de candidature rouvert par " + (session.user.name || "le conseiller") + " — le candidat peut à nouveau déposer des pièces.",
      leadId,
      organizationId: orgId,
      userId: session.user.id,
    },
  }).catch(() => {});

  revalidatePath("/leads/" + leadId);
  return { ok: true };
}
