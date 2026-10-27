// Production delivery: exact reviewed migration only. No test fixtures or races run.
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
const version='20261027160000',name='expand_s5_elite_calendar',file=`supabase/migrations/${version}_${name}.sql`;
const call=args=>{try{return execFileSync(bin,args,{encoding:'utf8',timeout:30000,maxBuffer:200000});}catch(e){throw new Error(`Delivery query failed: ${e.stderr||e.code}`);}};
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='s5-elite-calendar-delivery';${sql};commit;`;
const receipt=()=>query(ro(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`))[0]?.name;
const preserved=()=>query(ro(`select
  (select md5(string_agg(t.id::text||t.season_day_id||t.stage_number||t.day_slot||t.departure_at||t.stage_type||t.profile_type||t.distance_km,',' order by t.id))
    from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.seasons s on s.id=e.season_id where s.game_year=4) s4_calendar,
  (select md5(string_agg(e.id::text||coalesce(e.registration_closes_at::text,'')||coalesce(e.withdrawal_closes_at::text,'')||coalesce(e.wildcard_closes_at::text,''),',' order by e.id))
    from public.race_editions e join public.seasons s on s.id=e.season_id where s.game_year=4) s4_deadlines,
  md5(pg_get_functiondef('public.get_federation_selection_rider_limit(uuid,uuid,text)'::regprocedure)) selection_quotas,
  md5(pg_get_functiondef('public.freeze_due_international_nation_qualifications(timestamptz)'::regprocedure)) international_qualification
`))[0];
const summary=()=>query(ro(`select s.id,s.game_year,s.status,count(distinct e.id) filter(where c.code='elite')::int elite_races,
  count(t.id) filter(where c.code='elite')::int elite_stages,
  count(distinct e.id) filter(where c.code='elite' and r.race_format='stage_race')::int elite_tours,
  count(distinct e.id) filter(where c.code='elite' and r.is_monument)::int monuments,
  count(t.id) filter(where d.day_number=1)::int all_j1_stages,
  count(t.id) filter(where c.code='elite' and d.day_number in(15,24,26))::int elite_international_days
  from public.seasons s left join public.race_editions e on e.season_id=s.id and e.status<>'cancelled'
  left join public.races r on r.id=e.race_id left join public.race_categories c on c.id=e.race_category_id
  left join public.stages t on t.race_edition_id=e.id and t.status<>'cancelled' left join public.season_days d on d.id=t.season_day_id
  where s.game_year=5 group by s.id limit 1`))[0];
const verify=()=>{
  const s=summary();assert.equal(s.status,'planned');assert.equal(s.elite_races,24);assert.equal(s.elite_stages,74);
  assert.equal(s.elite_tours,7);assert.equal(s.monuments,6);assert.equal(s.all_j1_stages,0);assert.equal(s.elite_international_days,0);
  const checks=query(ro(`select
    (select max(n)::int from(select count(distinct e.id)n from public.stages t join public.race_editions e on e.id=t.race_edition_id
      join public.race_categories c on c.id=e.race_category_id where e.season_id='${s.id}' and c.code='elite' and e.status<>'cancelled' and t.status<>'cancelled' group by t.season_day_id)days) max_per_day,
    (select count(*)::int from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id
      join private.s5_elite_calendar_plan()p on p.slug=r.slug join public.season_days d on d.id=t.season_day_id
      where e.season_id='${s.id}' and (d.day_number<>p.start_day+case when p.stage_count>1 then (t.stage_number-1)/2 else 0 end
        or t.day_slot<>case when p.stage_count=1 then p.first_slot when mod(t.stage_number-1,2)=0 then 'early' else 'late' end)) wrong_dates,
    (select to_char(e.registration_closes_at at time zone 'Europe/Paris','YYYY-MM-DD HH24:MI') from public.race_editions e join public.races r on r.id=e.race_id where e.season_id='${s.id}' and r.slug='corsa-delle-regioni') corsa_closes,
    (select count(*)::int from public.stages t join public.race_editions e on e.id=t.race_edition_id join public.races r on r.id=e.race_id
      join private.s5_elite_calendar_plan()p on p.slug=r.slug where e.season_id='${s.id}' and p.profiles is not null
      and (not exists(select 1 from public.stage_segments x where x.stage_id=t.id)
        or t.distance_km<>(select sum(x.distance_km) from public.stage_segments x where x.stage_id=t.id))) incomplete_profiles,
    position('apply_s5_elite_calendar' in pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure))>0 automatic_preparation
  `))[0];
  assert.ok(checks.max_per_day<=2);assert.equal(checks.wrong_dates,0);assert.equal(checks.incomplete_profiles,0);assert.equal(checks.automatic_preparation,true);
  assert.equal(checks.corsa_closes,'2026-11-07 08:00');return {...s,...checks};
};
const initialReceipt=receipt(),before=preserved();
if(initialReceipt&&initialReceipt!==name)throw new Error('Migration version collision.');
if(mode==='--preflight'){
  const s=summary();assert.equal(s.status,'planned');assert.ok([17,24].includes(s.elite_races));assert.equal(s.all_j1_stages,0);
  const refs=query(ro(`select iso_alpha2 from public.countries where iso_alpha2 in('TN','HU','SI','CH','BE') order by iso_alpha2`));
  assert.equal(refs.length,5);
  const objective=query(ro("select objective_key,target_value,metric_key from public.game_objective_definitions where objective_key='all_monuments_won' limit 1"))[0];
  assert.equal(objective?.target_value,5);assert.equal(objective?.metric_key,'distinct_monument_wins');
  console.log(JSON.stringify({databaseOk:true,calendar:s,requiredCountriesFound:refs.length,alreadyInstalled:!!initialReceipt}));
}else{
  if(mode==='--apply-reviewed-migration'&&!initialReceipt){
    assert.equal(query(ro("select game_year from public.seasons where status='active' limit 1"))[0].game_year,4);
    call(['db','query','--linked','--file',file,'--output','json']);
    assert.deepEqual(preserved(),before,'S4 calendar/deadlines or international quota functions changed');
    verify();
    const sql=readFileSync(file,'utf8');
    query(`begin;set local lock_timeout='3s';set local statement_timeout='8s';insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]) on conflict(version) do nothing;commit;`);
  }
  assert.equal(receipt(),name);assert.deepEqual(preserved(),before);
  console.log(JSON.stringify({databaseOk:true,recorded:true,currentSeasonPreserved:true,internationalQuotaFunctionsPreserved:true,calendar:verify(),testOrSimulationRun:false}));
}
