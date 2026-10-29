// Deliver only the reviewed migration; never launches or settles live projects.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from 'dotenv';

const mode=process.argv[2];
const version='20261029110000', name='add_engineer_moderate_success';
const folder='artifacts/rnd-moderate-success-20261029';
if (!['--apply-reviewed','--verify'].includes(mode) || process.argv.length!==3 ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw Error('Expected project and exact delivery mode required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql) {
  const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:300000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const verification=`begin read only;set local application_name='rnd-moderate-success-verification';
set local statement_timeout='3s';set local lock_timeout='500ms';
select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
  position('engineer_moderate_success_v1' in pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure))>0
    and position('moderateSuccessChancePercentage' in pg_get_functiondef('public.equipment_rnd_engineer_profile(uuid)'::regprocedure))>0 installed,
  md5(pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure)) settlement_hash,
  md5(pg_get_functiondef('public.equipment_rnd_engineer_profile(uuid)'::regprocedure)) profile_hash,
  md5(pg_get_functiondef('public.start_current_team_equipment_rnd(uuid,uuid)'::regprocedure)) launch_hash,
  md5(pg_get_functiondef('public.start_current_team_equipment_rnd(uuid,uuid,text)'::regprocedure)) named_hash,
  md5(pg_get_functiondef('public.start_current_team_equipment_rnd(uuid,uuid,text,text)'::regprocedure)) focused_hash,
  md5(pg_get_functiondef('public.apply_federal_staff_to_equipment_rnd()'::regprocedure)) launch_trigger_hash,
  md5(pg_get_functiondef('public.calculate_equipment_rnd_duration_days(jsonb,integer,boolean,boolean)'::regprocedure)) duration_hash,
  md5(pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure)) training_hash;
commit;`;
config({path:'.env.local',quiet:true});
async function health() {
  const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{
    headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
  if(response.status!==200)throw Error('Database auth health check failed: '+response.status);
  return response.status;
}
await health();
const before=query(verification)[0];
if(before.receipt && (before.receipt!==name || !before.installed))throw Error('Migration receipt mismatch.');
if(mode==='--apply-reviewed' && !before.receipt) {
  if(!before.installed && existsSync(folder+'/production-functions-before.json')) {
    const audited=JSON.parse(readFileSync(folder+'/production-functions-before.json','utf8'));
    for(const [fn,key] of [['settle_due_equipment_rnd_projects','settlement_hash'],['equipment_rnd_engineer_profile','profile_hash']]) {
      const hash=createHash('md5').update(audited.find(row=>row.name===fn).definition).digest('hex');
      if(hash!==before[key])throw Error('Audited production function changed: '+fn);
    }
  }
  if(before.installed)throw Error('Installed code has no receipt; inspect before recording.');
  const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
  if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  const receipt=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);\ncommit;`;
  query(sql.replace('begin;',"begin;\nset local application_name='rnd-moderate-success-migration';").replace(/commit;\s*$/,receipt));
}
const after=query(verification)[0];
if(after.receipt!==name || !after.installed)throw Error('Moderate success migration is not installed.');
for(const key of ['launch_hash','named_hash','focused_hash','launch_trigger_hash','duration_hash','training_hash']) {
  if(before[key]!==after[key])throw Error('Unrelated gameplay function changed: '+key);
}
const permissions=query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
select private.equipment_rnd_moderate_success_chance(1) level_1,
  private.equipment_rnd_moderate_success_chance(5) level_5,
  has_function_privilege('authenticated','private.resolve_equipment_rnd_success(text,integer,integer,numeric,numeric,double precision,double precision,double precision,double precision)','execute') player_can_call;
commit;`)[0];
if(permissions.level_1!==5||permissions.level_5!==25||permissions.player_can_call)throw Error('Invalid base skill rules or privileges.');
const authStatus=await health();
mkdirSync(folder,{recursive:true});
writeFileSync(folder+'/production-verification.json',JSON.stringify({version,before,after,permissions,authStatus,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({version,installed:true,recorded:true,authStatus,gameplayFunctionsRun:false,existingProjectsUntouched:true,launchAndDurationPreserved:true}));
