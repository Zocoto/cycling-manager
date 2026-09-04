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

  const featuredTeamIds = [
    ...new Set(
      events.flatMap((event) =>
        event.featuredTeamId ? [event.featuredTeamId] : [],
      ),
    ),
  ];
  const existingTeams = featuredTeamIds.length
    ? await admin.from("teams").select("id").in("id", featuredTeamIds)
    : { data: [] as Array<{ id: string }>, error: null };
  if (existingTeams.error) {
    throw new Error(
      `Impossible de vérifier l’équipe du résumé de course : ${existingTeams.error.message}`,
    );
  }
  const existingTeamIds = new Set(
    (existingTeams.data ?? []).map((team) => team.id),
  );

  const { error } = await admin.from("post_race_news_events").upsert(
    events.map((event) => ({
      id: event.id,
      race_edition_id: event.raceEditionId,
      stage_id: event.stageId,
      event_kind: event.eventKind,
      title: event.title,
      detail: event.detail,
      featured_rider_id: event.featuredRiderId,
      // Les sélections nationales et les équipes de détection utilisent une
      // identité d'affichage qui n'est pas forcément une ligne de `teams`.
      featured_team_id:
        event.featuredTeamId && existingTeamIds.has(event.featuredTeamId)
          ? event.featuredTeamId
          : null,
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
