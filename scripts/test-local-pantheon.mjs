import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const call = async (sql) => (await db.query(sql)).rows[0].data;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table seasons(id uuid primary key, name text, game_year integer, status text);
    create table race_categories(id uuid primary key, code text, prestige_rank integer);
    create table races(id uuid primary key, slug text, race_format text, is_grand_tour boolean, is_monument boolean);
    create table countries(id uuid primary key, iso_alpha2 text);
    create table riders(id uuid primary key, first_name text, last_name text, country_id uuid, status text);
    create table rider_history_archives(rider_id uuid primary key, first_name text, last_name text, country_code text);
    create table team_seasons(id uuid primary key, team_id uuid, display_name text);
    create table race_editions(id uuid primary key, race_id uuid, season_id uuid, race_category_id uuid, display_name text, status text);
    create table race_registrations(id uuid primary key, race_edition_id uuid, team_season_id uuid, historical_team_name text);
    create table race_rosters(id uuid primary key, race_registration_id uuid, rider_id uuid);
    create table stages(id uuid primary key, race_edition_id uuid, stage_number smallint, name text, stage_type text, status text, created_at timestamptz default now());
    create table stage_results(id uuid primary key, stage_id uuid, race_roster_id uuid, rank integer, status text, elapsed_time_ms integer, created_at timestamptz default now());
    create table race_results(id uuid primary key, race_edition_id uuid, race_roster_id uuid, final_rank integer, status text, created_at timestamptz default now());
    create table youth_academy_riders(id uuid primary key, promoted_rider_id uuid);
    create table development_race_editions(id uuid primary key, slug text, name text, season_id uuid, race_format text, status text);
    create table development_race_stages(id uuid primary key, name text);
    create table development_race_results(id uuid primary key, race_edition_id uuid, stage_id uuid, result_scope text, rank integer,
      academy_rider_id uuid, competitor_key text, rider_name text, country_code text, team_name text, created_at timestamptz default now());
    insert into seasons values ('${id(1)}','Saison 1',1,'completed'),('${id(2)}','Saison 2',2,'active');
    insert into race_categories values ('${id(3)}','elite',1),('${id(4)}','regional',5);
    insert into races values ('${id(5)}','grand-tour-test','stage_race',true,false),
      ('${id(6)}','classique-test','one_day',false,false),('${id(7)}','contre-la-montre-test','one_day',false,false);
    insert into countries values ('${id(8)}','FR');
    insert into riders values ('${id(9)}','Alice','Duval','${id(8)}','retired'),('${id(10)}','Paul','Roux','${id(8)}','active');
    insert into rider_history_archives values ('${id(9)}','Alice','Duval','FR');
    insert into team_seasons values ('${id(11)}','${id(12)}','Équipe 2');
    insert into race_editions values
      ('${id(13)}','${id(5)}','${id(1)}','${id(3)}','Le Grand Tour','completed'),
      ('${id(14)}','${id(6)}','${id(2)}','${id(4)}','La Classique','completed'),
      ('${id(15)}','${id(7)}','${id(2)}','${id(4)}','Le Chrono','completed');
    insert into race_registrations values ('${id(20)}','${id(13)}',null,'Ancienne équipe'),
      ('${id(21)}','${id(14)}','${id(11)}',null),('${id(22)}','${id(15)}','${id(11)}',null);
    insert into race_rosters values ('${id(30)}','${id(20)}','${id(9)}'),('${id(31)}','${id(21)}','${id(10)}'),
      ('${id(32)}','${id(22)}','${id(10)}');
    insert into stages(id,race_edition_id,stage_number,name,stage_type,status) values
      ('${id(40)}','${id(13)}',1,'Premier col','road','completed'),
      ('${id(41)}','${id(14)}',1,'Circuit','road','completed'),
      ('${id(42)}','${id(15)}',1,'Chrono','team_time_trial','completed');
    insert into stage_results(id,stage_id,race_roster_id,rank,status,elapsed_time_ms) values
      ('${id(50)}','${id(40)}','${id(30)}',1,'finished',100),
      ('${id(51)}','${id(41)}','${id(31)}',1,'finished',100),
      ('${id(52)}','${id(42)}','${id(32)}',1,'finished',100);
    insert into race_results(id,race_edition_id,race_roster_id,final_rank,status) values
      ('${id(60)}','${id(13)}','${id(30)}',1,'classified'),
      ('${id(61)}','${id(14)}','${id(31)}',1,'classified'),
      ('${id(62)}','${id(15)}','${id(32)}',1,'classified');
    insert into youth_academy_riders values ('${id(70)}','${id(9)}');
    insert into development_race_editions values ('${id(71)}','test-junior','La Classique juniors','${id(1)}','one_day','completed');
    insert into development_race_results(id,race_edition_id,result_scope,rank,academy_rider_id,competitor_key,rider_name,country_code,team_name)
    values ('${id(72)}','${id(71)}','general',1,'${id(70)}','academy:70','Alice Duval','FR','École');
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261120113000_create_pantheon.sql", import.meta.url), "utf8"));
  const winnerPage = await call("select get_pantheon_winners() as data");
  assert.equal(winnerPage.total, 5);
  assert.equal(winnerPage.seasons.length, 2);
  const tour = await call("select get_pantheon_winners(p_race_key => 'grand-tour-test') as data");
  assert.equal(tour.race_name, "Le Grand Tour");
  assert.deepEqual(tour.items.map(({kind, points}) => [kind,points]).sort(), [["general",14],["stage",6]]);
  assert(tour.items.every(({ retired, result_href, team_name }) => retired && !result_href && team_name === "Ancienne équipe"));
  const team = await call("select get_pantheon_winners(p_kind => 'team') as data");
  assert.equal(team.total, 1);
  assert.equal(team.items[0].rider_id, null);
  assert.equal(team.items[0].team_name, "Équipe 2");
  assert.equal(team.items[0].result_href, "/jeu/resultats/contre-la-montre-test/1");
  await db.exec("set role authenticated");
  const ranking = await call("select get_pantheon_ranking() as data");
  assert.equal(ranking.total, 2);
  assert.deepEqual(ranking.items.map(({ rider_name, wins, points }) => [rider_name,wins,points]), [["Alice Duval",3,22],["Paul Roux",1,4]]);
  assert.deepEqual(ranking.items[0].category_wins, { elite: 1, grand_tour_monument: 1, junior: 1 });
  const juniors = await call("select get_pantheon_ranking(p_category => 'junior', p_sort => 'points') as data");
  assert.equal(juniors.total, 1);
  assert.equal(juniors.items[0].points, 2);
  assert.equal(juniors.items[0].wins, 1);
  const search = await call("select get_pantheon_ranking(p_query => 'ROUX') as data");
  assert.equal(search.items[0].rank, 2);
  const noPage = await call("select get_pantheon_winners(p_page => 2) as data");
  assert.deepEqual(noPage.items, []);
  assert.equal(noPage.total, 5);
  await db.exec("reset role; set role anon");
  await assert.rejects(call("select get_pantheon_winners() as data"), /permission denied/);
  await db.exec(`
    reset role;
    insert into development_race_editions values
      ('${id(73)}','test-junior-2','Classique juniors 2','${id(2)}','one_day','completed'),
      ('${id(74)}','test-junior-3','Classique juniors 3','${id(2)}','one_day','completed');
    insert into development_race_results(id,race_edition_id,result_scope,rank,competitor_key,rider_name,country_code,team_name)
    values ('${id(75)}','${id(73)}','general',1,'virtual:1','Jeanne Petit','FR','École'),
      ('${id(76)}','${id(74)}','general',1,'virtual:1','Marie Roy','FR','École');
  `);
  const virtualRiders = await call("select get_pantheon_ranking(p_category => 'junior') as data");
  assert.equal(virtualRiders.total, 3);
  assert.equal(new Set(virtualRiders.items.map(({ rider_key }) => rider_key)).size, 3);
  assert(virtualRiders.items.every(({ wins }) => wins === 1));
  console.log("Palmarès, classements, droits et pagination validés sur PostgreSQL isolé.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
