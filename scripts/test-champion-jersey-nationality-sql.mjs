// Isolated PostgreSQL/WASM regression tests. Never connects to Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an installed local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const migration = filename => readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const country = { armenia: id(1), japan: id(2), colombia: id(3), france: id(4), unknown: id(5) };
const rider = { moved: id(10), sameContinent: id(11), crossContinent: id(12), unrelated: id(13), proxy: id(14), unknown: id(15) };
const titleIds = new Map();
let sequence = 100;
async function title(key, riderId, countryId, type, relinquishedAt = null) {
  const titleId = id(sequence++);
  const editionId = id(sequence++);
  await db.query("insert into public.race_editions(id,season_id) values($1,$2)", [editionId, id(6)]);
  await db.query(`insert into public.rider_national_championship_titles
    (id,rider_id,country_id,season_id,race_edition_id,championship_type,won_at,relinquished_at)
    values($1,$2,$3,$4,$5,$6,'2026-11-20T12:00:00Z',$7)`,
  [titleId, riderId, countryId, id(6), editionId, type, relinquishedAt]);
  titleIds.set(key, titleId);
}
const active = key => scalar("select relinquished_at is null from public.rider_national_championship_titles where id=$1", [titleIds.get(key)]);
const changeCountry = (riderId, countryId) => db.query("update public.riders set country_id=$1 where id=$2", [countryId, riderId]);
const historicalTitles = () => rows(`select to_jsonb(title) - 'relinquished_at' as history
  from public.rider_national_championship_titles title order by id`);

