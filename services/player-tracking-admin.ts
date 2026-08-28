import "server-only";

import type { User } from "@supabase/supabase-js";

import { canAccessPlayerTracking } from "@/lib/game/player-tracking-access";
import {
  buildAcquisitionOverview,
  type AcquisitionAccount,
  type AcquisitionOverview,
  type AcquisitionPeriod,
} from "@/lib/marketing/acquisition-funnel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = {
  id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string;
  onboarding_completed: boolean;
};

type AssignmentRow = {
  sporting_director_id: string;
  team_id: string;
  status: string;
};

type SeasonRow = { id: string };

type TeamSeasonRow = {
  team_id: string;
  display_name: string;
};

type LastActivityRow = {
  auth_user_id: string;
  last_activity_on: string;
};

export type PlayerTrackingRow = {
  authUserId: string;
  playerName: string;
  email: string;
  directorName: string;
  teamName: string | null;
  lastActivityOn: string | null;
};

export type PlayerTrackingOverview = {
  generatedAt: string;
  acquisition: AcquisitionOverview;
  players: PlayerTrackingRow[];
};

const AUTH_USERS_PAGE_SIZE = 200;

export async function getPlayerTrackingOverview(
  requesterEmail: string | null | undefined,
  acquisitionPeriod: AcquisitionPeriod = 30,
): Promise<PlayerTrackingOverview> {
  if (!canAccessPlayerTracking(requesterEmail)) {
    throw new Error("Acces refuse a la console de suivi des joueurs.");
  }

  const admin = createSupabaseAdminClient();
  const users = await listAllAuthUsers(admin);

  const directorsResult = await admin
    .from("sporting_directors")
    .select(
      "id, auth_user_id, username, display_name, onboarding_completed",
    )
    .returns<DirectorRow[]>();
  assertAdminQuery(directorsResult.error, "les Directeurs Sportifs");

  const directors = directorsResult.data ?? [];
  const directorIds = directors.map((director) => director.id);
  const [assignmentsResult, activeSeasonResult, lastActivityResult] =
    await Promise.all([
    directorIds.length > 0
      ? admin
          .from("team_manager_assignments")
          .select("sporting_director_id, team_id, status")
          .in("sporting_director_id", directorIds)
          .eq("role", "general_manager")
          .returns<AssignmentRow[]>()
      : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
    admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
    admin.rpc("get_player_tracking_last_activity"),
  ]);

  assertAdminQuery(assignmentsResult.error, "les affectations des joueurs");
  assertAdminQuery(activeSeasonResult.error, "la saison active");
  assertAdminQuery(lastActivityResult.error, "les activites des joueurs");
  const lastActivities = Array.isArray(lastActivityResult.data)
    ? (lastActivityResult.data as LastActivityRow[])
    : [];

  const assignments = assignmentsResult.data ?? [];
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "active",
  );
  const teamIds = [
    ...new Set(activeAssignments.map((assignment) => assignment.team_id)),
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
    activeAssignments.map((assignment) => [
      assignment.sporting_director_id,
      assignment.team_id,
    ]),
  );
  const directorIdsWithTeam = new Set(
    assignments.map((assignment) => assignment.sporting_director_id),
  );
  const teamNameByTeamId = new Map(
    (teamSeasonsResult.data ?? []).map((teamSeason) => [
      teamSeason.team_id,
      teamSeason.display_name,
    ]),
  );
  const lastActivityByAuthUserId = new Map(
    lastActivities.map((activity) => [
      activity.auth_user_id,
      activity.last_activity_on,
    ]),
  );

  const generatedAt = new Date();
  const players = users
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
        lastActivityOn: lastActivityByAuthUserId.get(user.id) ?? null,
      } satisfies PlayerTrackingRow;
    })
    .sort(comparePlayerTrackingRows);
  const acquisitionAccounts = users.map((user) => {
    const director = directorByAuthUserId.get(user.id);
    const attribution = readMarketingAttribution(user);

    return {
      authUserId: user.id,
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      source: attribution.source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      hasDirector: Boolean(director),
      hasTeam: director ? directorIdsWithTeam.has(director.id) : false,
      onboardingCompleted: director?.onboarding_completed ?? false,
      lastActivityOn: lastActivityByAuthUserId.get(user.id) ?? null,
    } satisfies AcquisitionAccount;
  });

  return {
    generatedAt: generatedAt.toISOString(),
    acquisition: buildAcquisitionOverview(
      acquisitionAccounts,
      acquisitionPeriod,
      generatedAt,
    ),
    players,
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

function readMarketingAttribution(user: User) {
  const rawAttribution = user.user_metadata?.marketing_attribution;
  const referralCode = readAttributionValue(
    user.user_metadata?.referral_code,
  );

  if (!isRecord(rawAttribution)) {
    return referralCode
      ? {
          source: "player_referral",
          medium: "referral",
          campaign: "saison2_ambassadors",
        }
      : { source: null, medium: null, campaign: null };
  }

  return {
    source:
      readAttributionValue(rawAttribution.utm_source) ??
      (referralCode ? "player_referral" : null),
    medium:
      readAttributionValue(rawAttribution.utm_medium) ??
      (referralCode ? "referral" : null),
    campaign:
      readAttributionValue(rawAttribution.utm_campaign) ??
      (referralCode ? "saison2_ambassadors" : null),
  };
}

function readAttributionValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 100)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function comparePlayerTrackingRows(
  left: PlayerTrackingRow,
  right: PlayerTrackingRow,
) {
  const rightDate = right.lastActivityOn
    ? Date.parse(right.lastActivityOn)
    : Number.NEGATIVE_INFINITY;
  const leftDate = left.lastActivityOn
    ? Date.parse(left.lastActivityOn)
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
