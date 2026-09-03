import "server-only";

import { unstable_cache } from "next/cache";

import { SPONSORS } from "@/data/sponsors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createNationalTeamRiderJersey,
  createSponsoredRiderJersey,
  type RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import {
  consolidateNationalChampionshipEvents,
  getEffectiveSeasonDay,
  isRaceCategoryCode,
  isRaceDaySlot,
  type RaceCalendarEdition,
  type RaceCalendarStage,
  type RaceCompetitionType,
  type RaceFormat,
  type RaceProfileType,
  type RaceStageStatus,
  type RaceStageType,
  type RegistrationPolicy,
  type SeasonCalendarDay,
  type SeasonCalendarEvent,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import type { RiderRatings } from "@/lib/game/rider-profile";
import {
  isRiderSpecialAbility,
  type RiderSpecialAbility,
} from "@/lib/game/special-abilities";
import type { RaceRole } from "@/lib/game/race-simulation";
import type {
  RaceAttackOrder,
  RaceBreakawayPolicy,
  RaceChasePolicy,
  RaceCollectivePosture,
  RaceStrategyObjective,
  RaceTeamStrategy,
} from "@/lib/game/race-strategy";
import type {
  TimeTrialEffortMode,
  TimeTrialRiderPlan,
} from "@/lib/game/time-trial-preparation";
import {
  combineEquipmentEffects,
  normalizeEquipmentEffects,
  type EquipmentEffects,
} from "@/lib/game/equipment";
import {
  ensureCompleteRaceSegments,
  removeOneDayRaceMountainPrimes,
  resolveRaceProfileType,
} from "@/lib/game/race-profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TeamDivisionCode } from "@/lib/game/economy";
import { canTeamAccessRaceCategory } from "@/lib/game/regional-races";
import {
  chunkValues,
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";
import { getCurrentTeamDivisionForAuthUser } from "@/services/team-divisions";
import { loadNationalFederationJerseyDesigns } from "@/services/national-federation-jerseys";
import {
  loadRaceStaffEffects,
  type RaceStaffEffects,
  type TeamRaceStaffEffects,
} from "@/services/staff-race-effects";
import {
  getActiveNationalChampionshipTitlesByDisciplineForRiders,
  getActiveWorldChampionshipTitlesByDisciplineForRiders,
  type ActiveWorldChampionshipTitlesByDiscipline,
  type ActiveNationalChampionshipTitlesByDiscipline,
} from "@/services/rider-national-championship-titles";
import {
  getActiveContinentalChampionshipTitlesByDisciplineForRiders,
  parseContinentalChampionshipTitleType,
  type ActiveContinentalChampionshipTitlesByDiscipline,
} from "@/services/rider-continental-championship-titles";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
  starts_on: string;
  ends_on: string;
  current_day_number: number | null;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
  calendar_date: string;
  label: string | null;
};

type SeasonEventRow = {
  id: string;
  season_day_id: string;
  event_type: SeasonCalendarEvent["eventType"];
  title: string;
  description: string | null;
  href: string | null;
};

type RaceEditionRow = {
  id: string;
  race_id: string;
  race_category_id: string;
  display_name: string;
  status: string;
  registration_closes_at: string | null;
  wildcard_closes_at: string | null;
  withdrawal_closes_at: string | null;
  minimum_reputation: number | null;
  registration_policy: RegistrationPolicy;
  field_limit: number | null;
};

type RaceRow = {
  id: string;
  country_id: string;
  name: string;
  short_name: string | null;
  race_format: RaceFormat;
  slug: string;
  competition_type: RaceCompetitionType;
  is_grand_tour: boolean;
};

type RaceCategoryRow = {
  id: string;
  code: string;
  name: string;
  prestige_rank: number;
  minimum_roster_size: number | null;
  maximum_roster_size: number | null;
};

type SponsorObjectiveRaceRow = {
  race_edition_id: string;
};

type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
  stage_type: RaceStageType;
  status: RaceStageStatus;
  profile_type: RaceProfileType;
  distance_km: number | string;
  departure_at: string | null;
  day_slot: string;
};

type StageSegmentRow = {
  id: string;
  stage_id: string;
  segment_number: number;
  distance_km: number | string;
  terrain_type: "flat" | "climb" | "descent";
  surface_type: "asphalt" | "cobbles";
  average_gradient_pct: number | string;
  stage_segment_primes: StageSegmentPrimeRow[];
};

type StageSegmentPrimeRow = {
  prime_type: "mountain" | "intermediate_sprint";
  mountain_category: "HC" | "1" | "2" | "3" | "4" | null;
  points_scale: number[];
};

type StageReconnaissanceRow = {
  id: string;
  target_stage_id: string;
  bonus_points: number | string;
};

type StageReconnaissanceRiderRow = {
  reconnaissance_id: string;
  rider_id: string;
};

type StageRoleOverrideRow = {
  stage_id: string;
  rider_id: string;
  race_role: RaceRole;
};

type StageStrategyRow = {
  stage_id: string;
  team_id: string;
  objective: RaceStrategyObjective;
  collective_posture: RaceCollectivePosture;
  breakaway_policy: RaceBreakawayPolicy;
  chase_policy: RaceChasePolicy;
  lieutenant_rider_id: string | null;
  danger_pacer_rider_id: string | null;
  protector_rider_id: string | null;
  breakaway_rider_id: string | null;
  attack_orders: RaceAttackOrder[];
};

type TimeTrialPlanRow = {
  stage_id: string;
  rider_id: string;
  effort_mode: TimeTrialEffortMode;
  relay_share_pct: number | string | null;
  updated_at: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
  continent_code: string | null;
};

type RegionalRaceContextRow = {
  team_continent_code: string | null;
  is_amateur: boolean;
};

type SportingDirectorReputationRow = {
  reputation_points: number;
};

type RaceRegistrationRow = {
  registration_id: string;
  registration_status: "pending" | "accepted" | "rejected" | "withdrawn";
  registration_registered_at: string | null;
  roster_count: number;
  withdrawal_closes_at: string | null;
};

type CalendarRegistrationRow = {
  race_edition_id: string;
  registration_status: CurrentRaceRegistration["status"];
  roster_count: number;
};

type CalendarEngagedRiderRow = {
  race_edition_id: string;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  team_id: string;
  team_name: string;
  team_primary_color: string;
  team_secondary_color: string;
  age: number;
  form: number;
  race_role: RaceCalendarEdition["engagedRiders"][number]["role"];
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
  equipment_effects: unknown;
};

type RiderPerformancePreparationRow = {
  rider_id: string;
  preparation_type: "indoor_track" | "wind_tunnel";
  bonus_start_game_day: number;
  bonus_end_game_day: number;
  rating_bonus: number;
};

type CalendarStageEquipmentEffectsRow = {
  race_edition_id: string;
  stage_id: string;
  rider_id: string;
  team_id: string;
  equipment_effects: unknown;
};

type CalendarEngagedCountRow = {
  race_edition_id: string;
  engaged_rider_count: number;
};

type ActiveTeamSponsorContractRow = {
  team_id: string;
  sponsor_id: string;
  selected_jersey_id: string | null;
  created_at: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

export type RaceTeamSponsorVisual = {
  primaryColor: string;
  secondaryColor: string;
  jersey: RiderJerseyAppearance;
};

type ActiveSeasonCalendarLoadOptions = {
  raceSlug?: string;
  raceEditionIds?: readonly string[];
  includeCancelledEditions?: boolean;
  includeEngagedCounts?: boolean;
  includeEngagedRiders?: boolean;
  includeIneligibleRegionalRaces?: boolean;
};

type RiderCountryRow = {
  id: string;
  country_id: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  career_race_days: number;
};

type RiderSpecialAbilityRow = {
  rider_id: string;
  ability_code: string;
};

type RaceCalendarRiderContextRow = RiderCountryRow & {
  special_ability_codes: unknown;
  performance_preparations: unknown;
  championship_titles: unknown;
};

type RaceCalendarChampionshipTitleRow = {
  rider_id: string;
  championship_type: string;
  country_code: string | null;
  country_name: string | null;
};

export type CurrentRaceRegistration = {
  id: string;
  status: RaceRegistrationRow["registration_status"];
  registeredAt: string | null;
  rosterCount: number;
  withdrawalClosesAt: string | null;
};

export type CurrentRaceUserContext = {
  reputationPoints: number;
  divisionCode: TeamDivisionCode;
  registration: CurrentRaceRegistration | null;
};

export type RacePastWinner = {
  gameYear: number;
  seasonName: string;
  finalRank: number;
  riderId: string;
  riderName: string;
  teamName: string;
};

type RacePastWinnerRow = {
  game_year: number;
  season_name: string;
  final_rank: number;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  team_name: string;
};

export type RaceRosterOption = {
  riderId: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  timeTrial: number;
  cobbles: number;
  sprint: number;
  form: number;
  isSelected: boolean;
  isAvailable: boolean;
  unavailability: {
    type: "injury" | "form_camp" | "reconnaissance" | "race";
    label: string;
    until: string | null;
  } | null;
  conflict: {
    raceSlug: string;
    raceName: string;
    startDay: number;
    endDay: number;
  } | null;
};

export type RaceStageRolePlanRider = {
  riderId: string;
  generalRole: RaceRole;
  stageRoles: Record<string, RaceRole>;
};

export type RacePreparationRider = RaceStageRolePlanRider & {
  firstName: string;
  lastName: string;
  ratings: RiderRatings;
  timeTrialPlans: Record<string, TimeTrialRiderPlan>;
};

export type RaceStagePreparationPlan = RaceTeamStrategy & {
  updatedAt: string | null;
  timeTrialUpdatedAt: string | null;
};

export type RacePreparationEditionPlan = {
  editionId: string;
  registrationId: string;
  teamId: string;
  riders: RacePreparationRider[];
  stages: Record<string, RaceStagePreparationPlan>;
};

type RaceStageRolePlanRow = {
  rider_id: string;
  stage_id: string;
  general_role: RaceRole;
  stage_role: RaceRole | null;
};

type RacePreparationRow = {
  race_edition_id: string;
  race_registration_id: string;
  team_id: string;
  stage_id: string;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
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
  general_role: RaceRole;
  stage_role: RaceRole | null;
  time_trial_effort: TimeTrialEffortMode | null;
  relay_share_pct: number | string | null;
  time_trial_updated_at: string | null;
  objective: RaceStrategyObjective;
  collective_posture: RaceCollectivePosture;
  breakaway_policy: RaceBreakawayPolicy;
  chase_policy: RaceChasePolicy;
  lieutenant_rider_id: string | null;
  danger_pacer_rider_id: string | null;
  protector_rider_id: string | null;
  breakaway_rider_id: string | null;
  attack_orders: RaceAttackOrder[];
  strategy_updated_at: string | null;
};

type RaceRosterOptionRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_name: string;
  country_iso_alpha2: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  current_form: number | string;
  is_selected: boolean;
  is_available: boolean;
  unavailability_type:
    "injury" | "form_camp" | "reconnaissance" | "race" | null;
  unavailability_label: string | null;
  unavailable_until: string | null;
  conflicting_race_slug: string | null;
  conflicting_race_name: string | null;
  conflicting_start_day: number | null;
  conflicting_end_day: number | null;
};

