import "server-only";

import {
  createEmptyPublicGameNewsSnapshot,
  createPublicGameNewsSnapshot,
  type PublicGameNewsItem,
  type PublicGameNewsSnapshot,
} from "@/lib/game/public-game-news";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  race_roster_id: string;
  created_at: string;
};

type RaceEditionRow = {
  id: string;
  display_name: string;
};

type RaceRosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
};

type RaceRegistrationRow = {
  id: string;
  team_season_id: string;
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  created_at: string;
};

type SportingDirectorRow = {
  id: string;
  display_name: string;
  created_at: string;
};

type RiderContractRow = {
  id: string;
  rider_id: string;
  team_id: string;
  acquisition_type:
    | "daily_auction"
    | "director_auction"
    | "free_agent";
  signed_at: string | null;
  created_at: string;
};

type LoadedNews = {
  items: PublicGameNewsItem[];
  total: number | null;
};

const movementTypes = [
  "daily_auction",
  "director_auction",
  "free_agent",
] as const;

export async function getPublicGameNews(): Promise<PublicGameNewsSnapshot> {
  let admin: AdminClient;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return createEmptyPublicGameNewsSnapshot();
  }

  const results = await Promise.allSettled([
    loadRecentVictories(admin),
    loadRecentArrivals(admin),
    loadRecentMovements(admin),
  ]);
  const successfulLoads = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );

  if (successfulLoads.length === 0) {
    return createEmptyPublicGameNewsSnapshot();
  }

  const [victories, arrivals, movements] = results.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : ({ items: [], total: null } satisfies LoadedNews)
  );

  return createPublicGameNewsSnapshot({
    items: [...victories.items, ...arrivals.items, ...movements.items],
    totals: {
      directors: arrivals.total,
      victories: victories.total,
      movements: movements.total,
    },
    isLive: true,
  });
}

async function loadRecentVictories(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("race_results")
      .select("id, race_edition_id, race_roster_id, created_at")
      .eq("final_rank", 1)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<RaceResultRow[]>(),
    admin
      .from("race_results")
      .select("id", { count: "exact", head: true })
      .eq("final_rank", 1),
  ]);
  assertQuery(recentQuery.error, "les dernières victoires");
  assertQuery(totalQuery.error, "le total des victoires");

  const results = recentQuery.data ?? [];
  if (results.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const [editionsQuery, rostersQuery] = await Promise.all([
    admin
      .from("race_editions")
      .select("id, display_name")
      .in("id", unique(results.map((row) => row.race_edition_id)))
      .returns<RaceEditionRow[]>(),
    admin
      .from("race_rosters")
      .select("id, race_registration_id, rider_id")
      .in("id", unique(results.map((row) => row.race_roster_id)))
      .returns<RaceRosterRow[]>(),
  ]);
  assertQuery(editionsQuery.error, "les courses victorieuses");
  assertQuery(rostersQuery.error, "les vainqueurs");

  const rosters = rostersQuery.data ?? [];
  const [ridersQuery, registrationsQuery] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in("id", unique(rosters.map((row) => row.rider_id)))
      .returns<RiderRow[]>(),
    admin
      .from("race_registrations")
      .select("id, team_season_id")
      .in("id", unique(rosters.map((row) => row.race_registration_id)))
      .returns<RaceRegistrationRow[]>(),
  ]);
  assertQuery(ridersQuery.error, "les identités des vainqueurs");
  assertQuery(registrationsQuery.error, "les équipes victorieuses");

  const registrations = registrationsQuery.data ?? [];
  const teamSeasonsQuery = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, created_at")
    .in("id", unique(registrations.map((row) => row.team_season_id)))
    .returns<TeamSeasonRow[]>();
  assertQuery(teamSeasonsQuery.error, "les noms des équipes victorieuses");

  const editionById = toMap(editionsQuery.data ?? []);
  const rosterById = toMap(rosters);
  const riderById = toMap(ridersQuery.data ?? []);
  const registrationById = toMap(registrations);
  const teamSeasonById = toMap(teamSeasonsQuery.data ?? []);

  const items = results.flatMap((result) => {
    const edition = editionById.get(result.race_edition_id);
    const roster = rosterById.get(result.race_roster_id);
    const rider = roster ? riderById.get(roster.rider_id) : null;
    const registration = roster
      ? registrationById.get(roster.race_registration_id)
      : null;
    const teamSeason = registration
      ? teamSeasonById.get(registration.team_season_id)
      : null;

    if (!edition || !rider || !teamSeason) return [];

    return [
      {
        id: `victory:${result.id}`,
        kind: "victory" as const,
        title: `${rider.first_name} ${rider.last_name} s’impose`,
        detail: `${teamSeason.display_name} remporte ${edition.display_name}.`,
        happenedAt: result.created_at,
      },
    ];
  });

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentArrivals(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("id, display_name, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<SportingDirectorRow[]>(),
    admin
      .from("sporting_directors")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);
  assertQuery(recentQuery.error, "les nouveaux directeurs sportifs");
  assertQuery(totalQuery.error, "le total des directeurs sportifs");

  const items = (recentQuery.data ?? []).map((director) => ({
    id: `arrival:${director.id}`,
    kind: "arrival" as const,
    title: `${director.display_name} a rejoint le peloton`,
    detail: "Un nouveau directeur sportif prend place sur la ligne de départ.",
    happenedAt: director.created_at,
  }));

  return { items, total: totalQuery.count ?? items.length };
}

