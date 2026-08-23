import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const teamProfilePage = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

describe("team profile mobile layout", () => {
  it("keeps recent result tiles inside the narrow viewport", () => {
    expect(teamProfilePage).toContain(
      "grid min-w-0 grid-cols-[minmax(0,1fr)]",
    );
    expect(teamProfilePage).toContain(
      "group flex min-w-0 max-w-full items-center",
    );
    expect(teamProfilePage).toContain(
      "shrink-0 font-black text-[var(--team-secondary)]",
    );
  });

  it("streams secondary team sections after the essential profile queries", () => {
    const essentialQueryBlock = teamProfilePage.slice(
      teamProfilePage.indexOf("const [\n    team,"),
      teamProfilePage.indexOf("if (!team)"),
    );
    const rosterDisclosureBlock = teamProfilePage.slice(
      teamProfilePage.indexOf("async function TeamRosterDisclosure"),
      teamProfilePage.indexOf("async function DevelopmentTeamDisclosure"),
    );
    const historyDisclosureBlock = teamProfilePage.slice(
      teamProfilePage.indexOf("async function TeamHistoryDisclosure"),
    );

    expect(essentialQueryBlock).toContain("await Promise.all([");
    expect(essentialQueryBlock.match(/\bawait\b/g)).toHaveLength(1);
    expect(essentialQueryBlock).toContain("getPublicTeam(supabase, identifiant)");
    expect(essentialQueryBlock).toContain("getTeamRankingEntry(identifiant)");
    expect(essentialQueryBlock).not.toContain("getPublicTeamProfileHistory");
    expect(rosterDisclosureBlock).toContain("getPublicTeamRiders(teamId)");
    expect(historyDisclosureBlock).toContain("await Promise.all([");
    expect(historyDisclosureBlock).toContain("getPublicTeamRiderHistory(teamId)");
    expect(historyDisclosureBlock).toContain("getPublicTeamProfileHistory(teamId)");
    expect(teamProfilePage).toContain("<ProfileDisclosureSkeleton");
  });
});
