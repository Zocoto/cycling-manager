import { describe, expect, it } from "vitest";

import { applyGlobalChatGameStaffStatuses, type GlobalChatOnlineDirector } from "./global-chat-presence";

function director(id: string, gameStaff?: boolean): GlobalChatOnlineDirector {
  return { sportingDirectorId: id, username: id, displayName: id, avatarKey: null,
    avatarFrameKey: null, rookieBadgeExpiresAt: "2026-11-01T00:00:00Z", gameStaff,
    country: null, teamId: "team", teamName: "Team", teamHref: "/jeu/equipes/team" };
}

describe("game team presence identification", () => {
  it("uses only the server directory, never a realtime claimed flag", () => {
    const members = [director("staff", false), director("player", true)];
    const result = applyGlobalChatGameStaffStatuses(members, ["staff"]);
    expect(result.map(({ sportingDirectorId, gameStaff }) => ({ sportingDirectorId, gameStaff }))).toEqual([
      { sportingDirectorId: "staff", gameStaff: true },
      { sportingDirectorId: "player", gameStaff: false },
    ]);
    expect(result[0].rookieBadgeExpiresAt).toBe(members[0].rookieBadgeExpiresAt);
    expect(members[0].gameStaff).toBe(false);
    expect(members[1].gameStaff).toBe(true);
  });

  it("fails closed visually when the directory is empty or a role is removed", () => {
    expect(applyGlobalChatGameStaffStatuses([director("former", true)], [])[0].gameStaff).toBe(false);
    expect(applyGlobalChatGameStaffStatuses([], ["staff"])).toEqual([]);
  });
});
