"use server";

import { settleDueOfficialRaceRewardsAction } from "@/app/jeu/actions";

export async function settleOfficialRaceResultsAction(raceSlug: string) {
  const normalizedRaceSlug = raceSlug.trim();
  if (!normalizedRaceSlug || normalizedRaceSlug.length > 160) {
    throw new Error("Course invalide.");
  }

  return settleDueOfficialRaceRewardsAction(normalizedRaceSlug);
}
