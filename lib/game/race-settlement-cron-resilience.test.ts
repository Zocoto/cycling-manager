import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "app/api/cron/race-settlements/[slot]/route.ts"),
  "utf8",
);
const resultsPage = readFileSync(
  resolve(process.cwd(), "app/jeu/resultats/page.tsx"),
  "utf8",
);
const runner = readFileSync(
  resolve(process.cwd(), "services/race-settlement-runner.ts"),
  "utf8",
);
const resultsService = readFileSync(
  resolve(process.cwd(), "services/race-results.ts"),
  "utf8",
);
const newsService = readFileSync(
  resolve(process.cwd(), "services/post-race-news.ts"),
  "utf8",
);
const rewardRefreshMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904180000_defer_race_reward_ranking_refresh.sql",
  ),
  "utf8",
);
const teamTimeTrialRewardRefreshMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904181500_defer_team_time_trial_reward_ranking_refresh.sql",
  ),
  "utf8",
);
const initialNonStarterMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904182500_exclude_initial_non_starters_from_race_repair.sql",
  ),
  "utf8",
);

describe("race settlement cron resilience", () => {
  it("isolates pre-settlement failures instead of aborting race results", () => {
    expect(route).toContain("export const maxDuration = 300");
    expect(resultsPage).toContain("export const maxDuration = 300");
    expect(route).toContain("runPreSettlementTask");
    expect(route).toMatch(
      /runPreSettlementTask\(\s*"sélections internationales"/,
    );
    expect(route).not.toContain("syncNationalChampionshipRegistrations");
    expect(route).toContain("settleDueStandardRaceResults");
    expect(route).toContain("preSettlementFailures");
    expect(route).toContain("raceSlug: requestedRaceSlug ?? undefined");
    expect(route).toContain('skipped: "targeted_race_settlement"');
    expect(route).toContain('skipped: "secondary_job_pack"');
    expect(route).toContain("getRaceJobPackFromSlot");
  });

  it("discovers cheaply and loads only editions that can be settled", () => {
    expect(runner).toContain("includeEngagedCounts: false");
    expect(runner).toContain("includeEngagedRiders: false");
    expect(runner).toContain("isRaceEditionSettlementCandidate");
    expect(runner).toContain("claim_race_editions_for_settlement");
    expect(runner).toContain("selectRaceJobPack");
    expect(runner).toContain("deferredEditions");
    expect(runner).toContain("raceEditionIds: claimedEditionIds");
    expect(runner).toContain("repairableCompletedEditionIds");
  });

  it("keeps editorial side effects from blocking official results", () => {
    expect(resultsService).toContain("post_race_news_persistence_failed");
    expect(newsService).toContain('from("teams")');
    expect(newsService).toContain("existingTeamIds.has(event.featuredTeamId)");
    expect(resultsService).toContain("stage.status !== \"completed\"");
    expect(resultsService).toContain("la reprise du statut de ${stage.name}");
    expect(resultsService).toContain("initiallyUnavailableRiderIds");
    expect(initialNonStarterMigration).toContain("unavailableRiderIds");
  });

  it("refreshes the UCI aggregation once after all edition rewards", () => {
    expect(resultsService).toContain(
      '"refresh_race_edition_uci_rankings"',
    );
    expect(rewardRefreshMigration).not.toContain(
      "perform public.refresh_uci_rankings(v_context.season_id)",
    );
    expect(teamTimeTrialRewardRefreshMigration).not.toContain(
      "perform public.refresh_uci_rankings(v_context.season_id)",
    );
  });
});