export type RaceEngagedRider = {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamCountryCode: string;
  riderId: string;
  riderName: string;
  countryCode: string;
};

type RaceEngagedRiderRow = {
  team_id: string;
  team_name: string;
  team_short_name: string | null;
  team_country_iso_alpha2: string;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  country_iso_alpha2: string;
};

export async function getActiveSeasonRaceCalendar(
  supabase: SupabaseServerClient,
  now = new Date(),
  options: ActiveSeasonCalendarLoadOptions = {},
): Promise<SeasonRaceCalendar | null> {
  if (options.raceSlug && options.raceEditionIds !== undefined) {
    throw new Error(
      "Le calendrier ne peut pas être ciblé à la fois par course et par édition.",
    );
  }

  const scopedRaceEditionIds =
    options.raceEditionIds === undefined
      ? null
      : unique(options.raceEditionIds.filter(Boolean));

  const seasonResult = await supabase
    .from("seasons")
    .select(
      `
          id,
          game_year,
          name,
          starts_on,
          ends_on,
          current_day_number
        `,
    )
    .eq("status", "active")
    .maybeSingle<SeasonRow>();

  const { data: season, error: seasonError } = seasonResult;

  if (seasonError) {
    throw new Error(
      `Impossible de charger la saison active : ${seasonError.message}`,
    );
  }

  if (!season) {
    return null;
  }

  const scopedRaceResult = options.raceSlug
    ? await supabase
        .from("races")
        .select("id")
        .eq("slug", options.raceSlug)
        .maybeSingle<{ id: string }>()
    : null;

  if (scopedRaceResult?.error) {
    throw new Error(
      `Impossible de charger la course demandée : ${scopedRaceResult.error.message}`,
    );
  }

  if (options.raceSlug && !scopedRaceResult?.data) {
    return null;
  }

  const includeEngagedRiders = options.includeEngagedRiders !== false;
  const includeEngagedCounts =
    !includeEngagedRiders && options.includeEngagedCounts !== false;

  const fetchEditionsPage = async (
    from: number,
    to: number,
    editionIdChunk: string[] | null = scopedRaceEditionIds,
  ) => {
    let editionsQuery = supabase
      .from("race_editions")
      .select(
        `
          id,
          race_id,
          race_category_id,
          display_name,
          status,
          registration_closes_at,
          withdrawal_closes_at,
          wildcard_closes_at,
          minimum_reputation,
          registration_policy,
          field_limit
        `,
      )
      .eq("season_id", season.id);

    if (!options.includeCancelledEditions) {
      editionsQuery = editionsQuery.neq("status", "cancelled");
    }

    if (scopedRaceResult?.data) {
      editionsQuery = editionsQuery.eq("race_id", scopedRaceResult.data.id);
    }

    if (editionIdChunk) {
      editionsQuery = editionsQuery.in("id", editionIdChunk);
    }

    const result = await editionsQuery
      .order("id", { ascending: true })
      .range(from, to)
      .returns<RaceEditionRow[]>();
    return { data: result.data, error: result.error };
  };

  const [
    daysResult,
    editionsResult,
    registrationsResult,
    sponsorObjectivesResult,
    regionalRaceContextResult,
    earlyEngagedCountsResult,
  ] = await Promise.all([
    supabase
      .from("season_days")
      .select("id, day_number, calendar_date, label")
      .eq("season_id", season.id)
      .order("day_number", {
        ascending: true,
      })
      .returns<SeasonDayRow[]>(),

    scopedRaceEditionIds
      ? collectChunkedPaginatedRows<
          RaceEditionRow,
          { message: string },
          string
        >({
          values: scopedRaceEditionIds,
          chunkSize: URL_SAFE_UUID_FILTER_CHUNK_SIZE,
          fetchPage: (editionIdChunk, from, to) =>
            fetchEditionsPage(from, to, editionIdChunk),
        })
      : collectPaginatedRows<RaceEditionRow, { message: string }>({
          fetchPage: (from, to) => fetchEditionsPage(from, to, null),
        }),

    supabase.rpc("get_current_team_calendar_registrations"),
    supabase.rpc("get_current_team_sponsor_objective_races"),
    options.includeIneligibleRegionalRaces
      ? Promise.resolve({ data: null, error: null })
      : supabase.rpc("get_current_team_regional_race_context"),
    includeEngagedCounts
      ? collectPaginatedRows<CalendarEngagedCountRow, { message: string }>({
          fetchPage: async (from, to) => {
            const result = await supabase
              .rpc("get_active_calendar_engaged_counts")
              .range(from, to);
            return {
              data: result.data as CalendarEngagedCountRow[] | null,
              error: result.error,
            };
          },
        })
      : Promise.resolve(null),
  ]);

  if (daysResult.error) {
    throw new Error(
      `Impossible de charger les journées de saison : ${daysResult.error.message}`,
    );
  }

  if (editionsResult.error) {
    throw new Error(
      `Impossible de charger les éditions de course : ${editionsResult.error.message}`,
    );
  }

  if (registrationsResult.error) {
    throw new Error(
      `Impossible de charger les inscriptions du calendrier : ${registrationsResult.error.message}`,
    );
  }
  if (sponsorObjectivesResult.error) {
    throw new Error(
      `Impossible de charger les objectifs sponsor : ${sponsorObjectivesResult.error.message}`,
    );
  }
  if (regionalRaceContextResult.error) {
    throw new Error(
      `Impossible de vérifier l’éligibilité aux courses régionales : ${regionalRaceContextResult.error.message}`,
    );
  }

  const editionRows = editionsResult.data ?? [];
  const editionIds = editionRows.map((edition) => edition.id);
  const sponsorObjectiveEditionIds = new Set(
    (
      (sponsorObjectivesResult.data as SponsorObjectiveRaceRow[] | null) ?? []
    ).map((objective) => objective.race_edition_id),
  );
  const regionalRaceContext = options.includeIneligibleRegionalRaces
    ? null
    : (((regionalRaceContextResult.data as RegionalRaceContextRow[] | null) ??
        [])[0] ?? null);
  // Les RPC sont plafonnées à 1 000 lignes par PostgREST : on pagine pour ne
  // jamais tronquer les startlists (source des simulations officielles).
  const engagedRidersResult = includeEngagedRiders && editionIds.length > 0
    ? await loadCalendarEngagedRiders(supabase, editionIds, {
        isScoped:
          Boolean(scopedRaceResult?.data) || scopedRaceEditionIds !== null,
      })
    : null;
  const stageEquipmentEffectsResult =
    includeEngagedRiders && editionIds.length > 0
      ? await collectPaginatedRows<
          CalendarStageEquipmentEffectsRow,
          { message: string }
        >({
          fetchPage: async (from, to) => {
            const result = await supabase
              .rpc("get_active_calendar_stage_equipment_effects", {
                p_race_edition_ids: editionIds,
              })
              .range(from, to);
            return {
              data: result.data as CalendarStageEquipmentEffectsRow[] | null,
              error: result.error,
            };
          },
        })
      : null;
  const engagedCountsResult = earlyEngagedCountsResult;

  if (engagedRidersResult?.error) {
    throw new Error(
      `Impossible de charger les coureurs engagés : ${engagedRidersResult.error.message}`,
    );
  }

  if (stageEquipmentEffectsResult?.error) {
    throw new Error(
      `Impossible de charger les montages par étape : ${stageEquipmentEffectsResult.error.message}`,
    );
  }

  if (engagedCountsResult?.error) {
    throw new Error(
      `Impossible de charger le nombre de coureurs engagés : ${engagedCountsResult.error.message}`,
    );
  }

  const engagedRiderRows =
    (engagedRidersResult?.data as CalendarEngagedRiderRow[] | null) ?? [];
  const stageEquipmentEffectRows =
    (stageEquipmentEffectsResult?.data as
      CalendarStageEquipmentEffectsRow[] | null) ?? [];
  const engagedCountByEditionId = new Map(
    ((engagedCountsResult?.data as CalendarEngagedCountRow[] | null) ?? []).map(
      (row) => [row.race_edition_id, row.engaged_rider_count],
    ),
  );
  const engagedRiderIds = unique(
    engagedRiderRows.map((rider) => rider.rider_id),
  );
  const engagedTeamIds = unique(engagedRiderRows.map((rider) => rider.team_id));
  const raceDataAdmin = createSupabaseAdminClient();
  const raceStaffEffectsPromise = loadRaceStaffEffects(raceDataAdmin, {
    seasonId: season.id,
    teamIds: engagedTeamIds,
    riderIds: engagedRiderIds,
  });
  const teamSponsorVisualsPromise = loadActiveRaceTeamSponsorVisuals(
    raceDataAdmin,
    engagedTeamIds,
  );
  const localRaceCountriesPromise = loadWelcomeCenterLocalRaceCountries(
    raceDataAdmin,
    engagedTeamIds,
    engagedRiderIds,
  );
  const riderContext = await loadRaceCalendarRiderContext({
    supabase,
    admin: raceDataAdmin,
    riderIds: engagedRiderIds,
  });
  const {
    continentalChampionshipTitlesByRiderId,
    nationalChampionshipTitlesByRiderId,
    performancePreparationRows,
    riderCountryRows,
    specialAbilitiesByRiderId,
    worldChampionshipTitlesByRiderId,
  } = riderContext;
  const [raceStaffEffects, teamSponsorVisuals, welcomeCenterLocalRaceContext] =
    await Promise.all([
      raceStaffEffectsPromise,
      teamSponsorVisualsPromise,
      localRaceCountriesPromise,
    ]);

  const dayRows = daysResult.data ?? [];
  const dayIds = dayRows.map((day) => day.id);
  const raceIds = unique(editionRows.map((edition) => edition.race_id));
  const categoryIds = unique(
    editionRows.map((edition) => edition.race_category_id),
  );

  const [eventsResult, racesResult, categoriesResult, stagesResult] =
    await Promise.all([
      dayIds.length > 0
        ? supabase
            .from("season_events")
            .select(
              `
                id,
                season_day_id,
                event_type,
                title,
                description,
                href
              `,
            )
            .in("season_day_id", dayIds)
            .returns<SeasonEventRow[]>()
        : Promise.resolve(emptyResult<SeasonEventRow>()),

      raceIds.length > 0
        ? collectChunkedPaginatedRows<RaceRow, { message: string }, string>({
            values: raceIds,
            fetchPage: async (chunk, from, to) => {
              const result = await supabase
                .from("races")
                .select(
                  `
                    id,
                    country_id,
                    name,
                    short_name,
                    race_format,
                    slug,
                    competition_type,
                    is_grand_tour
                  `,
                )
                .in("id", chunk)
                .order("id", { ascending: true })
                .range(from, to)
                .returns<RaceRow[]>();
              return { data: result.data, error: result.error };
            },
          })
        : Promise.resolve(emptyResult<RaceRow>()),

      categoryIds.length > 0
        ? supabase
            .from("race_categories")
            .select(
              "id, code, name, prestige_rank, minimum_roster_size, maximum_roster_size",
            )
            .in("id", categoryIds)
            .returns<RaceCategoryRow[]>()
        : Promise.resolve(emptyResult<RaceCategoryRow>()),

      editionIds.length > 0
        ? collectChunkedPaginatedRows<StageRow, { message: string }, string>({
            values: editionIds,
            fetchPage: async (chunk, from, to) => {
              const result = await supabase
                .from("stages")
                .select(
                  `
                    id,
                    race_edition_id,
                    season_day_id,
                    stage_number,
                    name,
                    stage_type,
                    status,
                    profile_type,
                    distance_km,
                    day_slot,
                    departure_at
                  `,
                )
                .in("race_edition_id", chunk)
                .order("race_edition_id", { ascending: true })
                .order("stage_number", {
                  ascending: true,
                })
                .range(from, to)
                .returns<StageRow[]>();
              return { data: result.data, error: result.error };
            },
          })
        : Promise.resolve(emptyResult<StageRow>()),
    ]);

  assertQuerySucceeded(eventsResult.error, "les temps forts de la saison");
  assertQuerySucceeded(racesResult.error, "les courses");
  assertQuerySucceeded(categoriesResult.error, "les catégories de course");
  assertQuerySucceeded(stagesResult.error, "les étapes");

  const stageRows = stagesResult.data ?? [];
  const stageIds = stageRows.map((stage) => stage.id);
  const admin = createSupabaseAdminClient();
  const [
    segmentsResult,
    reconnaissanceResult,
    timeTrialPlansResult,
    stageRoleOverridesResult,
    stageStrategiesResult,
  ] = await Promise.all([
    loadStageSegments(stageIds),
    stageIds.length > 0
      ? collectChunkedPaginatedRows<
          StageReconnaissanceRow,
          { message: string },
          string
        >({
          values: stageIds,
          fetchPage: async (chunk, from, to) => {
            const result = await admin
              .from("stage_reconnaissances")
              .select("id, target_stage_id, bonus_points")
              .in("target_stage_id", chunk)
              .neq("status", "cancelled")
              .order("id", { ascending: true })
              .range(from, to)
              .returns<StageReconnaissanceRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : Promise.resolve(emptyResult<StageReconnaissanceRow>()),
    stageIds.length > 0 && includeEngagedRiders
      ? collectChunkedPaginatedRows<
          TimeTrialPlanRow,
          { message: string },
          string
        >({
          values: stageIds,
          fetchPage: async (chunk, from, to) => {
            const result = await admin
              .from("race_time_trial_rider_plans")
              .select(
                "stage_id, rider_id, effort_mode, relay_share_pct, updated_at",
              )
              .in("stage_id", chunk)
              .order("stage_id", { ascending: true })
              .order("rider_id", { ascending: true })
              .range(from, to)
              .returns<TimeTrialPlanRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : Promise.resolve(emptyResult<TimeTrialPlanRow>()),
    stageIds.length > 0 && includeEngagedRiders
      ? collectChunkedPaginatedRows<
          StageRoleOverrideRow,
          { message: string },
          string
        >({
          values: stageIds,
          fetchPage: async (chunk, from, to) => {
            const result = await admin
              .from("race_roster_stage_roles")
              .select("stage_id, rider_id, race_role")
              .in("stage_id", chunk)
              .order("stage_id", { ascending: true })
              .order("rider_id", { ascending: true })
              .range(from, to)
              .returns<StageRoleOverrideRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : Promise.resolve(emptyResult<StageRoleOverrideRow>()),
    stageIds.length > 0 && includeEngagedRiders
      ? collectChunkedPaginatedRows<
          StageStrategyRow,
          { message: string },
          string
        >({
          values: stageIds,
          fetchPage: async (chunk, from, to) => {
            const result = await admin
              .from("race_stage_strategies")
              .select(
                `
                  stage_id,
                  team_id,
                  objective,
                  collective_posture,
                  breakaway_policy,
                  chase_policy,
                  lieutenant_rider_id,
                  danger_pacer_rider_id,
                  protector_rider_id,
                  breakaway_rider_id,
                  attack_orders
                `,
              )
              .in("stage_id", chunk)
              .order("stage_id", { ascending: true })
              .order("team_id", { ascending: true })
              .range(from, to)
              .returns<StageStrategyRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : Promise.resolve(emptyResult<StageStrategyRow>()),
  ]);

  assertQuerySucceeded(segmentsResult.error, "les profils tronçonnés");
  assertQuerySucceeded(
    reconnaissanceResult.error,
    "les reconnaissances de course",
  );
  assertQuerySucceeded(
    stageRoleOverridesResult.error,
    "les rôles tactiques par étape",
  );
  assertQuerySucceeded(
    stageStrategiesResult.error,
    "les stratégies de course par étape",
  );
  assertQuerySucceeded(
    timeTrialPlansResult.error,
    "les consignes de contre-la-montre",
  );

  const segmentRows = segmentsResult.data ?? [];
  const reconnaissanceRows = reconnaissanceResult.data ?? [];
  const reconnaissanceIds = reconnaissanceRows.map(
    (reconnaissance) => reconnaissance.id,
  );
  const reconnaissanceRidersResult =
    reconnaissanceIds.length > 0
      ? await collectChunkedPaginatedRows<
          StageReconnaissanceRiderRow,
          { message: string },
          string
        >({
          values: reconnaissanceIds,
          fetchPage: async (chunk, from, to) => {
            const result = await admin
              .from("stage_reconnaissance_riders")
              .select("reconnaissance_id, rider_id")
              .in("reconnaissance_id", chunk)
              .order("reconnaissance_id", { ascending: true })
              .order("rider_id", { ascending: true })
              .range(from, to)
              .returns<StageReconnaissanceRiderRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : emptyResult<StageReconnaissanceRiderRow>();

  assertQuerySucceeded(
    reconnaissanceRidersResult.error,
    "les coureurs ayant reconnu une course",
  );
  const reconnaissanceBonusesByStageId = groupReconnaissanceBonuses(
    reconnaissanceRows,
    reconnaissanceRidersResult.data ?? [],
  );
  const riderRoleOverridesByStageId = groupStageRoleOverrides(
    stageRoleOverridesResult.data ?? [],
  );
  const teamStrategiesByStageId = groupStageStrategies(
    stageStrategiesResult.data ?? [],
  );
  const timeTrialPlansByStageId = groupTimeTrialPlans(
    timeTrialPlansResult.data ?? [],
  );

  const raceRows = racesResult.data ?? [];
  const countryIds = unique([
    ...raceRows.map((race) => race.country_id),
    ...riderCountryRows.map((rider) => rider.country_id),
  ]);
  const countriesResult =
    countryIds.length > 0
      ? await collectChunkedPaginatedRows<
          CountryRow,
          { message: string },
          string
        >({
          values: countryIds,
          fetchPage: async (chunk, from, to) => {
            const result = await supabase
              .from("countries")
              .select("id, name, iso_alpha2, continent_code")
              .in("id", chunk)
              .order("id", { ascending: true })
              .range(from, to)
              .returns<CountryRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : emptyResult<CountryRow>();

  assertQuerySucceeded(countriesResult.error, "les pays des courses");

  const dayById = new Map(dayRows.map((day) => [day.id, day]));
  const raceById = new Map(raceRows.map((race) => [race.id, race]));
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const stagesByEditionId = groupStages(
    stageRows,
    dayById,
    segmentRows,
    reconnaissanceBonusesByStageId,
    season.game_year,
  );
  const registrationByEditionId = new Map(
    ((registrationsResult.data as CalendarRegistrationRow[] | null) ?? []).map(
      (registration) => [registration.race_edition_id, registration],
    ),
  );
  const nationalInternationalEditionIds = new Set(
    season.game_year >= 2
      ? editionRows
          .filter(
            (edition) =>
              raceById.get(edition.race_id)?.competition_type ===
                "world_championship" ||
              raceById.get(edition.race_id)?.competition_type ===
                "continental_championship",
          )
          .map((edition) => edition.id)
      : [],
  );
  const nationalJerseyDesignByCountryId =
    nationalInternationalEditionIds.size > 0
      ? await loadNationalFederationJerseyDesigns(
          riderCountryRows.map((rider) => rider.country_id),
        )
      : new Map();
  const engagedRidersByEditionId = groupCalendarEngagedRiders(
    engagedRiderRows,
    stageEquipmentEffectRows,
    specialAbilitiesByRiderId,
    new Map(riderCountryRows.map((rider) => [rider.id, rider])),
    countryById,
    worldChampionshipTitlesByRiderId,
    continentalChampionshipTitlesByRiderId,
    nationalInternationalEditionIds,
    nationalJerseyDesignByCountryId,
    nationalChampionshipTitlesByRiderId,
    performancePreparationRows,
    raceStaffEffects,
    teamSponsorVisuals,
    welcomeCenterLocalRaceContext,
  );

  const editions = editionRows
    .map((edition): RaceCalendarEdition | null => {
      const race = raceById.get(edition.race_id);
      const category = categoryById.get(edition.race_category_id);
      const country = race ? countryById.get(race.country_id) : null;

      if (
        !race ||
        !category ||
        !country ||
        !isRaceCategoryCode(category.code)
      ) {
        return null;
      }

      if (
        !options.includeIneligibleRegionalRaces &&
        !canTeamAccessRaceCategory({
          categoryCode: category.code,
          raceContinentCode: country.continent_code,
          context: regionalRaceContext
            ? {
                isAmateur: regionalRaceContext.is_amateur,
                teamContinentCode: regionalRaceContext.team_continent_code,
              }
            : null,
        })
      ) {
        return null;
      }

      return {
        id: edition.id,
        status: edition.status as RaceCalendarEdition["status"],
        raceId: race.id,
        slug: race.slug,
        name: edition.display_name,
        shortName: race.short_name,
        countryName: country.name,
        countryCode: country.iso_alpha2,
        categoryCode: category.code,
        categoryName: category.name,
        prestigeRank: category.prestige_rank,
        raceFormat: race.race_format,
        competitionType: race.competition_type,
        isGrandTour: race.is_grand_tour,
        registrationClosesAt: edition.registration_closes_at,
        isSponsorObjective: sponsorObjectiveEditionIds.has(edition.id),
        wildcardClosesAt: edition.wildcard_closes_at,
        withdrawalClosesAt: edition.withdrawal_closes_at,
        registrationPolicy: edition.registration_policy,
        minimumReputation: edition.minimum_reputation,
        fieldLimit: edition.field_limit,
        minimumRosterSize:
          race.competition_type === "standard"
            ? (category.minimum_roster_size ?? 1)
            : 1,
        maximumRosterSize:
          race.competition_type === "standard"
            ? (category.maximum_roster_size ?? 1)
            : 200,
        engagedRiderCount:
          engagedCountByEditionId.get(edition.id) ??
          engagedRidersByEditionId.get(edition.id)?.length ??
          0,
        engagedRiders: engagedRidersByEditionId.get(edition.id) ?? [],
        currentTeamRegistration: registrationByEditionId.has(edition.id)
          ? {
              status: registrationByEditionId.get(edition.id)!
                .registration_status,
              rosterCount: registrationByEditionId.get(edition.id)!
                .roster_count,
            }
          : null,
        stages: (stagesByEditionId.get(edition.id) ?? []).map((stage) => ({
          ...stage,
          ...((season.game_year < 2 ||
            (race.competition_type !== "world_championship" &&
              race.competition_type !== "continental_championship")) &&
          riderRoleOverridesByStageId.has(stage.id)
            ? {
                riderRoleOverrides: riderRoleOverridesByStageId.get(stage.id),
              }
            : {}),
          ...((season.game_year < 2 ||
            (race.competition_type !== "world_championship" &&
              race.competition_type !== "continental_championship")) &&
          teamStrategiesByStageId.has(stage.id)
            ? {
                teamStrategies: teamStrategiesByStageId.get(stage.id),
              }
            : {}),
          ...((season.game_year < 2 ||
            (race.competition_type !== "world_championship" &&
              race.competition_type !== "continental_championship")) &&
          timeTrialPlansByStageId.has(stage.id)
            ? {
                timeTrialPlans: timeTrialPlansByStageId.get(stage.id),
              }
            : {}),
          segments: removeOneDayRaceMountainPrimes(
            stage.segments,
            race.race_format,
          ),
        })),
      } satisfies RaceCalendarEdition;
    })
    .filter(
      (edition): edition is RaceCalendarEdition =>
        edition !== null && edition.stages.length > 0,
    );

  const days = dayRows.map((day): SeasonCalendarDay => ({
    id: day.id,
    dayNumber: day.day_number,
    calendarDate: day.calendar_date,
    label: day.label,
  }));
  const events = consolidateNationalChampionshipEvents(
    (eventsResult.data ?? [])
      .map((event) => {
        const day = dayById.get(event.season_day_id);

        if (!day) {
          return null;
        }

        return {
          id: event.id,
          dayNumber: day.day_number,
          eventType: event.event_type,
          title: event.title,
          description: event.description,
          href: event.href,
        } satisfies SeasonCalendarEvent;
      })
      .filter((event): event is SeasonCalendarEvent => event !== null),
  );

  return {
    seasonId: season.id,
    seasonName: season.name,
    gameYear: season.game_year,
    startsOn: season.starts_on,
    endsOn: season.ends_on,
    currentDayNumber: getEffectiveSeasonDay({
      startsOn: season.starts_on,
      persistedDayNumber: season.current_day_number,
      parisDate: formatParisDate(now),
    }),
    days,
    events,
    editions,
  };
}

export async function getCurrentRaceUserContext(
  supabase: SupabaseServerClient,
  authUserId: string,
  raceEditionId: string,
): Promise<CurrentRaceUserContext> {
  const [directorResult, registrationResult, teamDivision] = await Promise.all([
    supabase
      .from("sporting_directors")
      .select("reputation_points")
      .eq("auth_user_id", authUserId)
      .maybeSingle<SportingDirectorReputationRow>(),

    supabase.rpc("get_current_team_race_registration", {
      p_race_edition_id: raceEditionId,
    }),
    getCurrentTeamDivisionForAuthUser(authUserId),
  ]);

  if (directorResult.error) {
    throw new Error(
      `Impossible de charger la réputation du Directeur Sportif : ${directorResult.error.message}`,
    );
  }

  if (registrationResult.error) {
    throw new Error(
      `Impossible de charger l'inscription de l'équipe : ${registrationResult.error.message}`,
    );
  }

  const registrationRow = Array.isArray(registrationResult.data)
    ? (registrationResult.data[0] as RaceRegistrationRow | undefined)
    : undefined;

  return {
    reputationPoints: directorResult.data?.reputation_points ?? 0,
    divisionCode: teamDivision?.code ?? "amateur",
    registration: registrationRow
      ? {
          id: registrationRow.registration_id,
          status: registrationRow.registration_status,
          registeredAt: registrationRow.registration_registered_at,
          rosterCount: registrationRow.roster_count,
          withdrawalClosesAt: registrationRow.withdrawal_closes_at,
        }
      : null,
  };
}

export async function getRacePastWinners(
  supabase: SupabaseServerClient,
  raceId: string,
): Promise<RacePastWinner[]> {
  const { data, error } = await supabase.rpc("get_race_past_winners", {
    p_race_id: raceId,
  });

  if (error) {
    throw new Error(
      `Impossible de charger le palmarès de la course : ${error.message}`,
    );
  }

  return ((data as RacePastWinnerRow[] | null) ?? []).map((winner) => ({
    gameYear: winner.game_year,
    seasonName: winner.season_name,
    finalRank: winner.final_rank,
    riderId: winner.rider_id,
    riderName: `${winner.rider_first_name} ${winner.rider_last_name}`,
    teamName: winner.team_name,
  }));
}

export async function getCurrentTeamRaceRosterOptions(
  supabase: SupabaseServerClient,
  raceEditionId: string,
): Promise<RaceRosterOption[]> {
  const { data, error } = await supabase.rpc(
    "get_current_team_race_roster_options",
    { p_race_edition_id: raceEditionId },
  );

  if (error) {
    throw new Error(
      `Impossible de charger votre effectif pour cette course : ${error.message}`,
    );
  }

  return ((data as RaceRosterOptionRow[] | null) ?? []).map((rider) => ({
    riderId: rider.rider_id,
    firstName: rider.first_name,
    lastName: rider.last_name,
    countryName: rider.country_name,
    countryCode: rider.country_iso_alpha2,
    avatarProfileKey: rider.avatar_profile_key,
    avatarSeed: rider.avatar_seed,
    age: rider.age,
    mountain: rider.mountain,
    hills: rider.hills,
    flat: rider.flat,
    timeTrial: rider.time_trial,
    cobbles: rider.cobbles,
    sprint: rider.sprint,
    form: Number(rider.current_form),
    isSelected: rider.is_selected,
    isAvailable: rider.is_available,
    unavailability:
      rider.unavailability_type && rider.unavailability_label
        ? {
            type: rider.unavailability_type,
            label: rider.unavailability_label,
            until: rider.unavailable_until,
          }
        : null,
    conflict:
      rider.conflicting_race_slug &&
      rider.conflicting_race_name &&
      rider.conflicting_start_day !== null &&
      rider.conflicting_end_day !== null
        ? {
            raceSlug: rider.conflicting_race_slug,
            raceName: rider.conflicting_race_name,
            startDay: rider.conflicting_start_day,
            endDay: rider.conflicting_end_day,
          }
        : null,
  }));
}

export async function getCurrentTeamStageRolePlan(
  supabase: SupabaseServerClient,
  raceEditionId: string,
): Promise<RaceStageRolePlanRider[]> {
  const { data, error } = await supabase.rpc(
    "get_current_team_stage_role_plan",
    { p_race_edition_id: raceEditionId },
  );

  if (error) {
    throw new Error(
      `Impossible de charger les rôles par étape : ${error.message}`,
    );
  }

  const planByRiderId = new Map<string, RaceStageRolePlanRider>();

  for (const row of (data as RaceStageRolePlanRow[] | null) ?? []) {
    const riderPlan = planByRiderId.get(row.rider_id) ?? {
      riderId: row.rider_id,
      generalRole: row.general_role,
      stageRoles: {},
    };

    if (row.stage_role) {
      riderPlan.stageRoles[row.stage_id] = row.stage_role;
    }

    planByRiderId.set(row.rider_id, riderPlan);
  }

  return [...planByRiderId.values()];
}

export async function getCurrentTeamRacePreparation(
  supabase: SupabaseServerClient,
): Promise<RacePreparationEditionPlan[]> {
  const { data, error } = await supabase.rpc(
    "get_current_team_race_preparation",
  );

  if (error) {
    throw new Error(
      `Impossible de charger la préparation des courses : ${error.message}`,
    );
  }

  const editionsById = new Map<string, RacePreparationEditionPlan>();
  const ridersByEditionId = new Map<
    string,
    Map<string, RacePreparationRider>
  >();

  for (const row of (data as RacePreparationRow[] | null) ?? []) {
    const editionPlan = editionsById.get(row.race_edition_id) ?? {
      editionId: row.race_edition_id,
      registrationId: row.race_registration_id,
      teamId: row.team_id,
      riders: [],
      stages: {},
    };
    const ridersById = ridersByEditionId.get(row.race_edition_id) ?? new Map();
    const riderPlan = ridersById.get(row.rider_id) ?? {
      riderId: row.rider_id,
      firstName: row.rider_first_name,
      lastName: row.rider_last_name,
      ratings: {
        mountain: Number(row.mountain),
        hills: Number(row.hills),
        flat: Number(row.flat),
        timeTrial: Number(row.time_trial),
        cobbles: Number(row.cobbles),
        sprint: Number(row.sprint),
        acceleration: Number(row.acceleration),
        downhill: Number(row.downhill),
        endurance: Number(row.endurance),
        resistance: Number(row.resistance),
        recovery: Number(row.recovery),
        breakaway: Number(row.breakaway),
        prologue: Number(row.prologue),
      },
      timeTrialPlans: {},
      generalRole: row.general_role,
      stageRoles: {},
    };

    if (row.stage_role) {
      riderPlan.stageRoles[row.stage_id] = row.stage_role;
    }
    if (row.time_trial_effort) {
      riderPlan.timeTrialPlans[row.stage_id] = {
        effortMode: row.time_trial_effort,
        relaySharePct:
          row.relay_share_pct === null ? null : Number(row.relay_share_pct),
      };
    }
    ridersById.set(row.rider_id, riderPlan);
    ridersByEditionId.set(row.race_edition_id, ridersById);

    editionPlan.stages[row.stage_id] ??= {
      teamId: row.team_id,
      objective: row.objective,
      collectivePosture: row.collective_posture,
      breakawayPolicy: row.breakaway_policy,
      chasePolicy: row.chase_policy,
      lieutenantRiderId: row.lieutenant_rider_id,
      dangerPacerRiderId: row.danger_pacer_rider_id,
      protectorRiderId: row.protector_rider_id,
      breakawayRiderId: row.breakaway_rider_id,
      attackOrders: row.attack_orders,
      updatedAt: row.strategy_updated_at,
      timeTrialUpdatedAt: row.time_trial_updated_at,
    };
    editionsById.set(row.race_edition_id, editionPlan);
  }

  for (const [editionId, editionPlan] of editionsById) {
    editionPlan.riders = [
      ...(ridersByEditionId.get(editionId)?.values() ?? []),
    ];

    const availableRiderIds = new Set(
      editionPlan.riders.map((rider) => rider.riderId),
    );

    for (const stagePlan of Object.values(editionPlan.stages)) {
      if (
        stagePlan.lieutenantRiderId &&
        !availableRiderIds.has(stagePlan.lieutenantRiderId)
      ) {
        stagePlan.lieutenantRiderId = null;
      }
      if (
        stagePlan.dangerPacerRiderId &&
        !availableRiderIds.has(stagePlan.dangerPacerRiderId)
      ) {
        stagePlan.dangerPacerRiderId = null;
      }
      if (
        stagePlan.protectorRiderId &&
        !availableRiderIds.has(stagePlan.protectorRiderId)
      ) {
        stagePlan.protectorRiderId = null;
      }
      if (
        stagePlan.breakawayRiderId &&
        !availableRiderIds.has(stagePlan.breakawayRiderId)
      ) {
        stagePlan.breakawayRiderId = null;
      }
      stagePlan.attackOrders = stagePlan.attackOrders.filter((order) =>
        availableRiderIds.has(order.riderId),
      );
    }
  }

  return [...editionsById.values()];
}

export async function getRaceEngagedRiders(
  supabase: SupabaseServerClient,
  raceEditionId: string,
): Promise<RaceEngagedRider[]> {
  const { data, error } = await collectPaginatedRows<
    RaceEngagedRiderRow,
    { message: string }
  >({
    fetchPage: async (from, to) => {
      const result = await supabase
        .rpc("get_race_engaged_riders", {
          p_race_edition_id: raceEditionId,
        })
        .range(from, to);
      return {
        data: result.data as RaceEngagedRiderRow[] | null,
        error: result.error,
      };
    },
  });

  if (error) {
    throw new Error(
      `Impossible de charger les coureurs engagés : ${error.message}`,
    );
  }

  return ((data as RaceEngagedRiderRow[] | null) ?? []).map((rider) => ({
    teamId: rider.team_id,
    teamName: rider.team_name,
    teamShortName: rider.team_short_name,
    teamCountryCode: rider.team_country_iso_alpha2,
    riderId: rider.rider_id,
    riderName: `${rider.rider_first_name} ${rider.rider_last_name}`,
    countryCode: rider.country_iso_alpha2,
  }));
}

export async function loadActiveRaceTeamSponsorVisuals(
  admin: SupabaseAdminClient,
  teamIds: string[],
): Promise<Map<string, RaceTeamSponsorVisual>> {
  if (teamIds.length === 0) return new Map();

  const contractsResult = await admin
    .from("team_sponsor_contracts")
    .select("team_id, sponsor_id, selected_jersey_id, created_at")
    .in("team_id", teamIds)
    .eq("role", "principal")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<ActiveTeamSponsorContractRow[]>();

  if (contractsResult.error) return new Map();

  const contractByTeamId = new Map<string, ActiveTeamSponsorContractRow>();
  for (const contract of contractsResult.data ?? []) {
    if (!contractByTeamId.has(contract.team_id)) {
      contractByTeamId.set(contract.team_id, contract);
    }
  }

  const sponsorIds = unique(
    [...contractByTeamId.values()].map((contract) => contract.sponsor_id),
  );
  if (sponsorIds.length === 0) return new Map();

  const sponsorsResult = await admin
    .from("sponsors")
    .select("id, catalog_key")
    .in("id", sponsorIds)
    .returns<SponsorRegistryRow[]>();

  if (sponsorsResult.error) return new Map();

  const sponsorRegistryById = new Map(
    (sponsorsResult.data ?? []).map((sponsor) => [sponsor.id, sponsor]),
  );
  const visuals = new Map<string, RaceTeamSponsorVisual>();

  for (const [teamId, contract] of contractByTeamId) {
    const registrySponsor = sponsorRegistryById.get(contract.sponsor_id);
    const sponsor = registrySponsor
      ? SPONSORS.find((entry) => entry.id === registrySponsor.catalog_key)
      : null;
    const selectedJersey =
      sponsor?.jerseys.find(
        (jersey) => jersey.id === contract.selected_jersey_id,
      ) ?? sponsor?.jerseys[0];
    if (!sponsor || !selectedJersey) continue;

    visuals.set(teamId, {
      primaryColor: sponsor.colors.primary,
      secondaryColor: sponsor.colors.secondary,
      jersey: createSponsoredRiderJersey({
        colors: sponsor.colors,
        style: selectedJersey.style,
        imagePath: selectedJersey.imagePath,
      }),
    });
  }

  return visuals;
}

function combineEquipmentEffectsWithStaff({
  values,
  teamStaffEffects,
  injuryPreventionPercentage,
}: {
  values: unknown[];
  teamStaffEffects: TeamRaceStaffEffects | undefined;
  injuryPreventionPercentage: number;
}): EquipmentEffects {
  const adjustedEffects = values.map((value) => {
    const effect = normalizeEquipmentEffects(value);
    const slotType =
      value && typeof value === "object" && !Array.isArray(value)
        ? String((value as Record<string, unknown>)._slotType ?? "")
        : "";
    const efficiencyPercentage =
      slotType === "front_wheel" || slotType === "rear_wheel"
        ? (teamStaffEffects?.wheelEfficiencyPercentage ?? 0)
        : slotType === "frame"
          ? (teamStaffEffects?.frameEfficiencyPercentage ?? 0)
          : 0;

    return scaleEquipmentEffect(effect, efficiencyPercentage);
  });
  const combined = combineEquipmentEffects(adjustedEffects);
  combined.injuryRiskReductionPct = Math.min(
    45,
    Math.max(0, combined.injuryRiskReductionPct + injuryPreventionPercentage),
  );
  return combined;
}

function scaleEquipmentEffect(
  effect: EquipmentEffects,
  percentage: number,
): EquipmentEffects {
  const multiplier = 1 + Math.max(0, percentage) / 100;
  const scaleRatings = (ratings: EquipmentEffects["ratingBonuses"]) =>
    Object.fromEntries(
      Object.entries(ratings).map(([key, value]) => [
        key,
        Number(value ?? 0) * multiplier,
      ]),
    ) as EquipmentEffects["ratingBonuses"];

  return {
    ratingBonuses: scaleRatings(effect.ratingBonuses),
    timeTrialRatingBonuses: scaleRatings(effect.timeTrialRatingBonuses),
    injuryRiskReductionPct: effect.injuryRiskReductionPct * multiplier,
    breakawayReputationBonus: effect.breakawayReputationBonus * multiplier,
    victoryReputationBonus: effect.victoryReputationBonus * multiplier,
  };
}

type WelcomeCenterLocalRaceContext = {
  eligibleTeamIds: Set<string>;
  adjacentRaceCountryCodesByRiderId: Map<string, string[]>;
};

async function loadWelcomeCenterLocalRaceCountries(
  admin: SupabaseAdminClient,
  teamIds: string[],
  riderIds: string[],
): Promise<WelcomeCenterLocalRaceContext> {
  const result: WelcomeCenterLocalRaceContext = {
    eligibleTeamIds: new Set(),
    adjacentRaceCountryCodesByRiderId: new Map(),
  };
  if (!teamIds.length || !riderIds.length) return result;
  const [facilitiesResult, ridersResult] = await Promise.all([
    admin
      .from("team_infrastructures")
      .select("team_id")
      .in("team_id", teamIds)
      .eq("infrastructure_code", "international_welcome_center")
      .gte("level", 3)
      .returns<Array<{ team_id: string }>>(),
    admin
      .from("riders")
      .select("id,country_id")
      .in("id", riderIds)
      .returns<Array<{ id: string; country_id: string }>>(),
  ]);
  assertQuerySucceeded(
    facilitiesResult.error,
    "les Centres d’accueil internationaux",
  );
  assertQuerySucceeded(ridersResult.error, "les nationalités des coureurs");
  result.eligibleTeamIds = new Set(
    (facilitiesResult.data ?? []).map((row) => row.team_id),
  );
  if (!result.eligibleTeamIds.size) return result;

  const countryIds = unique(
    (ridersResult.data ?? []).map((row) => row.country_id),
  );
  if (!countryIds.length) return result;
  const adjacencyResult = await admin
    .from("country_adjacencies")
    .select("country_id,adjacent_country_id")
    .in("country_id", countryIds)
    .returns<Array<{ country_id: string; adjacent_country_id: string }>>();
  assertQuerySucceeded(adjacencyResult.error, "les pays adjacents");
  const adjacentIds = unique(
    (adjacencyResult.data ?? []).map((row) => row.adjacent_country_id),
  );
  const countriesResult = adjacentIds.length
    ? await admin
        .from("countries")
        .select("id,iso_alpha2")
        .in("id", adjacentIds)
        .returns<Array<{ id: string; iso_alpha2: string }>>()
    : emptyResult<{ id: string; iso_alpha2: string }>();
  assertQuerySucceeded(countriesResult.error, "les codes des pays adjacents");
  const codeById = new Map(
    (countriesResult.data ?? []).map((country) => [
      country.id,
      country.iso_alpha2,
    ]),
  );
  const adjacentByCountryId = new Map<string, string[]>();
  for (const adjacency of adjacencyResult.data ?? []) {
    const code = codeById.get(adjacency.adjacent_country_id);
    if (!code) continue;
    const codes = adjacentByCountryId.get(adjacency.country_id) ?? [];
    if (!codes.includes(code)) codes.push(code);
    adjacentByCountryId.set(adjacency.country_id, codes);
  }
  for (const rider of ridersResult.data ?? []) {
    result.adjacentRaceCountryCodesByRiderId.set(
      rider.id,
      adjacentByCountryId.get(rider.country_id) ?? [],
    );
  }
  return result;
}

function groupCalendarEngagedRiders(
  rows: CalendarEngagedRiderRow[],
  stageEquipmentRows: CalendarStageEquipmentEffectsRow[],
  specialAbilitiesByRiderId: Map<string, RiderSpecialAbility[]>,
  riderMetadataById: Map<string, RiderCountryRow>,
  countryById: Map<string, CountryRow>,
  worldChampionshipTitlesByRiderId: Map<
    string,
    ActiveWorldChampionshipTitlesByDiscipline
  >,
  continentalChampionshipTitlesByRiderId: Map<
    string,
    ActiveContinentalChampionshipTitlesByDiscipline
  >,
  nationalInternationalEditionIds: ReadonlySet<string>,
  nationalJerseyDesignByCountryId: Awaited<
    ReturnType<typeof loadNationalFederationJerseyDesigns>
  >,
  nationalChampionshipTitlesByRiderId: Map<
    string,
    ActiveNationalChampionshipTitlesByDiscipline
  >,
  performancePreparationRows: RiderPerformancePreparationRow[],
  raceStaffEffects: RaceStaffEffects,
  teamSponsorVisuals: Map<string, RaceTeamSponsorVisual>,
  welcomeCenterLocalRaceContext: WelcomeCenterLocalRaceContext,
) {
  const ridersByEditionId = new Map<
    string,
    RaceCalendarEdition["engagedRiders"]
  >();
  const preparationsByRiderId = new Map<
    string,
    RiderPerformancePreparationRow[]
  >();
  for (const preparation of performancePreparationRows) {
    const riderPreparations =
      preparationsByRiderId.get(preparation.rider_id) ?? [];
    riderPreparations.push(preparation);
    preparationsByRiderId.set(preparation.rider_id, riderPreparations);
  }
  const equipmentByEditionRider = new Map<
    string,
    Record<string, EquipmentEffects>
  >();

  for (const row of stageEquipmentRows) {
    const key = row.race_edition_id + ":" + row.rider_id;
    const byStage = equipmentByEditionRider.get(key) ?? {};
    const usesNationalWorldModel = nationalInternationalEditionIds.has(
      row.race_edition_id,
    );
    byStage[row.stage_id] = combineEquipmentEffectsWithStaff({
      values: Array.isArray(row.equipment_effects) ? row.equipment_effects : [],
      teamStaffEffects: usesNationalWorldModel
        ? undefined
        : raceStaffEffects.byTeamId.get(row.team_id),
      injuryPreventionPercentage: usesNationalWorldModel
        ? 0
        : (raceStaffEffects.injuryPreventionByRiderId.get(row.rider_id) ?? 0),
    });
    equipmentByEditionRider.set(key, byStage);
  }

  for (const row of rows) {
    const riders = ridersByEditionId.get(row.race_edition_id) ?? [];
    const specialAbilities = specialAbilitiesByRiderId.get(row.rider_id) ?? [];
    const riderMetadata = riderMetadataById.get(row.rider_id);
    const usesNationalWorldModel = nationalInternationalEditionIds.has(
      row.race_edition_id,
    );
    const nationalChampionships = nationalChampionshipTitlesByRiderId.get(
      row.rider_id,
    );
    const worldChampionships = worldChampionshipTitlesByRiderId.get(
      row.rider_id,
    );
    const continentalChampionships = continentalChampionshipTitlesByRiderId.get(
      row.rider_id,
    );
    const riderCountry = riderMetadata
      ? countryById.get(riderMetadata.country_id)
      : null;
    const nationalTeamJersey =
      usesNationalWorldModel && riderCountry
        ? createNationalTeamRiderJersey(
            riderCountry.iso_alpha2,
            nationalJerseyDesignByCountryId.get(riderMetadata!.country_id),
          )
        : null;
    const teamStaffEffects = usesNationalWorldModel
      ? undefined
      : raceStaffEffects.byTeamId.get(row.team_id);
    const teamSponsorVisual = usesNationalWorldModel
      ? undefined
      : teamSponsorVisuals.get(row.team_id);
    const equipmentEffects = combineEquipmentEffectsWithStaff({
      values: Array.isArray(row.equipment_effects) ? row.equipment_effects : [],
      teamStaffEffects,
      injuryPreventionPercentage: usesNationalWorldModel
        ? 0
        : (raceStaffEffects.injuryPreventionByRiderId.get(row.rider_id) ?? 0),
    });
    const equipmentEffectsByStageId = equipmentByEditionRider.get(
      row.race_edition_id + ":" + row.rider_id,
    );
    riders.push({
      id: row.rider_id,
      name: `${row.rider_first_name} ${row.rider_last_name}`,
      teamId:
        usesNationalWorldModel && riderMetadata
          ? riderMetadata.country_id
          : row.team_id,
      teamName:
        usesNationalWorldModel && riderCountry
          ? riderCountry.name
          : row.team_name,
      teamPrimaryColor:
        nationalTeamJersey?.primaryColor ??
        teamSponsorVisual?.primaryColor ??
        row.team_primary_color,
      teamSecondaryColor:
        nationalTeamJersey?.secondaryColor ??
        teamSponsorVisual?.secondaryColor ??
        row.team_secondary_color,
      ...(nationalTeamJersey
        ? { teamJersey: nationalTeamJersey }
        : teamSponsorVisual
          ? { teamJersey: teamSponsorVisual.jersey }
          : {}),
      avatarProfileKey: riderMetadata?.avatar_profile_key ?? null,
      avatarSeed: riderMetadata?.avatar_seed ?? null,
      nationalChampionships,
      worldChampionships,
      continentalChampionships,
      age: Number(row.age),
      form: Number(row.form),
      careerRaceDays: Number(riderMetadata?.career_race_days ?? 0),
      countryCode: riderCountry?.iso_alpha2 ?? null,
      ...(usesNationalWorldModel
        ? {}
        : {
            localRaceCountryCodes:
              welcomeCenterLocalRaceContext.eligibleTeamIds.has(row.team_id)
                ? (welcomeCenterLocalRaceContext.adjacentRaceCountryCodesByRiderId.get(
                    row.rider_id,
                  ) ?? [])
                : [],
          }),
      role: usesNationalWorldModel ? "auto" : row.race_role,
      specialAbility: specialAbilities[0] ?? null,
      specialAbilities,
      performancePreparations: (
        preparationsByRiderId.get(row.rider_id) ?? []
      ).map((preparation) => ({
        type: preparation.preparation_type,
        bonusStartGameDay: Number(preparation.bonus_start_game_day),
        bonusEndGameDay: Number(preparation.bonus_end_game_day),
        ratingBonus: Number(preparation.rating_bonus),
      })),
      equipmentEffects,
      ...(equipmentEffectsByStageId ? { equipmentEffectsByStageId } : {}),
      mechanicalIncidentTimeReductionPct:
        teamStaffEffects?.incidentTimeReductionPercentage ?? 0,
      ratings: {
        mountain: Number(row.mountain),
        hills: Number(row.hills),
        flat: Number(row.flat),
        timeTrial: Number(row.time_trial),
        cobbles: Number(row.cobbles),
        sprint: Number(row.sprint),
        acceleration: Number(row.acceleration),
        downhill: Number(row.downhill),
        endurance: Number(row.endurance),
        resistance: Number(row.resistance),
        recovery: Number(row.recovery),
        breakaway: Number(row.breakaway),
        prologue: Number(row.prologue),
      },
    });
    ridersByEditionId.set(row.race_edition_id, riders);
  }

  return ridersByEditionId;
}

function groupSpecialAbilities(rows: RiderSpecialAbilityRow[]) {
  const abilitiesByRiderId = new Map<string, RiderSpecialAbility[]>();

  for (const row of rows) {
    if (!isRiderSpecialAbility(row.ability_code)) continue;
    const abilities = abilitiesByRiderId.get(row.rider_id) ?? [];
    if (!abilities.includes(row.ability_code)) abilities.push(row.ability_code);
    abilitiesByRiderId.set(row.rider_id, abilities);
  }

  return abilitiesByRiderId;
}

function groupStages(
  rows: StageRow[],
  dayById: Map<string, SeasonDayRow>,
  segmentRows: StageSegmentRow[],
  reconnaissanceBonusesByStageId: Map<string, Record<string, number>>,
  gameYear: number,
) {
  const stagesByEditionId = new Map<string, RaceCalendarStage[]>();
  const segmentsByStageId = new Map<string, StageSegmentRow[]>();

  for (const segment of segmentRows) {
    const stageSegments = segmentsByStageId.get(segment.stage_id) ?? [];
    stageSegments.push(segment);
    segmentsByStageId.set(segment.stage_id, stageSegments);
  }

  for (const row of rows) {
    const day = dayById.get(row.season_day_id);

    if (!day) {
      continue;
    }

    const loadedSegments = (segmentsByStageId.get(row.id) ?? []).map(
      (segment) => {
        const prime = segment.stage_segment_primes[0];

        return {
          segmentNumber: segment.segment_number,
          distanceKm: Number(segment.distance_km),
          terrain: segment.terrain_type,
          averageGradientPct: Number(segment.average_gradient_pct),
          surface: segment.surface_type,
          prime: prime
            ? {
                type: prime.prime_type,
                category: prime.mountain_category,
                pointsScale: prime.points_scale,
              }
            : null,
        };
      },
    );
    const distanceKm = Number(row.distance_km);
    const segments = ensureCompleteRaceSegments({
      segments: loadedSegments,
      distanceKm,
      profileType: row.profile_type,
      seed: row.id,
      includeTourPrimes: loadedSegments.some(
        (segment) => segment.prime !== null,
      ),
    });
    const stage: RaceCalendarStage = {
      id: row.id,
      dayNumber: day.day_number,
      gameDayIndex: gameYear * 28 + day.day_number - 1,
      stageNumber: row.stage_number,
      name: row.name,
      stageType: row.stage_type,
      status: row.status,
      profileType: resolveRaceProfileType(row.profile_type, segments),
      distanceKm,
      daySlot: isRaceDaySlot(row.day_slot) ? row.day_slot : "late",
      departureAt: row.departure_at,
      segments,
      reconnaissanceBonuses: reconnaissanceBonusesByStageId.get(row.id) ?? {},
    };
    const editionStages = stagesByEditionId.get(row.race_edition_id) ?? [];

    editionStages.push(stage);
    stagesByEditionId.set(row.race_edition_id, editionStages);
  }

  return stagesByEditionId;
}

function groupReconnaissanceBonuses(
  reconnaissances: StageReconnaissanceRow[],
  participants: StageReconnaissanceRiderRow[],
) {
  const reconnaissanceById = new Map(
    reconnaissances.map((reconnaissance) => [
      reconnaissance.id,
      reconnaissance,
    ]),
  );
  const bonusesByStageId = new Map<string, Record<string, number>>();

  for (const participant of participants) {
    const reconnaissance = reconnaissanceById.get(
      participant.reconnaissance_id,
    );
    if (!reconnaissance) continue;

    const stageBonuses =
      bonusesByStageId.get(reconnaissance.target_stage_id) ?? {};
    stageBonuses[participant.rider_id] = Number(reconnaissance.bonus_points);
    bonusesByStageId.set(reconnaissance.target_stage_id, stageBonuses);
  }

  return bonusesByStageId;
}

function groupStageRoleOverrides(rows: StageRoleOverrideRow[]) {
  const rolesByStageId = new Map<string, Record<string, RaceRole>>();

  for (const row of rows) {
    const stageRoles = rolesByStageId.get(row.stage_id) ?? {};
    stageRoles[row.rider_id] = row.race_role;
    rolesByStageId.set(row.stage_id, stageRoles);
  }

  return rolesByStageId;
}

function groupStageStrategies(rows: StageStrategyRow[]) {
  const strategiesByStageId = new Map<
    string,
    Record<string, RaceTeamStrategy>
  >();

  for (const row of rows) {
    const stageStrategies = strategiesByStageId.get(row.stage_id) ?? {};
    stageStrategies[row.team_id] = {
      teamId: row.team_id,
      objective: row.objective,
      collectivePosture: row.collective_posture,
      breakawayPolicy: row.breakaway_policy,
      chasePolicy: row.chase_policy,
      lieutenantRiderId: row.lieutenant_rider_id,
      dangerPacerRiderId: row.danger_pacer_rider_id,
      protectorRiderId: row.protector_rider_id,
      breakawayRiderId: row.breakaway_rider_id,
      attackOrders: row.attack_orders,
    };
    strategiesByStageId.set(row.stage_id, stageStrategies);
  }

  return strategiesByStageId;
}

function groupTimeTrialPlans(rows: TimeTrialPlanRow[]) {
  const plansByStageId = new Map<
    string,
    Record<string, TimeTrialRiderPlan>
  >();

  for (const row of rows) {
    const stagePlans = plansByStageId.get(row.stage_id) ?? {};
    stagePlans[row.rider_id] = {
      effortMode: row.effort_mode,
      relaySharePct:
        row.relay_share_pct === null ? null : Number(row.relay_share_pct),
    };
    plansByStageId.set(row.stage_id, stagePlans);
  }

  return plansByStageId;
}

const loadCachedStageSegmentBatch = unstable_cache(
  async (stageIdBatch: string[]): Promise<StageSegmentRow[]> => {
    const admin = createSupabaseAdminClient();
    const result = await collectPaginatedRows<
      StageSegmentRow,
      { message: string }
    >({
      fetchPage: async (from, to) => {
        const page = await admin
          .from("stage_segments")
          .select(
            `
              id,
              stage_id,
              segment_number,
              distance_km,
              terrain_type,
              surface_type,
              average_gradient_pct,
              stage_segment_primes (
                prime_type,
                mountain_category,
                points_scale
              )
            `,
          )
          .in("stage_id", stageIdBatch)
          .order("stage_id", { ascending: true })
          .order("segment_number", { ascending: true })
          .range(from, to)
          .returns<StageSegmentRow[]>();

        return {
          data: page.data,
          error: page.error,
        };
      },
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.data;
  },
  ["race-calendar-stage-segments-v2"],
  {
    revalidate: 900,
    tags: ["race-calendar-stage-segments"],
  },
);

async function loadStageSegments(stageIds: string[]) {
  if (stageIds.length === 0) {
    return emptyResult<StageSegmentRow>();
  }

  const normalizedStageIds = [...new Set(stageIds)].sort();

  try {
    const batchRows = await Promise.all(
      chunkValues(normalizedStageIds).map((stageIdBatch) =>
        loadCachedStageSegmentBatch(stageIdBatch),
      ),
    );

    return {
      data: batchRows.flat(),
      error: null,
    };
  } catch (error) {
    return {
      data: [] as StageSegmentRow[],
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Impossible de charger les segments de course.",
      },
    };
  }
}

function formatParisDate(date: Date) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

const URL_SAFE_UUID_FILTER_CHUNK_SIZE = 40;
const RIDER_CONTEXT_RPC_CHUNK_SIZE = 500;
const RIDER_CONTEXT_RPC_CONCURRENCY = 4;

async function loadRaceCalendarRiderContext({
  supabase,
  admin,
  riderIds,
}: {
  supabase: SupabaseServerClient;
  admin: SupabaseAdminClient;
  riderIds: string[];
}) {
  if (riderIds.length === 0) {
    return createEmptyRaceCalendarRiderContext();
  }

  const contextResult = await loadCompactRaceCalendarRiderContext(
    admin,
    riderIds,
  );

  if (!contextResult.error) {
    return parseRaceCalendarRiderContext(contextResult.data);
  }

  // Le repli évite toute fenêtre de panne entre la migration Supabase et le
  // déploiement applicatif. Les petits lots restent sous les limites d'URL de
  // PostgREST, contrairement aux anciens lots de 100 UUID.
  console.warn(
    "La RPC compacte du contexte coureur est indisponible, repli par petits lots :",
    contextResult.error,
  );
  const [
    specialAbilitiesResult,
    riderCountriesResult,
    nationalChampionshipTitlesByRiderId,
    worldChampionshipTitlesByRiderId,
    continentalChampionshipTitlesByRiderId,
    performancePreparationsResult,
  ] = await Promise.all([
    collectChunkedPaginatedRows<
      RiderSpecialAbilityRow,
      { message: string },
      string
    >({
      values: riderIds,
      chunkSize: URL_SAFE_UUID_FILTER_CHUNK_SIZE,
      fetchPage: async (chunk, from, to) => {
        const result = await supabase
          .from("rider_special_abilities")
          .select("rider_id, ability_code")
          .in("rider_id", chunk)
          .order("rider_id", { ascending: true })
          .order("ability_code", { ascending: true })
          .range(from, to)
          .returns<RiderSpecialAbilityRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RiderCountryRow, { message: string }, string>({
      values: riderIds,
      chunkSize: URL_SAFE_UUID_FILTER_CHUNK_SIZE,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("riders")
          .select(
            "id, country_id, avatar_profile_key, avatar_seed, career_race_days",
          )
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderCountryRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    getActiveNationalChampionshipTitlesByDisciplineForRiders(
      supabase,
      riderIds,
    ).catch((error: unknown) => {
      console.error(
        "Impossible de charger les maillots de champions nationaux du calendrier :",
        error,
      );
      return new Map<string, ActiveNationalChampionshipTitlesByDiscipline>();
    }),
    getActiveWorldChampionshipTitlesByDisciplineForRiders(
      supabase,
      riderIds,
    ).catch((error: unknown) => {
      console.error(
        "Impossible de charger les maillots de champions du monde du calendrier :",
        error,
      );
      return new Map<string, ActiveWorldChampionshipTitlesByDiscipline>();
    }),
    getActiveContinentalChampionshipTitlesByDisciplineForRiders(
      supabase,
      riderIds,
    ).catch((error: unknown) => {
      console.error(
        "Impossible de charger les maillots de champions continentaux du calendrier :",
        error,
      );
      return new Map<
        string,
        ActiveContinentalChampionshipTitlesByDiscipline
      >();
    }),
    collectChunkedPaginatedRows<
      RiderPerformancePreparationRow,
      { message: string },
      string
    >({
      values: riderIds,
      chunkSize: URL_SAFE_UUID_FILTER_CHUNK_SIZE,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("rider_performance_preparations")
          .select(
            "rider_id, preparation_type, bonus_start_game_day, bonus_end_game_day, rating_bonus",
          )
          .in("rider_id", chunk)
          .neq("status", "cancelled")
          .order("rider_id", { ascending: true })
          .range(from, to)
          .returns<RiderPerformancePreparationRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuerySucceeded(
    specialAbilitiesResult.error,
    "les capacités spéciales des coureurs engagés",
  );
  assertQuerySucceeded(
    riderCountriesResult.error,
    "les nationalités des coureurs engagés",
  );
  assertQuerySucceeded(
    performancePreparationsResult.error,
    "les bonus de préparation des coureurs engagés",
  );

  return {
    riderCountryRows: riderCountriesResult.data,
    specialAbilitiesByRiderId: groupSpecialAbilities(
      specialAbilitiesResult.data,
    ),
    performancePreparationRows: performancePreparationsResult.data,
    nationalChampionshipTitlesByRiderId,
    worldChampionshipTitlesByRiderId,
    continentalChampionshipTitlesByRiderId,
  };
}

async function loadCompactRaceCalendarRiderContext(
  admin: SupabaseAdminClient,
  riderIds: string[],
) {
  const rows: RaceCalendarRiderContextRow[] = [];
  const riderIdChunks = chunkValues(riderIds, RIDER_CONTEXT_RPC_CHUNK_SIZE);

  for (const requestBatch of chunkValues(
    riderIdChunks,
    RIDER_CONTEXT_RPC_CONCURRENCY,
  )) {
    const results = await Promise.all(
      requestBatch.map(async (riderIdChunk) => {
        const result = await admin.rpc("get_race_calendar_rider_context", {
          p_rider_ids: riderIdChunk,
        });
        return {
          data: result.data as RaceCalendarRiderContextRow[] | null,
          error: result.error,
        };
      }),
    );
    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) {
      return {
        data: [] as RaceCalendarRiderContextRow[],
        error: failedResult.error,
      };
    }
    rows.push(...results.flatMap((result) => result.data ?? []));
  }

  return { data: rows, error: null };
}

function createEmptyRaceCalendarRiderContext() {
  return {
    riderCountryRows: [] as RiderCountryRow[],
    specialAbilitiesByRiderId: new Map<string, RiderSpecialAbility[]>(),
    performancePreparationRows: [] as RiderPerformancePreparationRow[],
    nationalChampionshipTitlesByRiderId: new Map<
      string,
      ActiveNationalChampionshipTitlesByDiscipline
    >(),
    worldChampionshipTitlesByRiderId: new Map<
      string,
      ActiveWorldChampionshipTitlesByDiscipline
    >(),
    continentalChampionshipTitlesByRiderId: new Map<
      string,
      ActiveContinentalChampionshipTitlesByDiscipline
    >(),
  };
}

function parseRaceCalendarRiderContext(
  rows: RaceCalendarRiderContextRow[],
) {
  const context = createEmptyRaceCalendarRiderContext();
  const specialAbilityRows: RiderSpecialAbilityRow[] = [];

  for (const row of rows) {
    context.riderCountryRows.push({
      id: row.id,
      country_id: row.country_id,
      avatar_profile_key: row.avatar_profile_key,
      avatar_seed: row.avatar_seed,
      career_race_days: row.career_race_days,
    });

    if (Array.isArray(row.special_ability_codes)) {
      for (const abilityCode of row.special_ability_codes) {
        if (typeof abilityCode === "string") {
          specialAbilityRows.push({
            rider_id: row.id,
            ability_code: abilityCode,
          });
        }
      }
    }

    if (Array.isArray(row.performance_preparations)) {
      for (const value of row.performance_preparations) {
        const preparation = parsePerformancePreparation(value, row.id);
        if (preparation) {
          context.performancePreparationRows.push(preparation);
        }
      }
    }

    if (Array.isArray(row.championship_titles)) {
      for (const value of row.championship_titles) {
        const title = parseChampionshipTitle(value, row.id);
        if (title) addChampionshipTitleToContext(context, title);
      }
    }
  }

  context.specialAbilitiesByRiderId = groupSpecialAbilities(
    specialAbilityRows,
  );
  return context;
}

function parsePerformancePreparation(
  value: unknown,
  riderId: string,
): RiderPerformancePreparationRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    (row.preparation_type !== "indoor_track" &&
      row.preparation_type !== "wind_tunnel") ||
    !Number.isFinite(row.bonus_start_game_day) ||
    !Number.isFinite(row.bonus_end_game_day) ||
    !Number.isFinite(row.rating_bonus)
  ) {
    return null;
  }

  return {
    rider_id: riderId,
    preparation_type: row.preparation_type,
    bonus_start_game_day: Number(row.bonus_start_game_day),
    bonus_end_game_day: Number(row.bonus_end_game_day),
    rating_bonus: Number(row.rating_bonus),
  };
}

function parseChampionshipTitle(
  value: unknown,
  riderId: string,
): RaceCalendarChampionshipTitleRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.championship_type !== "string") return null;
  return {
    rider_id: riderId,
    championship_type: row.championship_type,
    country_code:
      typeof row.country_code === "string" ? row.country_code : null,
    country_name:
      typeof row.country_name === "string" ? row.country_name : null,
  };
}

function addChampionshipTitleToContext(
  context: ReturnType<typeof createEmptyRaceCalendarRiderContext>,
  title: RaceCalendarChampionshipTitleRow,
) {
  if (
    (title.championship_type === "road" ||
      title.championship_type === "time_trial") &&
    title.country_code &&
    title.country_name
  ) {
    const current =
      context.nationalChampionshipTitlesByRiderId.get(title.rider_id) ?? {};
    current[title.championship_type] = {
      riderId: title.rider_id,
      countryCode: title.country_code,
      countryName: title.country_name,
      championshipType: title.championship_type,
    };
    context.nationalChampionshipTitlesByRiderId.set(title.rider_id, current);
    return;
  }

  if (
    title.championship_type === "world_road" ||
    title.championship_type === "world_time_trial"
  ) {
    const discipline =
      title.championship_type === "world_time_trial" ? "time_trial" : "road";
    const current =
      context.worldChampionshipTitlesByRiderId.get(title.rider_id) ?? {};
    current[discipline] = {
      riderId: title.rider_id,
      countryCode: "",
      countryName: "Monde",
      championshipType: discipline,
    };
    context.worldChampionshipTitlesByRiderId.set(title.rider_id, current);
    return;
  }

  const continental = parseContinentalChampionshipTitleType(
    title.championship_type,
  );
  if (!continental) return;
  const current =
    context.continentalChampionshipTitlesByRiderId.get(title.rider_id) ?? {};
  current[continental.championshipType] = {
    riderId: title.rider_id,
    ...continental,
  };
  context.continentalChampionshipTitlesByRiderId.set(title.rider_id, current);
}

async function loadCalendarEngagedRiders(
  supabase: SupabaseServerClient,
  editionIds: string[],
  { isScoped }: { isScoped: boolean },
) {
  const targetedResult = await collectPaginatedRows<
    CalendarEngagedRiderRow,
    { message: string }
  >({
    fetchPage: async (from, to) => {
      const result = await supabase
        .rpc("get_calendar_engaged_riders", {
          p_race_edition_ids: editionIds,
        })
        .range(from, to);
      return {
        data: result.data as CalendarEngagedRiderRow[] | null,
        error: result.error,
      };
    },
  });
  if (!targetedResult.error) return targetedResult;

  // Déploiement sans coupure : tant que la migration n'est pas encore visible
  // dans le cache PostgREST, l'ancienne RPC reste utilisable. Le filtrage en
  // mémoire ne sert que de repli et disparaît dès que la RPC ciblée répond.
  console.warn(
    "La RPC ciblée des startlists est indisponible, repli temporaire :",
    targetedResult.error,
  );
  const fallbackResult = await collectPaginatedRows<
    CalendarEngagedRiderRow,
    { message: string }
  >({
    fetchPage: async (from, to) => {
      const result =
        isScoped && editionIds.length === 1
          ? await supabase
              .rpc("get_race_edition_engaged_riders", {
                p_race_edition_id: editionIds[0],
              })
              .range(from, to)
          : await supabase
              .rpc("get_active_calendar_engaged_riders")
              .range(from, to);
      return {
        data: result.data as CalendarEngagedRiderRow[] | null,
        error: result.error,
      };
    },
  });
  if (fallbackResult.error || !isScoped || editionIds.length === 1) {
    return fallbackResult;
  }

  const targetedEditionIds = new Set(editionIds);
  return {
    data: fallbackResult.data.filter((row) =>
      targetedEditionIds.has(row.race_edition_id),
    ),
    error: null,
  };
}

function emptyResult<T>() {
  return {
    data: [] as T[],
    error: null,
  };
}

function assertQuerySucceeded(
  error: { message: string } | null,
  subject: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${subject} : ${error.message}`);
  }
}
