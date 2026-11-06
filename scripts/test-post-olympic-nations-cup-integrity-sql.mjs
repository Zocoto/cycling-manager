// Entirely local PostgreSQL regression fixtures. No network or live data.
import {pathToFileURL} from 'node:url';
if(!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('An existing local PGlite module is required.');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
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

  let checks=0;
  const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
  // The narrow legacy fixture uses a stub integrity payload. Restore the
  // canonical service-only ACLs from the rollover foundation/hardening DDL.
  await db.exec("revoke all on function public.get_season_rollover_integrity(uuid,uuid),public.get_season_rollover_health() from public,anon,authenticated;grant execute on function public.get_season_rollover_integrity(uuid,uuid),public.get_season_rollover_health() to service_role;");
  // Compose the exact source-selection patch already deployed on 12 October.
  // This preserves the real historical seeder and its real provisional guard.
  const oldSeed=(await db.query("select pg_get_functiondef('public.seed_nations_cup_assignments_for_season(uuid)'::regprocedure) body")).rows[0].body;
  const previous="where season.game_year = v_target.game_year - 1\n  limit 1;";
  const replacement="where season.game_year < v_target.game_year\n    and season.game_year%4<>0\n  order by season.game_year desc limit 1;";
  assert(read('20261012160000_global_olympic_quotas_and_callups').includes(replacement));
  assert.equal(oldSeed.split(previous).length-1,1);
  await db.exec(oldSeed.replace(previous,replacement));
  // Restore the deliberately corrupted S4 fixture, then model the authoritative
  // S5 allocations from the last real Nations Cup (S3), not the Olympic S4.
  await db.exec("update national_federation_nations_cup_assignments set movement='promoted',source_season_id='"+s3+"' where season_id='"+s4+"' and country_id='"+c1+"';");
  for(let n=0;n<172;n++)await db.query('insert into countries values($1,true)',[id(1000+n)]);
  await db.query("insert into national_federation_nations_cup_assignments select id,$1,3,'A',$2,3,'held',row_number() over(order by id) from countries",[s5,s3]);
  await db.exec("update seasons set status='completed' where id='"+s4+"'; update seasons set status='active' where id='"+s5+"';insert into season_rollover_settlements values('"+s4+"','"+s5+"');");
  check((await db.query('select get_season_rollover_integrity($1,$2) value',[s4,s5])).rows[0].value.invalidNationsCupAssignments,174,'Reproduces all 174 false failures after Olympic S4');
  check((await db.query('select get_season_rollover_health() value')).rows[0].value.provisionalDivisionCount,174,'Health reproduces the same false alarm');
  await assert.rejects(()=>db.query('select repair_nations_cup_opening_budgets($1)',[s5]),/still provisional/);checks++;
  const signatures=['public.get_season_rollover_integrity(uuid,uuid)','public.get_season_rollover_health()','public.repair_nations_cup_opening_budgets(uuid)'];
  const functions=async()=> (await db.query('select oid::text,oid::regprocedure::text signature,proacl::text acl,proowner::text owner,proconfig::text config,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[]) order by oid',[signatures])).rows;
  const beforeFunctions=await functions();
  const frozen=(await db.query('select * from national_federation_nations_cup_assignments order by season_id,country_id')).rows;
  const balances=(await db.query('select * from national_federation_accounts order by id')).rows;
  const ledger=(await db.query('select * from national_federation_transactions order by id')).rows;
  const receipts=(await db.query('select * from season_rollover_settlements order by source_season_id')).rows;
  const migration=read('20261106010000_fix_post_olympic_nations_cup_integrity');
  await db.exec(migration);
  const afterFunctions=await functions();
  for(const before of beforeFunctions){const after=afterFunctions.find(f=>f.oid===before.oid);check([after.oid,after.acl,after.owner,after.config],[before.oid,before.acl,before.owner,before.config],before.signature+': OID/ACL/owner/bounds preserved');}
  check((await db.query('select * from national_federation_nations_cup_assignments order by season_id,country_id')).rows,frozen,'Migration never rewrites allocations or divisions');
  check((await db.query('select * from national_federation_accounts order by id')).rows,balances,'Migration never reprices account balances or objective bonuses');
  check((await db.query('select * from national_federation_transactions order by id')).rows,ledger,'Migration never rewrites the finance journal');
  check((await db.query('select * from season_rollover_settlements order by source_season_id')).rows,receipts,'Migration never mints a rollover receipt');
  check((await db.query('select get_season_rollover_integrity($1,$2) value',[s4,s5])).rows[0].value,{invalidNationsCupAssignments:0,otherChecks:0},'S4 to S5 accepts correct S3 Cup source and preserves other integrity checks');
  check((await db.query('select get_season_rollover_health() value')).rows[0].value.healthy,true,'Correct post-Olympic allocations are healthy');
  check((await db.query('select repair_nations_cup_opening_budgets($1) value',[s5])).rows[0].value,0,'Existing repair helper accepts the same source; no accounts means no grants');
  await db.query('update national_federation_nations_cup_assignments set source_season_id=$1 where season_id=$2 and country_id=$3',[s4,s5,c1]);
  check((await db.query('select get_season_rollover_integrity($1,$2) value',[s4,s5])).rows[0].value.invalidNationsCupAssignments,1,'S5 incorrectly sourced from Olympic S4 is still rejected');
  check((await db.query('select get_season_rollover_health() value')).rows[0].value.healthy,false,'Health rejects the wrong Olympic source');
  await db.query("update national_federation_nations_cup_assignments set source_season_id=null,movement='initial' where season_id=$1 and country_id=$2",[s5,c1]);
  check((await db.query('select get_season_rollover_integrity($1,$2) value',[s4,s5])).rows[0].value.invalidNationsCupAssignments,1,'Initial/null provisional allocations remain rejected');
  await db.query("update national_federation_nations_cup_assignments set source_season_id=$1,movement='held' where season_id=$2 and country_id=$3",[s3,s5,c1]);
  for(const [targetYear,expectedSource]of [[6,5],[7,6],[8,7],[9,7]]){
    if(!(await db.query('select 1 from seasons where game_year=$1',[targetYear])).rows.length)await db.query("insert into seasons values($1,$2,'planned',current_date+100)",[id(targetYear),targetYear]);
    await db.query("insert into national_federation_nations_cup_assignments select country_id,$1,division,group_code,$2,division,'held',source_overall_rank from national_federation_nations_cup_assignments where season_id=$3",[id(targetYear),id(expectedSource),s5]);
    check((await db.query('select get_season_rollover_integrity($1,$2) value',[id(targetYear-1),id(targetYear)])).rows[0].value.invalidNationsCupAssignments,0,'S'+targetYear+' retains the seeder source S'+expectedSource);
  }
  check((await db.query('select get_season_rollover_integrity($1,$2) value',[s3,s4])).rows[0].value.invalidNationsCupAssignments,0,'Pre-Olympic S3 to S4 source stays unchanged');
  const functionSnapshot=await functions();await db.exec(migration);
  check(await functions(),functionSnapshot,'A reviewed retry leaves patched functions unchanged');
  check((await db.query('select * from national_federation_accounts order by id')).rows,balances,'Retries and validation never credit money');
  check((await db.query("select has_function_privilege('authenticated','public.get_season_rollover_integrity(uuid,uuid)','execute') value")).rows[0].value,false,'Integrity remains service-only');
  console.log(JSON.stringify({checks,legacyRepairRegression:true,isolated:true,productionTouched:false}));

} finally { await db.close(); }
