export type TrainingRewardEffect = {
  effect_payload: Record<string, unknown>;
  starts_day_number: number;
  ends_day_number: number;
  consumed_day_number: number | null;
  status: "active" | "consumed";
};

// Match the session's selected bonus, not a stronger item queued afterwards.
export function getTrainingRewardMultiplierForDay(effects: readonly TrainingRewardEffect[], dayNumber: number): number {
  const consumed = effects.filter(effect => effect.status === "consumed" && effect.consumed_day_number === dayNumber);
  const candidates = consumed.length ? consumed : effects.filter(effect =>
    effect.status === "active" && effect.consumed_day_number === null
      && dayNumber >= effect.starts_day_number && dayNumber <= effect.ends_day_number);
  return candidates.reduce((best, effect) => {
    const multiplier = Number(effect.effect_payload.multiplier ?? 1);
    return Number.isFinite(multiplier) ? Math.max(best, Math.min(3, Math.max(1, multiplier))) : best;
  }, 1);
}
