import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260823113000_add_construction_and_staff_boost_rewards.sql",
  ),
  "utf8",
);
const actions = fs.readFileSync(
  path.join(process.cwd(), "app/jeu/objectifs/actions.ts"),
  "utf8",
);
const rewardService = fs.readFileSync(
  path.join(process.cwd(), "services/daily-rewards.ts"),
  "utf8",
);

describe("management reward items migration", () => {
  it("adds the balanced construction and staff rewards to both catalogs", () => {
    expect(migration).toContain("'construction-square'");
    expect(migration).toContain("'precision-architect-tee'");
    expect(migration).toContain("'staff-expertise-badge'");
    expect(migration).toContain("'{\"days\":2}'::jsonb");
    expect(migration).toContain("'{\"days\":7}'::jsonb");
    expect(migration).toContain("'uncommon'");
    expect(migration).toContain("'rare'");
    expect(migration).toContain("'epic'");
  });

  it("keeps construction acceleration atomic and leaves one day remaining", () => {
    expect(migration).toContain(
      "create or replace function public.redeem_construction_time_reward",
    );
    expect(migration).toContain("for update of project");
    expect(migration).toContain(
      "v_applied_days := least(v_reduction_days, v_remaining_days - 1)",
    );
    expect(migration).toContain(
      "final_duration_days = final_duration_days - v_applied_days",
    );
    expect(actions).toContain('"redeem_construction_time_reward"');
  });

  it("caps staff progression at five stars and only exposes eligible staff", () => {
    expect(migration).toContain(
      "create or replace function public.redeem_staff_level_boost_reward",
    );
    expect(migration).toContain("and member.level < 5");
    expect(migration).toContain("if v_staff.level >= 5 then");
    expect(migration).toContain("v_new_level := v_staff.level + 1");
    expect(actions).toContain('"redeem_staff_level_boost_reward"');
    expect(rewardService).toContain(
      'supabase.rpc("get_current_management_reward_targets")',
    );
  });

  it("links the new items to existing objectives and backfills prior claims", () => {
    expect(migration).toContain(
      "where objective_key = 'infrastructure_first_performance'",
    );
    expect(migration).toContain(
      "where objective_key = 'infrastructure_performance_network'",
    );
    expect(migration).toContain(
      "where objective_key = 'staff_team_nationality_3'",
    );
    expect(migration).toContain(
      "'Mise à niveau des récompenses d’objectifs'",
    );
  });
});
