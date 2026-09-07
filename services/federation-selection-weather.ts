import "server-only";

import type { RaceProfileType } from "@/lib/game/race-calendar";
import {
  getFederationSelectionForecast,
  type FederationSelectionForecast,
  type FederationSelectionOfficialStage,
  type FederationSelectionWeatherSlot,
} from "@/lib/game/federation-selection-weather";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SelectionSlotRow = {
  slot_key: string;
  competition_code: string;
  rider_category: "professional" | "junior";
  profile_label: string;
  host_country_code: string;
  day_number: number;
};
type SeasonRow = { id: string };
type FederationCountryRow = { continent_code: string };
type ProEditionRow = {
  id: string;
  race_id: string;
  host_country_id: string | null;
};
type ProRaceRow = {
  id: string;
  country_id: string;
  competition_type: string;
};
type ProStageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_type: string;
  profile_type: RaceProfileType;
};
type SeasonDayRow = { id: string; day_number: number };
type CountryRow = {
  id: string;
  iso_alpha2: string;
  continent_code: string;
};
type JuniorEditionRow = {
  id: string;
  country_code: string;
  competition_type: string;
  championship_continent_code: string | null;
};
type JuniorStageRow = {
  id: string;
  race_edition_id: string;
  day_number: number;
  stage_type: string;
  profile_type: RaceProfileType;
};

export async function getFederationSelectionForecasts({
  countryId,
  seasonId,
  gameYear,
  currentDayNumber,
  hostCountryCodeByEventType = {},
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  currentDayNumber: number;
  hostCountryCodeByEventType?: Record<string, string>;
}): Promise<Record<string, FederationSelectionForecast>> {
  const admin = createSupabaseAdminClient();
  const targetGameYear = Math.max(3, gameYear);
  const [slotsResult, countryResult, targetSeasonResult] = await Promise.all([
    admin
      .from("national_federation_selection_slots")
      .select(
        "slot_key, competition_code, rider_category, profile_label, host_country_code, day_number",
      )
      .lte("active_from_game_year", targetGameYear)
      .returns<SelectionSlotRow[]>(),
    admin
      .from("countries")
      .select("continent_code")
      .eq("id", countryId)
      .maybeSingle<FederationCountryRow>(),
    gameYear >= 3
      ? Promise.resolve({
          data: { id: seasonId } as SeasonRow,
          error: null,
        })
      : admin
          .from("seasons")
          .select("id")
          .eq("game_year", targetGameYear)
          .maybeSingle<SeasonRow>(),
  ]);

  if (slotsResult.error) throw slotsResult.error;
  if (countryResult.error) throw countryResult.error;
  if (targetSeasonResult.error) throw targetSeasonResult.error;

  const slots = (slotsResult.data ?? []).map((row) => ({
    slotKey: row.slot_key,
    competitionCode: row.competition_code,
    riderCategory: row.rider_category,
    profileLabel: row.profile_label,
    hostCountryCode:
      hostCountryCodeByEventType[getSlotEventType(row)] ??
      row.host_country_code,
    dayNumber: row.day_number,
  })) satisfies FederationSelectionWeatherSlot[];
  const officialStages = targetSeasonResult.data?.id
    ? await loadOfficialInternationalStages({
        seasonId: targetSeasonResult.data.id,
        federationContinentCode:
          countryResult.data?.continent_code ?? "world",
        slots,
      })
    : {};

  return Object.fromEntries(
    slots.map((slot) => [
      slot.slotKey,
      getFederationSelectionForecast({
        slot,
        gameYear: targetGameYear,
        currentGameYear: gameYear,
        currentDayNumber,
        officialStage: officialStages[slot.slotKey],
      }),
    ]),
  );
}