async function loadRecentMovements(admin: AdminClient): Promise<LoadedNews> {
  const [recentQuery, totalQuery] = await Promise.all([
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, acquisition_type, signed_at, created_at"
      )
      .in("acquisition_type", movementTypes)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: false })
      .limit(6)
      .returns<RiderContractRow[]>(),
    admin
      .from("rider_contracts")
      .select("id", { count: "exact", head: true })
      .in("acquisition_type", movementTypes)
      .not("signed_at", "is", null),
  ]);
  assertQuery(recentQuery.error, "les derniers mouvements");
  assertQuery(totalQuery.error, "le total des mouvements");

  const contracts = recentQuery.data ?? [];
  if (contracts.length === 0) {
    return { items: [], total: totalQuery.count ?? 0 };
  }

  const [ridersQuery, teamSeasonsQuery] = await Promise.all([
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in("id", unique(contracts.map((row) => row.rider_id)))
      .returns<RiderRow[]>(),
    admin
      .from("team_seasons")
      .select("id, team_id, display_name, created_at")
      .in("team_id", unique(contracts.map((row) => row.team_id)))
      .order("created_at", { ascending: false })
      .returns<TeamSeasonRow[]>(),
  ]);
  assertQuery(ridersQuery.error, "les recrues");
  assertQuery(teamSeasonsQuery.error, "les équipes recruteuses");

  const riderById = toMap(ridersQuery.data ?? []);
  const teamSeasonByTeamId = new Map<string, TeamSeasonRow>();
  for (const teamSeason of teamSeasonsQuery.data ?? []) {
    if (!teamSeasonByTeamId.has(teamSeason.team_id)) {
      teamSeasonByTeamId.set(teamSeason.team_id, teamSeason);
    }
  }

  const items = contracts.flatMap((contract) => {
    const rider = riderById.get(contract.rider_id);
    const teamSeason = teamSeasonByTeamId.get(contract.team_id);
    if (!rider || !teamSeason) return [];

    return [
      {
        id: `movement:${contract.id}`,
        kind: "movement" as const,
        title: `${rider.first_name} ${rider.last_name} rejoint ${teamSeason.display_name}`,
        detail: getMovementDetail(contract.acquisition_type),
        happenedAt: contract.signed_at ?? contract.created_at,
      },
    ];
  });

  return { items, total: totalQuery.count ?? items.length };
}

function getMovementDetail(
  acquisitionType: RiderContractRow["acquisition_type"]
): string {
  if (acquisitionType === "free_agent") {
    return "Recrutement conclu parmi les agents libres.";
  }
  if (acquisitionType === "director_auction") {
    return "Transfert conclu entre deux directeurs sportifs.";
  }
  return "Recrutement conclu sur le marché quotidien.";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function assertQuery(
  error: { message: string } | null,
  context: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
