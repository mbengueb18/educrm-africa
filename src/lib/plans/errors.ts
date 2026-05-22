// lib/plans/errors.ts

import type { Plan, Feature } from "./types";

/**
 * Erreur levée quand une limite de plan est atteinte
 * Permet une gestion uniforme dans toute l'app
 */
export class PlanLimitError extends Error {
  public readonly code: string;
  public readonly currentPlan: Plan;
  public readonly upgradeTarget: Plan | null;
  public readonly feature?: string;
  public readonly currentUsage?: number;
  public readonly limit?: number;

  constructor(params: {
    code: string;
    message: string;
    currentPlan: Plan;
    upgradeTarget?: Plan | null;
    feature?: string;
    currentUsage?: number;
    limit?: number;
  }) {
    super(params.message);
    this.name = "PlanLimitError";
    this.code = params.code;
    this.currentPlan = params.currentPlan;
    this.upgradeTarget = params.upgradeTarget ?? null;
    this.feature = params.feature;
    this.currentUsage = params.currentUsage;
    this.limit = params.limit;
  }

  toJSON() {
    return {
      error: "PLAN_LIMIT_EXCEEDED",
      code: this.code,
      message: this.message,
      currentPlan: this.currentPlan,
      upgradeTarget: this.upgradeTarget,
      feature: this.feature,
      currentUsage: this.currentUsage,
      limit: this.limit,
    };
  }
}

/**
 * Erreur levée quand une fonctionnalité n'est pas disponible dans le plan actuel
 */
export class FeatureNotAvailableError extends PlanLimitError {
  constructor(params: {
    feature: Feature;
    currentPlan: Plan;
    upgradeTarget?: Plan;
    customMessage?: string;
  }) {
    super({
      code: `FEATURE_NOT_AVAILABLE_${params.feature}`,
      message:
        params.customMessage ??
        `La fonctionnalité ${params.feature} n'est pas disponible dans le plan ${params.currentPlan}.`,
      currentPlan: params.currentPlan,
      upgradeTarget: params.upgradeTarget,
      feature: params.feature,
    });
    this.name = "FeatureNotAvailableError";
  }
}

/**
 * Erreur levée quand un quota est dépassé (ex: 3000 emails atteints)
 */
export class QuotaExceededError extends PlanLimitError {
  constructor(params: {
    resource: string;
    currentPlan: Plan;
    currentUsage: number;
    limit: number;
    upgradeTarget?: Plan;
  }) {
    super({
      code: `QUOTA_EXCEEDED_${params.resource.toUpperCase()}`,
      message: `Quota ${params.resource} atteint (${params.currentUsage}/${params.limit}). Upgradez pour augmenter la limite.`,
      currentPlan: params.currentPlan,
      upgradeTarget: params.upgradeTarget,
      currentUsage: params.currentUsage,
      limit: params.limit,
    });
    this.name = "QuotaExceededError";
  }
}