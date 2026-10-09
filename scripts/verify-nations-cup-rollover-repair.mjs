// Entirely local PostgreSQL regression fixtures. No network or live data.
import { PGlite } from '../.tmp/season-rollover-tests/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = name => readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r','');
const def = (sql,name) => {
  const start=sql.indexOf(`create or replace function public.${name}(`);
  assert(start>=0,name); return sql.slice(start,sql.indexOf('$$;',start)+3);
};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const s3=id(3),s4=id(4),s5=id(5),c1=id(11),c2=id(12),a1=id(21),a2=id(22);
const db=new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema cron; create table cron.job(jobname text,active boolean,schedule text,command text);
    insert into cron.job values('daily-season-rollover',true,'*/10 * * * *','select public.settle_due_season_rollovers();');
    create table seasons(id uuid primary key,game_year int,status text,ends_on date);
    insert into seasons values('${s3}',3,'completed',current_date-1),('${s4}',4,'active',current_date+27),('${s5}',5,'planned',current_date+55);
    create table season_rollover_settlements(source_season_id uuid,target_season_id uuid);
    insert into season_rollover_settlements values('${s3}','${s4}');
    create table countries(id uuid primary key,is_active boolean);
    insert into countries values('${c1}',true),('${c2}',true);
    create table races(id uuid primary key,competition_type text,status text);
    create table race_editions(id uuid primary key default gen_random_uuid(),race_id uuid,season_id uuid,status text);
    insert into races select gen_random_uuid(),'nations_cup','active' from generate_series(1,5);
    insert into race_editions(race_id,season_id,status) select id,'${s3}','completed' from races;
    create table national_federation_nations_cup_assignments(country_id uuid,season_id uuid,division int,group_code text,source_season_id uuid,
      source_division int,movement text,source_overall_rank int,primary key(country_id,season_id));
    insert into national_federation_nations_cup_assignments values('${c1}','${s4}',4,'A',null,null,'initial',1),('${c2}','${s4}',4,'B',null,null,'initial',2);
    create table national_federation_accounts(id uuid primary key,country_id uuid,season_id uuid,opening_balance numeric,balance numeric,
      source_game_year int,uci_rank int,nations_cup_division int,objective_completed_count int,objective_level text,objective_bonus numeric,updated_at timestamptz);
    create table national_federation_transactions(id uuid primary key default gen_random_uuid(),account_id uuid,day_number int,amount numeric,
      category text,description text,source_reference text unique,metadata jsonb);
    insert into national_federation_accounts values('${a1}','${c1}','${s4}',2705000,2655000,3,1,4,5,'gold',245000,now()),
      ('${a2}','${c2}','${s4}',2315000,2215000,3,4,4,1,'bronze',65000,now());
    insert into national_federation_transactions(account_id,day_number,amount,category,description,source_reference,metadata) values
      ('${a1}',1,2460000,'opening_grant','opening','opening1','{"commonGrant":1200000,"uciGrant":1000000,"nationsCupGrant":240000,"raceRevenue":20000}'),
      ('${a1}',1,245000,'objective_bonus','objectives','federation-account:${a1}:previous-objectives','{}'),
      ('${a2}',1,2250000,'opening_grant','opening','opening2','{"commonGrant":1200000,"uciGrant":850000,"nationsCupGrant":180000,"raceRevenue":20000}'),
      ('${a2}',1,65000,'objective_bonus','objectives','federation-account:${a2}:previous-objectives','{}');
    create function get_national_federation_nations_cup_movement_projection(uuid)
      returns table(country_id uuid,projected_division int,overall_rank int,uci_rank int,division int,movement_zone text)
      language sql as $$ select * from (values('${c1}'::uuid,1,1,1,2,'promotion'),('${c2}'::uuid,3,2,4,3,'safe')) p $$;
    create function get_national_federation_nations_cup_standings(uuid)
      returns table(country_id uuid,division int,group_code text,overall_rank int) language sql as $$ select '${c1}'::uuid,4,'A',1 $$;
    create function ensure_due_professional_nations_cup() returns integer language sql as $$ select 0 $$;
    create function get_season_rollover_integrity(p_source_season_id uuid,p_target_season_id uuid)
      returns jsonb language sql as $$ with target as(select * from seasons where id=p_target_season_id)
  select jsonb_build_object('otherChecks',0); $$;
  `);
  const old=read('20260913143000_wire_nations_cup_movements');
  await db.exec(def(old,'get_nations_cup_group_code_for_seed'));
  await db.exec(def(old,'seed_nations_cup_assignments_for_season'));
  await db.exec(def(read('20261005100000_reward_federation_sporting_rank_from_s4'),'get_national_federation_ranking_bonus'));
  await db.exec(`select seed_nations_cup_assignments_for_season('${s4}');`);
  assert.equal((await db.query('select division from national_federation_nations_cup_assignments order by country_id')).rows[0].division,4,'reproduce stale provisional fast path');
  await db.exec(read('20261009090000_finalize_nations_cup_rollover_and_budgets'));
  const assignments=(await db.query(`select * from national_federation_nations_cup_assignments where season_id='${s4}' order by country_id`)).rows;
  assert.equal(assignments[0].division,1); assert.equal(assignments[0].movement,'promoted');
  assert.equal(assignments[1].division,3); assert.equal(assignments[1].movement,'held');
  assert(assignments.every(x=>x.source_season_id===s3));
  const accounts=(await db.query('select * from national_federation_accounts order by id')).rows;
  assert.equal(accounts[0].opening_balance,'3430000'); assert.equal(accounts[0].balance,'3380000');
  assert.equal(accounts[0].objective_bonus,'310000');
  assert.equal(accounts[1].opening_balance,'2440000'); assert.equal(accounts[1].balance,'2340000');
  assert.equal(accounts[1].objective_bonus,'70000');
  const before=await db.query('select * from national_federation_transactions order by id');
  assert.equal((await db.query(`select repair_nations_cup_opening_budgets('${s4}') n`)).rows[0].n,0);
  assert.deepEqual((await db.query('select * from national_federation_transactions order by id')).rows,before.rows,'no duplicate credits or ledger changes on replay');
  assert.equal((await db.query(`select seed_nations_cup_assignments_for_season('${s5}') n`)).rows[0].n,0);
  assert.equal((await db.query(`select count(*) n from national_federation_nations_cup_assignments where season_id='${s5}'`)).rows[0].n,0,'no premature fallback for next season');
  assert.equal((await db.query('select get_season_rollover_health() h')).rows[0].h.healthy,true);
  assert.equal((await db.query(`select get_season_rollover_integrity('${s3}','${s4}') h`)).rows[0].h.invalidNationsCupAssignments,0);
  await db.exec(`update national_federation_nations_cup_assignments set movement='initial',source_season_id=null where country_id='${c1}';`);
  assert.equal((await db.query('select get_season_rollover_health() h')).rows[0].h.healthy,false);
  console.log('PASS: provisional fast-path bug reproduced; real projection/group seeding; grant and objective bonus correction; spending preserved; replay unchanged; S5 premature freezing blocked; health rejects provisional divisions');
} finally { await db.close(); }
