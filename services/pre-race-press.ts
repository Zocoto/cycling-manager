import "server-only";

import {
  isPreRaceAmbition,
  isPreRaceIntent,
  type PendingPreRacePressConference,
  type PreRacePressConference,
} from "@/lib/game/pre-race-press";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ConferenceRow = {
  conference_id: string;
  team_name: string;
  director_name: string;
  leader_rider_id: string;
  leader_name: string;
  ambition: string;
  race_intent: string;
  public_statement: string;
  status: "published" | "settled";
  target_met: boolean | null;
  leader_final_rank: number | null;
  reputation_delta: number | null;
  submitted_at: string;
  is_own: boolean;
};

type PendingConferenceRow = {
  race_edition_id: string;
  race_slug: string;
  race_name: string;
  start_day_number: number;
};

export async function getPreRacePressConferences(
  supabase: SupabaseServerClient,
  raceEditionId: string,
): Promise<PreRacePressConference[]> {
  const { data, error } = await supabase.rpc("get_pre_race_press_conferences", {
    p_race_edition_id: raceEditionId,
  });
  if (error) {
    throw new Error(`Impossible de charger les conférences d’avant-course : ${error.message}`);
  }

  return ((data as ConferenceRow[] | null) ?? []).flatMap((row) =>
    isPreRaceAmbition(row.ambition) && isPreRaceIntent(row.race_intent)
      ? [{
          id: row.conference_id,
          teamName: row.team_name,
          directorName: row.director_name,
          leaderRiderId: row.leader_rider_id,
          leaderName: row.leader_name,
          ambition: row.ambition,
          raceIntent: row.race_intent,
          publicStatement: row.public_statement,
          status: row.status,
          targetMet: row.target_met,
          leaderFinalRank: row.leader_final_rank,
          reputationDelta: row.reputation_delta,
          submittedAt: row.submitted_at,
          isOwn: row.is_own,
        }]
      : [],
  );
}

export async function getPendingPreRacePressConferences(
  supabase: SupabaseServerClient,
): Promise<PendingPreRacePressConference[]> {
  const { data, error } = await supabase.rpc("get_current_team_pending_press_conferences");
  if (error) {
    throw new Error(`Impossible de charger les conférences à préparer : ${error.message}`);
  }
  return ((data as PendingConferenceRow[] | null) ?? []).map((row) => ({
    raceEditionId: row.race_edition_id,
    raceSlug: row.race_slug,
    raceName: row.race_name,
    startDayNumber: row.start_day_number,
  }));
}
