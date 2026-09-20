import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919090000_weeklong_new_director_welcome_boost.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const hotfixMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919185000_fix_welcome_boost_team_creation.sql",
  ),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .toLowerCase();

const salaryWaiverMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260920133000_waive_welcome_scout_first_season_salary.sql",
  ),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .toLowerCase();

const teamStaffService = readFileSync(
  resolve(process.cwd(), "services/team-staff.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const staffPage = readFileSync(
  resolve(process.cwd(), "app/jeu/staff/page.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("weeklong new director welcome boost", () => {
  it("starts on migration application and expires for new registrations after seven days", () => {
    expect(migration).toContain("clock_timestamp() as started_at");
    expect(migration).toContain("activation.started_at + interval '7 days'");
    expect(migration).toContain("account.created_at");
    expect(migration).toContain("v_registered_at < v_campaign.starts_at");
    expect(migration).toContain("v_registered_at >= v_campaign.ends_at");
    expect(migration).toContain("after insert on public.initial_career_generations");
  });

  it("adds 50% to the existing 10,000 EUR opening cash only once", () => {
    expect(migration).toContain("  5000,");
    expect(migration).toContain("private.new_director_welcome_grants");
    expect(migration).toContain("auth_user_id uuid not null unique");
    expect(migration).toContain("team_id uuid not null unique");
    expect(migration).toContain(
      "opening_cash_balance = team_season.opening_cash_balance + v_campaign.extra_starting_cash",
    );
    expect(migration).toContain(
      "cash_balance = team_season.cash_balance + v_campaign.extra_starting_cash",
    );
  });

  it("gifts an active level-three scout of the amateur team's country", () => {
    expect(migration).toContain("team.home_country_id");
    expect(migration).toContain("'scout', v_campaign.scout_level");
    expect(migration).toContain("v_team_country_id, v_first_name, v_last_name");
    expect(migration).toContain("talent.role = 'scout'");
    expect(migration).toContain("v_currency_code, 0, 'active'");
  });

  it("does not prevent the established account-deletion flow", () => {
    expect(migration).toContain(
      "generation_id uuid primary key references public.initial_career_generations(id) on delete cascade",
    );
    expect(migration).toContain(
      "scout_contract_id uuid unique references public.staff_contracts(id) on delete set null",
    );
  });

  it("does not query the retired rider-name relation after the hotfix", () => {
    expect(hotfixMigration).not.toMatch(
      /(?:from|join)\s+public\.rider_name_parts/,
    );
    expect(hotfixMigration).toContain("from public.rider_contracts as contract");
    expect(hotfixMigration).toContain(
      "join public.riders as rider on rider.id = contract.rider_id",
    );
  });

  it("cannot roll back initial team creation when the optional gift fails", () => {
    expect(hotfixMigration).toContain("exception\n    when others then");
    expect(hotfixMigration).toContain("return new;");
    expect(hotfixMigration).toContain("v_first_name := coalesce");
    expect(hotfixMigration).toContain("v_last_name := coalesce");
  });
  it("waives only the gifted scout's first-season salary", () => {
    expect(salaryWaiverMigration).toContain(
      "add column if not exists salary_waived_season_id uuid",
    );
    expect(salaryWaiverMigration).toContain(
      "from private.new_director_welcome_grants as award",
    );
    expect(salaryWaiverMigration).toContain(
      "contract.id = award.scout_contract_id",
    );
    expect(salaryWaiverMigration).toContain(
      "if v_contract.salary_waived_season_id = v_team_season.season_id then",
    );
    expect(salaryWaiverMigration).toContain(
      "continue;\n    end if;\n\n    for v_installment in 1..4 loop",
    );
  });

  it("repairs already granted gifts without rewriting posted finance history", () => {
    expect(salaryWaiverMigration).toContain(
      "set status = 'cancelled'",
    );
    expect(salaryWaiverMigration).toContain(
      "welcome-scout-salary-refund:",
    );
    expect(salaryWaiverMigration).toContain(
      "-transaction.amount",
    );
    expect(salaryWaiverMigration).toContain(
      "on conflict (team_season_id, source_reference) do nothing",
    );
  });

  it("keeps the waiver visible and out of the current payroll", () => {
    expect(teamStaffService).toContain(
      "contract.salary_waived_season_id === context.season.id",
    );
    expect(teamStaffService).toContain(
      "const effectiveSalaryThisSeason = salaryWaivedThisSeason",
    );
    expect(staffPage).toContain(
      "Cadeau de bienvenue · salaire offert cette saison",
    );
    expect(staffPage).toContain("à partir de la saison suivante");
  });
});
