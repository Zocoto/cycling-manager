import "server-only";

import type { RaceFormat, RaceProfileType, RaceStageType } from "@/lib/game/race-calendar";
import {
  ensureCompleteRaceSegments,
  removeOneDayRaceMountainPrimes,
  resolveRaceProfileType,
  type RaceStageSegment,
} from "@/lib/game/race-profiles";
import {
  getFederationSelectionForecast,
  type FederationSelectionForecast,
  type FederationSelectionOfficialStage,
  type FederationSelectionWeatherSlot,
} from "@/lib/game/federation-selection-weather";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";

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
  slug: string;
  race_format: RaceFormat;
  country_id: string;
  competition_type: string;
  championship_continent_code: string | null;
};
type ProStageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  name: string;
  stage_type: RaceStageType;
  profile_type: RaceProfileType;
  distance_km: number | string;
};
type SeasonDayRow = { id: string; day_number: number };
type CountryRow = {
  id: string;
  iso_alpha2: string;
  continent_code: string;
  name: string;
};
type JuniorEditionRow = {
  id: string;
  slug: string;
  country_code: string;
  competition_type: string;
  championship_continent_code: string | null;
};
type JuniorStageRow = {
  id: string;
  race_edition_id: string;
  day_number: number;
  name: string;
  stage_type: RaceStageType;
  profile_type: RaceProfileType;
  distance_km: number | string;
};

