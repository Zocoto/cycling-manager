// Installs exactly the reviewed feature migration. Never runs a draft or a fixture.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3 || !['--inspect','--apply-reviewed-fix'].includes(mode)
  || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw Error('Exact mode and linked production project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261022160000', name='create_recurring_season_draft';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
if(!sql.startsWith('begin;') || !sql.includes("set local lock_timeout = '1s'")
  || !sql.includes("set local statement_timeout = '8s'")
  || !sql.includes("set local application_name = 'cyclostratege-season-draft-20261022'") || !/commit;\s*$/.test(sql)) throw Error('Migration bounds changed.');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const query=statement=>{
  let args=['db','query','--linked',statement,'--output','json'];
  if(statement.length>12000){
    mkdirSync('artifacts/season-draft-20261022',{recursive:true});
    const payload=path.resolve('artifacts/season-draft-20261022/reviewed-install.sql');
    writeFileSync(payload,statement);
    args=['db','query','--linked','--file',payload,'--output','json'];
  }
  let raw;
  try {raw=execFileSync(binary,args,{encoding:'utf8',timeout:25000,maxBuffer:150000});}
  catch(error){throw Error(`Database command failed: ${error.code??error.status??'unknown'}; ${String(error.stderr??'').slice(0,1800)}`);}
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const bounded=body=>`begin read only; set local statement_timeout='4s';set local lock_timeout='500ms';
  set local application_name='season-draft-install-receipt-20261022';${body};commit;`;
function inspect(){
  return query(bounded(`select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
    (select game_year from public.seasons where status='active') current_year,
    (select bool_and(to_regprocedure(signature) is not null) from (values
      ('public.calculate_rider_season_salary_quotes(uuid[],uuid)'),('public.get_projected_transfer_budget(uuid)'),
      ('public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'),
      ('public.can_team_reserve_roster_rider(uuid,integer,uuid,boolean)'),('public.get_team_roster_commitment_count(uuid,integer)'),
      ('public.get_team_non_homegrown_roster_commitment_count(uuid,integer)'),('public.get_team_roster_limit(uuid)'),
      ('public.get_team_roster_base_limit(uuid)'),('public.is_team_homegrown_rider(uuid,uuid)'),
      ('public.get_team_specialization_power(uuid,text,text)')) dependencies(signature)) dependencies_ok,
    (select jsonb_object_agg(signature,hash) from (select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash
      from pg_proc where oid in(to_regprocedure('public.rollover_game_season(uuid,boolean)'),
        to_regprocedure('public.sign_current_team_free_agent(uuid)'),to_regprocedure('public.settle_transfer_market()'),
        to_regprocedure('public.calculate_rider_season_salary_quotes(uuid[],uuid)'))) untouched) untouched_hashes`))[0];
}
const before=inspect();
if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
if(!before.dependencies_ok || before.database_ok!==1) throw Error('Preflight failed; no application deployment.');
if(before.recorded && before.recorded_hash!==createHash('md5').update(sql).digest('hex')) throw Error('Recorded migration differs from source; do not replay.');
if(!before.recorded) query(sql.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements)
  values(${quote(version)},${quote(name)},array[${quote(sql)}]);\ncommit;`));
const after=inspect();
const feature=query(bounded(`select
  (select first_game_year from public.season_draft_settings where singleton) first_game_year,
  (select enabled from public.season_draft_settings where singleton) enabled,
  (select count(*)::integer from public.season_draft_editions) edition_count,
  (select count(*)::integer from pg_trigger where tgname in('aa_season_draft_contract_reservation',
    'ab_season_draft_contract_resale','aa_season_draft_listing_reservation','ab_season_draft_listing_resale')) guards,
  (select count(*)::integer from pg_class where oid in('public.season_draft_settings'::regclass,'public.season_draft_editions'::regclass,
    'public.season_draft_participants'::regclass,'public.season_draft_riders'::regclass) and relrowsecurity) rls_tables,
  (select count(*)::integer from cron.job where jobname='season-opening-draft' and active and schedule='* * * * *'
    and command='select public.process_season_draft();') scheduled_jobs,
  has_function_privilege('authenticated','public.get_season_draft_view(boolean)','execute') reader_allowed,
  not has_function_privilege('anon','public.get_season_draft_view(boolean)','execute') anonymous_denied,
  not has_function_privilege('authenticated','public.process_season_draft()','execute') worker_private,
  not has_table_privilege('authenticated','public.season_draft_participants','select') preferences_private`))[0];
if(!after.recorded || after.recorded_hash!==createHash('md5').update(sql).digest('hex')
  || JSON.stringify(before.untouched_hashes)!==JSON.stringify(after.untouched_hashes)
  || feature.guards!==4 || feature.rls_tables!==4 || feature.scheduled_jobs!==1
  || !feature.reader_allowed || !feature.anonymous_denied || !feature.worker_private || !feature.preferences_private
  || feature.first_game_year!==before.current_year+1 || !feature.enabled || feature.edition_count!==0) throw Error('Unexpected receipt; stop before app deployment.');
const receipt={migration:version,sha256:createHash('sha256').update(sql).digest('hex'),...after,...feature};
mkdirSync('artifacts/season-draft-20261022',{recursive:true});
writeFileSync('artifacts/season-draft-20261022/deployment-receipt.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
