import "server-only";

import { unstable_cache } from "next/cache";

import { SPONSORS } from "@/data/sponsors";
import {
  DEFAULT_AMATEUR_JERSEY,
  isAmateurJerseyPattern,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDivisionForRank, type TeamDivisionCode } from "@/lib/game/economy";
import { normalizeTeamDivisionCode } from "@/lib/game/team-divisions";

type SeasonRow = { id: string; name: string };
type TeamSeasonRow = {
  team_id: string;
  display_name: string;
  points: number;
  final_rank: number | null;
  division_id: string | null;
};
type DivisionRow = { id: string; code: string };
type AssignmentRow = { team_id: string; sporting_director_id: string };
type DirectorRow = { id: string; username: string; display_name: string };
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
};
type RiderSummaryRow = { rider_id: string; points: number | null };
type ContractRow = { rider_id: string; team_id: string };
type CountryRow = { id: string; name: string; iso_alpha2: string };
type TeamRow = {
  id: string;
  amateur_jersey_pattern: string;
  amateur_jersey_primary_color: string;
  amateur_jersey_secondary_color: string;
  amateur_jersey_accent_color: string;
};
type SponsorContractRow = {
  team_id: string;
  sponsor_id: string;
  selected_jersey_id: string | null;
  created_at: string;
};
type SponsorRegistryRow = { id: string; catalog_key: string };

export type TeamRankingJerseyArtwork =
  | { kind: "sponsor"; imagePath: string }
  | { kind: "amateur"; jersey: AmateurJerseyConfig };

export type TeamRankingEntry = {
  rank: number;
  teamId: string;
  teamName: string;
  directorName: string | null;
  directorUsername: string | null;
  points: number;
  division: TeamDivisionCode;
  isProfessional: boolean;
  projectedDivision: TeamDivisionCode;
  jerseyArtwork: TeamRankingJerseyArtwork;
};

export type RiderRankingEntry = {
  rank: number;
  riderId: string;
  riderName: string;
  teamId: string | null;
  teamName: string | null;
  countryCode: string;
  countryName: string;
  points: number;
};

export type NationRankingEntry = {
  rank: number;
  countryCode: string;
  countryName: string;
  points: number;
  riderCount: number;
};

export type UciRankings = {
  seasonId: string;
  seasonName: string;
  teams: TeamRankingEntry[];
  riders: RiderRankingEntry[];
  nations: NationRankingEntry[];
};

const getCachedUciRankings = unstable_cache(loadUciRankings, ["uci-rankings"], {
  revalidate: 60,
  tags: ["uci-rankings"],
});

export async function getUciRankings(): Promise<UciRankings | null> {
  return getCachedUciRankings();
}

