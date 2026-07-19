import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getEffectiveSeasonDay,
  isRaceCategoryCode,
  type RaceCalendarEdition,
  type RaceCalendarStage,
  type RaceFormat,
  type RaceProfileType,
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
};

type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
  profile_type: RaceProfileType;
  distance_km: number | string;
  departure_at: string | null;
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
};

export type CurrentRaceRegistration = {
  id: string;
  status: RaceRegistrationRow["registration_status"];
  registeredAt: string | null;
};

export type CurrentRaceUserContext = {
  reputationPoints: number;
  registration: CurrentRaceRegistration | null;
};

export type RacePastWinner = {
  gameYear: number;
  seasonName: string;
  riderId: string;
  riderName: string;
  teamName: string;
};

type RacePastWinnerRow = {
  game_year: number;
  season_name: string;
  rider_id: string;
  rider_first_name: string;
  rider_last_name: string;
  team_name: string;
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

  const [daysResult, editionsResult] =
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
            minimum_reputation,
            registration_policy
          `
        )
        .eq("season_id", season.id)
        .neq("status", "cancelled")
        .returns<RaceEditionRow[]>(),
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
              "id, code, name, prestige_rank"
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
    stagesResult.data ?? [],
    dayById
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
        registrationPolicy:
          edition.registration_policy,
        minimumReputation:
          edition.minimum_reputation,
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
    riderId: winner.rider_id,
    riderName:
      `${winner.rider_first_name} ${winner.rider_last_name}`,
    teamName: winner.team_name,
  }));
}

function groupStages(
  rows: StageRow[],
  dayById: Map<string, SeasonDayRow>
) {
  const stagesByEditionId = new Map<
    string,
    RaceCalendarStage[]
  >();

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
      profileType: row.profile_type,
      distanceKm: Number(row.distance_km),
      departureAt: row.departure_at,
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
