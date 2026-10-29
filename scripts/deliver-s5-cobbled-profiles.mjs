// Exact reviewed S5 route migration. No race simulation or player fixture.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed-migration','--verify'].includes(mode)||
 readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const require=createRequire(import.meta.url);
const bin=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261029140000',name='refine_s5_cobbled_profiles';
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const expectedRoadStages=JSON.parse(readFileSync('scripts/fixtures/s5-cobbled-profile-baseline.json','utf8'))
 .filter(stage=>stage.competition==='standard'&&stage.type==='road').length;
const query=text=>{const raw=execFileSync(bin,['db','query','--linked',text,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:150000});return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=text=>query(`begin read only;set local application_name='s5-cobbled-profiles-delivery';set local statement_timeout='5s';set local lock_timeout='500ms';${text};commit;`);
const file='.codex-tools/s5-cobbled-profiles-before.json';
const preserved=()=>ro(`select
 (select md5(string_agg(t::text,','order by t.id)) from stages t join race_editions e on e.id=t.race_edition_id join seasons s on s.id=e.season_id where s.game_year in(4,5)) stages,
 (select md5(string_agg(x::text,','order by x.id))from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id join seasons s on s.id=e.season_id join races r on r.id=e.race_id where s.game_year=4 or(s.game_year=5 and(r.competition_type<>'standard' or t.stage_type<>'road' or t.profile_type<>'cobbles'))) protected_segments,
 (select md5(string_agg(e::text,','order by e.id))from race_editions e join seasons s on s.id=e.season_id where s.game_year in(4,5)) editions,
 (select md5(string_agg(z::text,','order by z.id))from race_registrations z join race_editions e on e.id=z.race_edition_id join seasons s on s.id=e.season_id where s.game_year=5) registrations,
 md5(pg_get_functiondef('public.get_federation_selection_rider_limit(uuid,uuid,text)'::regprocedure)) federation_quotas`)[0];
// Explicit fields exclude the new nullable presentation column from the check.
const stageFingerprint=()=>ro(`select md5(string_agg(t.id::text||t.race_edition_id||t.stage_number||t.stage_type||t.profile_type||t.distance_km||t.status||t.season_day_id||t.day_slot||coalesce(t.departure_at::text,'')||t.name,','order by t.id)) fingerprint from stages t join race_editions e on e.id=t.race_edition_id join seasons s on s.id=e.season_id where s.game_year in(4,5)`)[0].fingerprint;
const receipt=ro(`select name from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0]?.name;
if(receipt&&receipt!==name)throw Error('Migration version collision');
const before={...preserved(),stages:stageFingerprint()};
if(mode==='--preflight'){
 const readiness=ro(`select s.game_year,s.status,count(t.id)::int cobbled_stages,
 count(t.id)filter(where t.status<>'planned' or exists(select 1 from official_stage_simulations f where f.stage_id=t.id)or exists(select 1 from stage_results z where z.stage_id=t.id))::int frozen
 from seasons s join race_editions e on e.season_id=s.id join stages t on t.race_edition_id=e.id
 join races r on r.id=e.race_id where s.game_year=5 and r.competition_type='standard'and t.profile_type='cobbles'and t.stage_type='road'group by s.id`)[0];
 assert.equal(readiness.status,'planned');assert.equal(readiness.cobbled_stages,expectedRoadStages);assert.equal(readiness.frozen,0);
 if(!receipt)writeFileSync(file,JSON.stringify(before));
 console.log(JSON.stringify({databaseRead:'ok',alreadyInstalled:!!receipt,readiness,baselineSaved:!receipt}));
}else{
 if(mode==='--apply-reviewed-migration'&&!receipt){
  assert.ok(existsSync(file),'Run the read-only preflight first');
  assert.deepEqual(before,JSON.parse(readFileSync(file,'utf8')),'Calendar changed after preflight');
  const delivery='.codex-tools/s5-cobbled-profiles-reviewed.sql';
  const receiptSql=`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`;
  writeFileSync(delivery,sql.replace(/commit;\s*$/i,()=>receiptSql));
  execFileSync(bin,['db','query','--linked','--file',delivery,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:150000});
 }
 assert.equal(ro(`select name from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0]?.name,name);
 const after={...preserved(),stages:stageFingerprint()};
 assert.deepEqual(after,existsSync(file)?JSON.parse(readFileSync(file,'utf8')):before,'Protected calendar or entries changed');
 const check=ro(`select
 count(*)filter(where t.profile_variant='selective_cobbles')::int selective,
 count(*)filter(where t.profile_variant='sprint_cobbles')::int sprint,
 count(*)filter(where t.distance_km<>(select sum(x.distance_km)from stage_segments x where x.stage_id=t.id))::int inconsistent_distance,
 (select count(*)::int from stages old join race_editions e2 on e2.id=old.race_edition_id join seasons s2 on s2.id=e2.season_id where s2.game_year=4 and old.profile_variant is not null) s4_annotations,
 position('apply_s5_cobbled_profiles' in pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure))>0 automatic_provisioning,
 position('remove_obsolete_cloned_stage_segments' in pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure))>0 obsolete_clone_guard
 from stages t join race_editions e on e.id=t.race_edition_id join seasons s on s.id=e.season_id where s.game_year=5 and t.profile_type='cobbles'`)[0];
 assert.deepEqual(check,{selective:14,sprint:7,inconsistent_distance:0,s4_annotations:0,automatic_provisioning:true,obsolete_clone_guard:true});
 console.log(JSON.stringify({databaseRead:'ok',migrationRecorded:true,currentSeasonAndEntriesPreserved:true,check,simulationRun:false}));
}