async function loadUciRankings(): Promise<UciRankings | null> {
  const supabase = createSupabaseAdminClient();
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();

  assertQuery(seasonError, "la saison active");

  if (!season) {
    return null;
  }

  const [teamSeasonsResult, summariesResult] = await Promise.all([
    supabase
      .from("team_seasons")
      .select("team_id, display_name, points, final_rank, division_id")
      .eq("season_id", season.id)
      .neq("status", "withdrawn")
      .gt("points", 0)
      .returns<TeamSeasonRow[]>(),
    supabase
      .from("rider_season_summaries")
      .select("rider_id, points")
      .eq("season_id", season.id)
      .gt("points", 0)
      .returns<RiderSummaryRow[]>(),
  ]);

  assertQuery(teamSeasonsResult.error, "les équipes classées");
  assertQuery(summariesResult.error, "les points des coureurs");

  const teamSeasons = teamSeasonsResult.data ?? [];
  const teamIds = teamSeasons.map((team) => team.team_id);
  const divisionIds = [
    ...new Set(
      teamSeasons
        .map((team) => team.division_id)
        .filter((divisionId): divisionId is string => Boolean(divisionId))
    ),
  ];
  const riderIds = (summariesResult.data ?? []).map((summary) => summary.rider_id);

  const [
    assignmentsResult,
    ridersResult,
    contractsResult,
    divisionsResult,
    teamsResult,
    sponsorContractsResult,
  ] = await Promise.all([
    teamIds.length
      ? supabase
          .from("team_manager_assignments")
          .select("team_id, sporting_director_id")
          .in("team_id", teamIds)
          .eq("role", "general_manager")
          .eq("status", "active")
          .returns<AssignmentRow[]>()
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    riderIds.length
      ? supabase
          .from("riders")
          .select("id, country_id, first_name, last_name")
          .in("id", riderIds)
          .returns<RiderRow[]>()
      : Promise.resolve({ data: [] as RiderRow[], error: null }),
    riderIds.length
      ? supabase
          .from("rider_contracts")
          .select("rider_id, team_id")
          .in("rider_id", riderIds)
          .eq("status", "active")
          .returns<ContractRow[]>()
      : Promise.resolve({ data: [] as ContractRow[], error: null }),
    divisionIds.length
      ? supabase
          .from("divisions")
          .select("id, code")
          .in("id", divisionIds)
          .returns<DivisionRow[]>()
      : Promise.resolve({ data: [] as DivisionRow[], error: null }),
    teamIds.length
      ? supabase
          .from("teams")
          .select(
            "id, amateur_jersey_pattern, amateur_jersey_primary_color, amateur_jersey_secondary_color, amateur_jersey_accent_color"
          )
          .in("id", teamIds)
          .returns<TeamRow[]>()
      : Promise.resolve({ data: [] as TeamRow[], error: null }),
    teamIds.length
      ? supabase
          .from("team_sponsor_contracts")
          .select("team_id, sponsor_id, selected_jersey_id, created_at")
          .in("team_id", teamIds)
          .eq("role", "principal")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .returns<SponsorContractRow[]>()
      : Promise.resolve({ data: [] as SponsorContractRow[], error: null }),
  ]);

  assertQuery(assignmentsResult.error, "les Directeurs Sportifs classés");
  assertQuery(ridersResult.error, "l’identité des coureurs");
  assertQuery(contractsResult.error, "les équipes des coureurs");
  assertQuery(divisionsResult.error, "les divisions de la saison");
  assertQuery(teamsResult.error, "les maillots amateurs des équipes");
  assertQuery(sponsorContractsResult.error, "les maillots sponsorisés des équipes");

  const assignments = assignmentsResult.data ?? [];
  const directorIds = assignments.map((assignment) => assignment.sporting_director_id);
  const countryIds = [...new Set((ridersResult.data ?? []).map((rider) => rider.country_id))];
  const sponsorContractByTeamId = new Map<string, SponsorContractRow>();
  for (const contract of sponsorContractsResult.data ?? []) {
    if (!sponsorContractByTeamId.has(contract.team_id)) {
      sponsorContractByTeamId.set(contract.team_id, contract);
    }
  }
  const sponsorIds = [
    ...new Set(
      [...sponsorContractByTeamId.values()].map((contract) => contract.sponsor_id)
    ),
  ];

  const [directorsResult, countriesResult, sponsorsResult] = await Promise.all([
    directorIds.length
      ? supabase
          .from("sporting_directors")
          .select("id, username, display_name")
          .in("id", directorIds)
          .returns<DirectorRow[]>()
      : Promise.resolve({ data: [] as DirectorRow[], error: null }),
    countryIds.length
      ? supabase
          .from("countries")
          .select("id, name, iso_alpha2")
          .in("id", countryIds)
          .returns<CountryRow[]>()
      : Promise.resolve({ data: [] as CountryRow[], error: null }),
    sponsorIds.length
      ? supabase
          .from("sponsors")
          .select("id, catalog_key")
          .in("id", sponsorIds)
          .returns<SponsorRegistryRow[]>()
      : Promise.resolve({ data: [] as SponsorRegistryRow[], error: null }),
  ]);

  assertQuery(directorsResult.error, "les Directeurs Sportifs");
  assertQuery(countriesResult.error, "les nations classées");
  assertQuery(sponsorsResult.error, "les sponsors des équipes classées");

  const directorById = new Map((directorsResult.data ?? []).map((row) => [row.id, row]));
  const assignmentByTeamId = new Map(assignments.map((row) => [row.team_id, row]));
  const teamById = new Map(teamSeasons.map((row) => [row.team_id, row]));
  const contractByRiderId = new Map(
    (contractsResult.data ?? []).map((row) => [row.rider_id, row])
  );
  const countryById = new Map((countriesResult.data ?? []).map((row) => [row.id, row]));
  const pointsByRiderId = new Map(
    (summariesResult.data ?? []).map((row) => [row.rider_id, row.points ?? 0])
  );
  const divisionCodeById = new Map(
    (divisionsResult.data ?? []).map((division) => [division.id, division.code])
  );
  const teamIdentityById = new Map(
    (teamsResult.data ?? []).map((team) => [team.id, team])
  );
  const sponsorRegistryById = new Map(
    (sponsorsResult.data ?? []).map((sponsor) => [sponsor.id, sponsor])
  );

  const teams = teamSeasons
    .filter((team) => team.points > 0)
    .sort(
      (left, right) =>
        right.points - left.points || left.display_name.localeCompare(right.display_name, "fr")
    )
    .map((team, index) => {
      const assignment = assignmentByTeamId.get(team.team_id);
      const director = assignment ? directorById.get(assignment.sporting_director_id) : null;
      const rank = index + 1;

      return {
        rank,
        teamId: team.team_id,
        teamName: team.display_name,
        directorName: director?.display_name ?? null,
        directorUsername: director?.username ?? null,
        points: team.points,
        division: normalizeTeamDivisionCode(
          team.division_id ? divisionCodeById.get(team.division_id) : null
        ),
        isProfessional: sponsorContractByTeamId.has(team.team_id),
        projectedDivision: getDivisionForRank(rank),
        jerseyArtwork: resolveTeamRankingJerseyArtwork({
          team: teamIdentityById.get(team.team_id),
          contract: sponsorContractByTeamId.get(team.team_id),
          sponsorRegistryById,
        }),
      } satisfies TeamRankingEntry;
    });

  const riders = (ridersResult.data ?? [])
    .map((rider) => {
      const country = countryById.get(rider.country_id);
      const contract = contractByRiderId.get(rider.id);
      const team = contract ? teamById.get(contract.team_id) : null;

      if (!country) {
        return null;
      }

      return {
        rank: 0,
        riderId: rider.id,
        riderName: `${rider.first_name} ${rider.last_name}`,
        teamId: team?.team_id ?? null,
        teamName: team?.display_name ?? null,
        countryCode: country.iso_alpha2,
        countryName: country.name,
        points: pointsByRiderId.get(rider.id) ?? 0,
      } satisfies RiderRankingEntry;
    })
    .filter(
      (rider): rider is RiderRankingEntry => rider !== null && rider.points > 0
    )
    .sort(
      (left, right) =>
        right.points - left.points || left.riderName.localeCompare(right.riderName, "fr")
    )
    .map((rider, index) => ({ ...rider, rank: index + 1 }));

  const nationAccumulator = new Map<string, Omit<NationRankingEntry, "rank">>();
  for (const rider of riders) {
    const current = nationAccumulator.get(rider.countryCode) ?? {
      countryCode: rider.countryCode,
      countryName: rider.countryName,
      points: 0,
      riderCount: 0,
    };
    current.points += rider.points;
    current.riderCount += 1;
    nationAccumulator.set(rider.countryCode, current);
  }

  const nations = [...nationAccumulator.values()]
    .filter((nation) => nation.points > 0)
    .sort(
      (left, right) =>
        right.points - left.points || left.countryName.localeCompare(right.countryName, "fr")
    )
    .map((nation, index) => ({ ...nation, rank: index + 1 }));

  return { seasonId: season.id, seasonName: season.name, teams, riders, nations };
}

