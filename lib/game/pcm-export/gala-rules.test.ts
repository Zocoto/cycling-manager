import { resolve } from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { configurePcmSeasonFinaleGalaRules,configurePcmSeasonFourGalaRules } from "./gala-rules";

describe("règle PCM spécifique au gala", () => {
  it('prepares all four S4 source races for 7–8 riders and native capacity, without changing classes or the previous gala',async()=>{
    const SQL=await initSqlJs({locateFile:file=>resolve('node_modules','sql.js','dist',file)});const db=new SQL.Database();
    try{
      db.run('CREATE TABLE STA_race(IDrace integer);INSERT INTO STA_race VALUES(4),(25),(145),(173);CREATE TABLE STA_race_rules(IDrace_rule integer primary key,fkIDrace integer,gene_i_max_team integer,gene_i_min_riders integer,gene_i_max_riders integer,regulation_TTT integer);INSERT INTO STA_race_rules VALUES(1,25,23,8,8,0),(2,15,25,6,8,0),(3,999,18,6,6,0);');
      configurePcmSeasonFourGalaRules(db);configurePcmSeasonFourGalaRules(db);
      expect(db.exec('SELECT fkIDrace,gene_i_max_team,gene_i_min_riders,gene_i_max_riders FROM STA_race_rules ORDER BY fkIDrace')[0].values).toEqual([[4,25,7,8],[15,25,6,8],[25,23,7,8],[145,20,7,8],[173,25,7,8],[999,18,6,6]]);
    }finally{db.close();}
  });
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
