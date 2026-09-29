export const DEFAULT_RIDER_MORALE = 60;

export type RiderMoraleBand =
  | "dejected"
  | "fragile"
  | "stable"
  | "confident"
  | "euphoric";

export type RiderMoraleEvent = {
  id: string;
  label: string;
  delta: number;
  moraleBefore: number;
  moraleAfter: number;
  occurredAt: string;
  sourceType: string;
};

export function normalizeRiderMorale(value: number | null | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_RIDER_MORALE;
  return Math.min(100, Math.max(0, Number(value)));
}

export function getRiderMoraleBand(value: number): RiderMoraleBand {
  const morale = normalizeRiderMorale(value);
  if (morale < 25) return "dejected";
  if (morale < 45) return "fragile";
  if (morale < 65) return "stable";
  if (morale < 80) return "confident";
  return "euphoric";
}

export function getRiderMoraleLabel(value: number) {
  return {
    dejected: "Abattu",
    fragile: "Fragile",
    stable: "Stable",
    confident: "Confiant",
    euphoric: "Euphorique",
  }[getRiderMoraleBand(value)];
}

/**
 * Morale changes execution, not physical capacity. The curve deliberately
 * makes low morale slightly more damaging than very high morale is helpful.
 * Form remains the dominant condition input through the rider's energy.
 */
export function getRiderMoraleExecutionBias(value: number) {
  const morale = normalizeRiderMorale(value);
  if (morale === DEFAULT_RIDER_MORALE) return 0;
  const centered = Math.tanh((morale - DEFAULT_RIDER_MORALE) / 22);
  const amplitude = centered < 0 ? 1.75 : 1.25;
  return round(centered * amplitude, 3);
}

export function getRiderTimeTrialMoraleExecutionBias(value: number) {
  return round(getRiderMoraleExecutionBias(value) * 0.5, 3);
}

function round(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
