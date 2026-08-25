import { describe, expect, it } from "vitest";

import {
  GAME_PRESENCE_CROSS_TAB_THROTTLE_MS,
  GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
  GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS,
  mapGlobalChatOnlineDirectorRows,
  mergeGlobalChatOnlineDirectors,
  shouldRecordGamePresence,
  type GlobalChatOnlineDirector,
} from "./global-chat-presence";

const currentDirector: GlobalChatOnlineDirector = {
  sportingDirectorId: "director-current",
  username: "zoe",
  displayName: "Zoé",
  avatarKey: "director_f_01",
  avatarFrameKey: null,
  teamId: "team-current",
  teamName: "Équipe actuelle",
  teamHref: "/jeu/equipes/team-current",
};

describe("global game presence", () => {
  it("uses lightweight heartbeat, cross-tab throttle and chat refresh cadences", () => {
    expect(GAME_PRESENCE_HEARTBEAT_INTERVAL_MS).toBe(90_000);
    expect(GAME_PRESENCE_CROSS_TAB_THROTTLE_MS).toBe(60_000);
    expect(GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS).toBe(45_000);
  });

  it("does not repeat a heartbeat during the cross-tab throttle window", () => {
    expect(
      shouldRecordGamePresence({ lastRecordedAt: null, now: 100_000 }),
    ).toBe(true);
    expect(
      shouldRecordGamePresence({ lastRecordedAt: 50_000, now: 100_000 }),
    ).toBe(false);
    expect(
      shouldRecordGamePresence({ lastRecordedAt: 40_000, now: 100_000 }),
    ).toBe(true);
  });

  it("maps only complete authenticated director rows", () => {
    expect(
      mapGlobalChatOnlineDirectorRows([
        {
          sporting_director_id: "director-1",
          username: "alice",
          display_name: "Alice",
          avatar_key: "director_f_02",
          avatar_frame_key: null,
          team_id: "team-1",
          team_name: "Les Rouleurs",
        },
        {
          sporting_director_id: "director-invalid",
          display_name: null,
          team_id: "team-invalid",
          team_name: "Équipe invalide",
        },
      ]),
    ).toEqual([
      {
        sportingDirectorId: "director-1",
        username: "alice",
        displayName: "Alice",
        avatarKey: "director_f_02",
        avatarFrameKey: null,
        teamId: "team-1",
        teamName: "Les Rouleurs",
        teamHref: "/jeu/equipes/team-1",
      },
    ]);
  });

  it("merges site activity with realtime chat presence without duplicates", () => {
    const directors = mergeGlobalChatOnlineDirectors({
      currentDirector,
      recentDirectors: [
        {
          sportingDirectorId: "director-2",
          username: "bruno",
          displayName: "Bruno",
          avatarKey: null,
          avatarFrameKey: null,
          teamId: "team-2",
          teamName: "Nom ancien",
          teamHref: "/jeu/equipes/team-2",
        },
        currentDirector,
      ],
      realtimeDirectors: [
        {
          sportingDirectorId: "director-2",
          username: "bruno",
          displayName: "Bruno",
          avatarKey: "director_m_01",
          avatarFrameKey: null,
          teamId: "team-2",
          teamName: "Nom temps réel",
          teamHref: "/jeu/equipes/team-2",
        },
        {
          sportingDirectorId: "director-1",
          username: "alice",
          displayName: "Alice",
          avatarKey: "director_f_02",
          avatarFrameKey: null,
          teamId: "team-1",
          teamName: "Les Rouleurs",
          teamHref: "/jeu/equipes/team-1",
        },
      ],
    });

    expect(directors.map((director) => director.sportingDirectorId)).toEqual([
      "director-current",
      "director-1",
      "director-2",
    ]);
    expect(directors.find((director) => director.teamId === "team-2")?.teamName)
      .toBe("Nom temps réel");
  });
});
