"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getStageLiveState } from "@/lib/game/race-live";
import type { SeasonRaceCalendar } from "@/lib/game/race-calendar";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { settleFinishedRaceResults } from "@/services/race-results";

export async function settleDueOfficialRaceRewardsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      processedStages: 0,
      completedEditions: 0,
      nextSettlementAt: null,
    };
  }

  const now = new Date();
  const calendar = await getActiveSeasonRaceCalendar(supabase, now);
  if (!calendar) {
    return {
      processedStages: 0,
      completedEditions: 0,
      nextSettlementAt: null,
    };
  }

  const settlement = await settleFinishedRaceResults(calendar, now);
  if (settlement.completedEditions > 0) {
    revalidatePath("/jeu", "layout");
  }

  return {
    ...settlement,
    nextSettlementAt: getNextSettlementAt(calendar, now),
  };
}

function getNextSettlementAt(calendar: SeasonRaceCalendar, now: Date) {
  const nowTimestamp = now.getTime();
  const timestamps = calendar.editions.flatMap((edition) => {
    if (edition.status === "completed" || edition.status === "cancelled") {
      return [];
    }

    const finalStage = [...edition.stages].sort(
      (left, right) => right.stageNumber - left.stageNumber
    )[0];
    if (!finalStage) return [];
    const state = getStageLiveState(finalStage, now);
    if (!state.endsAt) return [];
    const timestamp = new Date(state.endsAt).getTime();
    return Number.isFinite(timestamp) && timestamp > nowTimestamp
      ? [timestamp]
      : [];
  });

  const nextTimestamp = timestamps.sort((left, right) => left - right)[0];
  return nextTimestamp ? new Date(nextTimestamp).toISOString() : null;
}

export async function logoutAccount(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    console.error("Échec de la déconnexion Supabase :", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }

  redirect("/connexion");
}
