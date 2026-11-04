// Called only by the isolated PostgreSQL calendar suite. No network or credentials.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';

export async function validateHybridCalendar({db,read,def,s4,s5,s6,dump}) {
  const migration=read('20261104160000_expand_s5_hilly_cobbled_calendar');
  await db.query("update seasons set status='planned' where id=$1",[s5]);
  await db.exec('alter table seasons add column current_day_number integer default 0;');
  const local=read('20260930150000_create_s4_local_race_circuit');
  await db.exec(local.slice(local.indexOf('create table if not exists private.local_race_country_catalog'),local.indexOf('create or replace function private.find_free_standard_race_start_day')));
  await db.exec(def(local,'private.ensure_local_race_calendar_for_country'));
  // Keep the already deployed typed-catalog fix when testing a new country.
  await db.exec(read('20261005200000_fix_local_calendar_country_fallback'));
  // Public route witnesses, including Arctic's true combination of hills/paving.
  const arctic=JSON.parse(read('20260825110000_add_team_time_trials_and_varied_profiles')
    .match(/\('arctic-289', 'road', 'hilly',\s*'(\[[^']+\])'/)[1]);
  const arcticId=(await db.query(`select t.id from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.slug='arctic-endurance-classic'`,[s5])).rows[0].id;
  await db.query('delete from stage_segments where stage_id=$1',[arcticId]);
  for(const [i,x]of arctic.entries())await db.query('insert into stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)values($1,$2,$3,$4,$5,$6)',[arcticId,i+1,x.d,x.t,x.s??'asphalt',x.g??0]);
  // Include real already selective routes, not only generic fixture segments.
  const cobbled=JSON.parse(readFileSync('scripts/fixtures/s5-cobbled-profile-baseline.json','utf8'));
  for(const source of cobbled.filter(r=>r.competition==='standard'&&r.type==='road')){
    const row=(await db.query(`select t.id from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.slug=$2 and t.stage_number=$3`,[s5,source.slug,source.stage])).rows[0];
    if(!row)continue;
    await db.query('delete from stage_segment_primes where stage_segment_id in(select id from stage_segments where stage_id=$1)',[row.id]);
    await db.query('delete from stage_segments where stage_id=$1',[row.id]);
    for(const [i,x]of source.segments.entries())await db.query('insert into stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)values($1,$2,$3,$4,$5,$6)',[row.id,i+1,...x]);
  }
  await db.query('select private.apply_s5_cobbled_profiles($1)',[s5]);
  const protectedS4=await dump(`select t.*,e.registration_closes_at,e.withdrawal_closes_at,e.wildcard_closes_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`);
  const protectedSegments=await dump(`select x.* from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by x.id`);
  const oldStages=await dump(`select t.id,t.race_edition_id,t.stage_number,t.profile_type,t.stage_type,t.distance_km,t.season_day_id,t.day_slot,t.departure_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s5}' order by t.id`);
  const ids=(await db.query('select t.id from stages t join race_editions e on e.id=t.race_edition_id where e.season_id=$1 order by t.id',[s5])).rows.map(r=>r.id);
  const entries=await dump('select * from race_registrations order by id');
  const rosters=await dump('select * from race_rosters order by id');
  const roles=await dump('select * from race_roster_stage_roles order by id');
  const deadlines=await dump(`select id,registration_closes_at,withdrawal_closes_at,wildcard_closes_at from race_editions where season_id='${s5}' order by id`);
  const expectedLocal=(await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.slug~'^local-[a-z]{2}-classic-2$'`,[s5])).rows[0].n;
  await db.exec(migration);
  const newRoutes=async season=>(await db.query(`select r.slug,c.code category,d.day_number,t.day_slot,t.distance_km,t.profile_type,t.profile_variant,e.field_limit,
    (e.registration_closes_at at time zone 'Europe/Paris')::time registration_time,
    (e.wildcard_closes_at at time zone 'Europe/Paris')::time wildcard_time,t.id,
    jsonb_agg(jsonb_build_array(x.distance_km,x.terrain_type,x.surface_type,x.average_gradient_pct)order by x.segment_number) segments
    from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id
    join race_categories c on c.id=e.race_category_id join season_days d on d.id=t.season_day_id
    join private.s5_hybrid_classic_plan() p on p.slug=r.slug join stage_segments x on x.stage_id=t.id
    where e.season_id=$1 group by r.id,c.id,d.id,t.id,e.id order by c.code`,[season])).rows;
  const newRaceRows=await newRoutes(s5);
  assert.equal(newRaceRows.length,5);
  assert.equal(new Set(newRaceRows.map(r=>r.category)).size,5);
  for(const r of newRaceRows){
    assert.equal(r.profile_variant,'hilly_cobbles');assert.equal(r.profile_type,'hilly');
    assert.ok(r.day_number>1);assert.equal(r.registration_time,r.day_slot==='early'?'08:00:00':'12:00:00');
    assert.equal(r.segments.reduce((s,x)=>s+x[0],0),Number(r.distance_km));
    assert.ok(r.segments.filter(x=>x[1]==='climb').length>=5);
    assert.ok(r.segments.filter(x=>x[2]==='cobbles').reduce((s,x)=>s+x[0],0)>=20);
    assert.ok(r.segments.filter(x=>x[1]==='climb').every(x=>x[0]<=3&&x[3]<=7));
    assert.equal(r.segments.at(-1)[1],'flat');
    assert.equal(r.field_limit,['continental','national'].includes(r.category)?30:24);
    if(r.category==='elite'){assert.equal(r.day_number,28);assert.equal(r.day_slot,'early');assert.equal(r.wildcard_time,'14:00:00');}
  }
  const hybridLocal=(await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id where e.season_id=$1 and c.code='local' and t.profile_variant='hilly_cobbles'`,[s5])).rows[0].n;
  assert.equal(hybridLocal,expectedLocal);
  const localCounts=await db.query(`select r.country_id,count(*)::int n from race_editions e join race_categories c on c.id=e.race_category_id join races r on r.id=e.race_id where e.season_id=$1 and c.code='local' group by r.country_id`,[s5]);
  assert.ok(localCounts.rows.every(r=>r.n===5));
  assert.equal((await db.query('select profile_variant from stages where id=$1',[arcticId])).rows[0].profile_variant,'hilly_cobbles');
  assert.equal(await dump(`select t.id,t.race_edition_id,t.stage_number,t.profile_type,t.stage_type,t.distance_km,t.season_day_id,t.day_slot,t.departure_at from stages t where id=any(array[${ids.map(id=>`'${id}'::uuid`).join(',')}]) order by t.id`),oldStages);
  assert.equal(await dump(`select id,registration_closes_at,withdrawal_closes_at,wildcard_closes_at from race_editions where season_id='${s5}' and race_id not in(select r.id from races r join private.s5_hybrid_classic_plan()p on p.slug=r.slug) order by id`),deadlines);
  assert.equal(await dump('select * from race_registrations order by id'),entries);
  assert.equal(await dump('select * from race_rosters order by id'),rosters);
  assert.equal(await dump('select * from race_roster_stage_roles order by id'),roles);
  const stable=await dump('select * from stage_segments order by id');
  const stableStages=await dump('select * from stages order by id');
  await db.exec(migration);
  assert.equal(await dump('select * from stage_segments order by id'),stable);
  assert.equal(await dump('select * from stages order by id'),stableStages);
  // Exercise the real local generator for a newly active country.
  const country=(await db.query("select id from countries where iso_alpha2='LT'")).rows[0].id;
  assert.equal((await db.query('select private.ensure_local_race_calendar_for_country($1,$2)n',[s5,country])).rows[0].n,5);
  assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.country_id=$2 and r.slug like 'local-%' and profile_variant='hilly_cobbles'`,[s5,country])).rows[0].n,1);
  assert.equal((await db.query('select private.ensure_local_race_calendar_for_country($1,$2)n',[s5,country])).rows[0].n,0);
  // Legacy cloning must add the courses even when the source is the old S4.
  await db.query('select public.provision_season_race_calendar($1,$2)',[s4,s6]);
  assert.equal((await newRoutes(s6)).length,5);
  // And re-provisioning from S5 cannot duplicate routes or lose their metadata.
  await db.query('select public.provision_season_race_calendar($1,$2)',[s5,s6]);
  assert.equal((await newRoutes(s6)).length,5);
  assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join season_days d on d.id=t.season_day_id where e.season_id=$1 and d.day_number=1`,[s6])).rows[0].n,0);
  assert.equal((await db.query(`select max(n)::int n from(select count(distinct e.id)n from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id where e.season_id=$1 and c.code='elite' group by t.season_day_id)x`,[s6])).rows[0].n,2);
  const frozen=newRaceRows[0].id;
  await db.query('insert into official_stage_simulations(stage_id)values($1)',[frozen]);
  await assert.rejects(()=>db.query('select private.apply_s5_hybrid_calendar($1)',[s5]),/frozen/);
  await db.query('delete from official_stage_simulations where stage_id=$1',[frozen]);
  await db.query("update seasons set status='active' where id=$1",[s5]);
  const active=await dump('select * from stage_segments order by id');
  await db.query('select private.apply_s5_hybrid_calendar($1)',[s5]);
  assert.equal(await dump('select * from stage_segments order by id'),active);
  assert.equal(await dump(`select t.*,e.registration_closes_at,e.withdrawal_closes_at,e.wildcard_closes_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`),protectedS4);
  assert.equal(await dump(`select x.* from stage_segments x join stages t on t.id=x.stage_id join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by x.id`),protectedSegments);
  const acl=(await db.query("select has_function_privilege('authenticated','private.apply_s5_hybrid_calendar(uuid)','execute') allowed")).rows[0];
  assert.equal(acl.allowed,false);
  const hook=(await db.query("select pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure) definition")).rows[0].definition;
  assert.equal((hook.match(/perform private.apply_s5_hybrid_calendar/g)??[]).length,1);
  writeFileSync('scripts/fixtures/s5-hybrid-classic-routes.json',JSON.stringify(newRaceRows.map(({slug,category,distance_km,segments})=>({slug,category,distance:Number(distance_km),segments}))));
  console.log(JSON.stringify({hybridCalendar:'passed',newClassics:5,localHybridClassics:hybridLocal,oldSeasonPreserved:true,entriesAndDatesPreserved:true,migrationRetry:true,newLocalCountry:true,legacyAndModernProvisioning:true,frozenAndActiveGuards:true}));
}
