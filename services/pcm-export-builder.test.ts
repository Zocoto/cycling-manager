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
import { createPcmExportPackage } from "@/services/pcm-export-package";
import { unzipSync } from "fflate";

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
      expect(readCount(templateDb, "SELECT gene_i_max_riders FROM STA_race_class WHERE IDrace_class = 8")).toBe(7);
      expect(readCount(templateDb, "SELECT COUNT(*) FROM STA_race_rules WHERE fkIDrace = 15")).toBe(0);
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
        expect(readCount(db, "SELECT COUNT(*) FROM STA_race_rules WHERE fkIDrace=15 AND gene_i_max_team=25 AND gene_i_min_riders=6 AND gene_i_max_riders=8")).toBe(1);
        expect(readCount(db, "SELECT gene_i_max_riders FROM STA_race_class WHERE IDrace_class = 8")).toBe(7);
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

  it("ajoute les vrais pays et leurs noms, utilise les alias existants et conserve les titres", async () => {
    const snapshot = createSnapshot();
    const cases = [
      ["NPL", "NP", "Népal", "asia", "NPL", "Nepal"],
      ["SLV", "SV", "Salvador", "america", "SLV", "El-Salvador"],
      ["PRK", "KP", "Corée du Nord", "asia", "PRK", "North-Korea"],
      ["MDV", "MV", "Maldives", "asia", "MDV", "Maldives"],
      ["GMB", "GM", "Gambie", "africa", "GMB", "Gambia"],
      ["MRT", "MR", "Mauritanie", "africa", "MRT", "Mauritania"],
      ["LVA", "LV", "Lettonie", "europe", "LAT", "Latvia"],
      ["BMU", "BM", "Bermudes", "america", "BER", "Bermuda"],
    ];
    const riderTemplate = snapshot.riders[0], contractTemplate = snapshot.contracts[0], ratingTemplate = snapshot.ratings[0];
    snapshot.riders = []; snapshot.contracts = []; snapshot.ratings = [];
    snapshot.nationalChampionshipTitles = [];
    for (const [i, [code, iso2, name, continent]] of cases.entries()) {
      const id = `rider-${code}`, countryId = `country-${code}`;
      snapshot.countries.push({ id: countryId, iso_alpha3: code, iso_alpha2: iso2, name, continent_code: continent });
      snapshot.riders.push({ ...riderTemplate, id, pcm_export_id: 10001 + i, country_id: countryId });
      snapshot.contracts.push({ ...contractTemplate, id: `contract-${code}`, rider_id: id });
      snapshot.ratings.push({ ...ratingTemplate, id: `rating-${code}`, rider_id: id });
      if (i !== 3) snapshot.nationalChampionshipTitles.push({ rider_id: id, country_id: countryId, championship_type: "road" });
      if (i < 2) snapshot.nationalChampionshipTitles.push({ rider_id: id, country_id: countryId, championship_type: "time_trial" });
    }
    // Teams use registration identity, sponsors use the same country's region.
    snapshot.teamSeasons[0].registration_country_id = "country-NPL";
    snapshot.counts = { teams: 1, riders: 8, contracts: 8, ratings: 8 };
    const result = await buildPcmDatabase(snapshot);
    expect(result.metadata.countryFallbacks).toEqual([]);
    expect(result.metadata.countryAdditions.map(c => c.sourceCode)).toEqual(["GMB", "MDV", "MRT", "NPL", "PRK", "SLV"]);
    expect(result.metadata.nationalChampions).toEqual({ riders: 7, road: 7, timeTrial: 2, both: 2 });
    // Ensure the zip uses the newly generated Local CDB, not the static template.
    const files = unzipSync((await createPcmExportPackage(result)).archive);
    expect(files["OfficialLocal.cdb"]).toEqual(result.localCdb);
    const SQL = await initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) });
    const db = cdbToSql(files["OfficialRelease.cdb"], SQL, { preciseTypes: true });
    const local = cdbToSql(files["OfficialLocal.cdb"], SQL, { preciseTypes: true });
    try {
      for (const [i, [code, , name, , expectedCode, flag]] of cases.entries()) {
        const row = db.exec(`SELECT co.CONSTANT,co.gene_sz_flag,c.gene_i_champion_bit,c.charac_i_mountain,c.charac_i_hill
          FROM DYN_cyclist c JOIN STA_region r ON r.IDregion=c.fkIDregion JOIN STA_country co ON co.IDcountry=r.fkIDcountry WHERE c.IDcyclist=${10001+i}`)[0].values[0];
        expect(row).toEqual([expectedCode, flag, i < 2 ? 192 : i === 3 ? 0 : 128, 77, 75]);
        expect(readCount(db, `SELECT COUNT(*) FROM STA_country WHERE CONSTANT='${expectedCode}'`)).toBe(1);
        const addition = result.metadata.countryAdditions.find(c => c.sourceCode === code);
        if (addition) expect(local.exec(`SELECT gene_sz_french FROM LOC WHERE IDloc=${addition.localizationId}`)[0].values[0][0]).toBe(name);
      }
      expect(db.exec("SELECT co.CONSTANT FROM DYN_team t JOIN STA_country co ON co.IDcountry=t.fkIDcountry WHERE t.IDteam=244")[0].values[0][0]).toBe("NPL");
      expect(db.exec("SELECT co.CONSTANT FROM DYN_team_sponsor ts JOIN DYN_sponsor s ON s.IDsponsor=ts.fkIDsponsor JOIN STA_region r ON r.IDregion=s.fkIDregion JOIN STA_country co ON co.IDcountry=r.fkIDcountry WHERE ts.fkIDteam=244")[0].values[0][0]).toBe("NPL");
      expect(readCount(db, "SELECT COUNT(*) FROM DYN_cyclist WHERE IDcyclist BETWEEN 9001 AND 9010 AND gene_i_champion_bit<>0")).toBe(0);
      expect(readCount(db, "SELECT COUNT(*) FROM STA_country WHERE CONSTANT='SAU' AND gene_sz_flag='Saudi-Arabia'")).toBe(1);
      expect(readCount(db, "SELECT COUNT(*) FROM DYN_cyclist c LEFT JOIN STA_region r ON r.IDregion=c.fkIDregion WHERE r.IDregion IS NULL")).toBe(0);
    } finally { db.close(); local.close(); }
  }, 20_000);

  it("conserve un titre CLM seul avec le bit PCM26 64", async () => {
    const snapshot = createSnapshot();
    snapshot.nationalChampionshipTitles = [{ rider_id: "rider-1", country_id: "country-fr", championship_type: "time_trial" }];
    const result = await buildPcmDatabase(snapshot);
    const SQL = await initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) });
    const db = cdbToSql(result.cdb, SQL, { preciseTypes: true });
    try { expect(readCount(db, "SELECT gene_i_champion_bit FROM DYN_cyclist WHERE IDcyclist=10001")).toBe(64); }
    finally { db.close(); }
  });

  it("refuse un pays incomplet au lieu de rendre son coureur français", async () => {
    const snapshot = createSnapshot();
    snapshot.countries.push({ id: "country-sv", iso_alpha3: "SLV", name: "Salvador", continent_code: "america" });
    snapshot.riders[0].country_id = "country-sv";
    await expect(buildPcmDatabase(snapshot)).rejects.toThrow("Code ISO alpha-2 absent");
  });

  it("refuse un titre national d'un pays différent de celui du coureur", async () => {
    const snapshot = createSnapshot();
    snapshot.nationalChampionshipTitles = [{ rider_id: "rider-1", country_id: "country-sv", championship_type: "road" }];
    await expect(buildPcmDatabase(snapshot)).rejects.toThrow("Titre national incohérent");
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
