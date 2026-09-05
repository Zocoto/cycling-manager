export const GAME_PRESENCE_HEARTBEAT_INTERVAL_MS = 90_000;
export const GAME_PRESENCE_CROSS_TAB_THROTTLE_MS = 60_000;
export const GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS = 45_000;
export const GLOBAL_CHAT_ONLINE_WINDOW_MINUTES = 15;

export type GlobalChatOnlineDirector = {
  sportingDirectorId: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  avatarFrameKey: "alpha_tester" | null;
  country: {
    name: string;
    code: string;
  } | null;
  teamId: string;
  teamName: string;
  teamHref: string;
};

type GlobalChatOnlineDirectorRow = {
  sporting_director_id?: unknown;
  username?: unknown;
  display_name?: unknown;
  avatar_key?: unknown;
  avatar_frame_key?: unknown;
  country_name?: unknown;
  country_code?: unknown;
  team_id?: unknown;
  team_name?: unknown;
};

export function shouldRecordGamePresence({
  lastRecordedAt,
  now,
}: {
  lastRecordedAt: number | null;
  now: number;
}) {
  return (
    lastRecordedAt === null ||
    !Number.isFinite(lastRecordedAt) ||
    now - lastRecordedAt >= GAME_PRESENCE_CROSS_TAB_THROTTLE_MS
  );
}

export function mapGlobalChatOnlineDirectorRows(
  rows: readonly GlobalChatOnlineDirectorRow[],
): GlobalChatOnlineDirector[] {
  const directors: GlobalChatOnlineDirector[] = [];

  for (const row of rows) {
    if (
      typeof row.sporting_director_id !== "string" ||
      typeof row.username !== "string" ||
      typeof row.display_name !== "string" ||
      (row.avatar_key !== null && typeof row.avatar_key !== "string") ||
      (row.avatar_frame_key !== null &&
        row.avatar_frame_key !== "alpha_tester") ||
      typeof row.team_id !== "string" ||
      typeof row.team_name !== "string"
    ) {
      continue;
    }

    directors.push({
      sportingDirectorId: row.sporting_director_id,
      username: row.username,
      displayName: row.display_name,
      avatarKey: row.avatar_key,
      avatarFrameKey:
        row.avatar_frame_key === "alpha_tester" ? row.avatar_frame_key : null,
      country:
        typeof row.country_name === "string" &&
        typeof row.country_code === "string" &&
        /^[A-Z]{2}$/i.test(row.country_code)
          ? {
              name: row.country_name,
              code: row.country_code.toUpperCase(),
            }
          : null,
      teamId: row.team_id,
      teamName: row.team_name,
      teamHref: `/jeu/equipes/${row.team_id}`,
    });
  }

  return directors;
}

export function mergeGlobalChatOnlineDirectors({
  currentDirector,
  recentDirectors,
  realtimeDirectors,
}: {
  currentDirector: GlobalChatOnlineDirector;
  recentDirectors: readonly GlobalChatOnlineDirector[];
  realtimeDirectors: readonly GlobalChatOnlineDirector[];
}) {
  const byDirectorId = new Map<string, GlobalChatOnlineDirector>();

  for (const director of recentDirectors) {
    byDirectorId.set(director.sportingDirectorId, director);
  }
  for (const director of realtimeDirectors) {
    byDirectorId.set(director.sportingDirectorId, director);
  }
  byDirectorId.set(currentDirector.sportingDirectorId, currentDirector);

  return [...byDirectorId.values()].sort((left, right) => {
    if (left.sportingDirectorId === currentDirector.sportingDirectorId) {
      return -1;
    }
    if (right.sportingDirectorId === currentDirector.sportingDirectorId) {
      return 1;
    }
    return left.displayName.localeCompare(right.displayName, "fr");
  });
}
