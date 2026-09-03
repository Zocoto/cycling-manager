import "server-only";

import {
  canRespondToInternationalSelection,
  shouldDisplayInternationalSelection,
  type InternationalSelectionDecisionStatus,
} from "@/lib/game/international-championship-selections";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type InternationalSelectionResponseStatus =
  InternationalSelectionDecisionStatus;

export type InternationalChampionshipSelection = {
  candidateId: string;
  riderId: string;
  riderName: string;
  riderRank: number;
  uciPoints: number;
  overallRating: number;
  responseStatus: InternationalSelectionResponseStatus;
  isSelected: boolean;
  wasSelected: boolean;
  respondedAt: string | null;
  countryName: string;
  countryCode: string;
  nationRank: number;
  continentCode: string | null;
  championshipName: string;
  championshipSlug: string;
  competitionType: "continental_championship" | "world_championship";
  raceEditionId: string;
  dayNumber: number;
  departureAt: string;
  conflictingRaceNames: string[];
  conflictingCampNames: string[];
  canRespond: boolean;
};

type InternationalSelectionRow = {
  candidate_id: string;
  rider_id: string;
  rider_name: string;
  rider_rank: number;
  uci_points: number;
  overall_rating: number | string;
  response_status: InternationalSelectionResponseStatus;
  is_selected: boolean;
  was_selected: boolean;
  responded_at: string | null;
  country_name: string;
  country_code: string;
  nation_rank: number;
  continent_code: string | null;
  championship_name: string;
  championship_slug: string;
  competition_type: "continental_championship" | "world_championship";
  race_edition_id: string;
  day_number: number;
  departure_at: string;
  conflicting_race_names: string[] | null;
  conflicting_camp_names: string[] | null;
};

export async function processDueInternationalChampionshipSelections(
  now = new Date(),
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "process_due_international_championship_selections",
    { p_now: now.toISOString() },
  );

  if (error) {
    throw new Error(
      `Impossible de préparer les sélections internationales : ${error.message}`,
    );
  }

  const row = ((data as Array<{
    created_nation_selections: number;
    finalized_nation_selections: number;
  }> | null) ?? [])[0];

  let synchronizedFederationStartlists = 0;
  try {
    synchronizedFederationStartlists =
      await syncDueNationalFederationChampionshipLineups({
        now,
        force:
          (row?.created_nation_selections ?? 0) > 0 ||
          (row?.finalized_nation_selections ?? 0) > 0,
      });
  } catch (error) {
    console.error("federation_championship_startlist_sync_failed", error);
  }

  return {
    createdNationSelections: row?.created_nation_selections ?? 0,
    finalizedNationSelections: row?.finalized_nation_selections ?? 0,
    synchronizedFederationStartlists,
  };
}

export async function syncDueNationalFederationChampionshipLineups({
  now = new Date(),
  force = false,
}: {
  now?: Date;
  force?: boolean;
} = {}): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "sync_due_national_federation_championship_lineups",
    { p_now: now.toISOString(), p_force: force },
  );

  if (error) {
    throw new Error(
      `Impossible de synchroniser les startlists fédérales : ${error.message}`,
    );
  }

  return Number(data ?? 0);
}

export async function getCurrentDirectorInternationalSelections({
  authUserId,
  now = new Date(),
  processDue = true,
}: {
  authUserId: string;
  now?: Date;
  processDue?: boolean;
}): Promise<InternationalChampionshipSelection[]> {
  const admin = createSupabaseAdminClient();

  if (processDue) {
    await processDueInternationalChampionshipSelections(now);
  }

  const { data, error } = await admin.rpc(
    "get_international_championship_selections_for_auth_user",
    { p_auth_user_id: authUserId },
  );

  if (error) {
    throw new Error(
      `Impossible de charger les sélections internationales : ${error.message}`,
    );
  }

  return ((data as InternationalSelectionRow[] | null) ?? [])
    .map((selection): InternationalChampionshipSelection => ({
      candidateId: selection.candidate_id,
      riderId: selection.rider_id,
      riderName: selection.rider_name,
      riderRank: selection.rider_rank,
      uciPoints: selection.uci_points,
      overallRating: Number(selection.overall_rating),
      responseStatus: selection.response_status,
      isSelected: selection.is_selected,
      wasSelected: selection.was_selected,
      respondedAt: selection.responded_at,
      countryName: selection.country_name,
      countryCode: selection.country_code,
      nationRank: selection.nation_rank,
      continentCode: selection.continent_code,
      championshipName: selection.championship_name,
      championshipSlug: selection.championship_slug,
      competitionType: selection.competition_type,
      raceEditionId: selection.race_edition_id,
      dayNumber: selection.day_number,
      departureAt: selection.departure_at,
      conflictingRaceNames: selection.conflicting_race_names ?? [],
      conflictingCampNames: selection.conflicting_camp_names ?? [],
      canRespond: canRespondToInternationalSelection({
        isSelected: selection.is_selected,
        responseStatus: selection.response_status,
        departureAt: selection.departure_at,
        now,
      }),
    }))
    .filter(shouldDisplayInternationalSelection)
    .sort(
      (left, right) =>
        Date.parse(left.departureAt) - Date.parse(right.departureAt) ||
        left.riderRank - right.riderRank ||
        left.riderName.localeCompare(right.riderName, "fr"),
    );
}

export async function respondToInternationalChampionshipSelection({
  supabase,
  candidateId,
  accept,
  acknowledgedConflicts,
}: {
  supabase: SupabaseServerClient;
  candidateId: string;
  accept: boolean;
  acknowledgedConflicts: string[];
}) {
  const { error } = await supabase.rpc(
    "respond_to_international_selection_with_conflict_ack",
    {
      p_candidate_id: candidateId,
      p_accept: accept,
      p_acknowledged_conflicts: acknowledgedConflicts,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
