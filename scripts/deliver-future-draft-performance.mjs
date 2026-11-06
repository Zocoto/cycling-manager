// Install the reviewed S6+ formula only. Never run a draft worker or fixtures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--inspect','--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106153017',name='prioritize_performance_in_future_drafts';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const digest=value=>createHash('md5').update(value).digest('hex');
assert.equal(createHash('sha256').update(source).digest('hex'),'bd97f0f031be191da4823c9ea2777264f5345db919f60d0dcb08d905a20f5e77');
const folder='C:/Dev/artifacts/future-draft-performance-20261106';
mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const reservation='reserve_season_draft_pool(uuid,integer)';
const helper='calculate_season_draft_score_for_edition(jsonb,integer,integer,integer)';
const preserved=[
  'calculate_season_draft_score(jsonb,integer,integer)',
  'guard_season_draft_reservation()',
  'initialize_season_draft(uuid)',
  'advance_season_draft(uuid)',
  'save_current_season_draft_preferences(uuid,uuid[],boolean)',
  'get_season_draft_view(boolean)',
  'process_season_draft()',
  'rollover_game_season(uuid,boolean)',
  'settle_due_season_rollovers()',
];
function query(sql,label){
  const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
  let raw;
  try {raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:120000});}
  catch(error){throw new Error(`${label}: ${String(error.stderr||error.message).slice(0,3500)}`);}
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function state(label){
  return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';
    set local application_name='future-draft-performance-verification';
    with pool as materialized (
      select p.rider_id,p.pool_rank,p.score from public.season_draft_riders p
      join public.season_draft_editions e on e.id=p.edition_id where e.game_year=5
      order by p.pool_rank limit 1001
    ) select true database_ok,
    (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') receipt_hash,
    (select count(*)::integer from pool) s5_pool_count,
    (select md5(string_agg(rider_id::text||':'||pool_rank::text||':'||score::text,',' order by pool_rank)) from pool) s5_pool_hash,
    (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'oid',p.oid::bigint,
      'hash',md5(replace(pg_get_functiondef(p.oid),chr(13),'')),'acl',p.proacl::text,'config',p.proconfig,
      'securityDefiner',p.prosecdef,'volatility',p.provolatile,
      'playersExecute',has_function_privilege('authenticated',p.oid,'execute'),
      'anonymousExecute',has_function_privilege('anon',p.oid,'execute'),
      'serviceExecute',has_function_privilege('service_role',p.oid,'execute')) order by p.oid::regprocedure::text)
      from pg_proc p where p.oid in (${[reservation,...preserved].map(signature=>quote('public.'+signature)+'::regprocedure').join(',')},to_regprocedure('public.${helper}'))) functions,
    (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname)
      from pg_trigger t where not t.tgisinternal and t.tgname like '%season_draft%'
      and t.tgrelid in ('public.rider_contracts'::regclass,'public.transfer_market_listings'::regclass,'public.season_rollover_settlements'::regclass)) triggers,
    (select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active,'command',command) order by jobname)
      from cron.job where jobname in ('season-opening-draft','daily-season-rollover')) jobs;
    commit;`,label)[0];
}
const current=state('current');
assert.equal(current.database_ok,true);assert.ok(current.s5_pool_count<1001);
if(mode==='--inspect'){
  assert.equal(current.receipt,null);
  assert.equal(current.functions.find(row=>row.signature===reservation).hash,'8db4ed7b934e4899bc64249da273e809');
  writeFileSync(path.join(folder,'before.json'),JSON.stringify(current,null,2));
  console.log(JSON.stringify({databaseOk:true,s5PoolCount:current.s5_pool_count,installed:false}));
}else{
  const baseline=JSON.parse(readFileSync(path.join(folder,'before.json'),'utf8'));
  if(!current.receipt){
    assert.equal(mode,'--apply');
    assert.deepEqual(current.functions,baseline.functions);
    assert.equal(current.s5_pool_hash,baseline.s5_pool_hash);
    assert.ok(source.endsWith('commit;\n'));
    query(source.slice(0,-'commit;\n'.length)+
      `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'reviewed-install');
  }
  const after=state('after');
  assert.equal(after.receipt,name);assert.equal(after.receipt_hash,digest(source));
  assert.equal(after.s5_pool_count,baseline.s5_pool_count);assert.equal(after.s5_pool_hash,baseline.s5_pool_hash);
  assert.deepEqual(after.triggers,baseline.triggers);assert.deepEqual(after.jobs,baseline.jobs);
  for(const previous of baseline.functions){
    const expected={...previous};
    if(previous.signature===reservation)expected.hash='88302f2bc993a29c4bdf336f8aecd4f0';
    assert.deepEqual(after.functions.find(row=>row.signature===previous.signature),expected);
  }
  const installed=after.functions.find(row=>row.signature===helper);
  assert.equal(installed.hash,'485eb10f0e5e396019bbe66993b5dca5');
  assert.equal(installed.playersExecute,false);assert.equal(installed.anonymousExecute,false);
  assert.equal(installed.serviceExecute,true);assert.equal(installed.securityDefiner,false);
  assert.equal(installed.volatility,'i');assert.deepEqual(installed.config,['search_path=""']);
  const proof={checkedAt:new Date().toISOString(),receipt:version,firstPerformanceDraft:6,
    s5PoolPreserved:true,s5PoolCount:after.s5_pool_count,legacyFormulaPreserved:true,
    guardsAndWorkersPreserved:true,noGameplayExecuted:true};
  writeFileSync(path.join(folder,'verification.json'),JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
}
