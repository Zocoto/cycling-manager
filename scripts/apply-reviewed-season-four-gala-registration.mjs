// Installs only reviewed registration routines. Never creates test entrants.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--inspect','--apply-reviewed'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const version='20261023173000',name='open_season_four_gala_registrations';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const sha=createHash('sha256').update(source).digest('hex');
if(sha!=='f79e490928518d0e8c2ba738eb9f2cf0299fbde0117defe125c1e3422d3f8909')throw Error('Reviewed source changed; review and isolated tests required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const directory='artifacts/gala-s4-publication-20261023';mkdirSync(directory,{recursive:true});
function run(sql){const file=path.resolve(directory,'reviewed-migration.sql');writeFileSync(file,sql);const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
function inspect(){return run(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='gala-s4-registration-inspect';select 1 database_ok,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 (select name from supabase_migrations.schema_migrations where version='${version}') recorded_name,
 to_regprocedure('public.get_current_season_four_gala_context()') is not null installed,
 not has_table_privilege('authenticated','public.season_gala_registrations','insert') raw_tables_protected,
 (select jsonb_object_agg(signature,fingerprint) from (select oid::regprocedure::text signature,md5(pg_get_functiondef(oid)) fingerprint from pg_proc where oid in(
 to_regprocedure('public.save_current_team_pcm_gala_registration(text,uuid[])'),to_regprocedure('public.settle_season_four_gala_results(text,jsonb)'),to_regprocedure('public.guard_season_four_gala_registration()'))) f) protected_functions;commit;`)[0];}
const before=inspect();if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
const md5=createHash('md5').update(source).digest('hex');
if(before.database_ok!==1||!before.raw_tables_protected||Object.keys(before.protected_functions??{}).length!==3)throw Error('Health or prerequisite mismatch');
if(before.recorded_hash&&(before.recorded_hash!==md5||before.recorded_name!==name))throw Error('Migration version collision; never overwrite');
if(!before.recorded_hash){
 if(before.installed)throw Error('Unrecorded existing routines: inspect before installation');
 run(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after=inspect();
if(after.recorded_hash!==md5||!after.installed||!after.raw_tables_protected||JSON.stringify(before.protected_functions)!==JSON.stringify(after.protected_functions))throw Error('Installation verification failed');
const receipt={migration:version,sha256:sha,...after,testEntrantsCreated:false,gameplayOrRewardMutation:false};
writeFileSync(path.join(directory,'migration-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