try {
  await db.exec(`
    set timezone = 'UTC';
    create schema private;
    create role anon; create role authenticated; create role service_role;
    create table public.countries(id uuid primary key,continent_code text);
    create table public.riders(id uuid primary key,country_id uuid not null references public.countries(id),status text not null);
    create table public.seasons(id uuid primary key,game_year int not null);
    create table public.race_editions(id uuid primary key,season_id uuid not null references public.seasons(id));
    create table public.race_results(id uuid primary key,race_edition_id uuid,status text,final_rank int,updated_at timestamptz);
    insert into public.countries values
      ('${country.armenia}','asia'),('${country.japan}','asia'),('${country.colombia}','america'),('${country.france}','europe'),('${country.unknown}',null);
    insert into public.riders values
      ('${rider.moved}','${country.colombia}','active'),
      ('${rider.sameContinent}','${country.armenia}','active'),
      ('${rider.crossContinent}','${country.armenia}','active'),
      ('${rider.unrelated}','${country.france}','free_agent'),
      ('${rider.proxy}','${country.armenia}','academy'),
      ('${rider.unknown}','${country.armenia}','active');
    insert into public.seasons values('${id(6)}',5);
    insert into public.race_results values('${id(7)}',null,'classified',1,'2026-11-20T12:00:00Z');
  `);
  // Use the actual title table and its existing indexes, including the real
  // relinquished_at field. A synthetic is_active column masked the original bug.
  const original = (await migration("20260722160000_create_national_championships.sql")).replaceAll("\r\n", "\n");
  const start = original.indexOf("create table public.rider_national_championship_titles (");
  const end = original.indexOf("alter table public.rider_national_championship_titles", start);
  assert(start >= 0 && end > start, "Missing actual title schema");
  await db.exec(original.slice(start, end));
  const quadrennial = (await migration("20261022120000_quadrennial_champion_jerseys.sql")).replaceAll("\r\n", "\n");
  const allowedTypes = quadrennial.match(/alter table public\.rider_national_championship_titles\s+add constraint rider_national_titles_type_allowed[\s\S]*?;/)?.[0];
  assert(allowedTypes, "Missing actual current title constraint");
  await db.exec("alter table public.rider_national_championship_titles drop constraint rider_national_titles_type_allowed;");
  await db.exec(allowedTypes);
  await db.exec("drop index public.rider_national_titles_one_active_per_country_type_idx;");
  for (const source of [
    await migration("20260811223000_world_championship_national_teams_s2.sql"),
    await migration("20260811234500_continental_championship_national_teams_and_jerseys.sql"),
    quadrennial,
  ]) {
    for (const [indexSource] of source.matchAll(/create unique index(?: if not exists)?\s+[\s\S]*?;/g)) {
      if (indexSource.includes("on public.rider_national_championship_titles")) await db.exec(indexSource);
    }
  }

  // Existing Gocha-shaped data: a former national title is already inactive;
  // the two Asian jerseys survived an earlier move to Colombia.
  await title("oldNational", rider.moved, country.armenia, "road", "2026-10-16T00:00:00Z");
  await title("staleNational", rider.moved, country.armenia, "time_trial");
  await title("staleAsiaRoad", rider.moved, country.armenia, "continental_asia_road");
  await title("staleAsiaTT", rider.moved, country.armenia, "continental_asia_time_trial");
  await title("validAmerica", rider.moved, country.armenia, "continental_america_road");
  await title("world", rider.moved, country.armenia, "world_road");
  await title("games", rider.moved, country.armenia, "quadrennial_time_trial");

  const historyBefore = await historicalTitles();
  const resultsBefore = await rows("select * from public.race_results order by id");
  const countriesBefore = await rows("select * from public.riders order by id");
  const oldRelinquished = await scalar("select relinquished_at::text from public.rider_national_championship_titles where id=$1", [titleIds.get("oldNational")]);
  await db.exec(await migration("20261127120000_relinquish_ineligible_champion_jerseys_on_nationality_change.sql"));
  for (const key of ["staleNational", "staleAsiaRoad", "staleAsiaTT"]) eq(await active(key), false, `repairs ${key}`);
  for (const key of ["validAmerica", "world", "games"]) eq(await active(key), true, `preserves ${key}`);
  eq(await scalar("select relinquished_at::text from public.rider_national_championship_titles where id=$1", [titleIds.get("oldNational")]), oldRelinquished, "does not rewrite an already inactive national title");
  eq(await historicalTitles(), historyBefore, "repair preserves every title's country, edition, season, win time and identity");
  eq(await rows("select * from public.riders order by id"), countriesBefore, "repair changes no rider nationality");

  await title("sameNational", rider.sameContinent, country.armenia, "road");
  await title("sameContinental", rider.sameContinent, country.armenia, "continental_asia_road");
  await title("crossNational", rider.crossContinent, country.armenia, "time_trial");
  await title("crossContinental", rider.crossContinent, country.armenia, "continental_asia_time_trial");
  await title("crossWorld", rider.crossContinent, country.armenia, "world_time_trial");
  await title("crossGames", rider.crossContinent, country.armenia, "quadrennial_road");
  await title("unrelated", rider.unrelated, country.france, "road");
  const historyBeforeChanges = await historicalTitles();
  await changeCountry(rider.sameContinent, country.japan);
  eq(await active("sameNational"), false, "same-continent naturalization ends old national jersey");
  eq(await active("sameContinental"), true, "same-continent naturalization preserves continental jersey");
  await changeCountry(rider.crossContinent, country.colombia);
  eq(await active("crossNational"), false, "country change ends old TT national jersey");
  eq(await active("crossContinental"), false, "continent change ends old continental TT jersey");
  eq(await active("crossWorld"), true, "world TT survives country change");
  eq(await active("crossGames"), true, "quadrennial road survives country change");
  eq(await active("unrelated"), true, "unrelated riders are unchanged");
  eq(await historicalTitles(), historyBeforeChanges, "country triggers preserve historical award fields");
  await title("proxy", rider.proxy, country.armenia, "time_trial");
  await title("unknown", rider.unknown, country.armenia, "continental_asia_time_trial");
  await changeCountry(rider.proxy, country.colombia);
  eq(await active("proxy"), false, "direct changes to academy competition proxies use the same central trigger");
  await changeCountry(rider.unknown, country.unknown);
  eq(await active("unknown"), false, "a country without a continent cannot wear a continental jersey");
  const inactiveBefore = await rows("select id,relinquished_at from public.rider_national_championship_titles order by id");
  await changeCountry(rider.crossContinent, country.colombia);
  await changeCountry(rider.crossContinent, country.armenia);
  eq(await rows("select id,relinquished_at from public.rider_national_championship_titles order by id"), inactiveBefore, "same-country update and later return do not reactivate or retimestamp history");

  // A failed surrounding transaction must roll back both nationality and jersey.
  await db.exec("begin");
  await changeCountry(rider.sameContinent, country.colombia);
  eq(await active("sameContinental"), false, "jersey follows country within the same transaction");
  await db.exec("rollback");
  eq(await active("sameContinental"), true, "rollback retains prior continental jersey");
  eq(await scalar("select country_id from public.riders where id=$1", [rider.sameContinent]), country.japan, "rollback retains prior country");

  // Late settlement and old-edition replay retain a historical title while
  // refusing its active jersey. Global titles remain eligible.
  await title("lateNational", rider.moved, country.armenia, "road");
  await title("lateEligibleNational", rider.moved, country.colombia, "road");
  await title("lateAsia", rider.moved, country.armenia, "continental_asia_road");
  await title("lateAmerica", rider.moved, country.armenia, "continental_america_time_trial");
  // Match settlement's existing turnover of global holders before award.
  await db.query("update public.rider_national_championship_titles set relinquished_at=now() where id in ($1,$2)", [titleIds.get("crossWorld"), titleIds.get("crossGames")]);
  await title("lateWorld", rider.moved, country.armenia, "world_time_trial");
  await title("lateGames", rider.moved, country.armenia, "quadrennial_road");
  for (const key of ["lateNational", "lateAsia"]) eq(await active(key), false, `late ${key} is historical only`);
  for (const key of ["lateEligibleNational", "lateAmerica", "lateWorld", "lateGames"]) eq(await active(key), true, `late ${key} remains eligible`);
  await db.query("update public.rider_national_championship_titles set relinquished_at=null where id=$1", [titleIds.get("oldNational")]);
  eq(await active("oldNational"), false, "old settlement cannot reactivate an incompatible national jersey");
  const lateHistory = await scalar("select jsonb_build_object('country',country_id,'won',won_at,'type',championship_type) from public.rider_national_championship_titles where id=$1", [titleIds.get("lateAsia")]);
  eq(lateHistory, { country: country.armenia, won: "2026-11-20T12:00:00+00:00", type: "continental_asia_road" }, "late award keeps original country and win");
  eq(await rows("select * from public.race_results order by id"), resultsBefore, "no race result is rewritten");

  // All known continent and discipline codes use the same explicit eligibility.
  for (const continent of ["africa", "america", "asia", "europe", "oceania"]) {
    for (const discipline of ["road", "time_trial"]) {
      eq(await scalar("select private.championship_jersey_is_eligible($1,$2,$3,$4)", [`continental_${continent}_${discipline}`, country.armenia, country.colombia, continent]), true, `${continent} ${discipline} accepts its current continent`);
      eq(await scalar("select private.championship_jersey_is_eligible($1,$2,$3,$4)", [`continental_${continent}_${discipline}`, country.armenia, country.colombia, continent === "asia" ? "america" : "asia"]), false, `${continent} ${discipline} rejects another continent`);
    }
  }
  const triggerDefinition = await scalar("select pg_get_triggerdef(oid) from pg_trigger where tgname='relinquish_ineligible_champion_jerseys_on_country_change'");
  eq(triggerDefinition.includes("AFTER UPDATE OF country_id") && triggerDefinition.includes("WHEN"), true, "country trigger runs only on actual nationality changes");
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const signature of ["private.championship_jersey_is_eligible(text,uuid,uuid,text)", "private.guard_champion_jersey_eligibility()", "private.relinquish_ineligible_champion_jerseys_on_country_change()"]) {
      eq(await scalar("select has_function_privilege($1,$2,'execute')", [role, signature]), false, `${role} cannot call ${signature}`);
    }
  }
  console.log(JSON.stringify({ isolated: true, productionActions: false, assertions, historicalAwardsPreserved: true }));
} catch (error) {
  console.error(JSON.stringify({ message: error.message, query: error.query, where: error.where }));
  process.exitCode = 1;
} finally {
  await db.close();
}
