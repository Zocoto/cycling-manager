export const WEIGHT_PROGRAM_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const;
export const WEIGHT_PROGRAM_FORM_COST_PER_KG = 20;
export const WEIGHT_PROGRAM_COOLDOWN_DAYS = 5;
export type WeightProgramDraft = { riderId: string; weightDeltaKg: number };
export type WeightProgramRider = {
  riderId: string; heightCm: number | null; weightKg: number | null; form: number;
  cooldownDays: number;
};
export function getWeightProgramCooldownDays(previousDate: string | null, currentDate: string) {
  if (!previousDate) return 0;
  const elapsed = (Date.parse(currentDate.slice(0, 10)) - Date.parse(previousDate.slice(0, 10))) / 86_400_000;
  return Number.isFinite(elapsed) ? Math.max(0, WEIGHT_PROGRAM_COOLDOWN_DAYS - Math.floor(elapsed)) : 0;
}
export function getWeightProgramQuote(rider: WeightProgramRider, delta: number, supplementFormGain = 0) {
  const formCost = Math.round(Math.abs(delta) * WEIGHT_PROGRAM_FORM_COST_PER_KG);
  const formBefore = Math.min(100, rider.form + supplementFormGain);
  const weightAfterKg = rider.weightKg === null ? null : Math.round((rider.weightKg + delta) * 10) / 10;
  const minimum = rider.heightCm === null ? Infinity : Math.max(45, Math.round(18 * (rider.heightCm / 100) ** 2 * 10) / 10);
  const allowed = WEIGHT_PROGRAM_STEPS.some(step => Math.abs(delta) === step) &&
    rider.cooldownDays <= 0 && rider.heightCm !== null && weightAfterKg !== null &&
    (delta > 0 ? weightAfterKg <= 120 : weightAfterKg >= minimum) && formBefore >= formCost;
  return { allowed, formCost, weightAfterKg, formAfter: Math.max(0, formBefore - formCost) };
}
