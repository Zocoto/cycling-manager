export type TrainingRewardEffect = {
  effect_payload: Record<string, unknown>;
  starts_day_number: number;
  ends_day_number: number;
  consumed_day_number: number | null;
  status: "active" | "consumed";
};

// Match the session's selected bonus, not a stronger item queued afterwards.
export function getTrainingRewardMultiplierForDay(effects: readonly TrainingRewardEffect[], dayNumber: number): number {
  let consumed = 1;
  let pending = 1;
  let hasConsumed = false;
  for (const effect of effects) {
    const selected = effect.status === "consumed" && effect.consumed_day_number === dayNumber;
    const available = effect.status === "active" && effect.consumed_day_number === null
      && dayNumber >= effect.starts_day_number && dayNumber <= effect.ends_day_number;
    if (!selected && !available) continue;
    const multiplier = Number(effect.effect_payload.multiplier ?? 1);
    const safeMultiplier = Number.isFinite(multiplier) ? Math.min(3, Math.max(1, multiplier)) : 1;
    if (selected) {
      hasConsumed = true;
      consumed = Math.max(consumed, safeMultiplier);
    } else {
      pending = Math.max(pending, safeMultiplier);
    }
  }
  return hasConsumed ? consumed : pending;
}
