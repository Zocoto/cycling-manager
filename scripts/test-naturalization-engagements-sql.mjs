// Isolated PostgreSQL/WASM only. Exercises the country triggers and callup reconciliation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2];
if (!isAbsolute(modulePath ?? "") || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an installed local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const oldCountry = id(91);
const newCountry = id(92);
const season = id(100);
const completedSeason = id(101);
const plannedSeason = id(102);
const pro = id(10);
const unaffectedPro = id(11);
const academy = id(20);
const currentProxy = id(21);
const historicalProxy = id(22);
const alreadyAlignedAcademy = id(30);
const alreadyAlignedProxy = id(31);
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
const roster = async rider => (await rows(
  "select status from public.race_rosters where rider_id = $1 order by race_registration_id", [rider]
)).map(row => row.status);
const changeCountry = (table, rider, country) => db.query(
  `update public.${table} set country_id = $1 where id = $2`, [country, rider]
);
const readMigration = filename => readFile(
  new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"
);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table public.seasons (id uuid primary key, status text not null, game_year int not null default 5);
    create table public.riders (id uuid primary key, country_id uuid not null, status text not null);
    create table public.youth_academy_riders (id uuid primary key, country_id uuid not null, status text not null);
    create table public.academy_competition_rider_links (
      academy_rider_id uuid not null, season_id uuid not null, rider_id uuid not null unique,
      primary key (academy_rider_id, season_id)
    );
    create table public.races (id uuid primary key, country_id uuid not null, competition_type text not null);
    create table public.race_editions (id uuid primary key, season_id uuid not null, race_id uuid not null, status text not null);
    create table public.stages (
      race_edition_id uuid not null, stage_number int not null, status text not null,
      departure_at timestamptz not null, id uuid not null default gen_random_uuid(),
      primary key (race_edition_id, stage_number)
    );
    create table public.official_stage_simulations (stage_id uuid primary key);
    create table public.official_stage_simulation_claims (stage_id uuid primary key);
    create table public.race_registrations (
      id uuid primary key, race_edition_id uuid not null, team_season_id uuid,
      entry_method text not null default 'automatic', status text not null default 'accepted', decided_at timestamptz
    );
    create table public.race_rosters (
      rider_id uuid not null, race_registration_id uuid not null, status text not null,
      primary key (rider_id, race_registration_id)
    );
    create table public.national_championship_rider_preferences (
      rider_id uuid not null, race_edition_id uuid not null, is_selected boolean not null
    );
    create table public.national_federation_selection_lists (
      id uuid primary key, country_id uuid not null, season_id uuid not null,
      slot_key text not null, status text not null, updated_at timestamptz not null default now()
    );
    create table public.national_federation_selection_members (
      id uuid primary key, selection_list_id uuid not null, professional_rider_id uuid,
      junior_rider_id uuid, response_status text not null, responded_at timestamptz
    );
    create table public.national_federation_selection_race_links (
      selection_list_id uuid primary key, race_edition_id uuid not null, race_registration_id uuid not null
    );
    create table public.national_federation_junior_race_registrations (
      selection_list_id uuid primary key, race_edition_id uuid not null
    );
    create table public.national_federation_junior_race_registration_riders (
      selection_list_id uuid not null, academy_rider_id uuid not null
    );
    create table public.development_race_editions (
      id uuid primary key, season_id uuid not null, start_day_number int not null,
      status text not null, simulated_at timestamptz
    );
    create table public.season_days (season_id uuid not null, day_number int not null, calendar_date date not null);
    create table public.international_championship_rider_selections (
      id uuid primary key, team_id uuid, nation_selection_id uuid not null, rider_id uuid not null,
      response_status text not null, is_selected boolean not null, responded_at timestamptz
    );
    create table public.international_championship_nation_selections (
      id uuid primary key, race_edition_id uuid not null, country_id uuid not null
    );
    create table public.team_seasons (id uuid primary key, season_id uuid not null, team_id uuid not null);
    create function public.get_national_federation_selection_schedule(uuid,uuid)
    returns table(slot_key text,race_edition_id uuid,departure_at timestamptz) language sql as $$
      values ('future-draft', null::uuid, now() + interval '1 day')
    $$;
    -- Isolate the existing junior lineup trigger's roster cleanup contract.
    create function private.fixture_callup_write() returns trigger language plpgsql as $$
    begin
      if current_setting('app.fixture_fail_callup', true) = 'true' then
        raise exception 'simulated callup reconciliation failure';
      end if;
      if new.response_status = 'ineligible' and new.junior_rider_id is not null then
        delete from public.national_federation_junior_race_registration_riders
        where selection_list_id = new.selection_list_id and academy_rider_id = new.junior_rider_id;
      end if;
      return new;
    end;
    $$;
    create trigger fixture_callup_write after update of response_status
      on public.national_federation_selection_members
      for each row execute function private.fixture_callup_write();
    insert into public.seasons values ('${season}','active'), ('${completedSeason}','completed'), ('${plannedSeason}','planned');
    insert into public.riders values
      ('${pro}','${oldCountry}','active'), ('${unaffectedPro}','${oldCountry}','free_agent'),
      ('${currentProxy}','${oldCountry}','academy'), ('${historicalProxy}','${oldCountry}','academy'),
      ('${alreadyAlignedProxy}','${newCountry}','academy');
    insert into public.youth_academy_riders values
      ('${academy}','${oldCountry}','recruited'), ('${alreadyAlignedAcademy}','${newCountry}','active');
    insert into public.academy_competition_rider_links values
      ('${academy}','${season}','${currentProxy}'), ('${academy}','${completedSeason}','${historicalProxy}'),
      ('${alreadyAlignedAcademy}','${season}','${alreadyAlignedProxy}');
    insert into public.races values
      ('${id(40)}','${oldCountry}','national_road'), ('${id(41)}','${oldCountry}','national_time_trial'),
      ('${id(42)}','${oldCountry}','open'), ('${id(43)}','${newCountry}','national_road');
    insert into public.race_editions values
      ('${id(50)}','${season}','${id(40)}','registration_open'),
      ('${id(51)}','${season}','${id(41)}','registration_closed'),
      ('${id(52)}','${season}','${id(42)}','planned'),
      ('${id(53)}','${season}','${id(40)}','registration_closed'),
      ('${id(54)}','${season}','${id(40)}','in_progress'),
      ('${id(55)}','${season}','${id(40)}','completed'),
      ('${id(56)}','${plannedSeason}','${id(40)}','planned'),
      ('${id(57)}','${completedSeason}','${id(41)}','completed'),
      ('${id(58)}','${season}','${id(43)}','registration_open'),
      ('${id(59)}','${season}','${id(40)}','registration_closed');
    insert into public.stages
    select id, 1,
      case when id = '${id(59)}' then 'in_progress' else 'planned' end,
      case when id = '${id(53)}' then now() - interval '1 second' else now() + interval '1 day' end
    from public.race_editions;
    insert into public.race_registrations select id, id from public.race_editions;
    insert into public.race_rosters
    select '${pro}', id, case when id = '${id(51)}' then 'selected' else 'confirmed' end
    from public.race_registrations where id <> '${id(58)}';
    insert into public.race_rosters values
      ('${unaffectedPro}','${id(50)}','confirmed'), ('${currentProxy}','${id(50)}','confirmed'),
      ('${historicalProxy}','${id(57)}','confirmed'), ('${alreadyAlignedProxy}','${id(50)}','selected');
    insert into public.national_championship_rider_preferences values ('${pro}','${id(58)}',false);

    insert into public.race_editions values
      ('${id(60)}','${season}','${id(42)}','registration_closed'),
      ('${id(61)}','${season}','${id(42)}','registration_closed'),
      ('${id(62)}','${season}','${id(42)}','registration_closed'),
      ('${id(63)}','${season}','${id(42)}','registration_closed');
    insert into public.stages select id, 1, 'planned', now() +
      case when id = '${id(63)}' then interval '6 minutes' else interval '1 day' end
    from public.race_editions where id in ('${id(60)}','${id(61)}','${id(62)}','${id(63)}');
    insert into public.official_stage_simulation_claims select id from public.stages where race_edition_id = '${id(62)}';
    insert into public.team_seasons values ('${id(80)}','${season}','${id(81)}');
    insert into public.race_registrations select id, id, case when id = '${id(61)}' then '${id(80)}'::uuid end
    from public.race_editions where id in ('${id(60)}','${id(61)}','${id(62)}','${id(63)}');
    insert into public.race_rosters values
      ('${pro}','${id(60)}','confirmed'), ('${id(12)}','${id(60)}','confirmed'),
      ('${pro}','${id(61)}','confirmed'), ('${pro}','${id(62)}','confirmed'), ('${pro}','${id(63)}','confirmed');
    insert into public.national_federation_selection_lists (id,country_id,season_id,slot_key,status) values
      ('${id(200)}','${oldCountry}','${season}','pro-future','pending_confirmation'),
      ('${id(201)}','${oldCountry}','${season}','pro-claimed','finalized'),
      ('${id(202)}','${newCountry}','${season}','pro-future','finalized'),
      ('${id(203)}','${oldCountry}','${season}','future-draft','draft'),
      ('${id(204)}','${oldCountry}','${season}','junior-future','finalized'),
      ('${id(205)}','${oldCountry}','${season}','pro-frozen','finalized');
    insert into public.national_federation_selection_members (id,selection_list_id,professional_rider_id,junior_rider_id,response_status) values
      ('${id(210)}','${id(200)}','${pro}',null,'confirmed'),
      ('${id(211)}','${id(200)}','${unaffectedPro}',null,'pending'),
      ('${id(212)}','${id(201)}','${pro}',null,'confirmed'),
      ('${id(213)}','${id(202)}','${pro}',null,'confirmed'),
      ('${id(214)}','${id(203)}','${pro}',null,'draft'),
      ('${id(215)}','${id(204)}',null,'${academy}','confirmed'),
      ('${id(216)}','${id(205)}','${pro}',null,'confirmed');
    insert into public.national_federation_selection_race_links values
      ('${id(200)}','${id(60)}','${id(60)}'), ('${id(201)}','${id(62)}','${id(62)}'),
      ('${id(205)}','${id(63)}','${id(63)}');
    insert into public.development_race_editions values ('${id(220)}','${season}',21,'planned',null);
    insert into public.season_days values ('${season}',21,current_date + 2);
    insert into public.national_federation_junior_race_registrations values ('${id(204)}','${id(220)}');
    insert into public.national_federation_junior_race_registration_riders values ('${id(204)}','${academy}');
    insert into public.international_championship_nation_selections values
      ('${id(230)}','${id(61)}','${oldCountry}'), ('${id(231)}','${id(62)}','${oldCountry}');
    insert into public.international_championship_rider_selections values
      ('${id(240)}','${id(81)}','${id(230)}','${pro}','confirmed',true,null),
      ('${id(241)}','${id(81)}','${id(231)}','${pro}','pending',true,null);
  `);

  // Synchronizer write fences are exercised by the dedicated CN SQL fixture.
  const cnMigration = await readMigration("20261109111000_reconcile_national_championship_rider_nationality.sql");
  const cnStart = cnMigration.indexOf("create or replace function private.reconcile_rider_cn_nationality(");
  const cnEnd = cnMigration.indexOf("$$;", cnStart);
  assert.ok(cnStart >= 0 && cnEnd > cnStart);
  await db.exec(cnMigration.slice(cnStart, cnEnd + 3));
  await db.exec(await readMigration("20261109112000_reconcile_international_callup_nationality.sql"));
  await db.exec(await readMigration("20261109113000_sync_competition_engagements_on_naturalization.sql"));
  assert.equal(await scalar(
    "select has_function_privilege('authenticated', 'private.reconcile_naturalized_competition_engagements(uuid,uuid,uuid,uuid,timestamptz)', 'execute')"
  ), false);

  await changeCountry("riders", pro, oldCountry);
  assert.equal(await scalar("select count(*)::int from public.national_federation_selection_members where response_status = 'ineligible'"), 0);
  await changeCountry("riders", pro, newCountry);
  assert.deepEqual(await roster(pro), [
    "withdrawn", "withdrawn", "confirmed", "confirmed", "confirmed", "confirmed", "confirmed", "confirmed", "confirmed",
    "withdrawn", "withdrawn", "confirmed", "confirmed",
  ]);
  assert.deepEqual(await roster(unaffectedPro), ["confirmed"]);
  assert.equal(await scalar("select is_selected from public.national_championship_rider_preferences"), false);
  assert.deepEqual((await rows("select response_status from public.national_federation_selection_members order by id")).map(row => row.response_status), [
    "ineligible", "pending", "confirmed", "confirmed", "ineligible", "confirmed", "confirmed",
  ]);
  assert.deepEqual((await rows("select status from public.race_registrations where id in ($1,$2) order by id", [id(60),id(61)])).map(row => row.status), ["accepted","withdrawn"]);
  assert.deepEqual(await rows("select response_status,is_selected from public.international_championship_rider_selections order by id"), [
    { response_status: "unavailable", is_selected: false }, { response_status: "pending", is_selected: true },
  ]);

  await changeCountry("youth_academy_riders", academy, newCountry);
  assert.equal(await scalar("select country_id from public.riders where id = $1", [currentProxy]), newCountry);
  assert.equal(await scalar("select country_id from public.riders where id = $1", [historicalProxy]), oldCountry);
  assert.deepEqual(await roster(currentProxy), ["withdrawn"]);
  assert.deepEqual(await roster(historicalProxy), ["confirmed"]);
  assert.equal(await scalar("select response_status from public.national_federation_selection_members where junior_rider_id = $1", [academy]), "ineligible");
  assert.equal(await scalar("select count(*)::int from public.national_federation_junior_race_registration_riders"), 0);

  await db.query(
    "select private.reconcile_naturalized_competition_engagements(null,$1,$2,$3,now())",
    [alreadyAlignedAcademy, oldCountry, newCountry],
  );
  assert.deepEqual(await roster(alreadyAlignedProxy), ["withdrawn"]);

  await db.exec("set app.fixture_fail_callup = 'true'");
  await assert.rejects(changeCountry("riders", unaffectedPro, newCountry), /simulated callup reconciliation failure/);
  assert.equal(await scalar("select country_id from public.riders where id = $1", [unaffectedPro]), oldCountry);
  assert.deepEqual(await roster(unaffectedPro), ["confirmed"]);
  assert.equal(await scalar("select response_status from public.national_federation_selection_members where professional_rider_id = $1", [unaffectedPro]), "pending");

  console.log(JSON.stringify({ professionalAndJuniorTriggers: true, federationAndLegacyCallupsReconciled: true, historicalAndLockedRacesPreserved: true, atomicRollback: true, productionAccess: false }));
} finally {
  await db.close();
}
