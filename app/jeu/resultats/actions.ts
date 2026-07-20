"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export async function settleOfficialRaceResultsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Vous devez être connecté pour actualiser les résultats.");
  }

  const now = new Date();
  const calendar = await getActiveSeasonRaceCalendar(supabase, now);
  if (!calendar) return { processedStages: 0, completedEditions: 0 };

  const settlement = await settleFinishedRaceResults(calendar, now);
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu/classements");
  revalidatePath("/jeu/finances");
  return settlement;
}
