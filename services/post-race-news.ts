import "server-only";

import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "@/lib/game/race-calendar";
import { buildPostRaceNewsEvents } from "@/lib/game/post-race-news";
import type { StageSimulationResult } from "@/lib/game/race-simulation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function persistPostRaceNewsEvents({
  admin,
  edition,
  stage,
  simulation,
}: {
  admin: AdminClient;
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  simulation: StageSimulationResult;
}) {
  const events = buildPostRaceNewsEvents({ edition, stage, simulation });
  if (events.length === 0) return;

  const { error } = await admin.from("post_race_news_events").upsert(
    events.map((event) => ({
      id: event.id,
      race_edition_id: event.raceEditionId,
      stage_id: event.stageId,
      event_kind: event.eventKind,
      title: event.title,
      detail: event.detail,
      featured_rider_id: event.featuredRiderId,
      featured_team_id: event.featuredTeamId,
      happened_at: event.happenedAt,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(
      `Impossible de publier le résumé de course : ${error.message}`
    );
  }
}
