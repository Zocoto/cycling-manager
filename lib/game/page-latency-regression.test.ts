import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("critical page request budgets", () => {
  it("never loads a trophy career or daily rewards on the objectives tab", () => {
    const source=readFileSync("app/jeu/objectifs/page.tsx","utf8");
    expect(source).toContain('selectedTab === "objectifs" ? getCurrentGameObjectives(supabase)');
    expect(source).toContain('selectedTab === "trophees" ? getSportingDirectorTrophyGallery(user.id)');
    expect(source).toContain('selectedTab === "quotidiennes" ? getCurrentDailyRewardOverview(supabase)');
  });
  it("does not await secondary dashboard data in the essential identity join", () => {
    const source=readFileSync("app/jeu/page.tsx","utf8");
    const block=source.slice(source.indexOf("const [sponsorIdentityResult, teamAmateurIdentity, financeOverview]"),source.indexOf("const teamSponsorIdentity ="));
    for(const promise of ["reputationBreakdownPromise","sponsorObjectiveSummaryPromise","inventoryOverviewPromise","fanClubBuildingsPromise"]) {
      expect(block).not.toContain(promise);
      expect(source).toContain(`promise={${promise}}`);
    }
  });
  it("uses the already authenticated race-page team and overlaps identity/calendar reads", () => {
    const source=readFileSync("app/jeu/courses/[slug]/race-profile-content.tsx","utf8");
    expect(source).not.toContain("getActiveTeamSponsorIdentityForAuthUser");
    expect(source).not.toContain("getTeamAmateurIdentityForAuthUser");
    expect(source).toContain("getActiveTeamSponsorIdentity(header.teamId)");
    expect(source.indexOf("const sponsorPromise")).toBeLessThan(source.indexOf("await Promise.all([" ,source.indexOf("const sponsorPromise")));
    expect(source).toContain("raceSlug: slug");
  });
});
