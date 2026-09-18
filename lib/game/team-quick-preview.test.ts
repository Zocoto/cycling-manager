import { describe, expect, it } from "vitest";

import { getTeamIdFromProfileHref } from "@/lib/game/team-quick-preview";

const teamId = "c779344f-23a3-4a95-8c37-40396a26d042";

describe("liens d’aperçu des équipes", () => {
  it("reconnaît uniquement la fiche d’une équipe", () => {
    expect(getTeamIdFromProfileHref(`/jeu/equipes/${teamId}?source=gazette`)).toBe(teamId);
    expect(getTeamIdFromProfileHref(`/jeu/equipes/${teamId}/`)).toBe(teamId);
    expect(getTeamIdFromProfileHref("/jeu/equipes/toutes")).toBeNull();
    expect(getTeamIdFromProfileHref(`/jeu/coureurs/${teamId}`)).toBeNull();
  });
});
