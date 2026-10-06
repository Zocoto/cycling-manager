// Isolated PostgreSQL in memory only. No network or production Supabase access.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  await db.exec(`
    set timezone='UTC';
    create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create function auth.role() returns text language sql as $$ select coalesce(nullif(current_setting('test.role',true),''),'authenticated') $$;
    create table seasons(id uuid primary key,game_year int,status text);
    create table teams(id uuid primary key,status text);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table countries(id uuid primary key,iso_alpha2 text);
    create table team_seasons(team_id uuid,season_id uuid,display_name text,short_name text,registration_country_id uuid,status text);
    create table riders(id uuid primary key,status text,first_name text,last_name text,country_id uuid);
    create table rider_contracts(rider_id uuid,team_id uuid,status text,start_season_id uuid,end_season_id uuid);
    create table rider_season_ratings(rider_id uuid,season_id uuid);
    create table sponsors(id uuid primary key,name text,short_name text,country_id uuid,catalog_key text);
    create table team_sponsor_contracts(team_id uuid,sponsor_id uuid,role text,status text,start_season_id uuid,
      contract_duration_seasons int,selected_jersey_id text,selected_jersey_style text,pending_jersey_season_id uuid,
      pending_jersey_id text,pending_jersey_style text,created_at timestamptz default now());
    create table secondary_sponsor_catalog(id uuid primary key,name text);
    create table secondary_sponsor_contracts(team_id uuid,season_id uuid,secondary_sponsor_id uuid,status text);
    create table official_sports_guard(form int,morale int,cash int,points int);
    insert into official_sports_guard values(77,88,1234,42);
    insert into seasons values(md5('s2')::uuid,2,'completed'),(md5('s3')::uuid,3,'active'),(md5('s4')::uuid,4,'planned');
    insert into countries values(md5('fr')::uuid,'fr'),(md5('it')::uuid,'it');
    insert into teams select md5('team-'||i)::uuid,'active' from generate_series(1,5)i;
    insert into sporting_directors select md5('ds-'||i)::uuid,md5('user-'||i)::uuid,'active' from generate_series(1,5)i;
    insert into team_manager_assignments select md5('ds-'||i)::uuid,md5('team-'||i)::uuid,'general_manager','active' from generate_series(1,5)i;
    insert into team_seasons select md5('team-'||i)::uuid,md5('s3')::uuid,'Actuelle '||i,'ACT',md5('fr')::uuid,'active' from generate_series(1,5)i;
    insert into riders select md5('rider-'||i||'-'||j)::uuid,'active','Coureur',i||'-'||j,md5('fr')::uuid from generate_series(1,5)i cross join generate_series(1,8)j;
    insert into rider_contracts select md5('rider-'||i||'-'||j)::uuid,md5('team-'||i)::uuid,'active',md5('s3')::uuid,md5('s3')::uuid from generate_series(1,5)i cross join generate_series(1,8)j;
    insert into rider_season_ratings select id,md5('s3')::uuid from riders;
    insert into sponsors values(md5('old')::uuid,'Ancien','OLD',md5('fr')::uuid,'old'),
      (md5('new')::uuid,'Nouveau','NEW',md5('it')::uuid,'new'),(md5('continuing')::uuid,'Reconduit','REC',md5('fr')::uuid,'continuing');
    insert into team_sponsor_contracts(team_id,sponsor_id,role,status,start_season_id,contract_duration_seasons,selected_jersey_id,selected_jersey_style)
      select md5('team-'||i)::uuid,md5('old')::uuid,'principal','active',md5('s3')::uuid,1,'old-jersey','classic' from unnest(array[1,4,5])i;
    insert into team_sponsor_contracts(team_id,sponsor_id,role,status,start_season_id,contract_duration_seasons,selected_jersey_id,selected_jersey_style)
      values(md5('team-1')::uuid,md5('new')::uuid,'principal','planned',md5('s4')::uuid,2,'new-jersey','modern'),
      (md5('team-5')::uuid,md5('new')::uuid,'principal','terminated',md5('s4')::uuid,2,'new-jersey','modern');
    insert into team_sponsor_contracts(team_id,sponsor_id,role,status,start_season_id,contract_duration_seasons,selected_jersey_id,selected_jersey_style,pending_jersey_season_id,pending_jersey_id,pending_jersey_style)
      values(md5('team-2')::uuid,md5('continuing')::uuid,'principal','active',md5('s2')::uuid,3,'old','classic',md5('s4')::uuid,'future-jersey','bold');
    insert into secondary_sponsor_catalog values(md5('secondary')::uuid,'Secondaire');
    insert into secondary_sponsor_contracts values(md5('team-1')::uuid,md5('s4')::uuid,md5('secondary')::uuid,'planned');
  `);
  for (const filename of ["20261002173000_create_pcm_gala_registrations.sql", "20261006100000_allow_season_finale_gala_six_to_eight_riders.sql"])
    await db.exec(await readFile(`supabase/migrations/${filename}`, "utf8"));
  const migration = await readFile("supabase/migrations/20261006123000_set_gala_deadline_and_next_season_identities.sql", "utf8");
  await db.exec(migration); await db.exec(migration);
  assert.equal((await db.query("select registration_closes_at::text as deadline from pcm_gala_events where event_key='gala-des-puncheurs'")).rows[0].deadline, "2026-10-08 10:00:00+00");
  await db.exec("update pcm_gala_events set registration_closes_at=clock_timestamp()+interval '1 day' where event_key='gala-des-puncheurs'");
  const user = (i) => db.exec(`select set_config('test.user_id',md5('user-${i}')::uuid::text,false)`);
  const identity = async (i) => (await db.query(`select * from private.season_finale_gala_team_identity(md5('team-${i}')::uuid)`)).rows[0];
  const save = (i, key = "gala-des-puncheurs", count = 6) => db.query(`select save_current_team_pcm_gala_registration('${key}',array(select md5('rider-${i}-'||j)::uuid from generate_series(1,${count})j))`);
  assert.equal((await identity(1)).team_name, "Nouveau - Secondaire");
  assert.equal((await identity(1)).team_country_code, "it");
  assert.equal((await identity(1)).identity_season, 4);
  assert.equal((await identity(2)).jersey_id, "future-jersey");
  assert.equal((await identity(2)).team_name, "Reconduit");
  assert.equal((await identity(3)).team_name, "Actuelle 3");
  assert.equal((await identity(3)).identity_ready, true);
  assert.equal((await identity(4)).identity_ready, false);
  assert.equal((await identity(5)).identity_ready, false);
  for (let i = 1; i <= 3; i++) { await user(i); await save(i); }
  await user(4); await assert.rejects(() => save(4), /identite/);
  await user(1);
  assert.equal((await db.query("select * from get_pcm_gala_team_identities()")).rows.length, 1);
  assert.equal((await db.query("select team_name from get_pcm_gala_public_startlists() where team_id=md5('team-1')::uuid limit 1")).rows[0].team_name, "Nouveau - Secondaire");
  const frozen = (await db.query("select * from pcm_gala_registrations order by id")).rows;
  await db.exec("update pcm_gala_events set registration_closes_at=clock_timestamp() where event_key='gala-des-puncheurs'");
  assert.equal((await db.query("select event_status from get_current_team_season_finale_gala_context() where event_key='gala-des-puncheurs'")).rows[0].event_status, "closed");
  await assert.rejects(() => save(1), /fermees/);
  await assert.rejects(() => save(1, "gala-des-sommets", 7), /fermees/);
  await assert.rejects(() => db.query("select withdraw_current_team_pcm_gala_registration()"), /fermees/);
  await user(5); await assert.rejects(() => save(5), /fermees/);
  assert.deepEqual((await db.query("select * from pcm_gala_registrations order by id")).rows, frozen);
  await db.exec("update seasons set status='completed' where game_year=3; update seasons set status='active' where game_year=4; update team_seasons set status='completed'; update team_sponsor_contracts set status='completed' where sponsor_id=md5('old')::uuid;");
  await user(1);
  assert.equal((await db.query("select game_year from get_season_finale_gala_export_context()")).rows[0].game_year, 3);
  assert.equal((await db.query("select count(*)::int as n from get_pcm_gala_public_startlists() where event_key='gala-des-puncheurs'")).rows[0].n, 18);
  assert.equal((await identity(4)).identity_ready, false);
  assert.equal((await identity(1)).team_name, "Nouveau - Secondaire");
  assert.equal((await db.query("select display_name from team_seasons where team_id=md5('team-1')::uuid")).rows[0].display_name, "Actuelle 1");
  assert.deepEqual((await db.query("select * from official_sports_guard")).rows, [{ form:77,morale:88,cash:1234,points:42 }]);
  assert.equal((await db.query("select has_function_privilege('anon','get_pcm_gala_team_identities(uuid[])','execute') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('authenticated','get_season_finale_gala_export_context()','execute') as allowed")).rows[0].allowed, false);
  console.log("SQL isolé OK : deadline Paris, inscriptions/modifications/retraits bloqués, identités S4 principal+secondaire/reconduction/amateur, refus non confirmé/terminé, conservation après rollover, droits et aucune mutation du jeu.");
} finally { await db.close(); }
