import "server-only";

import {
  type RiderSimulationRatings,
} from "@/lib/game/race-simulation";
import {
  type RaceSimulatorTeam,
} from "@/lib/game/race-simulator";
import {
  isRiderSpecialAbility,
  type RiderSpecialAbility,
} from "@/lib/game/special-abilities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SeasonRow = {
  id: string;
  current_day_number: number | null;
};

type TeamSeasonRow = {
  team_id: string;
  display_name: string;
};

type TeamRow = {
  id: string;
  amateur_jersey_primary_color: string | null;
  amateur_jersey_secondary_color: string | null;
};

type ContractRow = {
  rider_id: string;
  team_id: string;
};

type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
};

type RatingRow = {
  rider_id: string;
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

type SeasonDayRow = {
  id: string;
  day_number: number;
};

type ConditionRow = {
  rider_id: string;
  season_day_id: string;
  form: number;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type SpecialAbilityRow = {
  rider_id: string;
  ability_code: string;
};

export async function getRaceSimulatorTeams(): Promise<RaceSimulatorTeam[]> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();
  assertQuery(seasonResult.error, "la saison active du simulateur");

  const season = seasonResult.data;
  if (!season) return [];

  const teamSeasonsResult = await admin
    .from("team_seasons")
    .select("team_id, display_name")
    .eq("season_id", season.id)
    .returns<TeamSeasonRow[]>();
  assertQuery(teamSeasonsResult.error, "les équipes de la saison active");

  const teamSeasons = teamSeasonsResult.data ?? [];
  const teamIds = unique(teamSeasons.map((team) => team.team_id));
  if (teamIds.length === 0) return [];

  const [teamsResult, contractsResult, daysResult] = await Promise.all([
    admin
      .from("teams")
      .select(
        "id, amateur_jersey_primary_color, amateur_jersey_secondary_color"
      )
      .in("id", teamIds)
      .returns<TeamRow[]>(),
    admin
      .from("rider_contracts")
      .select("rider_id, team_id")
      .eq("status", "active")
      .in("team_id", teamIds)
      .returns<ContractRow[]>(),
    admin
      .from("season_days")
      .select("id, day_number")
      .eq("season_id", season.id)
      .lte("day_number", season.current_day_number ?? 28)
      .order("day_number", { ascending: true })
      .returns<SeasonDayRow[]>(),
  ]);

  assertQuery(teamsResult.error, "les couleurs des équipes");
  assertQuery(contractsResult.error, "les contrats actifs des coureurs");
  assertQuery(daysResult.error, "les journées de forme des coureurs");

  const contracts = contractsResult.data ?? [];
  const riderIds = unique(contracts.map((contract) => contract.rider_id));
  if (riderIds.length === 0) {
    return buildEmptyTeams(teamSeasons, teamsResult.data ?? []);
  }

  const days = daysResult.data ?? [];
  const dayIds = days.map((day) => day.id);
  const [ridersResult, ratingsResult, conditionsResult, abilitiesResult] =
    await Promise.all([
      admin
        .from("riders")
        .select("id, country_id, first_name, last_name")
        .in("id", riderIds)
        .returns<RiderRow[]>(),
      admin
        .from("rider_season_ratings")
        .select(
          "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue"
        )
        .eq("season_id", season.id)
        .in("rider_id", riderIds)
        .returns<RatingRow[]>(),
      dayIds.length > 0
        ? admin
            .from("rider_condition_states")
            .select("rider_id, season_day_id, form")
            .in("rider_id", riderIds)
            .in("season_day_id", dayIds)
            .returns<ConditionRow[]>()
        : Promise.resolve({ data: [] as ConditionRow[], error: null }),
      admin
        .from("rider_special_abilities")
        .select("rider_id, ability_code")
        .in("rider_id", riderIds)
        .returns<SpecialAbilityRow[]>(),
    ]);

  assertQuery(ridersResult.error, "les coureurs du simulateur");
  assertQuery(ratingsResult.error, "les notes des coureurs du simulateur");
  assertQuery(conditionsResult.error, "la forme des coureurs du simulateur");
  assertQuery(abilitiesResult.error, "les capacités spéciales des coureurs");

  const riders = ridersResult.data ?? [];
  const countryIds = unique(riders.map((rider) => rider.country_id));
  const countriesResult = countryIds.length
    ? await admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : { data: [] as CountryRow[], error: null };
  assertQuery(countriesResult.error, "les pays des coureurs du simulateur");

  const teamById = new Map(
    (teamsResult.data ?? []).map((team) => [team.id, team])
  );
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const ratingByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating])
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country])
  );
  const dayNumberById = new Map(days.map((day) => [day.id, day.day_number]));
  const formByRiderId = indexLatestForm(
    conditionsResult.data ?? [],
    dayNumberById
  );
  const abilitiesByRiderId = indexAbilities(abilitiesResult.data ?? []);
  const contractsByTeamId = groupBy(contracts, (contract) => contract.team_id);

  return teamSeasons
    .map((teamSeason) => {
      const team = teamById.get(teamSeason.team_id);
      const teamContracts = contractsByTeamId.get(teamSeason.team_id) ?? [];
      const teamRiders = teamContracts.flatMap((contract) => {
        const rider = riderById.get(contract.rider_id);
        const rating = ratingByRiderId.get(contract.rider_id);
        const country = rider ? countryById.get(rider.country_id) : null;
        if (!rider || !rating || !country) return [];

        return [
          {
            id: rider.id,
            firstName: rider.first_name,
            lastName: rider.last_name,
            countryName: country.name,
            countryCode: country.iso_alpha2,
            age: rating.age,
            form: formByRiderId.get(rider.id) ?? 75,
            ratings: toSimulationRatings(rating),
            specialAbilities: abilitiesByRiderId.get(rider.id) ?? [],
          },
        ];
      });

      return {
        id: teamSeason.team_id,
        name: teamSeason.display_name,
        primaryColor: normalizeColor(
          team?.amateur_jersey_primary_color,
          "#176951"
        ),
        secondaryColor: normalizeColor(
          team?.amateur_jersey_secondary_color,
          "#FFFDF4"
        ),
        riders: teamRiders.sort(
          (left, right) =>
            right.form - left.form ||
            left.lastName.localeCompare(right.lastName, "fr") ||
            left.firstName.localeCompare(right.firstName, "fr")
        ),
      } satisfies RaceSimulatorTeam;
    })
    .filter((team) => team.riders.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

function buildEmptyTeams(
  teamSeasons: TeamSeasonRow[],
  teams: TeamRow[]
): RaceSimulatorTeam[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return teamSeasons.map((teamSeason) => {
    const team = teamById.get(teamSeason.team_id);
    return {
      id: teamSeason.team_id,
      name: teamSeason.display_name,
      primaryColor: normalizeColor(
        team?.amateur_jersey_primary_color,
        "#176951"
      ),
      secondaryColor: normalizeColor(
        team?.amateur_jersey_secondary_color,
        "#FFFDF4"
      ),
      riders: [],
    };
  });
}

function toSimulationRatings(rating: RatingRow): RiderSimulationRatings {
  return {
    flat: rating.flat,
    mountain: rating.mountain,
    hills: rating.hills,
    cobbles: rating.cobbles,
    downhill: rating.downhill,
    sprint: rating.sprint,
    acceleration: rating.acceleration,
    timeTrial: rating.time_trial,
    prologue: rating.prologue,
    endurance: rating.endurance,
    resistance: rating.resistance,
    recovery: rating.recovery,
    breakaway: rating.breakaway,
  };
}

function indexLatestForm(
  rows: ConditionRow[],
  dayNumberById: Map<string, number>
) {
  const latest = new Map<string, { dayNumber: number; form: number }>();
  for (const row of rows) {
    const dayNumber = dayNumberById.get(row.season_day_id) ?? 0;
    const existing = latest.get(row.rider_id);
    if (!existing || dayNumber > existing.dayNumber) {
      latest.set(row.rider_id, { dayNumber, form: row.form });
    }
  }
  return new Map(
    [...latest.entries()].map(([riderId, value]) => [riderId, value.form])
  );
}

function indexAbilities(rows: SpecialAbilityRow[]) {
  const result = new Map<string, RiderSpecialAbility[]>();
  for (const row of rows) {
    if (!isRiderSpecialAbility(row.ability_code)) continue;
    const current = result.get(row.rider_id) ?? [];
    if (!current.includes(row.ability_code)) {
      current.push(row.ability_code);
    }
    result.set(row.rider_id, current);
  }
  return result;
}

function normalizeColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    result.set(groupKey, [...(result.get(groupKey) ?? []), item]);
  }
  return result;
}

function assertQuery(
  error: { message: string } | null | undefined,
  context: string
) {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
