export const MAX_SCOUTING_SUPERVISION_PERCENTAGE = 100;

export type ScoutingSupervisionEffect = {
  percentage: number;
  startsDayNumber: number;
  endsDayNumber: number;
};

export type ScoutingSupervisionStatus = {
  currentPercentage: number;
  stableThroughDayNumber: number | null;
  remainingDays: number;
  effects: ScoutingSupervisionEffect[];
};

export const EMPTY_SCOUTING_SUPERVISION_STATUS: ScoutingSupervisionStatus = {
  currentPercentage: 0,
  stableThroughDayNumber: null,
  remainingDays: 0,
  effects: [],
};

export function getScoutingSupervisionPercentageForDay(
  effects: readonly ScoutingSupervisionEffect[],
  dayNumber: number,
): number {
  if (!Number.isFinite(dayNumber)) return 0;

  return Math.min(
    MAX_SCOUTING_SUPERVISION_PERCENTAGE,
    effects.reduce((total, effect) => {
      if (
        dayNumber < effect.startsDayNumber ||
        dayNumber > effect.endsDayNumber
      ) {
        return total;
      }
      return total + normalizePercentage(effect.percentage);
    }, 0),
  );
}

export function getScoutingSupervisionStatus(
  effects: readonly ScoutingSupervisionEffect[],
  currentDayNumber: number,
): ScoutingSupervisionStatus {
  const activeEffects = effects.filter(
    (effect) =>
      effect.startsDayNumber <= currentDayNumber &&
      effect.endsDayNumber >= currentDayNumber &&
      normalizePercentage(effect.percentage) > 0,
  );
  const stableThroughDayNumber = activeEffects.length
    ? Math.min(...activeEffects.map((effect) => effect.endsDayNumber))
    : null;

  return {
    currentPercentage: getScoutingSupervisionPercentageForDay(
      activeEffects,
      currentDayNumber,
    ),
    stableThroughDayNumber,
    remainingDays:
      stableThroughDayNumber === null
        ? 0
        : Math.max(0, stableThroughDayNumber - currentDayNumber + 1),
    effects: [...effects],
  };
}

export function normalizeScoutingSupervisionEffects(
  value: unknown,
): ScoutingSupervisionEffect[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): ScoutingSupervisionEffect[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const payload = readObject(row.effect_payload ?? row.effectPayload);
    const percentage = normalizePercentage(
      row.percentage ?? payload.percentage,
    );
    const startsDayNumber = readInteger(
      row.starts_day_number ?? row.startsDayNumber,
    );
    const endsDayNumber = readInteger(
      row.ends_day_number ?? row.endsDayNumber,
    );
    if (
      percentage <= 0 ||
      startsDayNumber < 1 ||
      endsDayNumber < startsDayNumber
    ) {
      return [];
    }
    return [{ percentage, startsDayNumber, endsDayNumber }];
  });
}

function normalizePercentage(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_SCOUTING_SUPERVISION_PERCENTAGE, Math.max(0, parsed));
}

function readInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
