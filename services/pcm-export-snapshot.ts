import "server-only";

import { createHash } from "node:crypto";

import { CS_RATING_KEYS, deriveGlobalRatingScale } from "@/lib/game/pcm-export/ratings";
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

const PAGE_SIZE = 1_000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function createPcmExportSnapshot(): Promise<PcmExportSnapshot> {
  const admin = createSupabaseAdminClient();
  const activeSeasonResult = await admin
    .from("seasons")
    .select("*")
    .eq("status", "active")
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
          .eq("status", "active")
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
          .eq("status", "active")
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
  const teams = allTeams.filter((row) => activeTeamIds.has(row.id));
  const contracts = allContracts.filter((row) => activeTeamIds.has(row.team_id));
  const contractedRiderIds = new Set(contracts.map((row) => row.rider_id));
  const riders = allRiders.filter((row) => contractedRiderIds.has(row.id));
  const ratings = allRatings.filter((row) => contractedRiderIds.has(row.rider_id));

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
  };
  const canonical = JSON.stringify(snapshotCore);

  return {
    ...snapshotCore,
    exportedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(canonical).digest("hex"),
  };
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
      (id) => !Number.isInteger(id) || id <= 243,
    ) ||
    new Set(pcmTeamIds).size !== pcmTeamIds.length
  ) {
    throw new Error("Les identifiants PCM permanents des equipes sont invalides.");
  }

  const contractsByRider = countBy(contracts, (row) => row.rider_id);
  const ratingsByRider = countBy(ratings, (row) => row.rider_id);

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
      if (!Number.isFinite(Number(rating[key]))) {
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
