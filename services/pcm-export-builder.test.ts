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
      const sourcePresetRaceTeamListCount = readCount(
        templateDb,
        "SELECT COUNT(*) FROM STA_race WHERE gene_ilist_fkIDteam <> '()'",
      );
      templateDb.close();
      const result = await buildPcmDatabase(snapshot, template);

      expect(result.metadata.counts).toEqual({
        teams: 2,
        riders: 11,
        sponsors: 2,
        contracts: 11,
      });
      expect(result.metadata.ratingRange).toEqual({ minimum: 59, maximum: 77 });
      expect(result.metadata.divisionCounts).toEqual({
        "10": 0,
        "11": 1,
        "12": 1,
      });
      expect(result.metadata.filename).toMatch(
        /^OfficialRelease\.cdb$/,
      );

      const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });
      try {
        expect(
          readCount(db, "SELECT COUNT(*) FROM DYN_team WHERE CONSTANT LIKE 'CS_%'"),
        ).toBe(2);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_team
             WHERE IDteam = 244
               AND gene_sz_name = 'Abbaye Cyclisme'
               AND jersey_sz_abbreviation = 'apt'
               AND fkIDdivision = 11`,
          ),
        ).toBe(1);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_team
             WHERE CONSTANT = 'CS_SPECTATOR'
               AND gene_sz_name = 'Cyclostratège'
               AND gene_b_licensed = 1`,
          ),
        ).toBe(1);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_team
             WHERE CONSTANT <> 'LOOSER_TEAM' AND CONSTANT NOT LIKE 'CS_%'`,
          ),
        ).toBe(0);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_team
             WHERE CONSTANT LIKE 'CS_%' AND gene_b_licensed <> 1`,
          ),
        ).toBe(0);
        expect(readCount(db, "SELECT COUNT(*) FROM STA_stage")).toBe(
          sourceStageCount,
        );
        expect(
          readCount(
            db,
            "SELECT COUNT(*) FROM DYN_cyclist WHERE CONSTANT LIKE 'CS_%'",
          ),
        ).toBe(11);
        expect(readCount(db, "SELECT COUNT(*) FROM DYN_cyclist")).toBe(11);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_cyclist cyclist
             JOIN DYN_team team ON team.IDteam = cyclist.fkIDteam
             WHERE team.CONSTANT = 'CS_SPECTATOR'`,
          ),
        ).toBe(10);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_cyclist cyclist
             JOIN DYN_team team ON team.IDteam = cyclist.fkIDteam
             WHERE team.CONSTANT = 'CS_SPECTATOR'
               AND cyclist.gene_sz_firstname = 'Simulo'
               AND cyclist.charac_i_mountain = 65
               AND cyclist.charac_i_medium_mountain = 65
               AND cyclist.charac_i_hill = 65
               AND cyclist.charac_i_sprint = 65`,
          ),
        ).toBe(10);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM DYN_cyclist
             WHERE CONSTANT = 'CS_RIDER1'
               AND charac_i_mountain = 77
               AND charac_i_hill = 75
               AND charac_i_medium_mountain = 76
               AND limit_i_medium_mountain = 76`,
          ),
        ).toBe(1);
        expect(
          readCount(
            db,
            "SELECT COUNT(*) FROM STA_race WHERE gene_ilist_fkIDteam <> '()'",
          ),
        ).toBe(sourcePresetRaceTeamListCount);
        expect(
          readCount(
            db,
            `SELECT COUNT(*) FROM STA_race
             WHERE gene_ilist_fkIDteam <> '()'
               AND gene_ilist_fkIDteam <> '(243,244)'`,
          ),
        ).toBe(0);
        expect(
          readCount(
            db,
            `SELECT COUNT(*)
             FROM DYN_cyclist cyclist
             LEFT JOIN STA_cyclist_state state
               ON state.IDcyclist_state = cyclist.fkIDcyclist_state
             WHERE cyclist.CONSTANT LIKE 'CS_%'
               AND state.IDcyclist_state IS NULL`,
          ),
        ).toBe(0);
        expect(
          readCount(
            db,
            `SELECT COUNT(*)
             FROM DYN_cyclist
             WHERE CONSTANT LIKE 'CS_%'
               AND (charac_i_tour NOT BETWEEN 0 AND 5
                 OR charac_i_classic NOT BETWEEN 0 AND 5)`,
          ),
        ).toBe(0);
        expect(
          readCount(
            db,
            `SELECT COUNT(*)
             FROM DYN_cyclist
             WHERE CONSTANT LIKE 'CS_%'
               AND value_f_potentiel NOT IN
                 (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0)`,
          ),
        ).toBe(0);
      } finally {
        db.close();
      }
    },
    20_000,
  );

  it("place la division Elite dans le premier niveau PCM", async () => {
    const snapshot = createSnapshot();
    snapshot.divisions[0] = { id: "division-world", code: "elite" };

    const result = await buildPcmDatabase(snapshot);
    const SQL = await initSqlJs({
      locateFile: (file) => resolve("node_modules", "sql.js", "dist", file),
    });
    const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });

    try {
      expect(
        readCount(
          db,
          "SELECT COUNT(*) FROM DYN_team WHERE IDteam = 244 AND fkIDdivision = 10",
        ),
      ).toBe(1);
      expect(result.metadata.divisionCounts).toEqual({
        "10": 1,
        "11": 0,
        "12": 1,
      });
    } finally {
      db.close();
    }
  });

  it.each(["continental", "national"])(
    "place la division Cyclostratege %s dans le troisieme niveau PCM",
    async (divisionCode) => {
      const snapshot = createSnapshot();
      snapshot.divisions[0] = { id: "division-world", code: divisionCode };

      const result = await buildPcmDatabase(snapshot);
      const SQL = await initSqlJs({
        locateFile: (file) => resolve("node_modules", "sql.js", "dist", file),
      });
      const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });

      try {
        expect(
          readCount(
            db,
            "SELECT COUNT(*) FROM DYN_team WHERE IDteam = 244 AND fkIDdivision = 12",
          ),
        ).toBe(1);
      } finally {
        db.close();
      }
    },
  );

  it("place une equipe amateure sans division en troisieme niveau PCM", async () => {
    const snapshot = createSnapshot();
    snapshot.teamSeasons[0].division_id = null;

    const result = await buildPcmDatabase(snapshot);
    const SQL = await initSqlJs({
      locateFile: (file) => resolve("node_modules", "sql.js", "dist", file),
    });
    const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });

    try {
      expect(
        readCount(
          db,
          "SELECT COUNT(*) FROM DYN_team WHERE IDteam = 244 AND fkIDdivision = 12",
        ),
      ).toBe(1);
    } finally {
      db.close();
    }
  });

  it("interrompt l'export si la division reelle d'une equipe est inconnue", async () => {
    const snapshot = createSnapshot();
    snapshot.teamSeasons[0].division_id = "division-inconnue";

    await expect(buildPcmDatabase(snapshot)).rejects.toThrow(
      "Division Cyclostratege inconnue",
    );
  });
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
        pcm_export_id: 244,
        pcm_asset_code: "apt",
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
        pcm_export_id: 10001,
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
