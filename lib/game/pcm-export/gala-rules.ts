import type { Database } from "sql.js";
import { SEASON_FINALE_GALA_RACE, SEASON_FINALE_GALA_PCM_MAX_TEAMS, SEASON_FINALE_GALA_MIN_RIDERS, SEASON_FINALE_GALA_MAX_RIDERS } from "@/lib/game/season-finale-gala";

/** Modifie le CDB exporté seulement, sans toucher au gabarit officiel ni aux autres courses. */
export function configurePcmSeasonFinaleGalaRules(db: Database) {
  const raceId = SEASON_FINALE_GALA_RACE.pcmSource.raceId;
  const values = [SEASON_FINALE_GALA_PCM_MAX_TEAMS, SEASON_FINALE_GALA_MIN_RIDERS, SEASON_FINALE_GALA_MAX_RIDERS, raceId];
  const existing = db.exec(`SELECT IDrace_rule FROM STA_race_rules WHERE fkIDrace = ${raceId}`);
  if (existing[0]?.values.length) {
    db.run("UPDATE STA_race_rules SET gene_i_max_team=?, gene_i_min_riders=?, gene_i_max_riders=? WHERE fkIDrace=?", values);
  } else {
    db.run("INSERT INTO STA_race_rules (IDrace_rule, gene_i_max_team, gene_i_min_riders, gene_i_max_riders, fkIDrace, regulation_TTT) SELECT COALESCE(MAX(IDrace_rule),0)+1, ?, ?, ?, ?, 0 FROM STA_race_rules", values);
  }
}
