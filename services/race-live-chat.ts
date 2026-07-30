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

export async function getRaceLiveMessages(
  supabase: SupabaseServerClient,
  raceEditionId: string,
  limit = 40
): Promise<RaceLiveMessage[]> {
  const { data, error } = await supabase
    .from("race_live_messages")
    .select(
      "id, stage_id, race_edition_id, sporting_director_id, author_display_name, message, created_at"
    )
    .eq("race_edition_id", raceEditionId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RaceLiveMessageRow[]>();

  if (error) {
    throw new Error(
      `Impossible de charger le chat de course : ${error.message}`
    );
  }

  return (data ?? []).reverse().map(mapRaceLiveMessage);
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
