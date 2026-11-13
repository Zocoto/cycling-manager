import "server-only";

import { createHash } from "node:crypto";

import { CS_RATING_KEYS, deriveGlobalRatingScale } from "@/lib/game/pcm-export/ratings";
import { applyExistingPcmAssetCodes } from "@/lib/game/pcm-export/gala-asset-codes";
import type {
  ContractRow,
  CountryRow,
  DivisionRow,
  PcmExportSnapshot,
  RatingRow,
  RiderRow,
  SeasonRow,
  TeamRow,
  TeamSeasonRow,
} from "@/lib/game/pcm-export/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import { GalaStartlistError, selectSeasonFourGalaContracts } from "@/lib/game/season-four-gala-startlists";
import { SEASON_FOUR_GALA } from "@/lib/game/season-four-gala";
import { PCM_FIRST_CLUB_RIDER_ID, PCM_SPECTATOR_TEAM_ID } from "@/lib/game/pcm-gala-startlists";
import {loadSeasonFourGalaRegisteredClubs} from "@/services/season-four-gala-startlists";
import type { NationalChampionshipTitleRow } from "@/lib/game/pcm-export/types";
import { PCM_CHAMPIONSHIP_MASKS } from "@/lib/game/pcm-export/types";
import { applySeasonFinaleGalaIdentities, loadSeasonFinaleGalaIdentities, loadSeasonFinaleGalaSourceSeason } from "@/services/season-finale-gala-identity";

const PAGE_SIZE = 1_000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type HistoricalTitleRow = NationalChampionshipTitleRow & {
  relinquished_at: string | null;
};

type NaturalizationRow = { rider_id: string; from_country_id: string };