function resolveTeamRankingJerseyArtwork({
  team,
  contract,
  sponsorRegistryById,
}: {
  team: TeamRow | undefined;
  contract: SponsorContractRow | undefined;
  sponsorRegistryById: Map<string, SponsorRegistryRow>;
}): TeamRankingJerseyArtwork {
  const amateurJersey = getAmateurJersey(team);
  const sponsorRegistry = contract
    ? sponsorRegistryById.get(contract.sponsor_id)
    : null;
  const sponsor = sponsorRegistry
    ? SPONSORS.find((candidate) => candidate.id === sponsorRegistry.catalog_key)
    : null;
  const sponsorJersey = sponsor
    ? sponsor.jerseys.find((jersey) => jersey.id === contract?.selected_jersey_id) ??
      sponsor.jerseys[0]
    : null;

  return sponsorJersey?.imagePath
    ? { kind: "sponsor", imagePath: sponsorJersey.imagePath }
    : { kind: "amateur", jersey: amateurJersey };
}

function getAmateurJersey(team: TeamRow | undefined): AmateurJerseyConfig {
  if (!team) return DEFAULT_AMATEUR_JERSEY;

  return {
    pattern: isAmateurJerseyPattern(team.amateur_jersey_pattern)
      ? team.amateur_jersey_pattern
      : DEFAULT_AMATEUR_JERSEY.pattern,
    primaryColor:
      normalizeHexColor(team.amateur_jersey_primary_color) ??
      DEFAULT_AMATEUR_JERSEY.primaryColor,
    secondaryColor:
      normalizeHexColor(team.amateur_jersey_secondary_color) ??
      DEFAULT_AMATEUR_JERSEY.secondaryColor,
    accentColor:
      normalizeHexColor(team.amateur_jersey_accent_color) ??
      DEFAULT_AMATEUR_JERSEY.accentColor,
  };
}

export async function getTeamRankingEntry(
  teamId: string
): Promise<TeamRankingEntry | null> {
  const rankings = await getUciRankings();
  return rankings?.teams.find((entry) => entry.teamId === teamId) ?? null;
}

export async function getRiderRankingEntry(
  riderId: string
): Promise<RiderRankingEntry | null> {
  const rankings = await getUciRankings();
  return rankings?.riders.find((entry) => entry.riderId === riderId) ?? null;
}

export async function getNationRankingEntry(
  countryCode: string
): Promise<NationRankingEntry | null> {
  const normalizedCode = countryCode.trim().toUpperCase();
  const rankings = await getUciRankings();
  return (
    rankings?.nations.find((entry) => entry.countryCode === normalizedCode) ?? null
  );
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
