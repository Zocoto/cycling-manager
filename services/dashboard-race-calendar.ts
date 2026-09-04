import "server-only";

import {
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
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { canTeamAccessRaceCategory } from "@/lib/game/regional-races";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type EditionRow = {
  id: string;
  race_id: string;
  host_country_id: string | null;
  race_category_id: string;
  display_name: string;
  status: RaceCalendarEdition["status"];
  registration_closes_at: string | null;
  wildcard_closes_at: string | null;
  withdrawal_closes_at: string | null;
  minimum_reputation: number | null;
  registration_policy: RegistrationPolicy;
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

type CategoryRow = {
  id: string;
  code: string;
  name: string;
  prestige_rank: number;
  minimum_roster_size: number | null;
  maximum_roster_size: number | null;
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
  day_slot: string;
  departure_at: string | null;
};

type DayRow = {
  id: string;
  day_number: number;
  calendar_date: string;
  label: string | null;
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

type RegistrationRow = {
  race_edition_id: string;
  registration_status: NonNullable<
    RaceCalendarEdition["currentTeamRegistration"]
  >["status"];
  roster_count: number;
};

type SponsorObjectiveRaceRow = {
  race_edition_id: string;
};

export async function getDashboardRaceCalendar(
  supabase: SupabaseServerClient,
  {
    seasonId,
    seasonName,
    currentDayNumber,
  }: {
    seasonId: string;
    seasonName: string;
    currentDayNumber: number;
  },
): Promise<SeasonRaceCalendar> {
  const [
    editionsResult,
    daysResult,
    registrationsResult,
    sponsorObjectivesResult,
    regionalRaceContextResult,
  ] = await Promise.all([
    supabase
      .from("race_editions")
      .select(
        "id, race_id, host_country_id, race_category_id, display_name, status, registration_closes_at, wildcard_closes_at, withdrawal_closes_at, minimum_reputation, registration_policy",
      )
      .eq("season_id", seasonId)
      .in("status", [
        "planned",
        "registration_open",
        "registration_closed",
      ])
      .returns<EditionRow[]>(),
    supabase
      .from("season_days")
      .select("id, day_number, calendar_date, label")
      .eq("season_id", seasonId)
      .order("day_number", { ascending: true })
      .returns<DayRow[]>(),
    supabase.rpc("get_current_team_calendar_registrations"),
    supabase.rpc("get_current_team_sponsor_objective_races"),
    supabase.rpc("get_current_team_regional_race_context"),
  ]);

  assertQuery(editionsResult.error, "les courses du bureau");
  assertQuery(daysResult.error, "les journées de la saison");
  assertQuery(registrationsResult.error, "les inscriptions de l'équipe");
  assertQuery(sponsorObjectivesResult.error, "les objectifs sponsor");
  assertQuery(
    regionalRaceContextResult.error,
    "l’éligibilité aux courses régionales",
  );

  const editions = editionsResult.data ?? [];
  const sponsorObjectiveEditionIds = new Set(((sponsorObjectivesResult.data as SponsorObjectiveRaceRow[] | null) ?? []).map((objective) => objective.race_edition_id));
  const regionalRaceContext =
    ((regionalRaceContextResult.data as RegionalRaceContextRow[] | null) ??
      [])[0] ?? null;
  const editionIds = editions.map((edition) => edition.id);
  const raceIds = unique(editions.map((edition) => edition.race_id));
  const categoryIds = unique(
    editions.map((edition) => edition.race_category_id),
  );

  const [racesResult, categoriesResult, stagesResult] = await Promise.all([
    raceIds.length
      ? supabase
          .from("races")
          .select(
            "id, country_id, name, short_name, race_format, slug, competition_type, is_grand_tour",
          )
          .in("id", raceIds)
          .returns<RaceRow[]>()
      : emptyResult<RaceRow>(),
    categoryIds.length
      ? supabase
          .from("race_categories")
          .select(
            "id, code, name, prestige_rank, minimum_roster_size, maximum_roster_size",
          )
          .in("id", categoryIds)
          .returns<CategoryRow[]>()
      : emptyResult<CategoryRow>(),
    editionIds.length
      ? supabase
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, stage_number, name, stage_type, status, profile_type, distance_km, day_slot, departure_at",
          )
          .in("race_edition_id", editionIds)
          .neq("status", "cancelled")
          .returns<StageRow[]>()
      : emptyResult<StageRow>(),
  ]);

  assertQuery(racesResult.error, "les identités des courses");
  assertQuery(categoriesResult.error, "les catégories des courses");
  assertQuery(stagesResult.error, "les étapes des prochaines courses");

  const races = racesResult.data ?? [];
  const countryIds = unique([
    ...races.map((race) => race.country_id),
    ...editions.flatMap((edition) =>
      edition.host_country_id ? [edition.host_country_id] : [],
    ),
  ]);
  const countriesResult = countryIds.length
    ? await supabase
        .from("countries")
        .select("id, name, iso_alpha2, continent_code")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : emptyResult<CountryRow>();

  assertQuery(countriesResult.error, "les pays des prochaines courses");

  const dayById = new Map(
    (daysResult.data ?? []).map((day) => [day.id, day]),
  );
  const raceById = new Map(races.map((race) => [race.id, race]));
  const categoryById = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const registrationByEditionId = new Map(
    ((registrationsResult.data as RegistrationRow[] | null) ?? []).map(
      (registration) => [registration.race_edition_id, registration],
    ),
  );
  const stagesByEditionId = new Map<string, RaceCalendarStage[]>();

  for (const stage of stagesResult.data ?? []) {
    const day = dayById.get(stage.season_day_id);
    if (!day || !isRaceDaySlot(stage.day_slot)) continue;

    const normalizedStage: RaceCalendarStage = {
      id: stage.id,
      dayNumber: day.day_number,
      stageNumber: stage.stage_number,
      name: stage.name,
      stageType: stage.stage_type,
      status: stage.status,
      profileType: stage.profile_type,
      distanceKm: Number(stage.distance_km),
      daySlot: stage.day_slot,
      departureAt: stage.departure_at,
      segments: [],
    };
    const current = stagesByEditionId.get(stage.race_edition_id) ?? [];
    current.push(normalizedStage);
    stagesByEditionId.set(stage.race_edition_id, current);
  }

  const calendarEditions = editions.flatMap((edition): RaceCalendarEdition[] => {
    const race = raceById.get(edition.race_id);
    const category = categoryById.get(edition.race_category_id);
    const country = race
      ? countryById.get(edition.host_country_id ?? race.country_id)
      : null;
    const stages = stagesByEditionId.get(edition.id) ?? [];

    if (!race || !category || !country || !isRaceCategoryCode(category.code)) {
      return [];
    }
    if (
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
      return [];
    }
    if (!stages.length) return [];

    const registration = registrationByEditionId.get(edition.id);

    return [
      {
        id: edition.id,
        status: edition.status,
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
        isSponsorObjective: sponsorObjectiveEditionIds.has(edition.id),
        registrationClosesAt: edition.registration_closes_at,
        wildcardClosesAt: edition.wildcard_closes_at,
        withdrawalClosesAt: edition.withdrawal_closes_at,
        registrationPolicy: edition.registration_policy,
        minimumReputation: edition.minimum_reputation,
        fieldLimit: null,
        minimumRosterSize:
          race.competition_type === "standard"
            ? (category.minimum_roster_size ?? 1)
            : 1,
        maximumRosterSize:
          race.competition_type === "standard"
            ? (category.maximum_roster_size ?? 1)
            : 200,
        engagedRiderCount: 0,
        engagedRiders: [],
        currentTeamRegistration: registration
          ? {
              status: registration.registration_status,
              rosterCount: registration.roster_count,
            }
          : null,
        stages,
      },
    ];
  });

  const days = daysResult.data ?? [];

  return {
    seasonId,
    seasonName,
    gameYear: new Date().getUTCFullYear(),
    startsOn: days[0]?.calendar_date ?? "",
    endsOn: days.at(-1)?.calendar_date ?? "",
    currentDayNumber,
    days: days.map((day) => ({
      id: day.id,
      dayNumber: day.day_number,
      calendarDate: day.calendar_date,
      label: day.label,
    })),
    events: [],
    editions: calendarEditions,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function emptyResult<T>() {
  return { data: [] as T[], error: null };
}

function assertQuery(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resource} : ${error.message}`);
  }
}
