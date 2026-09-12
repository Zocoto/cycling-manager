import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260909210000_create_cyclogazette_season_two_gala.sql",
  ),
  "utf8",
);
const resilienceMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260910203000_ignore_terminal_editions_in_cyclogazette_gala.sql",
  ),
  "utf8",
);
const rolloverRepairMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260911130000_repair_cyclogazette_s2_quiz_rollover_rewards.sql",
  ),
  "utf8",
);

describe("Cyclogazette S2 gala migration", () => {
  it("waits for every race and stage before freezing all five awards", () => {
    expect(migration).toContain("prepare_cyclogazette_season_gala");
    expect(migration).toContain(
      "pending_stage.status not in (''completed'', ''cancelled'')",
    );
    expect(migration).toContain(
      "pending_edition.status not in (''completed'', ''cancelled'')",
    );
    expect(migration).toContain("'ready', v_award_count = 5");
  });

  it("does not let stale child stages block an already terminal edition", () => {
    expect(resilienceMigration).toContain(
      "edition.status not in ('completed', 'cancelled')",
    );
    expect(resilienceMigration).toContain(
      "stage.status not in ('completed', 'cancelled')",
    );
  });

  it("stores one attempt and credits the team atomically", () => {
    expect(migration).toContain(
      "create table public.cyclogazette_season_quiz_attempts",
    );
    expect(migration).toContain("unique (edition_id, sporting_director_id)");
    expect(migration).toContain("for update of team_season");
    expect(migration).toContain("v_reward := p_correct_answers * 10000");
    expect(migration).toContain("cash_balance = cash_balance + v_reward");
    expect(migration).toContain("to service_role");
  });

  it("does not expose the trusted completion RPC to browsers", () => {
    expect(migration).toMatch(
      /from public, anon, authenticated;\r?\ngrant execute on function public\.complete_cyclogazette_season_quiz_for_user/,
    );
  });

  it("credits the active season when the S2 quiz is answered after rollover", () => {
    expect(rolloverRepairMigration).toContain(
      "team_season.season_id = active_season.id",
    );
    expect(rolloverRepairMigration).toContain(
      "team_season.status = 'active'",
    );
    expect(rolloverRepairMigration).toContain(
      "v_target_season.starts_on::timestamp at time zone 'Europe/Paris'",
    );
    expect(rolloverRepairMigration).toContain(
      "cyclogazette-season-quiz:' || v_attempt.id::text",
    );
    expect(rolloverRepairMigration).toContain(
      "set team_season_id = v_target_team.id",
    );
  });
});
