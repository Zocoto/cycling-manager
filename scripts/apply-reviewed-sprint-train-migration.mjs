// Installs only the reviewed additive migration. Never runs races or fixtures.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3 || !['--inspect','--apply-reviewed-fix'].includes(mode)
  || readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw Error('Exact mode and project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261022200000', name='add_optional_ordered_sprint_trains';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
if(createHash('sha256').update(sql).digest('hex')!=='932801709f374bea2c96d152e9bd2d0efa1c1fba0459e03e908fd33372b8cf96')
  throw Error('Reviewed migration checksum changed.');
if(!sql.startsWith('begin;') || !sql.includes("set local lock_timeout = '1s'")
  || !sql.includes("set local statement_timeout = '8s'")
  || !sql.includes("set local application_name = 'cyclostratege-sprint-train-20261022'")
  || !/commit;\s*$/.test(sql)) throw Error('Migration atomicity or bounds changed.');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const hash=createHash('md5').update(sql).digest('hex');
const directory='artifacts/sprint-train-20261022';
function query(statement){
  mkdirSync(directory,{recursive:true});
  const payload=path.resolve(directory,'reviewed-query.sql');
  writeFileSync(payload,statement);
  let raw;
  try { raw=execFileSync(binary,['db','query','--linked','--file',payload,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:120000}); }
  catch(error){ throw Error(`Database command failed; verify task-owned transaction before retry: ${error.code??error.status}; ${String(error.stderr??'').slice(0,1500)}`); }
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const bounded=body=>`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';
  set local application_name='sprint-train-receipt-20261022';${body};commit;`;
function inspect(){
  return query(bounded(`select 1 database_ok,
    exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
    (select jsonb_object_agg(signature,hash) from (select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) hash
      from pg_proc where oid in(to_regprocedure('public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'),
        to_regprocedure('public.save_national_federation_race_preparation(text,uuid,uuid,jsonb,jsonb)'),
        to_regprocedure('public.get_current_team_race_preparation()'),
        to_regprocedure('public.get_current_national_federation_race_preparation(text)'),
        to_regprocedure('private.assert_federation_race_preparation_context(text,uuid,uuid,boolean)'),
        to_regprocedure('public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)'),
        to_regprocedure('public.save_national_federation_time_trial_preparation(text,uuid,uuid,jsonb)'))) untouched) canonical_hashes,
    exists(select 1 from pg_attribute where attrelid='public.race_stage_strategies'::regclass and attname='sprint_train_order' and not attisdropped) column_ready,
    (select relrowsecurity from pg_class where oid='public.race_stage_strategies'::regclass) strategies_rls,
    (select count(*)::int from pg_stat_activity where pid<>pg_backend_pid() and application_name in
      ('cyclostratege-sprint-train-20261022','sprint-train-receipt-20261022') and xact_start is not null) own_open_transactions`))[0];
}
const before=inspect();
if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
if(before.database_ok!==1 || !before.strategies_rls || Object.keys(before.canonical_hashes??{}).length<5
  || before.own_open_transactions!==0) throw Error('Preflight failed.');
if(before.recorded && before.recorded_hash!==hash) throw Error('Recorded migration differs; never replay.');
if(!before.recorded) query(sql.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
  values(${quote(version)},${quote(name)},array[${quote(sql)}]);\ncommit;`));
const after=inspect();
const feature=query(bounded(`select
  (select bool_and(has_function_privilege('authenticated',oid,'execute') and not has_function_privilege('anon',oid,'execute'))
    from pg_proc where oid in(to_regprocedure('public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb)'),
      to_regprocedure('public.save_national_federation_race_preparation_with_sprint(text,uuid,uuid,jsonb,jsonb)'),
      to_regprocedure('public.get_current_team_race_preparation_with_sprint()'),
      to_regprocedure('public.get_current_national_federation_race_preparation_with_sprint(text)'))) acl_ready,
  not has_function_privilege('authenticated','private.store_sprint_train_order(uuid,uuid,jsonb,jsonb)','execute') helper_private,
  (select count(*)::int from pg_proc where oid in(to_regprocedure('public.save_current_team_race_preparation_with_sprint(uuid,uuid,jsonb,jsonb)'),
      to_regprocedure('public.save_national_federation_race_preparation_with_sprint(text,uuid,uuid,jsonb,jsonb)'),
      to_regprocedure('public.get_current_team_race_preparation_with_sprint()'),
      to_regprocedure('public.get_current_national_federation_race_preparation_with_sprint(text)'))) rpc_count,
  (select count(*)::int from pg_attribute where attrelid=(select typrelid from pg_type where oid='public.race_preparation_with_sprint_row'::regtype)
    and attnum>0 and not attisdropped) row_columns`))[0];
if(after.database_ok!==1 || !after.recorded || after.recorded_hash!==hash || !after.column_ready || !after.strategies_rls
  || after.own_open_transactions!==0 || JSON.stringify(before.canonical_hashes)!==JSON.stringify(after.canonical_hashes)
  || !feature.acl_ready || !feature.helper_private || feature.rpc_count!==4 || feature.row_columns!==36)
  throw Error('Unexpected receipt; stop before application deployment.');
const receipt={migration:version,sha256:createHash('sha256').update(sql).digest('hex'),...after,...feature};
writeFileSync(path.join(directory,'deployment-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
