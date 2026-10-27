// Isolated PostgreSQL only. Calendar fixture contains public race data, no players.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite }=await import(pathToFileURL(process.env.LOCAL_CALENDAR_SQL_TEST_MODULE || 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r\n','\n');
const def=(source,name)=>{const start=source.indexOf(`create or replace function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',start)+3);};
const old=read('20260722220000_compact_stage_races_into_half_days');
const intl=read('20260904016000_separate_s3_international_and_elite_calendar');
const spacing=read('20260925153000_space_same_country_standard_races');
const opening=read('20261009190000_reserve_future_season_opening_day');
const local=read('20260930150000_create_s4_local_race_circuit');
const source=read('20261027160000_expand_s5_elite_calendar');
const baseline=JSON.parse(readFileSync('scripts/fixtures/s5-standard-calendar-baseline.json','utf8'));
await db.exec(`
  create schema private; create role anon; create role authenticated; create role service_role;
  create table seasons(id uuid primary key default gen_random_uuid(),game_year integer unique,status text);
  create table countries(id uuid primary key default gen_random_uuid(),iso_alpha2 text unique,name text);
  create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid references seasons,day_number integer,calendar_date date,unique(season_id,day_number));
  create table race_categories(id uuid primary key default gen_random_uuid(),code text unique);
  create table races(id uuid primary key default gen_random_uuid(),country_id uuid references countries,name text,short_name text,slug text unique,race_format text,status text,competition_type text,championship_continent_code text,is_monument boolean,is_grand_tour boolean);
  create table race_editions(id uuid primary key default gen_random_uuid(),race_id uuid references races,season_id uuid references seasons,race_category_id uuid references race_categories,edition_number integer,display_name text,status text,minimum_reputation numeric,registration_policy text,field_limit integer,registration_closes_at timestamptz,withdrawal_closes_at timestamptz,wildcard_closes_at timestamptz,unique(race_id,season_id));
  create table stages(id uuid primary key default gen_random_uuid(),race_edition_id uuid references race_editions,season_day_id uuid references season_days,stage_number integer,name text,stage_type text,distance_km numeric,status text,departure_at timestamptz,profile_type text,day_slot text,unique(race_edition_id,stage_number),constraint stages_day_slot_unique unique(race_edition_id,season_day_id,day_slot) deferrable initially deferred);
  create index on race_editions(season_id);create index on stages(season_day_id);create index on stages(race_edition_id);
  create table stage_segments(id uuid primary key default gen_random_uuid(),stage_id uuid references stages,segment_number integer,distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric,unique(stage_id,segment_number));
  create table stage_segment_primes(stage_segment_id uuid references stage_segments,prime_type text,mountain_category text,points_scale smallint[],unique(stage_segment_id,prime_type));
  create table stage_results(stage_id uuid references stages);
  create table official_stage_simulations(stage_id uuid references stages);
  create table national_federation_race_projects(id uuid primary key default gen_random_uuid(),race_id uuid,status text,stage_blueprint jsonb,start_day_number integer,start_day_slot text);
  create table national_federation_selection_slots(day_number smallint,active_from_game_year integer,competition_code text,rider_category text,profile_label text);
  insert into national_federation_selection_slots values(15,3,'continental_championship','professional','Route'),(15,3,'continental_championship','professional','Chrono'),(24,3,'nations_cup','professional','Route'),(26,3,'world_championship','professional','Route'),(26,3,'world_championship','professional','Chrono');
  create table season_events(season_day_id uuid,event_type text,title text,description text,href text,is_filter_persistent boolean,participation_rule text,unique(season_day_id,event_type));
  create table race_registrations(id uuid primary key default gen_random_uuid(),race_edition_id uuid references race_editions,status text);
  create table race_rosters(id uuid primary key default gen_random_uuid(),race_registration_id uuid references race_registrations,race_role text);
  create table race_roster_stage_roles(id uuid primary key default gen_random_uuid(),stage_id uuid references stages,race_roster_id uuid references race_rosters,race_role text);
  insert into seasons(game_year,status) values(4,'active'),(5,'planned'),(6,'planned'),(7,'planned');
  insert into season_days(season_id,day_number,calendar_date) select s.id,n,date '2026-10-09'+(s.game_year-4)*28+n-1 from seasons s cross join generate_series(1,28)n where s.game_year<=6;
`);
// Reuse the real objective catalog DDL so schema/name drift cannot be hidden by
// a simplified test table. Its unrelated item catalogs need only their keys.
await db.exec('create table inventory_catalog_items(item_key text primary key);create table equipment_catalog_items(catalog_key text primary key);');
const objectiveSource=read('20260722170000_create_game_objectives');
const objectiveStart=objectiveSource.indexOf('create table public.game_objective_definitions (');
await db.exec(objectiveSource.slice(objectiveStart,objectiveSource.indexOf('\n);',objectiveStart)+4));
await db.exec(`insert into game_objective_definitions(objective_key,objective_type,objective_group,title,description,metric_key,target_value,reward_cash,display_order)
  values('all_monuments_won','secondary','monuments','Le pentacle des classiques','Gagner cinq Monuments.','distinct_monument_wins',5,250000,1140);`);
await db.query(`insert into countries(iso_alpha2,name) select distinct value,value from jsonb_array_elements_text($1)`,[JSON.stringify([...new Set([...baseline.map(r=>r.country),'TN','HU','SI','CH','BE'])])]);
await db.query(`insert into race_categories(code) select distinct value from jsonb_array_elements_text($1)`,[JSON.stringify([...new Set(baseline.map(r=>r.category))])]);
await db.query(`insert into races(country_id,name,short_name,slug,race_format,status,competition_type,is_monument,is_grand_tour)
  select c.id,r->>'name',r->>'name',r->>'slug',r->>'format','active','standard',(r->>'monument')::boolean,(r->>'grandTour')::boolean
  from jsonb_array_elements($1)r join countries c on c.iso_alpha2=r->>'country'`,[JSON.stringify(baseline)]);
await db.exec(`insert into race_editions(race_id,season_id,race_category_id,edition_number,display_name,status,minimum_reputation,registration_policy,field_limit)
  select r.id,s.id,c.id,s.game_year,r.name,'registration_open',0,'open',24 from races r cross join seasons s cross join race_categories c
  where s.game_year in(4,5) and c.code='elite';`);
// Correct each baseline category before installing any triggers.
for(const race of baseline) await db.query(`update race_editions set race_category_id=(select id from race_categories where code=$2) where race_id=(select id from races where slug=$1)`,[race.slug,race.category]);
await db.query(`insert into stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
  select e.id,d.id,n::integer,'Étape '||n,stage->>3,(stage->>4)::numeric,'planned',
    (d.calendar_date::timestamp+case stage->>1 when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris',stage->>2,stage->>1
  from jsonb_array_elements($1)r cross join lateral jsonb_array_elements(r->'stages') with ordinality t(stage,n)
  join races race on race.slug=r->>'slug' join race_editions e on e.race_id=race.id
  join season_days d on d.season_id=e.season_id and d.day_number=(stage->>0)::integer`,[JSON.stringify(baseline)]);
await db.exec(def(read('20260930160000_expand_and_diversify_s4_calendar'),'private.rebuild_standard_stage_segments'));
await db.exec(`do $$declare r record;begin for r in select id from stages loop perform private.rebuild_standard_stage_segments(r.id);end loop;end$$;`);
await db.exec(def(intl,'public.enforce_international_elite_stage_calendar'));
await db.exec(def(intl,'public.refresh_schedule_dependent_edition_deadlines'));
await db.exec(def(spacing,'private.standard_race_country_overlap_allowed'));
await db.exec(def(spacing,'private.enforce_standard_race_country_spacing'));
await db.exec(def(local,'private.find_free_standard_race_start_day').replace('generate_series(1, 29 - p_duration)','generate_series(2, 29 - p_duration)'));
await db.exec(def(opening,'private.reserve_future_season_opening_day'));
await db.exec(def(opening,'private.enforce_future_season_opening_day'));
await db.exec(def(old,'public.compact_planned_stage_races'));
await db.exec(def(read('20260911093000_restore_standard_race_registration_deadlines'),'public.repair_missing_standard_race_deadlines'));
await db.exec(def(old,'public.provision_season_race_calendar').replace('  perform public.compact_planned_stage_races(p_target_season_id);',`  perform private.reserve_future_season_opening_day(p_target_season_id);
  perform public.compact_planned_stage_races(p_target_season_id);
  perform public.repair_missing_standard_race_deadlines(p_target_season_id);`));
for(const [migration,names] of [
  ['20260726140000_create_elite_wildcard_workflow',['public.configure_elite_race_edition','public.refresh_elite_wildcard_deadline']],
  ['20260726150000_expand_national_continental_fields',['public.enforce_standard_race_field_limit']],
  ['20260727200000_open_continental_and_world_races_by_reputation',['public.configure_standard_race_reputation_threshold']],
  ['20260914100000_rebuild_federation_race_workflow',['private.prevent_cancelled_federation_race_edition','private.preserve_federation_race_stage_schedule']],
  ['20261026160000_s5_international_championship_quotas',['public.set_s5_championship_field_limit']],
])for(const name of names)await db.exec(def(read(migration),name));
await db.exec(`
  create trigger configure_elite_race_edition_trigger before insert or update of race_category_id,registration_policy,minimum_reputation on race_editions for each row execute function configure_elite_race_edition();
  create trigger configure_standard_race_reputation_threshold_trigger before insert or update of race_id,race_category_id,registration_policy,minimum_reputation on race_editions for each row execute function configure_standard_race_reputation_threshold();
  create trigger race_editions_standard_field_limit before insert or update of race_id,race_category_id,field_limit on race_editions for each row execute function enforce_standard_race_field_limit();
  create trigger set_s5_championship_field_limit before insert or update of race_id,season_id,field_limit on race_editions for each row execute function set_s5_championship_field_limit();
  create trigger prevent_cancelled_federation_race_edition before insert on race_editions for each row execute function private.prevent_cancelled_federation_race_edition();
  create trigger preserve_federation_race_stage_schedule before insert or update on stages for each row execute function private.preserve_federation_race_stage_schedule();
  create trigger refresh_elite_wildcard_deadline_trigger after insert or update of race_edition_id,season_day_id,departure_at,day_slot or delete on stages for each row execute function refresh_elite_wildcard_deadline();
  create trigger international_calendar before insert or update of race_edition_id,season_day_id,departure_at,day_slot,stage_type on stages for each row execute function enforce_international_elite_stage_calendar();
  create trigger edition_deadlines after insert or update of race_edition_id,season_day_id,departure_at,day_slot,stage_type or delete on stages for each row execute function refresh_schedule_dependent_edition_deadlines();
  create constraint trigger enforce_standard_race_country_spacing after insert or update of race_edition_id,season_day_id on stages deferrable initially deferred for each row execute function private.enforce_standard_race_country_spacing();
  create constraint trigger enforce_future_season_opening_day after insert or update on stages deferrable initially deferred for each row execute function private.enforce_future_season_opening_day();
  insert into race_registrations(race_edition_id,status) select e.id,'accepted' from race_editions e join seasons s on s.id=e.season_id where s.game_year=5;
  insert into race_rosters(race_registration_id,race_role) select id,'leader' from race_registrations;
  insert into race_roster_stage_roles(stage_id,race_roster_id,race_role) select t.id,rr.id,'leader' from stages t join race_registrations r on r.race_edition_id=t.race_edition_id join race_rosters rr on rr.race_registration_id=r.id;
`);
const season=async year=>(await db.query('select id from seasons where game_year=$1',[year])).rows[0].id;
const s4=await season(4),s5=await season(5);
const dump=async sql=>JSON.stringify((await db.query(sql)).rows);
const oldState=await dump(`select t.*,e.registration_closes_at,e.withdrawal_closes_at,e.wildcard_closes_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`);
const entries=await dump('select * from race_registrations order by id');
const rosters=await dump('select * from race_rosters order by id');
const preparations=await dump('select * from race_roster_stage_roles order by id');
const stageIds=await dump(`select t.id,t.stage_type,t.profile_type,t.distance_km from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s5}' order by t.id`);
const segments=await dump('select * from stage_segments order by id');
await db.exec(source);
assert.equal(await dump(`select t.*,e.registration_closes_at,e.withdrawal_closes_at,e.wildcard_closes_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`),oldState,'S4 unchanged');
assert.equal(await dump('select * from race_registrations order by id'),entries);
assert.equal(await dump('select * from race_rosters order by id'),rosters);
assert.equal(await dump('select * from race_roster_stage_roles order by id'),preparations);
const originalIds=JSON.parse(stageIds).map(r=>r.id);
assert.equal(JSON.stringify((await db.query('select id,stage_type,profile_type,distance_km from stages where id=any($1::uuid[]) order by id',[originalIds])).rows),stageIds,'Existing stage IDs and profiles unchanged');
assert.equal(await dump(`select * from stage_segments where stage_id=any(array[${originalIds.map(id=>`'${id}'::uuid`).join(',')}]) or stage_id in(select t.id from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}') order by id`),segments,'Existing detailed profiles unchanged');
const check=async id=>{
  const races=(await db.query(`select r.slug,r.is_monument,r.race_format,count(t.id)::int stages,min(d.day_number)::int first,max(d.day_number)::int last,min(e.field_limit)::int capacity from race_editions e join races r on r.id=e.race_id join race_categories c on c.id=e.race_category_id join stages t on t.race_edition_id=e.id join season_days d on d.id=t.season_day_id where e.season_id=$1 and c.code='elite' group by r.id order by r.slug`,[id])).rows;
  assert.equal(races.length,24);assert.equal(races.reduce((n,r)=>n+r.stages,0),74);
  assert.equal(races.filter(r=>r.race_format==='stage_race').length,7);assert.equal(races.filter(r=>r.is_monument).length,6);
  assert.deepEqual((await db.query(`select t.profile_type,count(*)::int n from race_editions e join races r on r.id=e.race_id join stages t on t.race_edition_id=e.id where e.season_id=$1 and r.is_monument group by t.profile_type order by t.profile_type`,[id])).rows,[{profile_type:'cobbles',n:3},{profile_type:'hilly',n:3}]);
  assert.deepEqual((await db.query(`select t.profile_type,count(*)::int n from race_editions e join race_categories c on c.id=e.race_category_id join races r on r.id=e.race_id join stages t on t.race_edition_id=e.id where e.season_id=$1 and c.code='elite' and r.race_format='one_day' group by t.profile_type order by t.profile_type`,[id])).rows,[{profile_type:'cobbles',n:3},{profile_type:'hilly',n:5},{profile_type:'mountain',n:4},{profile_type:'sprint',n:4},{profile_type:'time_trial',n:1}]);
  const plan=(await db.query('select * from private.s5_elite_calendar_plan()')).rows;
  for(const p of plan){const r=races.find(r=>r.slug===p.slug);assert.equal(r.first,p.start_day,p.slug);assert.equal(r.last,p.start_day+Math.floor((p.stage_count-1)/2),p.slug);assert.equal(r.stages,p.stage_count,p.slug);assert.equal(r.capacity,24);}
  assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id join season_days d on d.id=t.season_day_id where e.season_id=$1 and c.code='elite' and d.day_number in(1,15,24,26)`,[id])).rows[0].n,0);
  assert.ok((await db.query(`select max(n)::int n from(select count(distinct e.id)n from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id where e.season_id=$1 and c.code='elite' group by t.season_day_id)counts`,[id])).rows[0].n<=2);
  assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id join season_days d on d.id=t.season_day_id where e.season_id=$1 and c.code='elite' and (t.departure_at at time zone 'Europe/Paris')::time<>case t.day_slot when 'early' then time '14:00' else time '18:00' end`,[id])).rows[0].n,0);
  const corsa=(await db.query(`select (e.registration_closes_at at time zone 'Europe/Paris')::time cutoff,d.day_number from race_editions e join races r on r.id=e.race_id join season_days d on d.season_id=e.season_id and d.calendar_date=(e.registration_closes_at at time zone 'Europe/Paris')::date where e.season_id=$1 and r.slug='corsa-delle-regioni'`,[id])).rows[0];
  assert.deepEqual(corsa,{cutoff:'08:00:00',day_number:2});
};
await check(s5);
// Full migration retry must be a no-op on data, IDs, and function bodies.
const state=await dump('select * from stages order by id');
const deadlineState=await dump('select * from race_editions order by id');
await db.exec(source);
assert.equal(await dump('select * from stages order by id'),state);
assert.equal(await dump('select * from race_editions order by id'),deadlineState);
assert.deepEqual((await db.query("select title,target_value,reward_cash::integer from game_objective_definitions where objective_key='all_monuments_won'")).rows[0],{title:'Collection des classiques',target_value:5,reward_cash:250000});
// Reproduce preparation directly from the legacy S4 calendar, not only S5->S6.
const s6=await season(6);
assert.equal((await db.query('select count(*)::int n from race_editions where season_id=$1',[s6])).rows[0].n,0,'Reserved empty calendars remain untouched');
assert.equal((await db.query('select count(*)::int n from season_days d join seasons s on s.id=d.season_id where s.game_year=7')).rows[0].n,0,'Reserved season without days remains untouched');
await db.query('select public.provision_season_race_calendar($1,$2)',[s4,s6]);
await check(s6);
assert.equal(await dump(`select t.*,e.registration_closes_at,e.withdrawal_closes_at,e.wildcard_closes_at from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s4}' order by t.id`),oldState);
// Once S5 is active, a provisioning helper must never rewrite its races.
await db.exec(`update seasons set status='active' where id='${s5}'`);
const activeState=await dump(`select t.* from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s5}' order by t.id`);
await db.query('select private.apply_s5_elite_calendar($1)',[s5]);
assert.equal(await dump(`select t.* from stages t join race_editions e on e.id=t.race_edition_id where e.season_id='${s5}' order by t.id`),activeState);
// A new third Elite event must fail even if it uses the other time slot.
await assert.rejects(()=>db.exec(`begin;insert into races(name,slug,race_format,status,competition_type,is_monument,is_grand_tour) values('Third race','third-race','one_day','active','standard',false,false);
  insert into race_editions(race_id,season_id,race_category_id,edition_number,display_name,status)select r.id,'${s5}',c.id,5,r.name,'registration_open' from races r,race_categories c where r.slug='third-race' and c.code='elite';
  insert into stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)select e.id,d.id,1,'Third race','road',180,'planned',d.calendar_date::timestamptz,'sprint','early' from race_editions e join races r on r.id=e.race_id join season_days d on d.season_id=e.season_id where r.slug='third-race' and d.day_number=2;commit;`),/Deux épreuves Elite/);
