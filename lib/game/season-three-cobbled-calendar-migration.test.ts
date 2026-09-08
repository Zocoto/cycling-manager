import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260908100000_expand_s3_cobbled_calendar.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("extension pavée du calendrier S3", () => {
  it("ajoute vingt courses et couvre également les pays peu représentés", () => {
    expect(migration).toContain(
      "Le complément pavé S3 doit contenir 20 courses, 20 pays et 35 étapes.",
    );

    for (const countryCode of [
      "UY",
      "SE",
      "CN",
      "CO",
      "MU",
      "LV",
      "RW",
      "AM",
      "CU",
      "LK",
      "CZ",
      "DK",
      "AR",
      "BR",
      "AL",
      "PY",
      "GT",
      "NP",
      "RS",
      "NZ",
    ]) {
      expect(migration).toContain(`'${countryCode}'`);
    }
  });

  it("répartit les courses entre les quatre catégories hors Elite", () => {
    expect(migration).toContain(
      "Chaque catégorie hors Elite doit recevoir exactement cinq courses pavées.",
    );
    expect(migration).toContain(
      "category_code in ('world', 'continental', 'national', 'regional')",
    );
    expect(migration).not.toContain("category_code in ('elite'");
  });

  it("crée un tour pavé par catégorie avec plusieurs profils", () => {
    expect(migration).toContain(
      "Chaque catégorie hors Elite doit recevoir exactement un tour pavé.",
    );
    expect(migration).toContain(
      "Chaque tour doit mêler vitesse, vallons et au moins deux étapes pavées.",
    );

    for (const slug of [
      "vuelta-de-los-caminos-blancos",
      "tour-des-paves-baltiques",
      "tour-de-la-voie-royale-de-boheme",
      "vuelta-de-los-caminos-rojos",
    ]) {
      expect(migration).toContain(`'${slug}'`);
    }

    for (const profile of [
      "flat-174",
      "sprint-188",
      "hilly-166",
      "cobbles-176",
      "cobbles-188",
      "cobbles-196",
      "cobbles-204",
      "gravel-182",
      "gravel-hilly-186",
    ]) {
      expect(migration).toContain(`'${profile}'`);
    }
  });

  it("introduit un unique CLM individuel pavé de 32 kilomètres", () => {
    expect(migration).toContain(
      "('cobbled-itt-32', 'individual_time_trial', 'cobbles'",
    );
    expect(migration).toContain("'Chrono des Caminos Blancos'");
    expect(migration).toContain(
      "Chaque saison ciblée doit contenir exactement un CLM pavé.",
    );
    expect(migration).toContain("segment.surface_type = 'cobbles'");
  });

  it("cible la S3 et préserve les journées internationales", () => {
    expect(migration.match(/season\.game_year >= 3/g)?.length).toBeGreaterThan(3);
    expect(migration).toContain("status in ('active', 'planned')");
    expect(migration).toContain("day_number in (15, 24, 26)");
    expect(migration).toContain(
      "Les journées CC, Nations Cup et CM doivent rester libres.",
    );
  });

  it("conserve les règles d'accès propres à chaque catégorie", () => {
    expect(migration).toContain("when 'world' then 200");
    expect(migration).toContain("when 'continental' then 100");
    expect(migration).toContain("when 'regional' then 16");
    expect(migration).toContain("when 'world' then 24");
    expect(migration).toContain("else 30");
  });
});