async function loadOfficialInternationalStages({
  seasonId,
  federationContinentCode,
  slots,
}: {
  seasonId: string;
  federationContinentCode: string;
  slots: FederationSelectionWeatherSlot[];
}): Promise<Record<string, FederationSelectionOfficialStage>> {
  const admin = createSupabaseAdminClient();
  const [proEditionsResult, juniorEditionsResult] = await Promise.all([
    admin
      .from("race_editions")
      .select("id, race_id, host_country_id")
      .eq("season_id", seasonId)
      .neq("status", "cancelled")
      .returns<ProEditionRow[]>(),
    admin
      .from("development_race_editions")
      .select(
        "id, country_code, competition_type, championship_continent_code",
      )
      .eq("season_id", seasonId)
      .in("competition_type", [
        "continental_road",
        "continental_time_trial",
        "world_road",
        "world_time_trial",
        "nations_cup_junior",
      ])
      .neq("status", "cancelled")
      .returns<JuniorEditionRow[]>(),
  ]);
  if (proEditionsResult.error) throw proEditionsResult.error;
  if (juniorEditionsResult.error) throw juniorEditionsResult.error;

  const proEditions = proEditionsResult.data ?? [];
  const juniorEditions = juniorEditionsResult.data ?? [];
  const raceIds = [...new Set(proEditions.map((edition) => edition.race_id))];
  const proEditionIds = proEditions.map((edition) => edition.id);
  const juniorEditionIds = juniorEditions.map((edition) => edition.id);
  const [racesResult, proStagesResult, juniorStagesResult] = await Promise.all([
    raceIds.length
      ? admin
          .from("races")
          .select("id, country_id, competition_type")
          .in("id", raceIds)
          .returns<ProRaceRow[]>()
      : Promise.resolve({ data: [] as ProRaceRow[], error: null }),
    proEditionIds.length
      ? admin
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, stage_type, profile_type",
          )
          .in("race_edition_id", proEditionIds)
          .returns<ProStageRow[]>()
      : Promise.resolve({ data: [] as ProStageRow[], error: null }),
    juniorEditionIds.length
      ? admin
          .from("development_race_stages")
          .select(
            "id, race_edition_id, day_number, stage_type, profile_type",
          )
          .in("race_edition_id", juniorEditionIds)
          .returns<JuniorStageRow[]>()
      : Promise.resolve({ data: [] as JuniorStageRow[], error: null }),
  ]);
  if (racesResult.error) throw racesResult.error;
  if (proStagesResult.error) throw proStagesResult.error;
  if (juniorStagesResult.error) throw juniorStagesResult.error;

  const races = racesResult.data ?? [];
  const internationalRaceIds = new Set(
    races
      .filter((race) =>
        [
          "continental_championship",
          "world_championship",
          "nations_cup",
        ].includes(race.competition_type),
      )
      .map((race) => race.id),
  );
  const relevantProEditions = proEditions.filter((edition) =>
    internationalRaceIds.has(edition.race_id),
  );
  const relevantProEditionIds = new Set(
    relevantProEditions.map((edition) => edition.id),
  );
  const proStages = (proStagesResult.data ?? []).filter((stage) =>
    relevantProEditionIds.has(stage.race_edition_id),
  );
  const dayIds = [...new Set(proStages.map((stage) => stage.season_day_id))];
  const countryIds = [
    ...new Set(
      relevantProEditions.flatMap((edition) => {
        const race = races.find((candidate) => candidate.id === edition.race_id);
        return [edition.host_country_id, race?.country_id].filter(
          (countryId): countryId is string => Boolean(countryId),
        );
      }),
    ),
  ];
  const [daysResult, countriesResult] = await Promise.all([
    dayIds.length
      ? admin
          .from("season_days")
          .select("id, day_number")
          .in("id", dayIds)
          .returns<SeasonDayRow[]>()
      : Promise.resolve({ data: [] as SeasonDayRow[], error: null }),
    countryIds.length
      ? admin
          .from("countries")
          .select("id, iso_alpha2, continent_code")
          .in("id", countryIds)
          .returns<CountryRow[]>()
      : Promise.resolve({ data: [] as CountryRow[], error: null }),
  ]);
  if (daysResult.error) throw daysResult.error;
  if (countriesResult.error) throw countriesResult.error;

  const raceById = new Map(races.map((race) => [race.id, race]));
  const editionById = new Map(
    relevantProEditions.map((edition) => [edition.id, edition]),
  );
  const dayById = new Map(
    (daysResult.data ?? []).map((day) => [day.id, day.day_number]),
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const juniorEditionById = new Map(
    juniorEditions.map((edition) => [edition.id, edition]),
  );

  return Object.fromEntries(
    slots.flatMap((slot) => {
      const stage =
        slot.riderCategory === "junior"
          ? findJuniorStage({
              slot,
              stages: juniorStagesResult.data ?? [],
              editionById: juniorEditionById,
              federationContinentCode,
            })
          : findProfessionalStage({
              slot,
              stages: proStages,
              editionById,
              raceById,
              dayById,
              countryById,
              federationContinentCode,
            });
      return stage ? [[slot.slotKey, stage]] : [];
    }),
  );
}

