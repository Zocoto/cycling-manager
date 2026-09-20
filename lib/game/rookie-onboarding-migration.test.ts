import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260919122000_add_rookie_onboarding_and_ranking.sql",
  "utf8",
);
const settlementFix = readFileSync(
  "supabase/migrations/20260919193000_fix_rookie_reward_settlement.sql",
  "utf8",
);
const rankingPage = readFileSync("app/jeu/classements/page.tsx", "utf8");
const chat = readFileSync("components/game/global-game-chat.tsx", "utf8");

describe("rookie onboarding and ranking", () => {
  it("separates the 21-day social badge from first-full-season eligibility", () => {
    expect(migration).toContain("generation.created_at + interval '21 days'");
    expect(migration).toContain("completed_season.game_year < target_season.game_year");
    expect(migration).toContain("completed_season.starts_on >=");
    expect(migration).toContain("public.alpha_bot_managers");
  });

  it("adds a fourth UCI view without introducing new sporting points", () => {
    expect(rankingPage).toContain('label="Rookies"');
    expect(rankingPage).toContain("columns={circuit === \"uci\" ? 4 : 3}");
    expect(rankingPage).toContain("Les points restent exactement ceux du classement UCI");
    expect(rankingPage).toContain("overallRank");
  });

  it("grants an idempotent and useful podium at season end", () => {
    expect(migration).toContain("unique (season_id, rookie_rank)");
    expect(migration).toContain("unique (season_id, team_id)");
    expect(migration).toContain("custom-staff-mandate");
    expect(migration).toContain("classified-talent-dossier");
    expect(migration).toContain("precision-architect-tee");
    expect(migration).toContain("potential-notebook");
    expect(migration).toContain("medallion-panache");
    expect(migration).toContain("settle_rookie_rewards_after_season_completion");
  });

  it("starts official rewards in season 3 and does not replay season 2", () => {
    expect(settlementFix).toContain("new.game_year >= 3");
    expect(settlementFix).toContain("previous.game_year >= 3");
    expect(settlementFix).toContain("where season.game_year < 3");
    expect(settlementFix).toContain("revocation_reason");
    expect(settlementFix).toContain("Correction du classement rookie");
  });

  it("does not count a day-one afternoon signup as a full season", () => {
    expect(settlementFix).toContain(
      "arrival_season.starts_on::timestamp at time zone 'Europe/Paris'",
    );
    expect(settlementFix).toContain(">= generation.created_at");
    expect(settlementFix).not.toContain(
      "(generation.created_at at time zone 'Europe/Paris')::date",
    );
  });

  it("reverses both untouched and already-consumed historical prizes", () => {
    expect(settlementFix).toContain("revoked_rookie_reward_items");
    expect(settlementFix).toContain("public.rider_special_abilities");
    expect(settlementFix).toContain("public.rider_consumable_item_applications");
    expect(settlementFix).toContain("public.team_item_inventory");
    expect(settlementFix).toContain("without a reversible audit trail");
  });

  it("invites newcomers to introduce themselves without canned chat messages", () => {
    expect(migration).toContain("Bienvenue dans le peloton !");
    expect(migration).toContain("'Se présenter au peloton'");
    expect(chat).not.toContain("Salut le peloton");
    expect(chat).not.toContain("Présenter mon équipe");
    expect(chat).not.toContain("Question tactique");
    expect(chat).not.toContain("Partager un objectif");
    expect(chat).toContain("<RookieBadge");
  });
});
