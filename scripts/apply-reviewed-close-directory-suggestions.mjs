// Additive, bounded installation. No gameplay fixtures, backfills or trigger changes.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const mode=process.argv[2],linkedWorkdir=path.resolve(process.argv[3]??'.');
if(![3,4].includes(process.argv.length)||!['--inspect','--apply-reviewed'].includes(mode)||readFileSync(path.join(linkedWorkdir,'supabase/.temp/project-ref'),'utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const version='20261027110000',name='add_close_directory_suggestions';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const sha=createHash('sha256').update(source).digest('hex');
if(sha!=='b868b7dafd4edb1b3667bd18fc6b588caaa9da6de1302ce3890ed5eeac6b9298')throw Error('Reviewed migration changed');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const directory='artifacts/close-directory-suggestions-20261027';mkdirSync(directory,{recursive:true});
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function run(sql){
  const file=path.resolve(directory,'reviewed-command.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',linkedWorkdir,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function read(sql){return run(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='close-directory-suggestions-inspect';${sql};commit;`);}
function inspect(){return read(`select 1 database_ok,
  (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
  (select name from supabase_migrations.schema_migrations where version='${version}') recorded_name,
  to_regprocedure('public.search_game_directory_suggestions(text,integer)') is not null installed,
  to_regclass('public.riders_directory_full_name_trgm_idx') is not null rider_index_available,
  exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm' and n.nspname='extensions') trigrams_available,
  not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname in('unaccent','fuzzystrmatch') and n.nspname<>'extensions') compatible_extensions,
  (select jsonb_object_agg(signature,fingerprint) from(select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) fingerprint from pg_proc where oid in(
    to_regprocedure('public.search_game_directory(text,integer)'),to_regprocedure('public.search_game_directory_without_riders(text,integer)'))) f) exact_search_functions`)[0];}
const before=inspect();if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
const md5=createHash('md5').update(source).digest('hex');
if(before.database_ok!==1||!before.rider_index_available||!before.trigrams_available||!before.compatible_extensions||Object.keys(before.exact_search_functions??{}).length!==2)throw Error('Search prerequisites unavailable');
if(before.recorded_hash&&(before.recorded_hash!==md5||before.recorded_name!==name))throw Error('Migration receipt mismatch');
if(!before.recorded_hash){
  if(before.installed)throw Error('Unrecorded function already exists');
  run(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after=inspect();
if(after.recorded_hash!==md5||!after.installed||JSON.stringify(before.exact_search_functions)!==JSON.stringify(after.exact_search_functions))throw Error('Exact search changed or migration verification failed');
const checks=read(`select not has_function_privilege('anon','public.search_game_directory_suggestions(text,integer)','execute') anonymous_denied,
  has_function_privilege('authenticated','public.search_game_directory_suggestions(text,integer)','execute') authenticated_allowed,
  not has_function_privilege('authenticated','private.directory_close_name_score(text,text)','execute') helper_protected,
  private.directory_close_name_score('Bostwana','Botswana')>0 transposition_supported,
  private.directory_close_name_score('Xylophone','Botswana') is null unrelated_denied,
  (select count(*)::int from public.search_game_directory_suggestions('Bostwana',6))=0 no_session_denied`)[0];
if(Object.values(checks).some(value=>value!==true))throw Error('Post-installation access/health verification failed');
const receipt={migration:version,sha256:sha,...after,...checks,gameplayWrites:0,productionFixtures:0};
writeFileSync(path.join(directory,'migration-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
