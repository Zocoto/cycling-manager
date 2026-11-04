// One reviewed, definition-only migration. Never simulates or settles a race.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=join(require.resolve('@supabase/cli-windows-x64/package.json'),'..','bin/supabase.exe');
const version='20261104133000',name='balance_junior_virtual_riders_and_equipment';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
const folder='C:/Dev/artifacts/junior-engine-fix-20261104';
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
 const directory=mkdtempSync(join(tmpdir(),'junior-engine-fix-')),file=join(directory,'query.sql');
 try{
  writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:50000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
 }finally{unlinkSync(file);rmdirSync(directory);}
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='junior-engine-balance-verification';${sql};commit;`);
const signatures=[
 'public.simulate_development_race_pre_federation_juniors(uuid)',
 'public.simulate_development_race_stage(uuid,uuid)',
 'public.simulate_development_race(uuid)',
 'public.get_national_federation_equipment_junior_stage_bonus(uuid,uuid,text,text)',
 'public.get_national_federation_equipment_rating_bonus(uuid,uuid,text,boolean)',
];
function state(){return read(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,
 p.proacl::text acl,p.proconfig,p.prosecdef,p.provolatile,
 position('junior_virtual_fillers_v1' in pg_get_functiondef(p.oid))>0 virtual_patched,
 position('junior_equipment_native_scale_v1' in pg_get_functiondef(p.oid))>0 equipment_patched
 from pg_proc p where p.oid=any(array[${signatures.map(quote).join(',')}]::regprocedure[]) order by signature`);}
function receipt(){return read(`select name,md5(statements[1]) hash from supabase_migrations.schema_migrations where version='${version}'`)[0];}
function historicalResults(){return read(`select race_edition_id,count(*)::integer results,
 md5(string_agg(concat_ws(':',id,result_scope,competitor_key,rank,elapsed_time_seconds,gap_to_winner_seconds,points),'|' order by id)) fingerprint
 from public.development_race_results
 where race_edition_id in('fad7ff62-663d-4425-bab0-7ad9ebe64c46','d6d83d63-f40f-4884-85c7-fc79f01de6a9')
 group by race_edition_id order by race_edition_id`);}
function ongoing(){return read(`select e.id,e.name from public.development_race_editions e
 join public.seasons s on s.id=e.season_id and s.status='active'
 where e.status not in('completed','cancelled') and exists(
 select 1 from public.development_race_results r where r.race_edition_id=e.id and r.result_scope='stage') limit 1`);}
function equipmentSamples(){return read(`select c.iso_alpha2,
 public.get_national_federation_equipment_junior_stage_bonus(c.id,'c0c5824c-43a4-442e-907c-265c479efa0a','hilly','road') road,
 public.get_national_federation_equipment_junior_stage_bonus(c.id,'c0c5824c-43a4-442e-907c-265c479efa0a','time_trial','individual_time_trial') tt
 from public.countries c where c.iso_alpha2 in('JP','BR') order by c.iso_alpha2`);}
const before=state(),record=receipt();assert.equal(before.length,5);
if(record){assert.equal(record.name,name);assert.equal(record.hash,hash(source),'Migration version collision.');}
if(mode==='--inspect'){
 console.log(JSON.stringify({recorded:Boolean(record),functions:before,ongoingWithResults:ongoing(),equipmentSamples:equipmentSamples()},null,2));
 process.exit(0);
}
let baseline;
if(!record){
 assert.equal(mode,'--apply','Migration not installed.');
 assert(before.every(r=>!r.virtual_patched&&!r.equipment_patched),'Partial unrecorded installation.');
 for(const guard of JSON.parse(readFileSync(join(folder,'guards-before.json'),'utf8'))){
  assert.equal(before.find(r=>r.signature===guard.signature)?.hash,hash(guard.definition),'Audited engine changed; inspect before applying.');
 }
 assert.equal(ongoing().length,0,'An ongoing tour has published stages; a mixed-engine rollout needs review.');
 baseline={checkedAt:new Date().toISOString(),functions:before,historicalResults:historicalResults(),equipmentSamples:equipmentSamples()};
 mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'before.json'),JSON.stringify(baseline,null,2));
 query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
 values('${version}','${name}',array[${quote(source)}]);commit;`));
}else baseline=JSON.parse(readFileSync(join(folder,'before.json'),'utf8'));
const after=state(),installed=receipt();assert.equal(installed?.hash,hash(source));
assert.equal(after.filter(r=>r.virtual_patched).length,2);assert.equal(after.filter(r=>r.equipment_patched).length,1);
const attributes=rows=>rows.map(({signature,acl,proconfig,prosecdef,provolatile})=>({signature,acl,proconfig,prosecdef,provolatile}));
assert.deepEqual(attributes(after),attributes(baseline.functions),'Engine execution permissions/settings changed.');
for(const fn of after.filter(r=>!r.virtual_patched&&!r.equipment_patched))assert.equal(fn.hash,baseline.functions.find(r=>r.signature===fn.signature)?.hash,'An unrelated function changed.');
const historical=historicalResults();assert.deepEqual(historical,baseline.historicalResults,'Completed World Championship results changed.');
const samples=equipmentSamples();for(const row of samples){
 const previous=baseline.equipmentSamples.find(r=>r.iso_alpha2===row.iso_alpha2);
 for(const axis of ['road','tt'])assert.equal(Number(row[axis]),Number(previous[axis])/8,'Incorrect equipment conversion.');
}
const proof={verifiedAt:new Date().toISOString(),version,installed:true,functions:after,equipmentSamples:samples,historicalResultsUnchanged:true,historicalResults:historical,
 botScoreRange:{minimum:.07,maximum:.38},minimumPlayerScoreBeforeEquipment:.64,executionAttributesPreserved:true,noGameplayRpcInvoked:true};
mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'verified.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
