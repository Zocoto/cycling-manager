"use server";

import { settleDueOfficialRaceRewardsAction } from "@/app/jeu/actions";

export async function settleOfficialRaceResultsAction() {
  return settleDueOfficialRaceRewardsAction();
}
