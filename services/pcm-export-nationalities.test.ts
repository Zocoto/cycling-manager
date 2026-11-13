import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cdbToSql, sqlToCdb } from "cdb-converter";
import initSqlJs, { type Database } from "sql.js";
import { describe, expect, it, vi } from "vitest";

import type { CountryRow } from "@/lib/game/pcm-export/types";

vi.mock("server-only", () => ({}));

import { configurePcmNationalities } from "./pcm-export-nationalities";

const nativeTemplates = Promise.all([
  initSqlJs({ locateFile: file => resolve("node_modules/sql.js/dist", file) }),
  readFile(resolve("assets/pcm/OfficialRelease.template.cdb")),
  readFile(resolve("assets/pcm/OfficialLocal.template.cdb")),
]);

describe("nationalités exportées vers PCM26", () => {
  it("réutilise les identités natives et distingue un drapeau existant d’un drapeau absent", async () => {
    const snapshot = makeSnapshot([
      country("OMN", "OM", "Oman", "asia"),
      country("XKX", "XK", "Kosovo", "europe"),
      country("SAU", "SA", "Arabie saoudite", "asia"),
      country("NPL", "NP", "Népal", "asia"),
      country("KIR", "KI", "Kiribati", "oceania"),
    ]);
    const [SQL, releaseBytes, localBytes] = await nativeTemplates;
    const db = cdbToSql(releaseBytes, SQL, { preciseTypes: true });
    const local = cdbToSql(localBytes, SQL, { preciseTypes: true });
    try {
      const result = configurePcmNationalities(db, local, snapshot);
      expect(result.resolveCountry("OMN").pcmCode).toBe("OMA");
      expect(result.resolveCountry("XKX").pcmCode).toBe("KOS");
      expect(result.countryAdditions.map(addition => addition.pcmCode)).toEqual(["KIR", "NPL"]);
      expect(result.countryFlags).toEqual([
        { pcmCode: "FRA", flagName: "France", source: "native" },
        { pcmCode: "KIR", flagName: "KIR", source: "missing" },
        { pcmCode: "KOS", flagName: "Kosovo", source: "native" },
        { pcmCode: "NPL", flagName: "Nepal", source: "workshop" },
        { pcmCode: "OMA", flagName: "Oman", source: "native" },
        { pcmCode: "SAU", flagName: "Saudi-Arabia", source: "native" },
      ]);

      const encoded = cdbToSql(sqlToCdb(db), SQL, { preciseTypes: true });
      const encodedLocal = cdbToSql(sqlToCdb(local), SQL, { preciseTypes: true });
      try {
        expect(values(encoded, "SELECT CONSTANT FROM STA_country WHERE CONSTANT IN ('OMN', 'XKX')")).toEqual([]);
        for (const addition of result.countryAdditions) {
          const sql = `SELECT c.CONSTANT, c.gene_sz_flag, c.gene_strID_country_name, r.gene_strID_name
            FROM STA_country c JOIN STA_region r ON r.fkIDcountry = c.IDcountry
            WHERE c.IDcountry = ${addition.countryId} AND r.IDregion = ${addition.regionId}`;
          expect(values(encoded, sql)).toEqual([[
            addition.pcmCode, addition.flagName, addition.localizationId, addition.localizationId,
          ]]);
          expect(values(encodedLocal, `SELECT gene_sz_french FROM LOC WHERE IDloc = ${addition.localizationId}`))
            .toEqual([[addition.sourceName]]);
        }
      } finally {
        encoded.close();
        encodedLocal.close();
      }
    } finally {
      db.close();
      local.close();
    }
  }, 20_000);

  it("rattache le Suriname à l’Amérique du Sud et le Salvador à l’Amérique centrale de PCM", async () => {
    const [SQL, releaseBytes, localBytes] = await nativeTemplates;
    const db = cdbToSql(releaseBytes, SQL, { preciseTypes: true });
    const local = cdbToSql(localBytes, SQL, { preciseTypes: true });
    try {
      configurePcmNationalities(db, local, makeSnapshot([
        country("SUR", "SR", "Suriname", "america"),
        country("SLV", "SV", "Salvador", "america"),
      ]));
      expect(values(db, `SELECT c.CONSTANT, t.CONSTANT, r.gene_b_europa
        FROM STA_country c JOIN STA_territory t ON t.IDterritory = c.fkIDterritory
        JOIN STA_region r ON r.fkIDcountry = c.IDcountry
        WHERE c.CONSTANT IN ('SLV', 'SUR') ORDER BY c.CONSTANT`)).toEqual([
        ["SLV", "CENTRALAMERICA", 0],
        ["SUR", "SOUTHAMERICA", 0],
      ]);
    } finally {
      db.close();
      local.close();
    }
  });
});

function country(code: string, isoAlpha2: string, name: string, continent: string): CountryRow {
  return { id: code, iso_alpha3: code, iso_alpha2: isoAlpha2, name, continent_code: continent };
}

function makeSnapshot(countries: CountryRow[]) {
  return {
    teamSeasons: [],
    teams: [],
    countries,
    riders: countries.map((entry, index) => ({
      id: `rider-${index}`,
      pcm_export_id: index + 10001,
      first_name: "Coureur",
      last_name: entry.iso_alpha3,
      country_id: entry.id,
      height_cm: null,
      weight_kg: null,
      potential_steps: null,
    })),
  };
}

function values(db: Database, sql: string) {
  return db.exec(sql)[0]?.values ?? [];
}