function findProfessionalStage({
  slot,
  stages,
  editionById,
  raceById,
  dayById,
  countryById,
  federationContinentCode,
}: {
  slot: FederationSelectionWeatherSlot;
  stages: ProStageRow[];
  editionById: Map<string, ProEditionRow>;
  raceById: Map<string, ProRaceRow>;
  dayById: Map<string, number>;
  countryById: Map<string, CountryRow>;
  federationContinentCode: string;
}): FederationSelectionOfficialStage | null {
  const candidates = stages.filter((stage) => {
    const edition = editionById.get(stage.race_edition_id);
    const race = edition ? raceById.get(edition.race_id) : null;
    const host = race
      ? countryById.get(edition?.host_country_id ?? race.country_id)
      : null;
    if (!edition || !race || !host) return false;
    if (race.competition_type !== slot.competitionCode) return false;
    if (
      slot.competitionCode === "continental_championship" &&
      host.continent_code !== federationContinentCode
    ) {
      return false;
    }
    if (slot.profileLabel === "Chrono") {
      return stage.stage_type === "individual_time_trial";
    }
    if (slot.profileLabel === "Route") {
      return stage.stage_type !== "individual_time_trial";
    }
    return stage.profile_type === profileLabelToExactProfile(slot.profileLabel);
  });
  const selected = candidates.sort(
    (left, right) =>
      Math.abs((dayById.get(left.season_day_id) ?? 99) - slot.dayNumber) -
      Math.abs((dayById.get(right.season_day_id) ?? 99) - slot.dayNumber),
  )[0];
  if (!selected) return null;
  const edition = editionById.get(selected.race_edition_id)!;
  const race = raceById.get(edition.race_id)!;
  const host = countryById.get(edition.host_country_id ?? race.country_id)!;
  return {
    raceEditionId: edition.id,
    stageId: selected.id,
    countryCode: host.iso_alpha2,
    profileType: selected.profile_type,
  };
}

function findJuniorStage({
  slot,
  stages,
  editionById,
  federationContinentCode,
}: {
  slot: FederationSelectionWeatherSlot;
  stages: JuniorStageRow[];
  editionById: Map<string, JuniorEditionRow>;
  federationContinentCode: string;
}): FederationSelectionOfficialStage | null {
  const competitionType =
    slot.competitionCode === "continental_championship_junior"
      ? slot.profileLabel === "Chrono"
        ? "continental_time_trial"
        : "continental_road"
      : slot.competitionCode === "world_championship_junior"
        ? slot.profileLabel === "Chrono"
          ? "world_time_trial"
          : "world_road"
        : "nations_cup_junior";
  const selected = stages.find((stage) => {
    const edition = editionById.get(stage.race_edition_id);
    return (
      edition?.competition_type === competitionType &&
      (competitionType.startsWith("continental_")
        ? edition.championship_continent_code === federationContinentCode
        : true)
    );
  });
  if (!selected) return null;
  const edition = editionById.get(selected.race_edition_id)!;
  return {
    raceEditionId: `junior:${edition.id}`,
    stageId: `junior:${selected.id}`,
    countryCode: edition.country_code,
    profileType: selected.profile_type,
  };
}

function profileLabelToExactProfile(profileLabel: string): RaceProfileType {
  return {
    Montagne: "mountain",
    Vallons: "hilly",
    Sprint: "sprint",
    Pavés: "cobbles",
    Chrono: "time_trial",
  }[profileLabel] as RaceProfileType;
}

function getSlotEventType(slot: SelectionSlotRow) {
  if (slot.competition_code === "continental_championship")
    return "continental_championship_pro";
  if (slot.competition_code === "continental_championship_junior")
    return "continental_championship_junior";
  if (slot.competition_code === "world_championship")
    return "world_championship_pro";
  if (slot.competition_code === "world_championship_junior")
    return "world_championship_junior";
  if (slot.competition_code === "nations_cup_junior")
    return "nations_cup_junior";
  return "nations_cup_pro";
}
