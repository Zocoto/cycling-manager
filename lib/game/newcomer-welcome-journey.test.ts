import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260920140000_create_newcomer_welcome_journey.sql",
  "utf8",
);
const assistant = readFileSync(
  "components/game/dashboard-assistant.tsx",
  "utf8",
);
const assistantService = readFileSync(
  "services/dashboard-assistant.ts",
  "utf8",
);
const livePage = readFileSync(
  "app/jeu/resultats/[slug]/[stageNumber]/page.tsx",
  "utf8",
);
const achievements = readFileSync(
  "lib/game/achievement-trophies.ts",
  "utf8",
);

describe("newcomer welcome journey", () => {
  it("enrolls only recent human directors and keeps the journey until completion", () => {
    expect(migration).toContain("director.created_at >= now() - interval '48 hours'");
    expect(migration).toContain("public.alpha_bot_managers");
    expect(migration).toContain("journey.completed_at is null");
    expect(migration).not.toContain("enrolled_at + interval '48 hours'");
  });

  it("exposes four progressive waves of two real objectives", () => {
    for (const stepKey of [
      "claim_daily_reward",
      "post_global_chat_message",
      "configure_training",
      "recruit_staff_member",
      "place_auction_bid",
      "register_for_race",
      "prepare_race",
      "follow_race_live",
    ]) {
      expect(migration).toContain(`'${stepKey}'`);
    }
    expect(migration).toContain("v_wave_start + 1");
    expect(migration).toContain("'totalWaves', 4");
  });

  it("detects persisted gameplay instead of navigation clicks", () => {
    for (const table of [
      "public.daily_reward_claims",
      "public.global_chat_messages",
      "public.rider_training_plan_versions",
      "public.staff_contracts",
      "public.transfer_market_bids",
      "public.race_registrations",
      "public.race_stage_strategies",
      "public.race_time_trial_rider_plans",
    ]) {
      expect(migration).toContain(table);
    }
    expect(livePage).toContain("record_current_newcomer_live_visit");
  });

  it("places the journey above assistant alerts and hides it after completion", () => {
    expect(assistantService).toContain("get_current_newcomer_journey");
    expect(assistant).toContain("Parcours de bienvenue");
    expect(assistant.indexOf("<WelcomeJourney")).toBeLessThan(
      assistant.indexOf('label="Alertes"'),
    );
    expect(migration).toContain("set completed_at = now()");
  });

  it("grants modest idempotent rewards and the completion achievement", () => {
    expect(migration).toContain("unique (sporting_director_id)");
    expect(migration).toContain("'premiers_tours_de_roue'");
    expect(migration).toContain("on conflict (sporting_director_id, trophy_key)");
    expect(achievements).toContain("Premiers tours de roue");
  });
});
