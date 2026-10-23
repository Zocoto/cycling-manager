import { z } from "zod";
import { GALA_PODIUM_PROPOSAL, getGalaEvent, type GalaProfile } from "./season-four-gala";

export const GALA_CONSUMABLE_KEYS = {
  capsule: "secondary-technique",
  training: "collective-training-200",
  form: "energy-ration",
  care: "injury-care-recovery-kit",
} as const;

export function getSeasonFourGalaPrize(profile: GalaProfile, rank: number) {
  if (!Number.isInteger(rank) || rank < 1 || rank > 10) throw new Error("Classement du gala invalide.");
  const podium = GALA_PODIUM_PROPOSAL.find(prize => prize.rank === rank);
  if (podium) return { equipmentKey: `gala-s4-${profile}-${podium.slot}`, consumables: [] };
  const consumables: { rewardKey: string; quantity: number }[] = [];
  if (rank === 4) consumables.push({ rewardKey: GALA_CONSUMABLE_KEYS.capsule, quantity: 1 });
  if (rank === 5) consumables.push({ rewardKey: GALA_CONSUMABLE_KEYS.training, quantity: 3 });
  consumables.push(
    { rewardKey: GALA_CONSUMABLE_KEYS.form, quantity: rank === 4 ? 3 : rank <= 7 ? 2 : 1 },
    { rewardKey: GALA_CONSUMABLE_KEYS.care, quantity: rank <= 5 ? 2 : 1 },
  );
  return { equipmentKey: null, consumables };
}

// Import only the verified top ten, excluding PCM's observer team. No official
// race, points, finances, condition or registration is changed by this import.
export const seasonFourGalaResultsSchema = z.object({
  eventKey: z.string().refine(key => Boolean(getGalaEvent(key))),
  results: z.array(z.object({
    rank: z.number().int().min(1).max(10),
    riderId: z.uuid(),
    teamId: z.uuid(),
  }).strict()).length(10),
}).strict().superRefine(({ results }, context) => {
  if (new Set(results.map(row => row.rank)).size !== 10 || new Set(results.map(row => row.riderId)).size !== 10) {
    context.addIssue({ code: "custom", message: "Les dix places et coureurs doivent être distincts." });
  }
});