await db.exec('rollback');
await assert.rejects(()=>db.exec(`begin;update stages set season_day_id=(select id from season_days where season_id='${s5}' and day_number=1) where id=(select t.id from stages t join race_editions e on e.id=t.race_edition_id join race_categories c on c.id=e.race_category_id where e.season_id='${s5}' and c.code='local' limit 1);commit;`),/J1 est réservé/);
await db.exec('rollback');
assert.equal((await db.query(`select count(*)::int n from stage_segments where distance_km<=0 or (terrain_type='flat' and average_gradient_pct<>0) or (terrain_type='climb' and average_gradient_pct<=0) or (terrain_type='descent' and average_gradient_pct>=0)`)).rows[0].n,0);
assert.equal((await db.query(`select count(*)::int n from stages t where abs(t.distance_km-(select sum(distance_km) from stage_segments where stage_id=t.id))>0.001`)).rows[0].n,0);
assert.equal((await db.query(`select count(*)::int n from stages t join race_editions e on e.id=t.race_edition_id join races r on r.id=e.race_id where e.season_id=$1 and r.slug in('tour-des-plaines','tour-des-hautes-vallees') and t.profile_type in('mountain','hilly') and not exists(select 1 from stage_segments s join stage_segment_primes p on p.stage_segment_id=s.id where s.stage_id=t.id and p.prime_type='mountain')`,[s5])).rows[0].n,0);
console.log(`Isolated SQL passed: ${baseline.length} existing races, S4 preserved, 24 Elite races / 74 stages, 7 tours, 6 Monuments, dates/slots, J1/international days, two-event cap, profiles/primes, entries and preparation, migration retry, legacy S4->S6 provisioning, Corsa 08:00.`);
await db.close();
