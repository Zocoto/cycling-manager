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

  it("starts the team directory and profile queries in the same parallel batch", () => {
    const queryBlock = teamProfilePage.slice(
      teamProfilePage.indexOf("const [\n    team,"),
      teamProfilePage.indexOf("if (!team)"),
    );

    expect(queryBlock).toContain("await Promise.all([");
    expect(queryBlock.match(/\bawait\b/g)).toHaveLength(1);
    expect(queryBlock).toContain("getPublicTeam(supabase, identifiant)");
    expect(queryBlock).toContain("getPublicTeamProfileHistory(identifiant)");
    expect(queryBlock).toContain("getTeamRankingEntry(identifiant)");
  });
});
