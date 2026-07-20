import type { RiderRatingKey, RiderRatings } from "@/lib/game/rider-profile";

export const EQUIPMENT_SLOTS = [
  "helmet",
  "gloves",
  "bib_shorts",
  "glasses",
  "shoes",
  "front_wheel",
  "rear_wheel",
  "frame",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const EQUIPMENT_CATEGORIES = [
  { slot: "gloves", label: "Gants", shortLabel: "Gants" },
  { slot: "bib_shorts", label: "Cuissards", shortLabel: "Cuissard" },
  { slot: "glasses", label: "Lunettes", shortLabel: "Lunettes" },
  { slot: "helmet", label: "Casques", shortLabel: "Casque" },
  { slot: "shoes", label: "Chaussures", shortLabel: "Chaussures" },
  { slot: "front_wheel", label: "Roues avant", shortLabel: "Roue avant" },
  { slot: "rear_wheel", label: "Roues arrière", shortLabel: "Roue arrière" },
  { slot: "frame", label: "Cadres", shortLabel: "Cadre" },
] as const satisfies ReadonlyArray<{
  slot: EquipmentSlot;
  label: string;
  shortLabel: string;
}>;

export type EquipmentEffects = {
  ratingBonuses: Partial<Record<RiderRatingKey, number>>;
  timeTrialRatingBonuses: Partial<Record<RiderRatingKey, number>>;
  injuryRiskReductionPct: number;
  breakawayReputationBonus: number;
  victoryReputationBonus: number;
};

export const EMPTY_EQUIPMENT_EFFECTS: EquipmentEffects = {
  ratingBonuses: {},
  timeTrialRatingBonuses: {},
  injuryRiskReductionPct: 0,
  breakawayReputationBonus: 0,
  victoryReputationBonus: 0,
};

export function combineEquipmentEffects(
  effects: ReadonlyArray<Partial<EquipmentEffects>>
): EquipmentEffects {
  const combined: EquipmentEffects = {
    ratingBonuses: {},
    timeTrialRatingBonuses: {},
    injuryRiskReductionPct: 0,
    breakawayReputationBonus: 0,
    victoryReputationBonus: 0,
  };

  for (const effect of effects) {
    for (const [key, value] of Object.entries(effect.ratingBonuses ?? {})) {
      const ratingKey = key as RiderRatingKey;
      combined.ratingBonuses[ratingKey] =
        (combined.ratingBonuses[ratingKey] ?? 0) + Number(value ?? 0);
    }

    for (const [key, value] of Object.entries(
      effect.timeTrialRatingBonuses ?? {}
    )) {
      const ratingKey = key as RiderRatingKey;
      combined.timeTrialRatingBonuses[ratingKey] =
        (combined.timeTrialRatingBonuses[ratingKey] ?? 0) + Number(value ?? 0);
    }

    combined.injuryRiskReductionPct += effect.injuryRiskReductionPct ?? 0;
    combined.breakawayReputationBonus +=
      effect.breakawayReputationBonus ?? 0;
    combined.victoryReputationBonus += effect.victoryReputationBonus ?? 0;
  }

  combined.injuryRiskReductionPct = Math.min(
    45,
    Math.max(0, combined.injuryRiskReductionPct)
  );

  return combined;
}

export function normalizeEquipmentEffects(value: unknown): EquipmentEffects {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...EMPTY_EQUIPMENT_EFFECTS,
      ratingBonuses: {},
      timeTrialRatingBonuses: {},
    };
  }

  const payload = value as Record<string, unknown>;
  const rawRatings =
    payload.ratingBonuses && typeof payload.ratingBonuses === "object"
      ? (payload.ratingBonuses as Record<string, unknown>)
      : {};
  const ratingBonuses: Partial<Record<RiderRatingKey, number>> = {};
  const rawTimeTrialRatings =
    payload.timeTrialRatingBonuses &&
    typeof payload.timeTrialRatingBonuses === "object"
      ? (payload.timeTrialRatingBonuses as Record<string, unknown>)
      : {};
  const timeTrialRatingBonuses: Partial<Record<RiderRatingKey, number>> = {};

  for (const [key, ratingValue] of Object.entries(rawRatings)) {
    const amount = Number(ratingValue);
    if (Number.isFinite(amount)) ratingBonuses[key as RiderRatingKey] = amount;
  }


  for (const [key, ratingValue] of Object.entries(rawTimeTrialRatings)) {
    const amount = Number(ratingValue);
    if (Number.isFinite(amount)) {
      timeTrialRatingBonuses[key as RiderRatingKey] = amount;
    }
  }

  return {
    ratingBonuses,
    timeTrialRatingBonuses,
    injuryRiskReductionPct: toFiniteNumber(payload.injuryRiskReductionPct),
    breakawayReputationBonus: toFiniteNumber(payload.breakawayReputationBonus),
    victoryReputationBonus: toFiniteNumber(payload.victoryReputationBonus),
  };
}

export function applyEquipmentRatingBonuses(
  ratings: RiderRatings,
  effects: Pick<EquipmentEffects, "ratingBonuses"> &
    Partial<Pick<EquipmentEffects, "timeTrialRatingBonuses">>,
  options: { isTimeTrial?: boolean } = {}
): RiderRatings {
  const contextualBonuses = options.isTimeTrial
    ? combineRatingBonuses(
        effects.ratingBonuses,
        effects.timeTrialRatingBonuses ?? {}
      )
    : effects.ratingBonuses;

  return Object.fromEntries(
    Object.entries(ratings).map(([key, value]) => [
      key,
      Math.min(100, Math.max(0, value + (contextualBonuses[key as RiderRatingKey] ?? 0))),
    ])
  ) as RiderRatings;
}

export function isEquipmentFrozenForToday(now = new Date()): boolean {
  const hourPart = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;

  return Number(hourPart ?? 0) >= 12;
}

export function getEquipmentCategory(slot: EquipmentSlot) {
  return EQUIPMENT_CATEGORIES.find((category) => category.slot === slot)!;
}

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function combineRatingBonuses(
  first: Partial<Record<RiderRatingKey, number>>,
  second: Partial<Record<RiderRatingKey, number>>
) {
  const combined = { ...first };

  for (const [key, value] of Object.entries(second)) {
    const ratingKey = key as RiderRatingKey;
    combined[ratingKey] = (combined[ratingKey] ?? 0) + Number(value ?? 0);
  }

  return combined;
}
