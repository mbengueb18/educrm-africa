import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/plans/config";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  allDone: boolean;
  dismissed: boolean;
}

/**
 * Calcule l'état de la checklist de premier démarrage à partir des VRAIES
 * données de l'org (pas de cases manuelles) → la progression reflète la réalité.
 * L'état « masqué » est stocké dans Organization.settings.onboardingChecklistDismissed.
 */
export async function getOnboardingProgress(
  orgId: string,
  userId: string
): Promise<OnboardingProgress> {
  const [org, currentUser, leadCount, formCount, userCount, emailDomain] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true, plan: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } }),
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.form.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.orgEmailDomain.findUnique({ where: { organizationId: orgId }, select: { id: true } }),
  ]);

  const settings = (org?.settings as Record<string, unknown> | null) || {};
  const dismissed = settings.onboardingChecklistDismissed === true;

  // Le domaine email personnalisé est une fonctionnalité des plans payants :
  // on ne propose l'étape que si le plan de l'org y donne droit.
  const plan = org?.plan ?? "ESSENTIEL";
  const canCustomEmailDomain = PLAN_LIMITS[plan].customEmailDomain;

  const steps: OnboardingStep[] = [
    {
      key: "verify-email",
      label: "Confirmer votre adresse email",
      description: "Indispensable pour envoyer emails et campagnes.",
      href: "/pipeline",
      cta: "Vérifier ma boîte mail",
      done: currentUser?.emailVerified != null,
    },
    {
      key: "first-lead",
      label: "Ajouter votre premier prospect",
      description: "Créez ou importez un candidat dans votre pipeline.",
      href: "/pipeline",
      cta: "Ajouter un prospect",
      done: leadCount > 0,
    },
    // Étape domaine email : plans payants uniquement.
    ...(canCustomEmailDomain
      ? [{
          key: "email-domain",
          label: "Connecter votre domaine email",
          description: "Envoyez depuis votre propre nom de domaine.",
          href: "/settings/email-domain",
          cta: "Configurer le domaine",
          done: emailDomain != null,
        }]
      : []),
    {
      key: "first-form",
      label: "Créer un formulaire de captation",
      description: "Collectez des candidatures depuis votre site.",
      href: "/forms",
      cta: "Créer un formulaire",
      done: formCount > 0,
    },
    {
      key: "invite-team",
      label: "Inviter votre équipe",
      description: "Ajoutez vos conseillers et responsables admissions.",
      href: "/settings/users",
      cta: "Inviter un collègue",
      done: userCount > 1,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return {
    steps,
    completed,
    total,
    allDone: completed === total,
    dismissed,
  };
}
