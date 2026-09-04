import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904130000_expand_federation_program.sql",
  ),
  "utf8",
);

describe("expanded federation programme", () => {
  it("keeps automatic selection enabled by default and lets the president opt out", () => {
    expect(migration).toContain(
      "create table public.national_federation_selection_preferences",
    );
    expect(migration).toContain("automatic_selection boolean not null default true");
    expect(migration).toContain("set_national_federation_selection_mode");
    expect(migration).toContain(
      "enforce_manual_federation_selection_mode",
    );
    expect(migration).toContain(
      "Désactivez la sélection automatique avant de modifier une liste",
    );
    expect(migration).toContain("ensure_automatic_federation_junior_lineups");
    expect(migration).toContain(
      "prepare_due_automatic_federation_junior_lineups",
    );
    expect(migration).toContain("academy.status in ('active', 'recruited')");
    expect(migration).toContain(
      "slot.day_number > v_season.current_day_number",
    );
  });

  it("stores one future jersey and activates it only on the next season", () => {
    expect(migration).toContain("pending_design jsonb");
    expect(migration).toContain("pending_activation_game_year");
    expect(migration).toContain("v_game_year + 1");
    expect(migration).toContain("activate_due_national_federation_jerseys");
  });
});
