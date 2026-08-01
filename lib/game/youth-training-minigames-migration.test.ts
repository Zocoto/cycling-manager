import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260801090000_expand_youth_training_minigames.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth training minigames migration", () => {
  it("autorise les six types de minijeu dans les séances et tentatives", () => {
    expect(migration).toContain(
      "drop constraint youth_academy_training_sessions_game_allowed",
    );
    expect(migration).toContain(
      "drop constraint youth_academy_training_attempts_game_allowed",
    );
    for (const gameType of [
      "rhythm",
      "reflex",
      "speed",
      "time_trial",
      "breakaway",
      "puncheur",
    ]) {
      expect(migration).toContain(`'${gameType}'`);
    }
  });

  it("associe chaque profil à son jeu et lance une partie de 30 secondes", () => {
    for (const mapping of [
      "when 'climber' then 'rhythm'",
      "when 'puncheur' then 'puncheur'",
      "when 'northern_classics' then 'reflex'",
      "when 'breakaway' then 'breakaway'",
      "when 'rouleur' then 'time_trial'",
    ]) {
      expect(migration).toContain(mapping);
    }
    expect(migration).toContain("'durationSeconds',\n    30");
  });

  it("remplace uniquement la fonction interne et conserve son verrouillage", () => {
    expect(migration).toContain(
      "create or replace function public.start_current_youth_training_attempt_immediate(",
    );
    expect(migration).toContain(
      "revoke all on function public.start_current_youth_training_attempt_immediate(",
    );
    expect(migration).not.toContain(
      "create or replace function public.start_current_youth_training_attempt(\n",
    );
  });
});