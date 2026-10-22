import type { Database } from "sql.js";
import {GALA_COURSES,SEASON_FOUR_GALA} from "@/lib/game/season-four-gala";
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

/** Explicit S4 export only: native team caps include the observer; rosters are 7–8. */
export function configurePcmSeasonFourGalaRules(db:Database){
 for(const course of Object.values(GALA_COURSES)){
  if(!db.exec('SELECT IDrace FROM STA_race WHERE IDrace='+course.raceId)[0]?.values.length)throw new Error('Parcours PCM du gala S4 absent du gabarit.');
  const values=[course.nativeCapacity,SEASON_FOUR_GALA.minRiders,SEASON_FOUR_GALA.maxRiders,course.raceId];
  if(db.exec('SELECT IDrace_rule FROM STA_race_rules WHERE fkIDrace='+course.raceId)[0]?.values.length)db.run('UPDATE STA_race_rules SET gene_i_max_team=?,gene_i_min_riders=?,gene_i_max_riders=? WHERE fkIDrace=?',values);
  else db.run('INSERT INTO STA_race_rules(IDrace_rule,gene_i_max_team,gene_i_min_riders,gene_i_max_riders,fkIDrace,regulation_TTT) SELECT coalesce(max(IDrace_rule),0)+1,?,?,?,?,0 FROM STA_race_rules',values);
 }
}
