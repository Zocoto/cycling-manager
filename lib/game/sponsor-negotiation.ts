import type { SponsorObjectiveAmbitionLevel } from "@/types/sponsor-objective";

export const SPONSOR_OBJECTIVE_DIFFICULTIES = [
  "accessible",
  "balanced",
  "ambitious",
] as const;

export type SponsorObjectiveDifficulty =
  (typeof SPONSOR_OBJECTIVE_DIFFICULTIES)[number];

export const SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG: Record<
  SponsorObjectiveDifficulty,
  {
    label: string;
    shortLabel: string;
    description: string;
    budgetAdjustmentPercent: number;
    ambitionOffset: -1 | 0 | 1;
  }
> = {
  accessible: {
    label: "Objectifs accessibles",
    shortLabel: "Accessible",
    description: "Des attentes allégées en échange d’un apport réduit.",
    budgetAdjustmentPercent: -10,
    ambitionOffset: -1,
  },
  balanced: {
    label: "Objectifs équilibrés",
    shortLabel: "Équilibré",
    description: "L’offre et les exigences initiales du sponsor.",
    budgetAdjustmentPercent: 0,
    ambitionOffset: 0,
  },
  ambitious: {
    label: "Objectifs ambitieux",
    shortLabel: "Ambitieux",
    description: "Des attentes renforcées contre un apport supérieur.",
    budgetAdjustmentPercent: 10,
    ambitionOffset: 1,
  },
};

const BUDGET_STEP = 10_000;

export function isSponsorObjectiveDifficulty(
  value: string,
): value is SponsorObjectiveDifficulty {
  return SPONSOR_OBJECTIVE_DIFFICULTIES.includes(
    value as SponsorObjectiveDifficulty,
  );
}

export function getSponsorNegotiationBudgetCeiling({
  baseBudget,
  sponsorMaximumBudget,
}: {
  baseBudget: number;
  sponsorMaximumBudget: number;
}): number {
  assertPositiveBudget(baseBudget, "Le budget de base");
  assertPositiveBudget(sponsorMaximumBudget, "Le plafond du sponsor");

  // Une hausse annuelle de renouvellement ou un bonus déjà acquis reste
  // conservé même s’il a porté l’offre au-dessus du plafond catalogue.
  return Math.max(baseBudget, sponsorMaximumBudget);
}

export function calculateSponsorNegotiatedBudget({
  baseBudget,
  budgetCeiling,
  difficulty,
}: {
  baseBudget: number;
  budgetCeiling: number;
  difficulty: SponsorObjectiveDifficulty;
}): number {
  assertPositiveBudget(baseBudget, "Le budget de base");
  assertPositiveBudget(budgetCeiling, "Le plafond de négociation");

  if (budgetCeiling < baseBudget) {
    throw new Error(
      "Le plafond de négociation ne peut pas être inférieur au budget de base.",
    );
  }

  const adjustment =
    SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG[difficulty]
      .budgetAdjustmentPercent;

  if (adjustment === 0) return baseBudget;

  const adjustedBudget = Math.round(
    (baseBudget * (1 + adjustment / 100)) / BUDGET_STEP,
  ) * BUDGET_STEP;

  return Math.max(
    BUDGET_STEP,
    Math.min(adjustedBudget, budgetCeiling),
  );
}

export function adjustSponsorObjectiveAmbitionLevel(
  baseAmbitionLevel: SponsorObjectiveAmbitionLevel,
  difficulty: SponsorObjectiveDifficulty,
): SponsorObjectiveAmbitionLevel {
  const offset =
    SPONSOR_OBJECTIVE_DIFFICULTY_CONFIG[difficulty].ambitionOffset;

  return Math.max(
    1,
    Math.min(6, baseAmbitionLevel + offset),
  ) as SponsorObjectiveAmbitionLevel;
}

function assertPositiveBudget(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} doit être un montant strictement positif.`);
  }
}
