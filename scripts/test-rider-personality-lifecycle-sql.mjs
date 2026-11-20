// Isolated PostgreSQL only: migration volume, identity continuity and bounded social settlement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = name => readFileSync(`supabase/migrations/${name}.sql`, "utf8");
const definition = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("$$;", start) + 3);
};
const one = async sql => (await db.query(sql)).rows[0];
const uuid = n => `('00000000-0000-4000-8000-' || lpad((${n})::text,12,'0'))::uuid`;

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table seasons(id uuid primary key,status text,current_day_number int);
    create table season_days(id uuid primary key,season_id uuid,day_number int);
    create table countries(id uuid primary key,iso_alpha2 text);
    create table riders(id uuid primary key,country_id uuid);
    create table youth_scouting_candidates(id uuid primary key);
    create table youth_academy_riders(id uuid primary key,candidate_id uuid,team_id uuid,
      promoted_rider_id uuid,status text,signed_at timestamptz default now(),country_id uuid,
      morale numeric default 60,updated_at timestamptz default now());
    create table rider_contracts(rider_id uuid,team_id uuid,status text);
    create index on rider_contracts(rider_id,status); create index on rider_contracts(team_id,status);
    create index on youth_academy_riders(team_id,status);
    create table rider_condition_states(id uuid primary key default gen_random_uuid(),rider_id uuid,
      season_day_id uuid,morale numeric,form int,fatigue int,source text,updated_at timestamptz default now(),unique(rider_id,season_day_id));
    create table rider_morale_events(id uuid primary key default gen_random_uuid(),rider_id uuid,season_day_id uuid,
      source_type text,source_reference text,requested_delta numeric,applied_delta numeric,morale_before numeric,
      morale_after numeric,description text,metadata jsonb,unique(rider_id,source_type,source_reference));
    create table youth_rider_morale_events(id uuid primary key default gen_random_uuid(),academy_rider_id uuid,season_day_id uuid,
      source_type text,source_reference text,requested_delta numeric,applied_delta numeric,morale_before numeric,
      morale_after numeric,description text,metadata jsonb,unique(academy_rider_id,source_type,source_reference));
    create table rider_special_abilities(rider_id uuid,ability_code text,source_type text,source_reference text,unique(rider_id,ability_code));
    insert into countries values (${uuid(1)},'FR'),(${uuid(2)},'GB'),(${uuid(3)},'US');
    insert into seasons values (${uuid(10)},'active',15);
    insert into season_days values (${uuid(11)},${uuid(10)},15);
    insert into riders select ${uuid('10000+n')},${uuid('1+n%3')} from generate_series(1,3168) n;
    insert into youth_scouting_candidates select ${uuid('20000+n')} from generate_series(1,2925) n;
    insert into youth_academy_riders(id,candidate_id,team_id,promoted_rider_id,status,country_id)
      select ${uuid('30000+n')},${uuid('20000+n')},${uuid('50000+n%40')},
        case when n<=500 then ${uuid('10000+n')} end,
        case when n<=500 then 'promoted' else 'active' end,${uuid('1+n%3')}
      from generate_series(1,1395) n;
    insert into rider_contracts select id,${uuid('50000+(right(id::text,12)::bigint-10000)%40')},'active' from riders;
  `);
  await db.exec(definition(read("20260727101000_add_homegrown_special_ability"), "grant_homegrown_ability_from_academy"));
  await db.exec(`create trigger grant_homegrown_ability_from_academy_after_write after insert or update on youth_academy_riders
    for each row execute function public.grant_homegrown_ability_from_academy();`);
  const moraleSource = read("20260927233500_reapply_persistent_rider_morale");
  for (const name of ["apply_rider_morale_event", "apply_youth_rider_morale_event"]) {
    await db.exec(definition(moraleSource, name));
  }

  const started = performance.now();
  await db.exec(read("20261117090000_add_rider_personalities"));
  const migrationMs = Math.round(performance.now() - started);
  assert.equal((await one("select count(*)::int n from youth_academy_riders a join youth_scouting_candidates c on c.id=a.candidate_id where a.personality_key<>c.personality_key")).n, 0);
  assert.equal((await one("select count(*)::int n from youth_academy_riders a join riders r on r.id=a.promoted_rider_id where a.personality_key<>r.personality_key")).n, 0);
  assert.equal((await one("select count(*)::int n from rider_special_abilities")).n, 0, "Personality backfill does not grant homegrown bonuses");
  assert.equal((await one("select count(*)::int n from rider_morale_events")).n, 0, "Migration does not retrospectively modify morale");
  await db.exec(`
    insert into riders(id,country_id) values(${uuid(99999)},${uuid(1)});
    insert into youth_scouting_candidates(id) values(${uuid(99998)});
    insert into youth_academy_riders(id,candidate_id,team_id,status,country_id)
      values(${uuid(99997)},${uuid(99998)},${uuid(50000)},'active',${uuid(1)});
    update youth_academy_riders set promoted_rider_id=${uuid(99999)} where id=${uuid(99997)};
  `);
  assert.equal((await one(`select a.personality_key=r.personality_key and a.personality_key=c.personality_key preserved
    from youth_academy_riders a join riders r on r.id=a.promoted_rider_id join youth_scouting_candidates c on c.id=a.candidate_id
    where a.id=${uuid(99997)}`)).preserved, true, "New identity survives recruitment and promotion");

  await db.exec(read("20261117092000_apply_sociable_integration"));
  await db.exec(`update riders set personality_key='sociable' where id in(select id from riders order by id limit 280);`);
  const first = Number((await one("select public.settle_due_sociable_morale() n")).n);
  const second = Number((await one("select public.settle_due_sociable_morale() n")).n);
  assert.equal(first, 250, "Maintenance limits the first catch-up batch");
  assert.ok(second > 0 && second <= 250);
  assert.equal(Number((await one("select public.settle_due_sociable_morale() n")).n), 0, "Completed integrations are never replayed");
  assert.equal((await one("select count(*)::int n from rider_morale_events where requested_delta<>1 or applied_delta<>1")).n, 0);
  console.log(`Personality lifecycle verified on 7,488 existing identities (${migrationMs} ms isolated backfill): inherited identities, safe academy trigger, no historic morale mutation, 250-event batches and replay safety.`);
} finally {
  await db.close();
}
