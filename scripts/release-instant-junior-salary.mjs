// Production is never a test database. No gameplay RPCs or fixtures are run.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const mode=process.argv[2];assert.ok(['--preflight','--apply','--verify','--inspect'].includes(mode));
const folder='artifacts/.tmp-instant-junior-salary';mkdirSync(folder,{recursive:true});
const version='20261022154500';
const expected={
  'redeem_instant_youth_promotion_reward(uuid,uuid)':'be4d3588237d56b76cf6826d2e702ad6',
  'renew_current_team_rider_until(uuid,integer)':'34237bafd4f4fa8507c41f9f39dd2d4e',
  'renew_current_team_rider(uuid)':'184e6d469e5f7f8a8e4015137ee09f38',
  'sync_rider_salary_installments(uuid)':'e1a4dff62565674534147a2d1bb182fb',
  'apply_homegrown_salary_discount_to_contract()':'73969cb9de1d7cf9647fa23cd3ec9392',
  'calculate_rider_season_salary(uuid,uuid)':'8c6d3ce4196bf5a7d3c996e0a63c502d',
  'calculate_rider_season_salary_quotes(uuid[],uuid)':'7f0f1e71636d1cc818d496645aa87cc3',
};
const changed=new Set(['redeem_instant_youth_promotion_reward(uuid,uuid)','renew_current_team_rider_until(uuid,integer)','sync_rider_salary_installments(uuid)']);
const call=(args,timeout=20000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:200000,stdio:['ignore','pipe','pipe']});
const query=sql=>{const raw=call(['db','query','--linked',`begin read only;set local application_name='instant-junior-salary-release-${mode.slice(2)}';set local statement_timeout='4s';set local lock_timeout='500ms';${sql}commit;`,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const catalog=()=>query(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proowner::regrole::text owner from pg_proc p where p.oid in (${Object.keys(expected).map(s=>`'public.${s}'::regprocedure`).join(',')}) order by p.oid::regprocedure::text;`);
const targets=()=>query("select contract.id,contract.rider_id,contract.team_id,contract.status,contract.acquisition_type from public.youth_academy_riders academy join public.youth_development_notifications notice on notice.team_id=academy.team_id and notice.notification_type='promoted' and notice.source_reference='instant-youth-promotion:'||academy.id::text join public.rider_contracts contract on contract.rider_id=academy.promoted_rider_id and contract.team_id=academy.team_id join public.seasons first_season on first_season.id=contract.start_season_id join public.seasons last_season on last_season.id=contract.end_season_id join public.seasons current_season on current_season.status='active' where academy.status='promoted' and contract.status in ('active','planned') and contract.acquisition_type in ('academy','renewal') and contract.salary_per_season=0 and last_season.game_year>=current_season.game_year and first_season.game_year<=last_season.game_year order by contract.id limit 101;");
function posted(ids){
  if(!ids.length)return [];
  assert.ok(ids.every(id=>/^[0-9a-f-]{36}$/u.test(id)));
  return query(`select t.id,t.team_season_id,t.source_reference,t.amount,t.status,t.description,t.season_day_id,t.day_number from public.rider_contracts c join public.team_seasons ts on ts.team_id=c.team_id join public.team_finance_transactions t on t.team_season_id=ts.id and t.source_reference like 'rider-salary:'||c.id::text||':%' where c.id in (${ids.map(id=>`'${id}'::uuid`).join(',')}) and t.status='posted' order by t.id limit 201;`);
}
const baselineFile=`${folder}/release-before.json`;
const record=(step,details={})=>{const file=`${folder}/release-receipts.json`;const rows=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];rows.push({at:new Date().toISOString(),mode,step,...details});writeFileSync(file,JSON.stringify(rows,null,2));};
try{
  if(mode==='--preflight'){
    assert.ok(!existsSync(`${folder}/release.started`)&&!existsSync(`${folder}/release.blocked`),'Prior operation started/failed: inspect first, no automatic retry.');
    const functions=catalog();assert.equal(functions.length,Object.keys(expected).length);
    for(const row of functions)assert.equal(row.hash,expected[row.signature],`Function drift: ${row.signature}`);
    const [state]=query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,exists(select 1 from information_schema.columns where table_schema='public' and table_name='rider_contracts' and column_name='salary_billing_from_game_day_index') has_floor,(select relrowsecurity from pg_class where oid='public.rider_contracts'::regclass) rls,exists(select 1 from pg_policies where schemaname='public' and tablename='rider_contracts' and cmd<>'SELECT' and roles&&array['authenticated','anon','public']::name[]) player_write_policy;`);
    assert.equal(state.recorded,false);assert.equal(state.has_floor,false);
    assert.equal(state.rls,true);assert.equal(state.player_write_policy,false,'New billing boundary must not be editable through player table access.');
    const affected=targets();assert.ok(affected.length<=100,'Stop: unreviewed repair volume');
    const history=posted(affected.map(c=>c.id));assert.ok(history.length<=200);
    writeFileSync(baselineFile,JSON.stringify({functions,affected,history},null,2));
    record('preflight-ok',{affected:affected.length,postedRows:history.length});
    console.log(JSON.stringify({readOnly:true,preflight:true,affectedContracts:affected.length,postedRows:history.length}));
  }else if(mode==='--apply'){
    assert.ok(!existsSync(`${folder}/release.blocked`),'Prior failure: inspect only.');
    writeFileSync(`${folder}/release.started`,new Date().toISOString(),{flag:'wx'});
    const before=JSON.parse(readFileSync(baselineFile,'utf8'));
    assert.deepEqual(catalog(),before.functions,'Definition or ACL drift: stop.');
    record('sql-started');
    call(['db','query','--linked','--file',path.resolve(`supabase/migrations/${version}_fix_instant_youth_promotion_salary.sql`),'--output','json'],30000);
    record('sql-applied');
    call(['migration','repair',version,'--status','applied','--linked','--yes']);
    record('migration-recorded');
    console.log(JSON.stringify({applied:true,version,fixtures:false,gameplayRPCsCalled:false}));
  }else if(mode==='--inspect'){
    const sessions=query("select pid,application_name,state,xact_start,wait_event_type from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and application_name in ('instant-junior-salary-migration','instant-junior-salary-release-apply','instant-junior-salary-release-preflight','instant-junior-salary-capture') order by pid limit 10;");
    const state=query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,exists(select 1 from information_schema.columns where table_schema='public' and table_name='rider_contracts' and column_name='salary_billing_from_game_day_index') has_floor;`);
    console.log(JSON.stringify({readOnly:true,sessions,state}));
  }else{
    const before=JSON.parse(readFileSync(baselineFile,'utf8'));const functions=catalog();
    for(const row of functions){const old=before.functions.find(f=>f.signature===row.signature);assert.ok(old);assert.equal(row.acl,old.acl);assert.equal(row.owner,old.owner);if(changed.has(row.signature))assert.notEqual(row.hash,old.hash);else assert.equal(row.hash,old.hash);}
    const remaining=targets();assert.equal(remaining.length,0,'Zero salaries remain in the proven scope.');
    assert.deepEqual(posted(before.affected.map(c=>c.id)),before.history,'Already posted wages changed.');
    const [state]=query(`select 1 database_ok,exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,exists(select 1 from information_schema.columns where table_schema='public' and table_name='rider_contracts' and column_name='salary_billing_from_game_day_index') has_floor,(select count(*)::int from private.instant_youth_salary_corrections) audit_rows,(select relrowsecurity and not has_table_privilege('anon',oid,'SELECT') and not has_table_privilege('authenticated',oid,'SELECT') from pg_class where oid='private.instant_youth_salary_corrections'::regclass) audit_private,not exists(select 1 from private.instant_youth_salary_corrections a join public.team_seasons ts on ts.team_id=a.team_id join public.seasons s on s.id=ts.season_id join public.team_finance_transactions t on t.team_season_id=ts.id and t.source_reference like 'rider-salary:'||a.contract_id::text||':%' where t.status='pending' and s.game_year*28+t.day_number-1<a.salary_billing_from_game_day_index) no_arrears;`);
    assert.equal(state.database_ok,1);assert.equal(state.recorded,true);assert.equal(state.has_floor,true);
    assert.equal(state.audit_private,true);assert.equal(state.no_arrears,true);assert.ok(state.audit_rows>=before.affected.length);
    record('verified',{repaired:before.affected.length,postedHistoryUnchanged:true});
    console.log(JSON.stringify({readOnly:true,verified:true,repairedContracts:before.affected.length,postedHistoryUnchanged:true,permissionsUnchanged:true,otherSalaryFunctionsUnchanged:true,...state}));
  }
}catch(error){
  if(mode!=='--inspect')writeFileSync(`${folder}/release.blocked`,JSON.stringify({at:new Date().toISOString(),mode,status:error.status,signal:error.signal,code:error.code}));
  record('failed');console.error('Stopped. Inspect exact task-owned transactions; never replay automatically.');throw error;
}
