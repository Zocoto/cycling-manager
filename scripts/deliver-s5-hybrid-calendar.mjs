// Exact reviewed delivery only. No race simulation or player action.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';

const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed','--verify'].includes(mode)
  ||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact delivery mode and linked project required.');
const require=createRequire(import.meta.url);
const bin=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261104160000',name='expand_s5_hilly_cobbled_calendar';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(sql).digest('hex');
const directory='C:/Dev/artifacts/s5-hybrid-calendar-20261104';
mkdirSync(directory,{recursive:true});
const query=text=>{
  const file=path.join(directory,'query.sql');writeFileSync(file,text);
  const raw=execFileSync(bin,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=text=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='s5-hybrid-calendar-delivery';${text};commit;`);
const newSlugs="'classique-des-paves-de-bratislava','baltijos-gristos-kalvos','tartu-munakiviklassik','vidzemes-bruga-klasika','klasik-kamenih-brezuljaka'";
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0];
const preserved=()=>ro(`select
  (select md5(string_agg(t::text,','order by t.id)) from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id where s.game_year=4) s4_stages,
  (select md5(string_agg(e::text,','order by e.id)) from public.race_editions e join public.seasons s on s.id=e.season_id where s.game_year=4) s4_editions,
  (select md5(string_agg(x::text,','order by x.id)) from public.stage_segments x join public.stages t on t.id=x.stage_id join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id join public.races r on r.id=e.race_id
    where s.game_year=4 or(s.game_year=5 and r.slug not in(${newSlugs}) and r.slug!~'^local-[a-z]{2}-classic-2$')) protected_segments,
  (select md5(string_agg(t.id::text||t.race_edition_id||t.stage_number||t.stage_type||t.profile_type||t.distance_km||t.status||t.season_day_id||t.day_slot||coalesce(t.departure_at::text,''),','order by t.id)) from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id join public.races r on r.id=e.race_id where s.game_year=5 and r.slug not in(${newSlugs})) existing_s5_stages,
  (select md5(string_agg(e.id::text||coalesce(e.registration_closes_at::text,'')||coalesce(e.withdrawal_closes_at::text,'')||coalesce(e.wildcard_closes_at::text,''),','order by e.id)) from public.race_editions e join public.seasons s on s.id=e.season_id join public.races r on r.id=e.race_id where s.game_year=5 and r.slug not in(${newSlugs})) existing_s5_deadlines,
  (select md5(string_agg(z::text,','order by z.id)) from public.race_registrations z join public.race_editions e on e.id=z.race_edition_id join public.seasons s on s.id=e.season_id where s.game_year=5) s5_registrations,
  md5(pg_get_functiondef('public.get_federation_selection_rider_limit(uuid,uuid,text)'::regprocedure)) federation_quotas,
  md5(pg_get_functiondef('public.simulate_development_race_stage(uuid,uuid)'::regprocedure)) junior_simulation
`)[0];
const initialReceipt=receipt();
if(initialReceipt)assert.deepEqual(initialReceipt,{name,hash},'Migration receipt mismatch');
const beforeFile=path.join(directory,'before.json');
if(mode==='--preflight'){
  const readiness=ro(`select s.id,s.status,s.game_year,
    count(t.id)filter(where t.status<>'planned' or exists(select 1 from public.official_stage_simulations x where x.stage_id=t.id)or exists(select 1 from public.stage_results x where x.stage_id=t.id))::int frozen,
    count(t.id)filter(where d.day_number=1)::int j1,
    count(t.id)filter(where c.code='local' and r.slug~'^local-[a-z]{2}-classic-2$')::int local_targets
    from public.seasons s join public.race_editions e on e.season_id=s.id join public.races r on r.id=e.race_id
    join public.race_categories c on c.id=e.race_category_id join public.stages t on t.race_edition_id=e.id join public.season_days d on d.id=t.season_day_id
    where s.game_year=5 and e.status<>'cancelled' group by s.id`)[0];
  assert.equal(readiness.status,'planned');assert.equal(readiness.frozen,0);assert.equal(readiness.j1,0);assert.equal(readiness.local_targets,56);
  if(!initialReceipt)writeFileSync(beforeFile,JSON.stringify(preserved(),null,2));
  console.log(JSON.stringify({readOnly:true,readiness,alreadyInstalled:!!initialReceipt}));
}else{
  if(mode==='--apply-reviewed'&&!initialReceipt){
    assert.ok(existsSync(beforeFile),'Read-only preflight required');
    assert.deepEqual(preserved(),JSON.parse(readFileSync(beforeFile,'utf8')),'Protected data changed after preflight');
    const quote=value=>"'"+value.replaceAll("'","''")+"'";
    query(sql.replace(/commit;\s*$/i,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(sql)}]);commit;`));
  }
  assert.deepEqual(receipt(),{name,hash});
  assert.deepEqual(preserved(),JSON.parse(readFileSync(beforeFile,'utf8')),'Protected season, routes, entries or functions changed');
  const routes=ro(`select r.slug,c.code category,d.day_number,t.day_slot,t.profile_type,t.profile_variant,t.distance_km,
    (select sum(x.distance_km) from public.stage_segments x where x.stage_id=t.id) actual_distance,
    (e.registration_closes_at at time zone 'Europe/Paris')::time closes
    from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id
    join public.seasons s on s.id=e.season_id join public.race_categories c on c.id=e.race_category_id join public.season_days d on d.id=t.season_day_id
    where s.game_year=5 and r.slug in(${newSlugs})order by c.code`);
  assert.equal(routes.length,5);assert.equal(new Set(routes.map(r=>r.category)).size,5);
  for(const r of routes){assert.equal(r.profile_variant,'hilly_cobbles');assert.equal(r.profile_type,'hilly');assert.equal(r.actual_distance,r.distance_km);assert.ok(r.day_number>=2);assert.equal(r.closes,r.day_slot==='early'?'08:00:00':'12:00:00');}
  const check=ro(`select
    (select count(*)::int from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.season_days d on d.id=t.season_day_id join public.seasons s on s.id=e.season_id where s.game_year=5 and d.day_number=1 and e.status<>'cancelled') j1,
    (select max(n)::int from(select count(distinct e.id)n from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.race_categories c on c.id=e.race_category_id join public.seasons s on s.id=e.season_id where s.game_year=5 and c.code='elite' and e.status<>'cancelled' group by t.season_day_id)x) max_elite_per_day,
    (select count(*)::int from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id join public.seasons s on s.id=e.season_id where s.game_year=5 and r.slug~'^local-[a-z]{2}-classic-2$' and t.profile_variant='hilly_cobbles') local_hybrids,
    (select count(*)::int from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id join public.seasons s on s.id=e.season_id where s.game_year=5 and r.slug='arctic-endurance-classic' and t.profile_variant='hilly_cobbles') arctic_labeled
  `)[0];
  assert.deepEqual(check,{j1:0,max_elite_per_day:2,local_hybrids:56,arctic_labeled:1});
  const distribution=ro(`select c.code category,count(*)::int hybrid_stages from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id join public.race_categories c on c.id=e.race_category_id where s.game_year=5 and t.profile_variant='hilly_cobbles' group by c.code order by c.code`);
  assert.equal(distribution.length,6);
  const response=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
  const proof={checkedAt:new Date().toISOString(),recorded:true,databaseHealthy:true,publicHttp:response.status,protectedDataPreserved:true,routes,check,distribution};
  writeFileSync(path.join(directory,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}
