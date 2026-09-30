import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

import { deriveGlobalRatingScale } from "@/lib/game/pcm-export/ratings";
import type {
  PcmExportSnapshot,
  RatingRow,
} from "@/lib/game/pcm-export/types";
import { buildPcmDatabase } from "@/services/pcm-export-builder";

describe("generateur de base PCM26", () => {
  it(
    "genere un CDB relisible avec une equipe, un coureur et son contrat",
    async () => {
      const template = await readFile(
        resolve("assets/pcm/OfficialRelease.template.cdb"),
      );
      const snapshot = createSnapshot();
      const SQL = await initSqlJs({
        locateFile: (file) =>
          resolve("node_modules", "sql.js", "dist", file),
      });
      const templateDb = cdbToSql(template, SQL, { preciseTypes: true });
      const sourceStageCount = readCount(
        templateDb,
        "SELECT COUNT(*) FROM STA_stage",
      );
      templateDb.close();
      const result = await buildPcmDatabase(snapshot, template);

      expect(result.metadata.counts).toEqual({
        teams: 1,
        riders: 1,
        sponsors: 1,
        contracts: 1,
      });
      expect(result.metadata.ratingRange).toEqual({ minimum: 50, maximum: 85 });
      expect(result.metadata.filename).toMatch(
        /^OfficialRelease\.cdb$/,
      );

      const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });
      try {
        expect(
          readCount(db, "SELECT COUNT(*) FROM DYN_team WHERE CONSTANT LIKE 'CS_%'"),
        ).toBe(1);
        expect(readCount(db, "SELECT COUNT(*) FROM STA_stage")).toBe(
          sourceStageCount,
        );
        expect(
          readCount(
            db,
            "SELECT COUNT(*) FROM DYN_cyclist WHERE CONSTANT LIKE 'CS_%'",
          ),
        ).toBe(1);
      } finally {
        db.close();
      }
    },
    20_000,
  );
});

function createSnapshot(): PcmExportSnapshot {
  const rating: RatingRow = {
    id: "rating-1",
    rider_id: "rider-1",
    season_id: "season-3",
    age: 24,
    mountain: 81,
    hills: 75,
    flat: 55,
    time_trial: 68,
    cobbles: 35,
    sprint: 59,
    acceleration: 65,
    downhill: 70,
    endurance: 73,
    resistance: 72,
    recovery: 71,
    breakaway: 67,
    prologue: 66,
  };
  const scale = deriveGlobalRatingScale([rating]);
  const snapshotCore = {
    schemaVersion: 1 as const,
    source: "Cyclostratege production" as const,
    activeSeason: {
      id: "season-3",
      game_year: 3,
      status: "active",
    },
    seasons: [
      { id: "season-3", game_year: 3, status: "active" },
      { id: "season-4", game_year: 4, status: "planned" },
    ],
    counts: { teams: 1, riders: 1, contracts: 1, ratings: 1 },
    ratingPolicy: {
      source: "native rider_season_ratings only" as const,
      bonusesIncluded: false as const,
      scale,
    },
    teamSeasons: [
      {
        id: "team-season-1",
        season_id: "season-3",
        team_id: "team-1",
        division_id: "division-world",
        registration_country_id: "country-fr",
        display_name: "Abbaye Cyclisme",
        short_name: "Abbaye",
        status: "active",
        operating_budget: 1_000_000,
        final_rank: 1,
      },
    ],
    teams: [
      {
        id: "team-1",
        home_country_id: "country-fr",
        amateur_jersey_primary_color: "#176951",
        amateur_jersey_secondary_color: "#fffdf4",
      },
    ],
    countries: [
      {
        id: "country-fr",
        iso_alpha3: "FRA",
        name: "France",
        continent_code: "europe",
      },
    ],
    divisions: [{ id: "division-world", code: "world" }],
    contracts: [
      {
        id: "contract-1",
        rider_id: "rider-1",
        team_id: "team-1",
        start_season_id: "season-3",
        end_season_id: "season-4",
        salary_per_season: 120_000,
        status: "active",
      },
    ],
    riders: [
      {
        id: "rider-1",
        first_name: "Roger",
        last_name: "Testeur",
        country_id: "country-fr",
        height_cm: 181,
        weight_kg: 69,
        potential_steps: 5,
      },
    ],
    ratings: [rating],
  };

  return {
    ...snapshotCore,
    exportedAt: "2026-09-30T12:00:00.000Z",
    sha256: "a".repeat(64),
  };
}

function readCount(
  db: ReturnType<typeof cdbToSql>,
  sql: string,
) {
  const result = db.exec(sql);
  return Number(result[0]?.values[0]?.[0] ?? 0);
}
