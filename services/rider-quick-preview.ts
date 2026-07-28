import "server-only";

import {
  EMPTY_EQUIPMENT_EFFECTS,
  getEquipmentRatingBonusTotals,
} from "@/lib/game/equipment";
import {
  resolvePublicTeamName,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";
import {
  createExactTransferScoutingReport,
  createStandardTransferScoutingReport,
} from "@/lib/game/transfer-scouting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRiderEquipmentEffectsByRiderId } from "@/services/rider-equipment-effects";

type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  status: string;
  potential_steps: number;
};

type ActiveSeasonRow = {
  id: string;
};

type RatingRow = {
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type ActiveContractRow = {
  team_id: string;
};

type CountryRow = {
  name: string;
  iso_alpha2: string;
};

type TeamRow = {
  id: string;
  internal_name: string;
  amateur_name: string | null;
};

type TeamSeasonRow = {
  display_name: string;
};

export async function getRiderQuickPreview({
  riderIdentifier,
  viewerAuthUserId,
}: {
  riderIdentifier: string;
  viewerAuthUserId: string;
}): Promise<RiderQuickPreview | null> {
  const riderId = riderIdentifier.trim().toLowerCase();

  if (!isUuid(riderId)) return null;

  const supabase = createSupabaseAdminClient();
  const [riderResult, activeSeasonResult] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, status, potential_steps"
      )
      .eq("id", riderId)
      .maybeSingle<RiderRow>(),
    supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<ActiveSeasonRow>(),
  ]);

  assertQuery(riderResult.error, "le coureur");
  assertQuery(activeSeasonResult.error, "la saison active");

  const rider = riderResult.data;
  if (!rider) return null;

  const activeSeason = activeSeasonResult.data;
  const [
    countryResult,
    ratingResult,
    contractResult,
    listingResult,
    equipmentEffectsByRiderId,
  ] = await Promise.all([
      supabase
        .from("countries")
        .select("name, iso_alpha2")
        .eq("id", rider.country_id)
        .maybeSingle<CountryRow>(),
      activeSeason
        ? supabase
            .from("rider_season_ratings")
            .select(
              "age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue"
            )
            .eq("rider_id", rider.id)
            .eq("season_id", activeSeason.id)
            .maybeSingle<RatingRow>()
        : Promise.resolve({ data: null as RatingRow | null, error: null }),
      supabase
        .from("rider_contracts")
        .select("team_id")
        .eq("rider_id", rider.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle<ActiveContractRow>(),
      supabase
        .from("transfer_market_listings")
        .select("id")
        .eq("rider_id", rider.id)
        .eq("status", "open")
        .limit(1)
        .maybeSingle<{ id: string }>(),
      getRiderEquipmentEffectsByRiderId([rider.id]),
    ]);

  assertQuery(countryResult.error, "le pays du coureur");
  assertQuery(ratingResult.error, "les statistiques du coureur");
  assertQuery(contractResult.error, "l’équipe du coureur");
  assertQuery(listingResult.error, "le statut de transfert du coureur");

  if (!countryResult.data) {
    throw new Error("Le pays du coureur est introuvable.");
  }

  const contract = contractResult.data;
  const [teamResult, teamSeasonResult, canManage] = contract
    ? await Promise.all([
        supabase
          .from("teams")
          .select("id, internal_name, amateur_name")
          .eq("id", contract.team_id)
          .maybeSingle<TeamRow>(),
        activeSeason
          ? supabase
              .from("team_seasons")
              .select("display_name")
              .eq("team_id", contract.team_id)
              .eq("season_id", activeSeason.id)
              .maybeSingle<TeamSeasonRow>()
          : Promise.resolve({
              data: null as TeamSeasonRow | null,
              error: null,
            }),
        viewerManagesTeam({
          viewerAuthUserId,
          teamId: contract.team_id,
        }),
      ])
    : [
        { data: null as TeamRow | null, error: null },
        { data: null as TeamSeasonRow | null, error: null },
        false,
      ];

  assertQuery(teamResult.error, "l’identité de l’équipe");
  assertQuery(teamSeasonResult.error, "la saison de l’équipe");

  const exactRatings = ratingResult.data ? toRatings(ratingResult.data) : null;
  const mustUseScouting =
    !canManage &&
    (rider.status === "free_agent" || Boolean(listingResult.data)) &&
    Boolean(exactRatings);
  const ratings =
    exactRatings && activeSeason
      ? mustUseScouting
        ? createStandardTransferScoutingReport({
            riderId: rider.id,
            seasonId: activeSeason.id,
            ratings: exactRatings,
            potentialSteps: rider.potential_steps,
          }).ratings
        : createExactTransferScoutingReport({
            ratings: exactRatings,
            potentialSteps: rider.potential_steps,
          }).ratings
      : null;
  const equipmentRatingBonuses = getEquipmentRatingBonusTotals(
    equipmentEffectsByRiderId.get(rider.id) ?? EMPTY_EQUIPMENT_EFFECTS,
  );

  return {
    id: rider.id,
    name: `${rider.first_name} ${rider.last_name}`.trim(),
    age: ratingResult.data?.age ?? null,
    country: {
      name: countryResult.data.name,
      code: countryResult.data.iso_alpha2,
    },
    team:
      contract && teamResult.data
        ? {
            id: teamResult.data.id,
            name: resolvePublicTeamName({
              seasonDisplayName: teamSeasonResult.data?.display_name,
              amateurName: teamResult.data.amateur_name,
              internalName: teamResult.data.internal_name,
            }),
          }
        : null,
    ratings,
    equipmentRatingBonuses,
    ratingVisibility: ratings
      ? mustUseScouting
        ? "scouted"
        : "exact"
      : "unavailable",
  };
}

async function viewerManagesTeam({
  viewerAuthUserId,
  teamId,
}: {
  viewerAuthUserId: string;
  teamId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", viewerAuthUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(directorError, "le Directeur Sportif connecté");
  if (!director) return false;

  const { data: assignment, error: assignmentError } = await supabase
    .from("team_manager_assignments")
    .select("id")
    .eq("sporting_director_id", director.id)
    .eq("team_id", teamId)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(assignmentError, "l’affectation du Directeur Sportif");

  return Boolean(assignment);
}

function toRatings(row: RatingRow): RiderRatings {
  return {
    mountain: row.mountain,
    hills: row.hills,
    recovery: row.recovery,
    endurance: row.endurance,
    resistance: row.resistance,
    breakaway: row.breakaway,
    downhill: row.downhill,
    acceleration: row.acceleration,
    sprint: row.sprint,
    flat: row.flat,
    cobbles: row.cobbles,
    prologue: row.prologue,
    timeTrial: row.time_trial,
  };
}

function assertQuery(
  error: { message: string } | null,
  label: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
