import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getEffectiveSeasonDay,
  isRaceCategoryCode,
  type RaceCalendarEdition,
  type RaceCalendarStage,
  type RaceFormat,
  type RaceProfileType,
  type RaceStageStatus,
  type RaceStageType,
  type RegistrationPolicy,
  type SeasonCalendarDay,
  type SeasonCalendarEvent,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
};

type RaceCategoryRow = {
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
  departure_at: string | null;
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

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type SportingDirectorReputationRow = {
  reputation_points: number;
};

type RaceRegistrationRow = {
  registration_id: string;
  registration_status:
    | "pending"
    | "accepted"
    | "rejected"
    | "withdrawn";
  registration_registered_at: string | null;
  roster_count: number;
  withdrawal_closes_at: string | null;
};

type CalendarRegistrationRow = {
  race_edition_id: string;
  registration_status: CurrentRaceRegistration["status"];
  roster_count: number;
};

type EngagedRiderCountRow = {
  race_edition_id: string;
  engaged_rider_count: number;
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
  isSelected: boolean;
  isAvailable: boolean;
  conflict: {
    raceSlug: string;
    raceName: string;
    startDay: number;
    endDay: number;
  } | null;
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
  is_selected: boolean;
  is_available: boolean;
  conflicting_race_slug: string | null;
  conflicting_race_name: string | null;
  conflicting_start_day: number | null;
  conflicting_end_day: number | null;
};

export type RaceEngagedRider = {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  riderId: string;
  riderName: string;
  countryCode: string;
};

type RaceEngagedRiderRow = {
  team_id: string;
  team_name: string;
  team_short_name: string | null;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  country_iso_alpha2: string;
};

export async function getActiveSeasonRaceCalendar(
  supabase: SupabaseServerClient,
  now = new Date()
): Promise<SeasonRaceCalendar | null> {
  const {
    data: season,
    error: seasonError,
  } = await supabase
    .from("seasons")
    .select(
      `
        id,
        game_year,
        name,
        starts_on,
        ends_on,
        current_day_number
      `
    )
    .eq("status", "active")
    .maybeSingle<SeasonRow>();

  if (seasonError) {
    throw new Error(
      `Impossible de charger la saison active : ${seasonError.message}`
    );
  }

  if (!season) {
    return null;
  }

  const [
    daysResult,
    editionsResult,
    registrationsResult,
    engagedRiderCountsResult,
  ] =
    await Promise.all([
      supabase
        .from("season_days")
        .select(
          "id, day_number, calendar_date, label"
        )
        .eq("season_id", season.id)
        .order("day_number", {
          ascending: true,
        })
        .returns<SeasonDayRow[]>(),

      supabase
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
            minimum_reputation,
            registration_policy
          `
        )
        .eq("season_id", season.id)
        .neq("status", "cancelled")
        .returns<RaceEditionRow[]>(),

      supabase.rpc(
        "get_current_team_calendar_registrations"
      ),

      supabase.rpc(
        "get_active_calendar_engaged_rider_counts"
      ),
    ]);

  if (daysResult.error) {
    throw new Error(
      `Impossible de charger les journées de saison : ${daysResult.error.message}`
    );
  }

  if (editionsResult.error) {
    throw new Error(
      `Impossible de charger les éditions de course : ${editionsResult.error.message}`
    );
  }

  if (registrationsResult.error) {
    throw new Error(
      `Impossible de charger les inscriptions du calendrier : ${registrationsResult.error.message}`
    );
  }

  if (engagedRiderCountsResult.error) {
    throw new Error(
      `Impossible de charger le nombre de coureurs engagés : ${engagedRiderCountsResult.error.message}`
    );
  }

  const dayRows = daysResult.data ?? [];
  const editionRows =
    editionsResult.data ?? [];
  const dayIds = dayRows.map((day) => day.id);
  const editionIds = editionRows.map(
    (edition) => edition.id
  );
  const raceIds = unique(
    editionRows.map((edition) => edition.race_id)
  );
  const categoryIds = unique(
    editionRows.map(
      (edition) => edition.race_category_id
    )
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
              `
            )
            .in("season_day_id", dayIds)
            .returns<SeasonEventRow[]>()
        : Promise.resolve(emptyResult<SeasonEventRow>()),

      raceIds.length > 0
        ? supabase
            .from("races")
            .select(
              `
                id,
                country_id,
                name,
                short_name,
                race_format,
                slug
              `
            )
            .in("id", raceIds)
            .returns<RaceRow[]>()
        : Promise.resolve(emptyResult<RaceRow>()),

      categoryIds.length > 0
        ? supabase
            .from("race_categories")
            .select(
              "id, code, name, prestige_rank, minimum_roster_size, maximum_roster_size"
            )
            .in("id", categoryIds)
            .returns<RaceCategoryRow[]>()
        : Promise.resolve(
            emptyResult<RaceCategoryRow>()
          ),

      editionIds.length > 0
        ? supabase
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
                departure_at
              `
            )
            .in("race_edition_id", editionIds)
            .order("stage_number", {
              ascending: true,
            })
            .returns<StageRow[]>()
        : Promise.resolve(emptyResult<StageRow>()),
    ]);

  assertQuerySucceeded(
    eventsResult.error,
    "les temps forts de la saison"
  );
  assertQuerySucceeded(
    racesResult.error,
    "les courses"
  );
  assertQuerySucceeded(
    categoriesResult.error,
    "les catégories de course"
  );
  assertQuerySucceeded(
    stagesResult.error,
    "les étapes"
  );

  const stageRows = stagesResult.data ?? [];
  const stageIds = stageRows.map((stage) => stage.id);
  const segmentsResult =
    stageIds.length > 0
      ? await supabase
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
            `
          )
          .in("stage_id", stageIds)
          .order("segment_number", { ascending: true })
          .returns<StageSegmentRow[]>()
      : emptyResult<StageSegmentRow>();

  assertQuerySucceeded(
    segmentsResult.error,
    "les profils tronçonnés"
  );

  const segmentRows = segmentsResult.data ?? [];

  const raceRows = racesResult.data ?? [];
  const countryIds = unique(
    raceRows.map((race) => race.country_id)
  );
  const countriesResult =
    countryIds.length > 0
      ? await supabase
          .from("countries")
          .select("id, name, iso_alpha2")
          .in("id", countryIds)
          .returns<CountryRow[]>()
      : emptyResult<CountryRow>();

  assertQuerySucceeded(
    countriesResult.error,
    "les pays des courses"
  );

  const dayById = new Map(
    dayRows.map((day) => [day.id, day])
  );
  const raceById = new Map(
    raceRows.map((race) => [race.id, race])
  );
  const categoryById = new Map(
    (categoriesResult.data ?? []).map(
      (category) => [category.id, category]
    )
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map(
      (country) => [country.id, country]
    )
  );
  const stagesByEditionId = groupStages(
    stageRows,
    dayById,
    segmentRows
  );
  const registrationByEditionId = new Map(
    ((registrationsResult.data as CalendarRegistrationRow[] | null) ?? []).map(
      (registration) => [
        registration.race_edition_id,
        registration,
      ]
    )
  );
  const engagedRiderCountByEditionId = new Map(
    ((engagedRiderCountsResult.data as
      | EngagedRiderCountRow[]
      | null) ?? []).map((entry) => [
      entry.race_edition_id,
      entry.engaged_rider_count,
    ])
  );

  const editions = editionRows
    .map((edition) => {
      const race = raceById.get(
        edition.race_id
      );
      const category = categoryById.get(
        edition.race_category_id
      );
      const country = race
        ? countryById.get(race.country_id)
        : null;

      if (
        !race ||
        !category ||
        !country ||
        !isRaceCategoryCode(category.code)
      ) {
        return null;
      }

      return {
        id: edition.id,
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
        registrationClosesAt:
          edition.registration_closes_at,
        withdrawalClosesAt:
          edition.withdrawal_closes_at,
        registrationPolicy:
          edition.registration_policy,
        minimumReputation:
          edition.minimum_reputation,
        minimumRosterSize:
          category.minimum_roster_size ?? 1,
        maximumRosterSize:
          category.maximum_roster_size ?? 1,
        engagedRiderCount:
          engagedRiderCountByEditionId.get(
            edition.id
          ) ?? 0,
        currentTeamRegistration: registrationByEditionId.has(
          edition.id
        )
          ? {
              status: registrationByEditionId.get(
                edition.id
              )!.registration_status,
              rosterCount: registrationByEditionId.get(
                edition.id
              )!.roster_count,
            }
          : null,
        stages:
          stagesByEditionId.get(edition.id) ?? [],
      } satisfies RaceCalendarEdition;
    })
    .filter(
      (
        edition
      ): edition is RaceCalendarEdition =>
        edition !== null &&
        edition.stages.length > 0
    );

  const days = dayRows.map(
    (day): SeasonCalendarDay => ({
      id: day.id,
      dayNumber: day.day_number,
      calendarDate: day.calendar_date,
      label: day.label,
    })
  );
  const events = (eventsResult.data ?? [])
    .map((event) => {
      const day = dayById.get(
        event.season_day_id
      );

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
    .filter(
      (
        event
      ): event is SeasonCalendarEvent =>
        event !== null
    );

  return {
    seasonId: season.id,
    seasonName: season.name,
    gameYear: season.game_year,
    startsOn: season.starts_on,
    endsOn: season.ends_on,
    currentDayNumber: getEffectiveSeasonDay({
      startsOn: season.starts_on,
      persistedDayNumber:
        season.current_day_number,
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
  raceEditionId: string
): Promise<CurrentRaceUserContext> {
  const [directorResult, registrationResult] =
    await Promise.all([
      supabase
        .from("sporting_directors")
        .select("reputation_points")
        .eq("auth_user_id", authUserId)
        .maybeSingle<SportingDirectorReputationRow>(),

      supabase.rpc(
        "get_current_team_race_registration",
        {
          p_race_edition_id: raceEditionId,
        }
      ),
    ]);

  if (directorResult.error) {
    throw new Error(
      `Impossible de charger la réputation du Directeur Sportif : ${directorResult.error.message}`
    );
  }

  if (registrationResult.error) {
    throw new Error(
      `Impossible de charger l'inscription de l'équipe : ${registrationResult.error.message}`
    );
  }

  const registrationRow = Array.isArray(
    registrationResult.data
  )
    ? (registrationResult.data[0] as
        | RaceRegistrationRow
        | undefined)
    : undefined;

  return {
    reputationPoints:
      directorResult.data?.reputation_points ?? 0,
    registration: registrationRow
      ? {
          id: registrationRow.registration_id,
          status:
            registrationRow.registration_status,
          registeredAt:
            registrationRow.registration_registered_at,
          rosterCount: registrationRow.roster_count,
          withdrawalClosesAt:
            registrationRow.withdrawal_closes_at,
        }
      : null,
  };
}

export async function getRacePastWinners(
  supabase: SupabaseServerClient,
  raceId: string
): Promise<RacePastWinner[]> {
  const { data, error } = await supabase.rpc(
    "get_race_past_winners",
    {
      p_race_id: raceId,
    }
  );

  if (error) {
    throw new Error(
      `Impossible de charger le palmarès de la course : ${error.message}`
    );
  }

  return (
    (data as RacePastWinnerRow[] | null) ?? []
  ).map((winner) => ({
    gameYear: winner.game_year,
    seasonName: winner.season_name,
    finalRank: winner.final_rank,
    riderId: winner.rider_id,
    riderName:
      `${winner.rider_first_name} ${winner.rider_last_name}`,
    teamName: winner.team_name,
  }));
}

export async function getCurrentTeamRaceRosterOptions(
  supabase: SupabaseServerClient,
  raceEditionId: string
): Promise<RaceRosterOption[]> {
  const { data, error } = await supabase.rpc(
    "get_current_team_race_roster_options",
    { p_race_edition_id: raceEditionId }
  );

  if (error) {
    throw new Error(
      `Impossible de charger votre effectif pour cette course : ${error.message}`
    );
  }

  return ((data as RaceRosterOptionRow[] | null) ?? []).map(
    (rider) => ({
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
      isSelected: rider.is_selected,
      isAvailable: rider.is_available,
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
    })
  );
}

export async function getRaceEngagedRiders(
  supabase: SupabaseServerClient,
  raceEditionId: string
): Promise<RaceEngagedRider[]> {
  const { data, error } = await supabase.rpc(
    "get_race_engaged_riders",
    { p_race_edition_id: raceEditionId }
  );

  if (error) {
    throw new Error(
      `Impossible de charger les coureurs engagés : ${error.message}`
    );
  }

  return ((data as RaceEngagedRiderRow[] | null) ?? []).map(
    (rider) => ({
      teamId: rider.team_id,
      teamName: rider.team_name,
      teamShortName: rider.team_short_name,
      riderId: rider.rider_id,
      riderName: `${rider.rider_first_name} ${rider.rider_last_name}`,
      countryCode: rider.country_iso_alpha2,
    })
  );
}

function groupStages(
  rows: StageRow[],
  dayById: Map<string, SeasonDayRow>,
  segmentRows: StageSegmentRow[]
) {
  const stagesByEditionId = new Map<
    string,
    RaceCalendarStage[]
  >();
  const segmentsByStageId = new Map<string, StageSegmentRow[]>();

  for (const segment of segmentRows) {
    const stageSegments = segmentsByStageId.get(segment.stage_id) ?? [];
    stageSegments.push(segment);
    segmentsByStageId.set(segment.stage_id, stageSegments);
  }

  for (const row of rows) {
    const day = dayById.get(
      row.season_day_id
    );

    if (!day) {
      continue;
    }

    const stage: RaceCalendarStage = {
      id: row.id,
      dayNumber: day.day_number,
      stageNumber: row.stage_number,
      name: row.name,
      stageType: row.stage_type,
      status: row.status,
      profileType: row.profile_type,
      distanceKm: Number(row.distance_km),
      departureAt: row.departure_at,
      segments: (segmentsByStageId.get(row.id) ?? []).map((segment) => {
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
      }),
    };
    const editionStages =
      stagesByEditionId.get(
        row.race_edition_id
      ) ?? [];

    editionStages.push(stage);
    stagesByEditionId.set(
      row.race_edition_id,
      editionStages
    );
  }

  return stagesByEditionId;
}

function formatParisDate(date: Date) {
  const parts = new Intl.DateTimeFormat(
    "fr-FR",
    {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);
  const partByType = new Map(
    parts.map((part) => [part.type, part.value])
  );

  return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function emptyResult<T>() {
  return {
    data: [] as T[],
    error: null,
  };
}

function assertQuerySucceeded(
  error: { message: string } | null,
  subject: string
): asserts error is null {
  if (error) {
    throw new Error(
      `Impossible de charger ${subject} : ${error.message}`
    );
  }
}
