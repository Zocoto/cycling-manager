import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type RaceLiveMessage = {
  id: string;
  stageId: string;
  raceEditionId: string;
  sportingDirectorId: string;
  authorDisplayName: string;
  message: string;
  createdAt: string;
};

type RaceLiveMessageRow = {
  id: string;
  stage_id: string;
  race_edition_id: string;
  sporting_director_id: string;
  author_display_name: string;
  message: string;
  created_at: string;
};

type RaceContextGlobalMessageRow = {
  id: string;
  source_stage_id: string;
  source_race_edition_id: string;
  sporting_director_id: string;
  author_display_name: string;
  message: string;
  created_at: string;
};

export async function getRaceLiveMessages(
  supabase: SupabaseServerClient,
  raceEditionId: string,
  limit = 40
): Promise<RaceLiveMessage[]> {
  const [legacyResult, globalResult] = await Promise.all([
    supabase
      .from("race_live_messages")
      .select(
        "id, stage_id, race_edition_id, sporting_director_id, author_display_name, message, created_at",
      )
      .eq("race_edition_id", raceEditionId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RaceLiveMessageRow[]>(),
    supabase
      .from("global_chat_messages")
      .select(
        "id, source_stage_id, source_race_edition_id, sporting_director_id, author_display_name, message, created_at",
      )
      .eq("source_race_edition_id", raceEditionId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RaceContextGlobalMessageRow[]>(),
  ]);

  if (legacyResult.error && globalResult.error) {
    throw new Error(
      `Impossible de charger le chat de course : ${globalResult.error.message}`,
    );
  }

  if (legacyResult.error) {
    console.error("Historique du chat de course indisponible :", legacyResult.error);
  }
  if (globalResult.error) {
    console.error("Messages de course du fil général indisponibles :", globalResult.error);
  }

  return [
    ...(legacyResult.data ?? []).map(mapRaceLiveMessage),
    ...(globalResult.data ?? []).map(mapRaceContextGlobalMessage),
  ]
    .sort(
      (first, second) =>
        first.createdAt.localeCompare(second.createdAt) ||
        first.id.localeCompare(second.id),
    )
    .slice(-limit);
}

export function mapRaceContextGlobalMessage(
  row: RaceContextGlobalMessageRow,
): RaceLiveMessage {
  return {
    id: row.id,
    stageId: row.source_stage_id,
    raceEditionId: row.source_race_edition_id,
    sportingDirectorId: row.sporting_director_id,
    authorDisplayName: row.author_display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

export function mapRaceLiveMessage(
  row: RaceLiveMessageRow
): RaceLiveMessage {
  return {
    id: row.id,
    stageId: row.stage_id,
    raceEditionId: row.race_edition_id,
    sportingDirectorId: row.sporting_director_id,
    authorDisplayName: row.author_display_name,
    message: row.message,
    createdAt: row.created_at,
  };
}
