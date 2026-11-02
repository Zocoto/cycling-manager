// One reviewed migration only; no db push, gameplay fixtures or benchmarks.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
const workdir=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(join(workdir,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=join(require.resolve('@supabase/cli-windows-x64/package.json'),'..','bin/supabase.exe');
const version='20261102141537',name='remove_seasonal_training_gain_limits';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const directory=mkdtempSync(join(tmpdir(),'unlimited-training-'));const file=join(directory,'query.sql');
  try{
    writeFileSync(file,sql);
    const raw=execFileSync(binary,['db','query','--linked','--workdir',workdir,'--file',file,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:400000});
    return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  }finally{rmSync(file,{force:true});rmdirSync(directory);}
}
const read=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';${sql};commit;`);
function state(){return read(`select true database_ok,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 to_regclass('private.training_season_limit_recoveries') is not null receipt_table,
 (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
 'acl',p.proacl::text,'definer',p.prosecdef,'config',p.proconfig) order by p.oid::regprocedure::text)
 from pg_proc p where p.oid in('public.settle_due_training_sessions()'::regprocedure,'public.settle_due_free_agent_training(integer)'::regprocedure,
 'private.apply_training_season_carryover(uuid,uuid,text)'::regprocedure)) engines`)[0];}
const before=state();assert(before.database_ok);
if(before.recorded_hash)assert.equal(before.recorded_hash,hash(source),'Migration version collision: stop.');
if(mode==='--inspect'){
  console.log(JSON.stringify({databaseHealthy:true,recorded:Boolean(before.recorded_hash),receiptTable:before.receipt_table,
    engines:before.engines.map(e=>({signature:e.signature,patched:e.definition.includes('unlimited_season_training_v1')}))}));
  process.exit(0);
}
const careerSql=`select coalesce(p.value,0) value from public.team_manager_assignments a
 left join public.career_achievement_progress p on p.sporting_director_id=a.sporting_director_id and p.metric_key='future_natural_progress'
 and p.subject_key='4e44a1c8-c33d-49b1-9cf2-b5e809e20762:hills'
 where a.team_id='ad506cc8-91ff-4306-a30f-b1397e2154a5' and a.status='active' and a.role='general_manager' limit 1`;
let careerBefore=null;
if(!before.recorded_hash){
  assert.equal(mode,'--apply','Migration is not installed.');assert.equal(before.receipt_table,false,'Unrecorded receipt table exists: inspect first.');
  careerBefore=Number(read(careerSql)[0]?.value??0);
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${quote(source)}]);commit;`));
}
const after=state();assert.equal(after.recorded_hash,hash(source));assert(after.receipt_table);
for(const engine of after.engines){assert(engine.definition.includes('unlimited_season_training_v1'));assert(!engine.definition.includes('v_gain_cap'));}
const attributes=e=>e.map(({signature,acl,definer,config})=>({signature,acl,definer,config}));
assert.deepEqual(attributes(after.engines),attributes(before.engines),'Engine privileges/settings changed.');
const result=read(`select r.hills,p.balance_milli,p.rating_gain,p.total_training_milli,t.rating_changes,
 c.recovered_milli,c.rating_change,c.balance_before,c.balance_after,c.rating_before,c.rating_after,
 (select relrowsecurity from pg_class where oid='private.training_season_limit_recoveries'::regclass) receipt_rls,
 has_table_privilege('authenticated','private.training_season_limit_recoveries','select') receipt_player_access
 from private.training_season_limit_recoveries c
 join public.rider_season_ratings r on r.rider_id=c.rider_id and r.season_id=c.season_id
 join public.rider_training_stat_progress p on p.rider_id=c.rider_id and p.season_id=c.season_id and p.stat_code=c.stat_code
 join public.rider_training_sessions t on t.id=c.session_id
 where c.rider_id='4e44a1c8-c33d-49b1-9cf2-b5e809e20762' and c.season_id='c0c5824c-43a4-442e-907c-265c479efa0a' and c.stat_code='hills'`)[0];
assert(result);assert.equal(result.recovered_milli,1410);assert.equal(result.rating_change,2);
assert.equal(result.rating_before,73);assert.equal(result.rating_after,75);assert.equal(result.balance_after,409);
assert(result.hills>=75);assert(result.receipt_rls&&!result.receipt_player_access);
assert.equal(result.rating_changes.hills,2);
const careerAfter=Number(read(careerSql)[0]?.value??0);
if(careerBefore!==null)assert.equal(careerAfter,careerBefore+2,'Recovered career progress differs.');
const proof={checkedAt:new Date().toISOString(),databaseHealthy:true,version,enginesPatched:3,privilegesPreserved:true,
  recoveredRiders:1,recoveredStats:1,recoveredRatingPoints:2,recoveredMilli:1410,careerBefore,careerAfter,result};
const directory='C:/Dev/artifacts/iguchi-training-20261102';mkdirSync(directory,{recursive:true});
writeFileSync(join(directory,mode==='--verify'?'unlimited-production-recheck.json':'unlimited-production-verification.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
