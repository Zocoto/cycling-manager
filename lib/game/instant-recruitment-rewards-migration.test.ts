import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821235900_add_instant_recruitment_rewards.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const recruitmentService = readFileSync(
  resolve(process.cwd(), "services/daily-reward-recruitment.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("instant recruitment rewards migration", () => {
  it("adds the balanced rewards to both daily and objective inventories", () => {
    expect(migration).toContain("'instant-youth-contract'");
    expect(migration).toContain("'custom-staff-mandate'");
    expect(migration).toContain("'instant_youth_promotion'");
    expect(migration).toContain("'custom_staff_recruitment'");
    expect(migration).toContain("'rare'");
    expect(migration).toContain("'epic'");
    expect(migration).toContain("'youth_signing_10'");
    expect(migration).toContain("'youth_promotion_10'");
  });

  it("promotes only an eligible academy rider and cleans future DevTeam entries", () => {
    expect(migration).toContain("v_age < 17");
    expect(migration).toContain("edition.start_day_number <= v_context.current_day_number");
    expect(migration).toContain("edition.start_day_number > v_context.current_day_number");
    expect(migration).toContain("delete from public.development_team_roster");
    expect(migration).toContain("'instant_youth_promotion'");
    expect(migration).toContain("hashtextextended('team-roster:'");
  });

  it("keeps custom staff generation constrained and server-only", () => {
    expect(recruitmentService).toContain("const level = randomInt(1, 6)");
    expect(recruitmentService).toContain("getStaffTalentMinimumLevel(code) <= level");
    expect(migration).toContain("p_level not between 1 and 5");
    expect(migration).toContain("p_level < v_talent.minimum_level");
    expect(migration).toContain("get_staff_capacity_for_director_level");
    expect(migration).toContain("get_projected_transfer_budget");
    expect(migration).toContain("signing_fee_non_negative");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role;");
  });

  it("counts sponsor-country staff and rewards the new long-term goals", () => {
    expect(migration).toContain("'active_staff_team_nationality'");
    expect(migration).toContain(
      "member.country_id = team_season.registration_country_id",
    );
    expect(migration).toContain("'active_staff_distinct_roles'");
    expect(migration).toContain("count(distinct member.role)");
    expect(migration).toContain("'staff_team_nationality_6'");
    expect(migration).toContain("'staff_all_roles'");
  });

  it("consumes either source only after the successful mutation", () => {
    const juniorInsert = migration.indexOf("insert into public.riders (");
    const staffInsert = migration.indexOf("insert into public.staff_members (");
    const juniorConsumption = migration.indexOf(
      "if v_reward_source = 'daily_reward' then",
      juniorInsert,
    );
    const staffConsumption = migration.indexOf(
      "if v_reward_source = 'daily_reward' then",
      staffInsert,
    );

    expect(juniorInsert).toBeGreaterThan(-1);
    expect(staffInsert).toBeGreaterThan(-1);
    expect(juniorConsumption).toBeGreaterThan(juniorInsert);
    expect(staffConsumption).toBeGreaterThan(staffInsert);
    expect(migration).toContain("from public.team_item_inventory as inventory");
  });
});
