import { applyInfrastructureEfficiencyBonus } from "@/lib/game/infrastructure";
import {
  getEquipmentRatingBonusTotals,
  type EquipmentEffects,
} from "@/lib/game/equipment";

export type EquipmentRndSpecialty =
  | "research_time"
  | "research_cost"
  | "research_success";

export const EQUIPMENT_RND_SPECIALTIES = [
  "research_time",
  "research_cost",
  "research_success",
] as const satisfies readonly EquipmentRndSpecialty[];

export type EquipmentRndEngineer = {
  contractId: string;
  name: string;
  level: number;
  specialties: EquipmentRndSpecialty[];
  /** Conservé pour les anciens appels internes ne connaissant qu'un talent. */
  specialty: EquipmentRndSpecialty | null;
};

export function isEquipmentRndSpecialty(
  value: string,
): value is EquipmentRndSpecialty {
  return EQUIPMENT_RND_SPECIALTIES.some((specialty) => specialty === value);
}

function getEngineerSpecialties(
  engineer: EquipmentRndEngineer | null | undefined,
): EquipmentRndSpecialty[] {
  if (!engineer) return [];
  if (engineer.specialties.length > 0) {
    return EQUIPMENT_RND_SPECIALTIES.filter((specialty) =>
      engineer.specialties.includes(specialty),
    );
  }
  return engineer.specialty ? [engineer.specialty] : [];
}

export function estimateEquipmentRndResearch(args: {
  labLevel: number;
  existingBonusTotal?: number;
  labEfficiencyBonusPercentage?: number;
  engineer?: EquipmentRndEngineer | null;
}) {
  const engineer = args.engineer ?? null;
  const specialties = getEngineerSpecialties(engineer);
  const hasSpecialty = (specialty: EquipmentRndSpecialty) =>
    specialties.includes(specialty);
  const successRate = Math.min(
    95,
    45 +
      Math.round(
        applyInfrastructureEfficiencyBonus(
          args.labLevel * 5,
          args.labEfficiencyBonusPercentage ?? 0,
        ),
      ) +
      (engineer && hasSpecialty("research_success") ? engineer.level * 3 : 0),
  );
  const baseDurationDays = getEquipmentRndBaseDurationDays(
    args.existingBonusTotal ?? 0,
  );
  const durationEfficiency =
    engineer && hasSpecialty("research_cost")
      ? Math.min(0.9, engineer.level * 0.05)
      : 0;
  const durationDays = Math.max(
    1,
    Math.ceil(baseDurationDays * (1 - durationEfficiency)) -
      (engineer && hasSpecialty("research_time") ? engineer.level : 0),
  );

  return { successRate, durationDays, cost: 0 };
}

export function getEquipmentRndBonusTotal(
  effects: Pick<
    EquipmentEffects,
    "ratingBonuses" | "timeTrialRatingBonuses"
  >,
): number {
  const total = Object.values(getEquipmentRatingBonusTotals(effects)).reduce(
    (sum, value) => sum + Number(value ?? 0),
    0,
  );

  return Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
}

export function getEquipmentRndBaseDurationDays(
  existingBonusTotal: number,
): number {
  const score = Math.max(
    0,
    Math.floor(Number.isFinite(existingBonusTotal) ? existingBonusTotal : 0),
  );

  if (score === 0) return 1;
  if (score === 1) return 3;
  if (score === 2) return 5;
  if (score >= 17) return 100_000;

  return Math.min(100_000, 5 * 2 ** (score - 2));
}

export function describeEquipmentRndEngineerEffects(
  engineer: EquipmentRndEngineer,
): string[] {
  return getEngineerSpecialties(engineer).map((specialty) => {
    switch (specialty) {
      case "research_time":
        return `−${engineer.level} jour${engineer.level > 1 ? "s" : ""}`;
      case "research_cost":
        return `−${engineer.level * 5} % sur la durée`;
      case "research_success":
        return `+${engineer.level * 3} points de réussite`;
    }
  });
}
