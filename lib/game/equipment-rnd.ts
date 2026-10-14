import { applyInfrastructureEfficiencyBonus } from "@/lib/game/infrastructure";
import {
  getEquipmentRatingBonusTotals,
  type EquipmentEffects,
} from "@/lib/game/equipment";
import { RIDER_RATING_AXES, type RiderRatingKey } from "./rider-profile";

export type EquipmentRndSpecialty =
  | "research_time"
  | "research_cost"
  | "research_success"
  | "research_exceptional_chance";

export const EQUIPMENT_RND_SPECIALTIES = [
  "research_time",
  "research_cost",
  "research_success",
  "research_exceptional_chance",
] as const satisfies readonly EquipmentRndSpecialty[];

export const EQUIPMENT_RND_MAX_BONUS = 10;
export const EQUIPMENT_RND_BASE_EXCEPTIONAL_CHANCE_PERCENTAGE = 1;
export const EQUIPMENT_RND_EXCEPTIONAL_CHANCE_PER_ENGINEER_LEVEL = 0.5;
export const EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH = 3;
export const EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH = 60;

export function normalizeEquipmentPrototypeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isEquipmentPrototypeNameValid(value: unknown): boolean {
  const name = normalizeEquipmentPrototypeName(value);
  return (
    name.length >= EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH &&
    name.length <= EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH
  );
}

export type EquipmentRndEngineer = {
  contractId: string;
  name: string;
  level: number;
  specialties: EquipmentRndSpecialty[];
  /** Conservé pour les anciens appels internes ne connaissant qu'un talent. */
  specialty: EquipmentRndSpecialty | null;
  countryName?: string | null;
  countryCode?: string | null;
  nationalityMultiplier?: number;
  federalMultiplier?: number;
  setbackProtected?: boolean;
  exceptionalChancePercentage?: number;
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

export function getEquipmentRndExceptionalChancePercentage(
  engineer?: EquipmentRndEngineer | null,
): number {
  if (engineer?.exceptionalChancePercentage !== undefined) return engineer.exceptionalChancePercentage;
  return (
    EQUIPMENT_RND_BASE_EXCEPTIONAL_CHANCE_PERCENTAGE +
    (engineer &&
    getEngineerSpecialties(engineer).includes("research_exceptional_chance")
      ? Math.min(5, Math.max(1, Math.floor(engineer.level))) *
        EQUIPMENT_RND_EXCEPTIONAL_CHANCE_PER_ENGINEER_LEVEL
        * (engineer.nationalityMultiplier ?? 1)
      : 0)
  );
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
  const affinity = engineer?.nationalityMultiplier ?? 1;
  const federal = engineer?.federalMultiplier ?? 1;
  const successRate = Math.min(
    95,
    45 +
      Math.round(
        applyInfrastructureEfficiencyBonus(
          args.labLevel * 5,
          args.labEfficiencyBonusPercentage ?? 0,
        ),
      ) +
      (engineer && hasSpecialty("research_success") ? Math.round(engineer.level * 3 * affinity * federal) : 0),
  );
  const baseDurationDays = getEquipmentRndBaseDurationDays(
    args.existingBonusTotal ?? 0,
  );
  const durationEfficiency =
    engineer && hasSpecialty("research_cost")
      ? Math.min(0.9, engineer.level * 0.05 * affinity)
      : 0;
  const durationDays = Math.max(1, Math.ceil(Math.max(1,
    Math.ceil(Math.ceil(baseDurationDays * (1 - durationEfficiency)) -
      (engineer && hasSpecialty("research_time") ? engineer.level * affinity : 0)),
  ) / federal));

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
  if (score <= 6) return score * 2;

  return Math.min(28, 12 + (score - 6) * 4);
}

export function describeEquipmentRndEngineerEffects(
  engineer: EquipmentRndEngineer,
): string[] {
  const affinity = engineer.nationalityMultiplier ?? 1;
  const fmt = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const effects = getEngineerSpecialties(engineer).map((specialty) => {
    switch (specialty) {
      case "research_time":
        return `−${fmt(engineer.level * affinity)} jour${engineer.level > 1 ? "s" : ""}`;
      case "research_cost":
        return `−${fmt(Math.min(90, engineer.level * 5 * affinity))} % sur la durée`;
      case "research_success":
        return `+${Math.round(engineer.level * 3 * affinity * (engineer.federalMultiplier ?? 1))} points de réussite`;
      case "research_exceptional_chance":
        return `${getEquipmentRndExceptionalChancePercentage(engineer).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % de chance de prototype +3`;
    }
  });
  if (engineer.setbackProtected) effects.push("Revers sans malus");
  return effects;
}

export const EQUIPMENT_RND_FOCUSES = [
  { key: "mountain", label: "Montagne", symbol: "△", primary: ["mountain"], secondary: ["endurance", "resistance", "recovery", "downhill"] },
  { key: "hills", label: "Vallons", symbol: "∿", primary: ["hills", "acceleration"], secondary: ["resistance", "endurance", "breakaway"] },
  { key: "cobbles", label: "Pavés", symbol: "▦", primary: ["cobbles", "resistance"], secondary: ["flat", "endurance", "acceleration"] },
  { key: "plain", label: "Plaine", symbol: "↗", primary: ["flat", "sprint", "timeTrial"], secondary: ["acceleration", "endurance", "prologue"] },
] as const satisfies readonly { key: string; label: string; symbol: string; primary: readonly RiderRatingKey[]; secondary: readonly RiderRatingKey[] }[];
export type EquipmentRndFocus = typeof EQUIPMENT_RND_FOCUSES[number]["key"];
export function isEquipmentRndFocus(value: unknown): value is EquipmentRndFocus {
  return EQUIPMENT_RND_FOCUSES.some(focus => focus.key === value);
}
export function equipmentRndStatsSummary(effects: EquipmentEffects) {
  return RIDER_RATING_AXES.flatMap(axis => {
    const value = effects.ratingBonuses[axis.key] ?? 0;
    const tt = effects.timeTrialRatingBonuses[axis.key] ?? 0;
    return [...(value ? [`${value > 0 ? "+" : ""}${value} ${axis.shortLabel}`] : []), ...(tt ? [`${tt > 0 ? "+" : ""}${tt} ${axis.shortLabel} (CLM)`] : [])];
  }).join(" · ") || "Aucun bonus de statistique";
}
export function equipmentRndAffinitySummary(engineer: EquipmentRndEngineer) {
  const affinity = Math.round(((engineer.nationalityMultiplier ?? 1) - 1) * 10000) / 100;
  const federal = Math.round(((engineer.federalMultiplier ?? 1) - 1) * 10000) / 100;
  return [affinity > 0 ? `Affinité nationale/accueil +${affinity.toLocaleString("fr-FR")}% sur les talents` : "Pas de bonus d’affinité", ...(federal > 0 ? [`Institut fédéral +${federal.toLocaleString("fr-FR")}% d’efficacité`] : [])].join(" · ");
}
