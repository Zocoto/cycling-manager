// Only the two reviewed migrations. Never records a production login or awards a test pack.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed-migration','--verify'].includes(mode)
  ||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact delivery mode and linked project required.');
const require=createRequire(import.meta.url);
const bin=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261027170000',name='weekly_login_cyclo_stickers_boosters',file=`supabase/migrations/${version}_${name}.sql`;
const presenceVersion='20261027171000',presenceName='weekly_login_boosters_game_presence',presenceFile=`supabase/migrations/${presenceVersion}_${presenceName}.sql`;
const call=args=>{try{return execFileSync(bin,args,{encoding:'utf8',timeout:30000,maxBuffer:200000});}catch(e){throw new Error(`Delivery query failed: ${e.stderr||e.code}`);}};
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='weekly-login-boosters-delivery';${sql};commit;`;
const protectedFunctions=()=>query(ro(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
  ('claim_current_daily_reward','redeem_current_daily_reward','get_next_daily_reward_cycle_day','get_daily_reward_importance','record_current_game_presence') order by p.oid::regprocedure::text limit 12`));
const receipt=(v=version)=>query(ro(`select name from supabase_migrations.schema_migrations where version='${v}' limit 1`))[0]?.name;
const record=(v,n,f)=>{
  const sql=readFileSync(f,'utf8');
  query(`begin;set local lock_timeout='3s';set local statement_timeout='8s';insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${v}','${n}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing;commit;`);
};
const installation=()=>query(ro(`select
  to_regclass('public.weekly_login_booster_states') is not null states,
  to_regclass('public.cyclo_stickers_boosters') is not null inventory,
  position('record_weekly_login_booster_connection' in pg_get_functiondef('public.record_current_sporting_director_attendance()'::regprocedure))>0 attendance_hook,
  position('get_weekly_login_booster_progress' in pg_get_functiondef('public.get_current_daily_reward_overview()'::regprocedure))>0 overview_hook,
  exists(select 1 from pg_trigger where tgrelid='public.player_daily_activity'::regclass and tgname='weekly_login_booster_daily_activity' and not tgisinternal) presence_hook,
  (select game_year from public.seasons where status='active' limit 1) game_year`))[0];
const verify=(requirePresence=true)=>{
  const s=installation();assert.ok(s.states&&s.inventory&&s.attendance_hook&&s.overview_hook);
  if(requirePresence)assert.equal(s.presence_hook,true);
  const rights=query(ro(`select
    (select relrowsecurity from pg_class where oid='public.cyclo_stickers_boosters'::regclass) inventory_rls,
    (select relrowsecurity from pg_class where oid='public.weekly_login_booster_states'::regclass) states_rls,
    has_table_privilege('authenticated','public.cyclo_stickers_boosters','select') player_read,
    has_table_privilege('authenticated','public.cyclo_stickers_boosters','insert') player_mint,
    has_table_privilege('authenticated','public.cyclo_stickers_boosters','update') player_open,
    has_function_privilege('authenticated','private.record_weekly_login_booster_connection(uuid,uuid,date)','execute') player_set_streak
  `))[0];
  assert.ok(rights.inventory_rls&&rights.states_rls&&rights.player_read);
  assert.equal(rights.player_mint,false);assert.equal(rights.player_open,false);assert.equal(rights.player_set_streak,false);
  if(s.game_year<5){
    const counts=query(ro('select (select count(*)::int from public.weekly_login_booster_states) states,(select count(*)::int from public.cyclo_stickers_boosters) boosters'))[0];
    assert.deepEqual(counts,{boosters:0,states:0});
  }
  return {...s,...rights};
};
const before=protectedFunctions(),initial=installation(),initialReceipt=receipt();
assert.ok(before.length>=5);if(initialReceipt&&initialReceipt!==name)throw new Error('Migration version collision.');
if(mode==='--preflight'){
  assert.equal(initial.game_year,4);
  if(!initialReceipt)assert.ok(!initial.states&&!initial.inventory&&!initial.attendance_hook&&!initial.overview_hook);
  console.log(JSON.stringify({databaseOk:true,gameYear:initial.game_year,alreadyInstalled:!!initialReceipt,preservedRewardFunctions:before.length}));
}else{
  if(mode==='--apply-reviewed-migration'&&!initialReceipt){
    assert.equal(initial.game_year,4);assert.ok(!initial.states&&!initial.inventory);
    call(['db','query','--linked','--file',file,'--output','json']);
    assert.deepEqual(protectedFunctions(),before);verify(false);record(version,name,file);
  }
  const presenceReceipt=receipt(presenceVersion);
  if(presenceReceipt&&presenceReceipt!==presenceName)throw new Error('Presence migration version collision.');
  if(mode==='--apply-reviewed-migration'&&!presenceReceipt){
    assert.equal(initial.game_year,4);
    call(['db','query','--linked','--file',presenceFile,'--output','json']);
    assert.deepEqual(protectedFunctions(),before);verify();record(presenceVersion,presenceName,presenceFile);
  }
  assert.equal(receipt(presenceVersion),presenceName);
  assert.equal(receipt(),name);assert.deepEqual(protectedFunctions(),before);
  console.log(JSON.stringify({databaseOk:true,recorded:true,installation:verify(),existingGiftFunctionsPreserved:true,loginOrAwardRun:false}));
}
