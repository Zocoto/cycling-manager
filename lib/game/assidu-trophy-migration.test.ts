import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809100000_create_assidu_attendance_trophy.sql",
  ),
  "utf8",
);
const gameLayout = readFileSync(
  resolve(process.cwd(), "app/jeu/layout.tsx"),
  "utf8",
);
const trophyService = readFileSync(
  resolve(process.cwd(), "services/trophy-gallery.ts"),
  "utf8",
);
const profileAction = readFileSync(
  resolve(process.cwd(), "app/jeu/directeur-sportif/actions.ts"),
  "utf8",
);

describe("Assidu attendance trophy", () => {
  it("records at most one authenticated attendance per season day", () => {
    expect(migration).toContain(
      "create table public.sporting_director_daily_attendance",
    );
    expect(migration).toContain(
      "unique (sporting_director_id, season_day_id)",
    );
    expect(migration).toContain(
      "record_current_sporting_director_attendance",
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id, season_day_id) do nothing",
    );
    expect(gameLayout).toContain(
      'supabase.rpc("record_current_sporting_director_attendance")',
    );
  });

  it("awards one trophy after every day of a completed season", () => {
    expect(migration).toContain(
      "create table public.sporting_director_attendance_trophies",
    );
    expect(migration).toContain(
      "having count(distinct attendance.season_day_id) = season_size.day_count",
    );
    expect(migration).toContain(
      "award_assidu_trophies_after_season_completion",
    );
    expect(migration).toContain("from public.alpha_bot_managers as bot");
  });

  it("loads the awarded trophy instead of inferring it from daily gifts", () => {
    expect(trophyService).toContain(
      '.from("sporting_director_attendance_trophies")',
    );
    expect(trophyService).not.toContain('.eq("streak_day", 28)');
  });

  it("protects the exclusive glasses in both the action and database", () => {
    expect(migration).toContain("validate_assidu_avatar_glasses");
    expect(migration).toContain("v_glasses_key <> 'honor-roll'");
    expect(migration).toContain(
      "Le trophée Assidu est requis pour porter les lunettes Premier de la classe.",
    );
    expect(profileAction).toContain(
      '.from("sporting_director_attendance_trophies")',
    );
    expect(profileAction).toContain("ASSIDU_AVATAR_GLASSES_KEY");
  });
});