export async function createPcmExportSnapshot(seasonFinale = false, seasonFourGala = false): Promise<PcmExportSnapshot> {
  const admin = createSupabaseAdminClient();
  const galaSourceSeason = seasonFinale ? await loadSeasonFinaleGalaSourceSeason(admin) : null;
  const activeSeasonResult = await admin
    .from("seasons")
    .select("*")
    .eq(seasonFourGala ? "game_year" : galaSourceSeason ? "id" : "status", seasonFourGala ? SEASON_FOUR_GALA.sourceSeason : galaSourceSeason?.id ?? "active")
    .single<SeasonRow>();

  if (activeSeasonResult.error || !activeSeasonResult.data) {
    throw new Error(
      `Impossible de charger la saison active : ${activeSeasonResult.error?.message ?? "saison absente"}`,
    );
  }

  const activeSeason = activeSeasonResult.data;
  const [teamSeasons, allTeams, countries, divisions, allContracts, allRiders, allRatings, seasons] =
    await Promise.all([
      fetchPaginated<TeamSeasonRow>((from, to) =>
        admin
          .from("team_seasons")
          .select("*")
          .eq("season_id", activeSeason.id)
          .in("status", seasonFinale || seasonFourGala ? ["active", "completed"] : ["active"])
          .order("id", { ascending: true })
          .range(from, to)
          .returns<TeamSeasonRow[]>(),
      ),
      fetchPaginated<TeamRow>((from, to) =>
        admin
          .from("teams")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to)
          .returns<TeamRow[]>(),
      ),
      fetchPaginated<CountryRow>((from, to) =>
        admin
          .from("countries")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to)
          .returns<CountryRow[]>(),
      ),
      fetchPaginated<DivisionRow>((from, to) =>
        admin
          .from("divisions")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to)
          .returns<DivisionRow[]>(),
      ),
      fetchPaginated<ContractRow>((from, to) =>
        admin
          .from("rider_contracts")
          .select("*")
          .in("status", seasonFinale || seasonFourGala ? ["active", "completed"] : ["active"])
          .order("id", { ascending: true })
          .range(from, to)
          .returns<ContractRow[]>(),
      ),
      fetchPaginated<RiderRow>((from, to) =>
        admin
          .from("riders")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderRow[]>(),
      ),
      fetchPaginated<RatingRow>((from, to) =>
        admin
          .from("rider_season_ratings")
          .select("*")
          .eq("season_id", activeSeason.id)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RatingRow[]>(),
      ),
      fetchPaginated<SeasonRow>((from, to) =>
        admin
          .from("seasons")
          .select("*")
          .order("id", { ascending: true })
          .range(from, to)
          .returns<SeasonRow[]>(),
      ),
    ]);

  const activeTeamIds = new Set(teamSeasons.map((row) => row.team_id));
  const sourceTeams = allTeams.filter((row) => activeTeamIds.has(row.id));
  const teams = applyExistingPcmAssetCodes(sourceTeams);
  const seasonYears = new Map(seasons.map((season) => [season.id, season.game_year]));
  const registeredClubs=seasonFourGala?await loadSeasonFourGalaRegisteredClubs(admin,activeSeason.id):undefined;
  let contractSource=seasonFourGala?selectSeasonFourGalaContracts(allContracts,seasons,registeredClubs):allContracts;
  if(seasonFourGala&&registeredClubs){
    const selectedRiders=new Set(contractSource.map(row=>row.rider_id));
    const missingRegisteredRiders=[...registeredClubs.keys()].filter(id=>!selectedRiders.has(id));
    if(missingRegisteredRiders.length){
      // Recover only registered, released riders; never scan all terminated contracts.
      const released=await collectChunkedPaginatedRows<ContractRow,{message:string},string>({
        values:missingRegisteredRiders,maxConcurrency:1,
        fetchPage:async(riderIds,from,to)=>{
          const result=await admin.from("rider_contracts").select("*")
            .in("rider_id",riderIds).eq("status","terminated")
            .order("id",{ascending:true}).range(from,to)
            .abortSignal(AbortSignal.timeout(5000));
          return {data:result.data as ContractRow[]|null,error:result.error};
        },
      });
      if(released.error)throw new Error(`Export PCM impossible : ${released.error.message}`);
      contractSource=selectSeasonFourGalaContracts([...allContracts,...released.data],seasons,registeredClubs);
    }
  }
  const contracts = contractSource.filter((row) => activeTeamIds.has(row.team_id) && (!seasonFinale || (
    (seasonYears.get(row.start_season_id) ?? Infinity) <= activeSeason.game_year &&
    (seasonYears.get(row.end_season_id) ?? -Infinity) >= activeSeason.game_year
  )));
  const contractedRiderIds = new Set(contracts.map((row) => row.rider_id));
  const sourceRiders = allRiders.filter((row) => contractedRiderIds.has(row.id));
  const ratings = allRatings.filter((row) => contractedRiderIds.has(row.rider_id));

  if (registeredClubs) {
    const contractsByRider = new Map(contracts.map(row => [row.rider_id, row]));
    const ridersById = new Map(allRiders.map(row => [row.id, row]));
    for (const [riderId, clubId] of registeredClubs) {
      if (contractsByRider.get(riderId)?.team_id !== clubId || !ridersById.has(riderId)) {
        const rider = ridersById.get(riderId);
        const name = rider ? `${rider.first_name} ${rider.last_name}` : riderId;
        throw new GalaStartlistError(`Gala PCM : ${name} est inscrit mais son club ne peut pas être exporté pour la saison 4.`);
      }
    }
  }

  const cutoff = seasonFourGala ? new Date(SEASON_FOUR_GALA.liveStartsAt).toISOString() : null;
  const riders = cutoff
    ? await restoreGalaRiderCountries(admin, sourceRiders, cutoff)
    : sourceRiders;
  const titleResult = await collectChunkedPaginatedRows<HistoricalTitleRow, { message: string }, string>({
    values: [...contractedRiderIds],
    maxConcurrency: 1,
    fetchPage: async (riderIds, from, to) => {
      const query = admin.from("rider_national_championship_titles")
        .select("rider_id, country_id, championship_type, relinquished_at")
        .in("rider_id", riderIds)
        .in("championship_type", Object.keys(PCM_CHAMPIONSHIP_MASKS));
      const result = await (cutoff ? query.lte("won_at", cutoff) : query.is("relinquished_at", null))
        .order("id", { ascending: true })
        .range(from, to).returns<HistoricalTitleRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  if (titleResult.error) throw new Error(`Impossible de charger les titres nationaux : ${titleResult.error.message}`);
  const nationalChampionshipTitles = titleResult.data
    .filter(row => !cutoff || !row.relinquished_at || Date.parse(row.relinquished_at) > Date.parse(cutoff))
    .map(({ rider_id, country_id, championship_type }) => ({ rider_id, country_id, championship_type }));

  assertSnapshotIntegrity({
    teamSeasons,
    teams,
    contracts,
    riders,
    ratings,
  });

  const ratingScale = deriveGlobalRatingScale(ratings);
  const snapshotCore = {
    schemaVersion: 1 as const,
    ...(seasonFourGala?{galaEdition:'season-four' as const}:{}),
    source: "Cyclostratege production" as const,
    activeSeason,
    seasons,
    counts: {
      teams: teamSeasons.length,
      riders: riders.length,
      contracts: contracts.length,
      ratings: ratings.length,
    },
    ratingPolicy: {
      source: "native rider_season_ratings only" as const,
      bonusesIncluded: false as const,
      scale: ratingScale,
    },
    teamSeasons,
    teams,
    countries,
    divisions,
    contracts,
    riders,
    ratings,
    nationalChampionshipTitles,
  };
  const projectedSnapshot = seasonFinale ? applySeasonFinaleGalaIdentities({ ...snapshotCore, exportedAt: "", sha256: "" },
    await loadSeasonFinaleGalaIdentities(admin, [...activeTeamIds])) : snapshotCore;
  const canonical = JSON.stringify(projectedSnapshot);

  return {
    ...projectedSnapshot,
    exportedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(canonical).digest("hex"),
  };
}

async function restoreGalaRiderCountries(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  riders: RiderRow[],
  cutoff: string,
) {
  const result = await collectChunkedPaginatedRows<NaturalizationRow, { message: string }, string>({
    values: riders.map(row => row.id),
    maxConcurrency: 1,
    fetchPage: async (riderIds, from, to) => {
      const query = await admin.from("rider_naturalizations")
        .select("rider_id, from_country_id")
        .in("rider_id", riderIds)
        .gt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
        .abortSignal(AbortSignal.timeout(5000));
      return { data: query.data as NaturalizationRow[] | null, error: query.error };
    },
  });
  if (result.error) throw new Error(`Impossible de charger les nationalités au gala : ${result.error.message}`);
  const historicalCountries = new Map<string, string>();
  // The first change after the gala records the country held at the gala, even after several later changes.
  for (const row of result.data) {
    if (!historicalCountries.has(row.rider_id)) historicalCountries.set(row.rider_id, row.from_country_id);
  }
  return riders.map(row => {
    const countryId = historicalCountries.get(row.id);
    return countryId ? { ...row, country_id: countryId } : row;
  });
}

async function fetchPaginated<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Export PCM impossible : ${error.message}`);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function assertSnapshotIntegrity({
  teamSeasons,
  teams,
  contracts,
  riders,
  ratings,
}: {
  teamSeasons: TeamSeasonRow[];
  teams: TeamRow[];
  contracts: ContractRow[];
  riders: RiderRow[];
  ratings: RatingRow[];
}) {
  if (teamSeasons.length === 0 || riders.length === 0) {
    throw new Error("La saison active ne contient aucune donnee exportable.");
  }
  if (teams.length !== teamSeasons.length) {
    throw new Error("Une equipe active ne possede pas de fiche permanente.");
  }

  const pcmTeamIds = teams.map((team) => Number(team.pcm_export_id));
  if (
    pcmTeamIds.some(
      (id) => !Number.isSafeInteger(id) || id <= PCM_SPECTATOR_TEAM_ID,
    ) ||
    new Set(pcmTeamIds).size !== pcmTeamIds.length
  ) {
    throw new Error("Les identifiants PCM permanents des equipes sont invalides.");
  }

  const pcmAssetCodes = teams
    .map((team) => team.pcm_asset_code?.trim().toLowerCase() ?? null)
    .filter((code): code is string => code !== null);
  if (
    pcmAssetCodes.some((code) => !/^[a-z]{3}$/.test(code)) ||
    new Set(pcmAssetCodes).size !== pcmAssetCodes.length
  ) {
    throw new Error("Les identifiants graphiques PCM permanents sont invalides.");
  }

  const contractsByRider = countBy(contracts, (row) => row.rider_id);
  const ratingsByRider = countBy(ratings, (row) => row.rider_id);
  const riderIds = new Set(riders.map(row => row.id));
  if (contracts.some(row => !riderIds.has(row.rider_id))) {
    throw new Error("Un contrat PCM référence un coureur absent.");
  }
  const pcmRiderIds = riders.map((rider) => Number(rider.pcm_export_id));
  if (
    pcmRiderIds.some((id) => !Number.isSafeInteger(id) || id < PCM_FIRST_CLUB_RIDER_ID) ||
    new Set(pcmRiderIds).size !== pcmRiderIds.length
  ) {
    throw new Error("Les identifiants PCM permanents des coureurs sont invalides.");
  }

  for (const rider of riders) {
    if (contractsByRider.get(rider.id) !== 1) {
      throw new Error(
        `Le coureur ${rider.id} doit posseder exactement un contrat actif.`,
      );
    }
    if (ratingsByRider.get(rider.id) !== 1) {
      throw new Error(
        `Le coureur ${rider.id} doit posseder exactement un jeu de notes pour la saison active.`,
      );
    }
  }

  for (const rating of ratings) {
    for (const key of CS_RATING_KEYS) {
      if (rating[key] == null || String(rating[key]).trim() === "" || !Number.isFinite(Number(rating[key]))) {
        throw new Error(`Note ${key} invalide pour le coureur ${rating.rider_id}.`);
      }
    }
  }
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
