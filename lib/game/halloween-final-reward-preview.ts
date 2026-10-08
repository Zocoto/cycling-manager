import type { EquipmentSlot } from "./equipment";
import type { HalloweenPreviewArt } from "./halloween-catalog";
import { HALLOWEEN_FINAL_FRAME_EFFECTS, HALLOWEEN_FINAL_FRAME_IMAGE } from "./halloween-final-frame";

/** Private event specification. No inventory grant is performed by the preview. */
export const HALLOWEEN_FINAL_FRAME_PREVIEW = {
  id: "headless-domestique-frame",
  name: "Monture de l’équipier sans tête",
  slot: "frame" satisfies EquipmentSlot,
  art: "headless-frame" satisfies HalloweenPreviewArt,
  imagePath: HALLOWEEN_FINAL_FRAME_IMAGE,
  ratingBonuses: HALLOWEEN_FINAL_FRAME_EFFECTS.ratingBonuses,
  effectPayload: HALLOWEEN_FINAL_FRAME_EFFECTS,
  specialAbilityMultipliers: HALLOWEEN_FINAL_FRAME_EFFECTS.specialAbilityMultipliers,
  leaderProtection: {
    helperContributionMultiplier: HALLOWEEN_FINAL_FRAME_EFFECTS.leaderProtectionContributionMultiplier,
    minimumHelperEnergy: 12,
    requiresSameGroup: true,
    requiresEligibleSupportHelper: true,
    preservesExistingProtectionCaps: true,
  },
  award: { rank: 1, timing: "event-end", score: "best-validated-run", quantity: 1 },
  availability: "event-winner-only",
  purchasable: false,
  drawable: false,
  transferable: false,
  persistsAfterEvent: true,
  replacesExistingFrame: true,
  skin: { name: "Maillot de l’équipier sans tête", summary: "Cadre exclusif + skin unique" },
} as const;

export const HALLOWEEN_FINAL_FRAME_STAT_LABELS = [
  { key: "recovery", label: "REC" },
  { key: "resistance", label: "RES" },
  { key: "endurance", label: "END" },
  { key: "downhill", label: "DES" },
] as const;

export const HALLOWEEN_FINAL_FRAME_STATS_SUMMARY = HALLOWEEN_FINAL_FRAME_STAT_LABELS
  .map(({ key, label }) => `+${HALLOWEEN_FINAL_FRAME_PREVIEW.ratingBonuses[key]} ${label}`)
  .join(" · ");

export const HALLOWEEN_FINAL_FRAME_PROTECTION_PERCENT = Math.round(
  (HALLOWEEN_FINAL_FRAME_PREVIEW.leaderProtection.helperContributionMultiplier - 1) * 100,
);

/** Final top-five proposal only; deliberately separate from the daily podium and real grants. */
export const HALLOWEEN_FINAL_PRIZES_PREVIEW = [
  { rank: 1, wheels: 500, exclusiveFrame: true, shopItemId: null },
  { rank: 2, wheels: 300, exclusiveFrame: false, shopItemId: "mummy-resurrection" },
  { rank: 3, wheels: 200, exclusiveFrame: false, shopItemId: "full-moon-elixir" },
  { rank: 4, wheels: 120, exclusiveFrame: false, shopItemId: "lord-vlad" },
  { rank: 5, wheels: 80, exclusiveFrame: false, shopItemId: "halloween-background" },
] as const;

export function getHalloweenFinalPrizePreview(rank: number) {
  return HALLOWEEN_FINAL_PRIZES_PREVIEW.find((prize) => prize.rank === rank);
}
