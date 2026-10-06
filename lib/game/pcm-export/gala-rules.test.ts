import { resolve } from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { configurePcmSeasonFinaleGalaRules } from "./gala-rules";

describe("règle PCM spécifique au gala", () => {
  it("ajoute une seule règle 6–8, reste idempotent et préserve les autres courses", async () => {
    const SQL = await initSqlJs({ locateFile: (file) => resolve("node_modules", "sql.js", "dist", file) });
    const db = new SQL.Database();
    try {
      db.run("CREATE TABLE STA_race_rules (IDrace_rule INTEGER PRIMARY KEY, fkIDrace INTEGER, gene_i_max_team INTEGER, gene_i_min_riders INTEGER, gene_i_max_riders INTEGER, regulation_TTT INTEGER)");
      db.run("INSERT INTO STA_race_rules VALUES (10, 20, 19, 7, 7, 2)");
      configurePcmSeasonFinaleGalaRules(db);
      configurePcmSeasonFinaleGalaRules(db);
      expect(db.exec("SELECT * FROM STA_race_rules ORDER BY IDrace_rule")[0].values).toEqual([[10, 20, 19, 7, 7, 2], [11, 15, 25, 6, 8, 0]]);
    } finally { db.close(); }
  });
});
