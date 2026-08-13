import "server-only";

import type { User } from "@supabase/supabase-js";

import { canAccessPlayerTracking } from "@/lib/game/player-tracking-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = {
  id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string;
};

type AssignmentRow = {
  sporting_director_id: string;
  team_id: string;
};

type SeasonRow = { id: string };

type TeamSeasonRow = {
  team_id: string;
  display_name: string;
};

export type PlayerTrackingRow = {
  authUserId: string;
  playerName: string;
  email: string;
  directorName: string;
  teamName: string | null;
  lastSignInAt: string | null;
};

export type PlayerTrackingOverview = {
  generatedAt: string;
  players: PlayerTrackingRow[];
};

const AUTH_USERS_PAGE_SIZE = 200;

export async function getPlayerTrackingOverview(
  requesterEmail: string | null | undefined,
): Promise<PlayerTrackingOverview> {
  if (!canAccessPlayerTracking(requesterEmail)) {
    throw new Error("Acces refuse a la console de suivi des joueurs.");
  }

  const admin = createSupabaseAdminClient();
  const users = await listAllAuthUsers(admin);

  const directorsResult = await admin
    .from("sporting_directors")
    .select("id, auth_user_id, username, display_name")
    .returns<DirectorRow[]>();
  assertAdminQuery(directorsResult.error, "les Directeurs Sportifs");

  const directors = directorsResult.data ?? [];
  const directorIds = directors.map((director) => director.id);
  const [assignmentsResult, activeSeasonResult] = await Promise.all([
    directorIds.length > 0
      ? admin
          .from("team_manager_assignments")
          .select("sporting_director_id, team_id")
          .in("sporting_director_id", directorIds)
          .eq("role", "general_manager")
          .eq("status", "active")
          .returns<AssignmentRow[]>()
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);

  assertAdminQuery(assignmentsResult.error, "les affectations des joueurs");
  assertAdminQuery(activeSeasonResult.error, "la saison active");

  const assignments = assignmentsResult.data ?? [];
  const teamIds = [
    ...new Set(assignments.map((assignment) => assignment.team_id)),
  ];
  const activeSeasonId = activeSeasonResult.data?.id ?? null;
  const teamSeasonsResult =
    activeSeasonId && teamIds.length > 0
      ? await admin
          .from("team_seasons")
          .select("team_id, display_name")
          .eq("season_id", activeSeasonId)
          .in("team_id", teamIds)
          .returns<TeamSeasonRow[]>()
      : { data: [] as TeamSeasonRow[], error: null };
  assertAdminQuery(teamSeasonsResult.error, "les equipes actives");

  const directorByAuthUserId = new Map(
    directors.flatMap((director) =>
      director.auth_user_id ? [[director.auth_user_id, director] as const] : [],
    ),
  );
  const teamIdByDirectorId = new Map(
    assignments.map((assignment) => [
      assignment.sporting_director_id,
      assignment.team_id,
    ]),
  );
  const teamNameByTeamId = new Map(
    (teamSeasonsResult.data ?? []).map((teamSeason) => [
      teamSeason.team_id,
      teamSeason.display_name,
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    players: users
      .map((user) => {
        const director = directorByAuthUserId.get(user.id);
        const teamId = director
          ? teamIdByDirectorId.get(director.id) ?? null
          : null;

        return {
          authUserId: user.id,
          playerName: readPlayerName(user, director),
          email: user.email ?? "E-mail indisponible",
          directorName: director?.display_name ?? "Profil DS non créé",
          teamName: teamId ? teamNameByTeamId.get(teamId) ?? null : null,
          lastSignInAt: user.last_sign_in_at ?? null,
        } satisfies PlayerTrackingRow;
      })
      .sort(comparePlayerTrackingRows),
  };
}

async function listAllAuthUsers(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const users: User[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });
    if (error) {
      throw new Error(
        `Impossible de charger les comptes joueurs : ${error.message}`,
      );
    }

    users.push(...data.users);
    if (data.users.length < AUTH_USERS_PAGE_SIZE) break;
  }

  return users;
}

function readPlayerName(user: User, director: DirectorRow | undefined) {
  if (director?.username.trim()) return director.username.trim();

  const managerName = user.user_metadata?.manager_name;
  if (typeof managerName === "string" && managerName.trim()) {
    return managerName.trim();
  }

  return "Compte sans profil";
}

function comparePlayerTrackingRows(
  left: PlayerTrackingRow,
  right: PlayerTrackingRow,
) {
  const rightDate = right.lastSignInAt
    ? Date.parse(right.lastSignInAt)
    : Number.NEGATIVE_INFINITY;
  const leftDate = left.lastSignInAt
    ? Date.parse(left.lastSignInAt)
    : Number.NEGATIVE_INFINITY;

  if (rightDate !== leftDate) return rightDate - leftDate;
  return left.playerName.localeCompare(right.playerName, "fr");
}

function assertAdminQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
