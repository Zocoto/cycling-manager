import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261001110000_romanize_game_names_and_french_sponsor_copy.sql",
  "utf8",
);

const localRaceSeed = readFileSync(
  "supabase/migrations/20260930150000_create_s4_local_race_circuit.sql",
  "utf8",
);

const expandedCalendarSeed = readFileSync(
  "supabase/migrations/20260930160000_expand_and_diversify_s4_calendar.sql",
  "utf8",
);

const NON_ROMAN_LETTER_PATTERN =
  /(?:\p{Script=Greek}|\p{Script=Cyrillic}|\p{Script=Armenian}|\p{Script=Hebrew}|\p{Script=Arabic}|\p{Script=Devanagari}|\p{Script=Thai}|\p{Script=Georgian}|\p{Script=Ethiopic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul})/u;

describe("romanisation des noms publics", () => {
  it("corrige les données existantes et leur génération future", () => {
    expect(migration).toContain("update public.races as race");
    expect(migration).toContain("update public.race_editions as edition");
    expect(migration).toContain("update public.stages as stage");
    expect(migration).toContain("private.local_race_country_catalog");
    expect(migration).toContain("Bishkek Emal");
  });

  it("protège les courses, équipes et sponsors au niveau de la base", () => {
    expect(migration).toContain("public.uses_roman_alphabet_name");
    expect(migration).toContain("teams_names_use_roman_alphabet");
    expect(migration).toContain("races_names_use_roman_alphabet");
    expect(migration).toContain("stages_names_use_roman_alphabet");
    expect(migration).toContain("sponsors_names_use_roman_alphabet");
    expect(migration).toContain(
      "national_federation_race_projects_names_use_roman_alphabet",
    );
  });

  it("ne réintroduit aucun autre alphabet dans les catalogues S4", () => {
    expect(localRaceSeed).not.toMatch(NON_ROMAN_LETTER_PATTERN);
    expect(expandedCalendarSeed).not.toMatch(NON_ROMAN_LETTER_PATTERN);
  });
});