type SegmentRow = {
  stage_id: string;
  segment_number: number;
  distance_km: number | string;
  terrain_type: RaceStageSegment["terrain"];
  surface_type: RaceStageSegment["surface"];
  average_gradient_pct: number | string;
  stage_segment_primes: Array<{
    prime_type: "mountain" | "intermediate_sprint";
    mountain_category: "HC" | "1" | "2" | "3" | "4" | null;
    points_scale: number[];
  }> | null;
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
  const [racesResult, juniorEditionsResult] = await Promise.all([
    admin
      .from("races")
      .select("id, slug, race_format, country_id, competition_type, championship_continent_code")
      .in("competition_type", [
        "continental_championship",
        "world_championship",
        "nations_cup",
      ])
      .returns<ProRaceRow[]>(),
    admin
      .from("development_race_editions")
      .select(
        "id, slug, country_code, competition_type, championship_continent_code",
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
  if (racesResult.error) throw racesResult.error;
  if (juniorEditionsResult.error) throw juniorEditionsResult.error;

  const races = (racesResult.data ?? []).filter(
    (race) => race.competition_type !== "continental_championship" ||
      race.championship_continent_code === federationContinentCode,
  );
  const proEditionsResult = await collectChunkedPaginatedRows<ProEditionRow, { message: string }, string>({
    values: races.map((race) => race.id),
    fetchPage: async (raceIds, from, to) => await admin
      .from("race_editions")
      .select("id, race_id, host_country_id")
      .eq("season_id", seasonId)
      .in("race_id", raceIds)
      .neq("status", "cancelled")
      .order("id")
      .range(from, to)
      .returns<ProEditionRow[]>(),
  });
  if (proEditionsResult.error) throw proEditionsResult.error;
  const proEditions = proEditionsResult.data ?? [];
  const juniorEditions = (juniorEditionsResult.data ?? []).filter(
    (edition) => !edition.competition_type.startsWith("continental_") ||
      edition.championship_continent_code === federationContinentCode,
  );
  const proEditionIds = proEditions.map((edition) => edition.id);
  const juniorEditionIds = juniorEditions.map((edition) => edition.id);
  const [proStagesResult, juniorStagesResult] = await Promise.all([
    collectChunkedPaginatedRows<ProStageRow, { message: string }, string>({
      values: proEditionIds,
      fetchPage: async (editionIds, from, to) => await admin
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, name, stage_type, profile_type, distance_km",
          )
          .in("race_edition_id", editionIds)
          .neq("status", "cancelled")
          .order("id")
          .range(from, to)
          .returns<ProStageRow[]>(),
    }),
    collectChunkedPaginatedRows<JuniorStageRow, { message: string }, string>({
      values: juniorEditionIds,
      fetchPage: async (editionIds, from, to) => await admin
          .from("development_race_stages")
          .select(
            "id, race_edition_id, day_number, name, stage_type, profile_type, distance_km",
          )
          .in("race_edition_id", editionIds)
          .order("id")
          .range(from, to)
          .returns<JuniorStageRow[]>(),
    }),
  ]);
  if (proStagesResult.error) throw proStagesResult.error;
  if (juniorStagesResult.error) throw juniorStagesResult.error;

  const relevantProEditions = proEditions;
  const proStages = proStagesResult.data;
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
  const [daysResult, countriesResult, juniorCountriesResult, segmentsResult] = await Promise.all([
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
          .select("id, iso_alpha2, continent_code, name")
          .in("id", countryIds)
          .returns<CountryRow[]>()
      : Promise.resolve({ data: [] as CountryRow[], error: null }),
    juniorEditions.length
      ? admin.from("countries")
          .select("id, iso_alpha2, continent_code, name")
          .in("iso_alpha2", [...new Set(juniorEditions.map((edition) => edition.country_code))])
          .returns<CountryRow[]>()
      : Promise.resolve({ data: [] as CountryRow[], error: null }),
    collectChunkedPaginatedRows<SegmentRow, { message: string }, string>({
      values: proStages.map((stage) => stage.id),
      fetchPage: async (stageIds, from, to) => await admin
        .from("stage_segments")
        .select("stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct, stage_segment_primes(prime_type, mountain_category, points_scale)")
        .in("stage_id", stageIds)
        .order("stage_id")
        .order("segment_number")
        .range(from, to)
        .returns<SegmentRow[]>(),
    }),
  ]);
  if (daysResult.error) throw daysResult.error;
  if (countriesResult.error) throw countriesResult.error;
  if (juniorCountriesResult.error) throw juniorCountriesResult.error;
  if (segmentsResult.error) throw segmentsResult.error;

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
  const juniorCountryByCode = new Map(
    (juniorCountriesResult.data ?? []).map((country) => [country.iso_alpha2, country]),
  );
  const segmentsByStageId = new Map<string, RaceStageSegment[]>();
  for (const row of segmentsResult.data) {
    const segments = segmentsByStageId.get(row.stage_id) ?? [];
    const prime = row.stage_segment_primes?.[0];
    segments.push({
      segmentNumber: row.segment_number,
      distanceKm: Number(row.distance_km),
      terrain: row.terrain_type,
      surface: row.surface_type,
      averageGradientPct: Number(row.average_gradient_pct),
      prime: prime ? {
        type: prime.prime_type,
        category: prime.mountain_category,
        pointsScale: prime.points_scale,
      } : null,
    });
    segmentsByStageId.set(row.stage_id, segments);
  }

  return Object.fromEntries(
    slots.flatMap((slot) => {
      const stage =
        slot.riderCategory === "junior"
          ? findJuniorStage({
              slot,
              stages: juniorStagesResult.data ?? [],
              editionById: juniorEditionById,
              federationContinentCode,
              countryByCode: juniorCountryByCode,
            })
          : findProfessionalStage({
              slot,
              stages: proStages,
              editionById,
              raceById,
              dayById,
              countryById,
              federationContinentCode,
              segmentsByStageId,
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
  segmentsByStageId,
}: {
  slot: FederationSelectionWeatherSlot;
  stages: ProStageRow[];
  editionById: Map<string, ProEditionRow>;
  raceById: Map<string, ProRaceRow>;
  dayById: Map<string, number>;
  countryById: Map<string, CountryRow>;
  federationContinentCode: string;
  segmentsByStageId: Map<string, RaceStageSegment[]>;
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
      race.championship_continent_code !== federationContinentCode
    ) {
      return false;
    }
    if (slot.profileLabel === "Chrono") {
      return stage.stage_type !== "road";
    }
    if (slot.profileLabel === "Route") {
      return stage.stage_type === "road";
    }
    return stage.profile_type === profileLabelToExactProfile(slot.profileLabel);
  });
  const selected = candidates.sort(
    (left, right) =>
      Math.abs((dayById.get(left.season_day_id) ?? 99) - slot.dayNumber) -
      Math.abs((dayById.get(right.season_day_id) ?? 99) - slot.dayNumber) ||
      left.id.localeCompare(right.id),
  )[0];
  if (!selected) return null;
  const edition = editionById.get(selected.race_edition_id)!;
  const race = raceById.get(edition.race_id)!;
  const host = countryById.get(edition.host_country_id ?? race.country_id)!;
  const distanceKm = Number(selected.distance_km);
  const segments = removeOneDayRaceMountainPrimes(ensureCompleteRaceSegments({
    segments: segmentsByStageId.get(selected.id) ?? [],
    distanceKm,
    profileType: selected.profile_type,
    seed: selected.id,
    includeTourPrimes: (segmentsByStageId.get(selected.id) ?? []).some((segment) => segment.prime !== null),
  }), race.race_format);
  const profileType = resolveRaceProfileType(selected.profile_type, segments);
  return {
    raceEditionId: edition.id,
    stageId: selected.id,
    countryCode: host.iso_alpha2,
    profileType,
    course: {
      raceEditionId: edition.id,
      stageId: selected.id,
      stageName: selected.name,
      stageType: selected.stage_type,
      profileType,
      countryCode: host.iso_alpha2,
      countryName: host.name,
      distanceKm,
      dayNumber: dayById.get(selected.season_day_id) ?? slot.dayNumber,
      segments,
      href: `/jeu/courses/${encodeURIComponent(race.slug)}`,
    },
  };
}

function findJuniorStage({
  slot,
  stages,
  editionById,
  federationContinentCode,
  countryByCode,
}: {
  slot: FederationSelectionWeatherSlot;
  stages: JuniorStageRow[];
  editionById: Map<string, JuniorEditionRow>;
  federationContinentCode: string;
  countryByCode: Map<string, CountryRow>;
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
  const selected = stages.filter((stage) => {
    const edition = editionById.get(stage.race_edition_id);
    return (
      edition?.competition_type === competitionType &&
      (slot.profileLabel === "Chrono" ? stage.stage_type !== "road" : stage.stage_type === "road") &&
      (competitionType.startsWith("continental_")
        ? edition.championship_continent_code === federationContinentCode
        : true)
    );
  }).sort((left, right) =>
    Math.abs(left.day_number - slot.dayNumber) - Math.abs(right.day_number - slot.dayNumber) ||
    left.id.localeCompare(right.id),
  )[0];
  if (!selected) return null;
  const edition = editionById.get(selected.race_edition_id)!;
  return {
    raceEditionId: `junior:${edition.id}`,
    stageId: `junior:${selected.id}`,
    countryCode: edition.country_code,
    profileType: selected.profile_type,
    course: {
      raceEditionId: `junior:${edition.id}`,
      stageId: `junior:${selected.id}`,
      stageName: selected.name,
      stageType: selected.stage_type,
      profileType: selected.profile_type,
      countryCode: edition.country_code,
      countryName: countryByCode.get(edition.country_code)?.name ?? edition.country_code,
      distanceKm: Number(selected.distance_km),
      dayNumber: selected.day_number,
      // Junior simulations use the official profile and distance, not road segments.
      segments: [],
      href: `/jeu/resultats-juniors/${encodeURIComponent(edition.slug)}`,
    },
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
