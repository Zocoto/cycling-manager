// Exact reviewed schema migration only. No gameplay fixture or catch-up run.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {config} from 'dotenv';
const mode=process.argv[2],version='20261102150000',name='add_season_race_load_morale';
const folder='artifacts/s5-race-load-morale-20261102';
if(!['--apply-reviewed','--verify'].includes(mode)||process.argv.length!==3||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact project and delivery mode required.');
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql){
  try{const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:70000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
  catch(error){throw Error(error.stderr?.slice(0,1800)??error.message);}
}
const read=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='s5-race-load-morale-verify';${sql};commit;`);
const inspect=()=>read(`select 'function' kind,n.nspname||'.'||p.proname key,md5(pg_get_functiondef(p.oid)) value
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('apply_rider_morale_event','sync_rider_race_days_from_stage_result','rollover_game_season'))
    or (n.nspname='private' and p.proname in ('adjust_rider_season_race_load','sync_season_race_load_from_stage_result'))
  union all select 'column',column_name,data_type from information_schema.columns where table_schema='public' and table_name='rider_season_ratings' and column_name in ('season_race_days','race_load_morale_debit')
  union all select 'trigger',tgname,tgenabled::text from pg_trigger where tgrelid='public.stage_results'::regclass and tgname='zz_stage_results_season_race_load'
  union all select 'receipt',version,name from supabase_migrations.schema_migrations where version='${version}'`);
config({path:'.env.local',quiet:true});
async function health(){
  const auth=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/health',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(5000)});
  const site=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(10000)});
  if(auth.status!==200||site.status!==200)throw Error('Service health failed.');return {auth:auth.status,site:site.status};
}
await health();
const before=inspect(),receipt=before.find(r=>r.kind==='receipt');
if(receipt&&receipt.value!==name)throw Error('Migration version collision.');
if(mode==='--apply-reviewed'&&!receipt){
  if(before.some(r=>r.kind==='column'||r.kind==='trigger'||r.key.startsWith('private.')))throw Error('Partial installation; review required.');
  const access=read(`select has_table_privilege('authenticated','public.rider_season_ratings','UPDATE') player_writable`)[0];
  if(access.player_writable)throw Error('Players can update rating columns; review counter write protection before installation.');
  const audited=JSON.parse(readFileSync(folder+'/functions-before.json','utf8'));
  for(const fn of audited){if(before.find(r=>r.key===fn.schema+'.'+fn.name)?.value!==createHash('md5').update(fn.definition).digest('hex'))throw Error('Audited function changed: '+fn.name);}
  const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
  if(!/^begin;/.test(sql)||!/commit;\s*$/.test(sql))throw Error('Atomic migration required.');
  query(sql.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`));
}
const after=inspect();
if(after.filter(r=>r.kind==='column').length!==2||after.filter(r=>r.kind==='function'&&r.key.startsWith('private.')).length!==2||!after.some(r=>r.kind==='trigger'&&r.value==='O')||after.find(r=>r.kind==='receipt')?.value!==name)throw Error('Installation incomplete.');
for(const key of ['public.rollover_game_season','public.sync_rider_race_days_from_stage_result'])if(before.find(r=>r.key===key)?.value!==after.find(r=>r.key===key)?.value)throw Error('Unrelated engine changed: '+key);
const checks=read(`select
  (select count(*)::integer from public.rider_morale_events e join public.season_days d on d.id=e.season_day_id join public.seasons s on s.id=d.season_id where e.source_type='race_load' and s.game_year<5) pre_s5_morale_events,
  (select count(*)::integer from public.rider_season_ratings r join public.seasons s on s.id=r.season_id where s.game_year<5 and (r.season_race_days<>0 or r.race_load_morale_debit<>0)) pre_s5_modified_counters,
  has_column_privilege('authenticated','public.rider_season_ratings','season_race_days','UPDATE') player_can_edit_count,
  has_column_privilege('authenticated','public.rider_season_ratings','race_load_morale_debit','UPDATE') player_can_edit_debit,
  has_function_privilege('authenticated','private.adjust_rider_season_race_load(uuid,uuid,uuid,integer)','EXECUTE') player_can_call,
  (select position('''race_load''' in pg_get_functiondef('public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)'::regprocedure))>0) source_installed`)[0];
if(checks.pre_s5_morale_events||checks.pre_s5_modified_counters||checks.player_can_edit_count||checks.player_can_edit_debit||checks.player_can_call||!checks.source_installed)throw Error('S4 isolation or privilege check failed.');
const serviceHealth=await health();mkdirSync(folder,{recursive:true});
writeFileSync(folder+'/production-verification.json',JSON.stringify({version,before,after,checks,health:serviceHealth,verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({version,installed:true,checks,health:serviceHealth,gameplayRpcsInvoked:false}));
