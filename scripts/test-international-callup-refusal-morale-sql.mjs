// Isolated PostgreSQL/WASM; no production credentials, URL, mutation or network.
// The small baseline is a bounded export of versioned business function bodies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const modulePath=process.env.INTERNATIONAL_MORALE_SQL_TEST_MODULE??process.argv[2];
assert(modulePath,'Pass a local PGlite module path as the argument or INTERNATIONAL_MORALE_SQL_TEST_MODULE');
const baselinePath=process.env.INTERNATIONAL_MORALE_SQL_TEST_BASELINE??'scripts/fixtures/international-callup-refusal-baseline.json';
const {PGlite}=await import(pathToFileURL(modulePath).href);
const baseline=JSON.parse(readFileSync(baselinePath,'utf8')).rows;
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const migration='supabase/migrations/20261106170000_add_international_callup_refusal_morale.sql';
const read=file=>readFileSync(file,'utf8').replaceAll('\r\n','\n');
let checks=0,scenarios=0,currentCase='bootstrap';
const check=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const auth=async(user=11)=>db.query("select set_config('test.uid',$1,false)",[user===null?'':id(user)]);
const reject=async(sql,args=[])=>{
  await db.exec('savepoint expected_rejection');
  try{await assert.rejects(()=>db.query(sql,args));checks++;}
  finally{await db.exec('rollback to savepoint expected_rejection;release savepoint expected_rejection');}
};
const scenario=async(name,body)=>{
  currentCase=name;scenarios++;await db.exec('begin');
  try{await auth();await body();}finally{await db.exec('rollback');}
};
const snapshot=()=>rows(`select * from (select 'conditions' kind,to_jsonb(c) value from rider_condition_states c
  union all select 'events',to_jsonb(e) from rider_morale_events e
  union all select 'youth',to_jsonb(y) from youth_academy_riders y
  union all select 'youth_events',to_jsonb(e) from youth_rider_morale_events e
  union all select 'members',to_jsonb(m) from national_federation_selection_members m
  union all select 'legacy',to_jsonb(c) from international_championship_rider_selections c) snapshot order by kind,value::text`);
const proMorale=(rider=700)=>scalar('select morale from rider_condition_states where rider_id=$1 and season_day_id=$2',[id(rider),id(410)]).then(Number);
const youthMorale=(rider=800)=>scalar('select morale from youth_academy_riders where id=$1',[id(rider)]).then(Number);
const events=(rider=700)=>rows("select * from rider_morale_events where rider_id=$1 and source_type='international_callup_refusal' order by source_reference",[id(rider)]);
const answer=(member=3000,accept=false)=>scalar('select public.respond_to_national_federation_preselection($1,$2)',[id(member),accept]);
const legacy=(candidate=6000,accept=false)=>db.query('select public.respond_to_international_championship_selection($1,$2)',[id(candidate),accept]);
try{
  // Reuse only the minimal schema/calendar/auth fixture from the established
  // eligibility harness, never its scenarios or remote baseline loader.
  const fixture=read('scripts/test-federation-callup-eligibility-sql.mjs');
  const start=fixture.indexOf(' await db.exec(`')+' await db.exec(`'.length;
  const end=fixture.indexOf(' `);',start);
  assert(start>20&&end>start);
  const fixtureSql=fixture.slice(start,end).replace(/\$\{id\((\d+)\)\}/g,(_,n)=>id(Number(n)));
  assert(!fixtureSql.includes('${'));
  await db.exec(fixtureSql);
  await db.exec(`create schema private;
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date,unique(season_id,day_number));
    insert into season_days values('${id(410)}','${id(301)}',10,date '2030-10-10');
    alter table youth_academy_riders add column morale numeric default 60,add column updated_at timestamptz default now();
    alter table stages add column id uuid default gen_random_uuid(),add column departure_at timestamptz;
    alter table development_race_editions add column season_id uuid,add column display_name text;
    create table international_championship_nation_selections(id uuid primary key,race_edition_id uuid,country_id uuid);
    create table international_championship_rider_selections(id uuid primary key,nation_selection_id uuid,rider_id uuid,
      team_id uuid,sporting_director_id uuid,rider_rank integer,uci_points integer,overall_rating numeric,
      response_status text,is_selected boolean,selected_at timestamptz,responded_at timestamptz,created_at timestamptz default now());
    create table rider_condition_states(id uuid primary key default gen_random_uuid(),rider_id uuid,season_day_id uuid,
      form numeric default 75,fatigue integer default 0,morale numeric default 60,source text,updated_at timestamptz default now(),
      unique(rider_id,season_day_id),check(morale between 0 and 100));
    create function refill_national_federation_professional_selection(uuid,timestamptz) returns integer language sql as $$select 0$$;
    create function sync_national_federation_championship_lineup(uuid) returns integer language plpgsql as $$begin
      if current_setting('test.sync_error',true)='yes' then raise exception 'Fixture synchronization failed';end if;
      insert into public.race_rosters(race_registration_id,rider_id,status)
      select link.race_registration_id,m.professional_rider_id,'selected' from public.national_federation_selection_members m
      join public.national_federation_selection_race_links link on link.selection_list_id=m.selection_list_id
      where m.selection_list_id=$1 and m.response_status='confirmed' and m.professional_rider_id is not null
      on conflict(race_registration_id,rider_id) do update set status=excluded.status;return 0;end$$;
    create function sync_international_championship_lineup(uuid) returns void language plpgsql as $$begin
      if current_setting('test.sync_error',true)='yes' then raise exception 'Fixture synchronization failed';end if;end$$;
    create function is_rider_protected_by_stage_race_for_international_selection(uuid,uuid,timestamptz) returns boolean language sql as $$select false$$;
  `);
  const morale=read('supabase/migrations/20260927233500_reapply_persistent_rider_morale.sql');
  for(const table of ['rider_morale_events','youth_rider_morale_events']){
    const begin=morale.indexOf('create table public.'+table+' (');
    const finish=morale.indexOf('\n);',begin);
    assert(begin>0&&finish>begin);await db.exec(morale.slice(begin,finish+3));
  }
  await db.exec(`alter table rider_morale_events drop constraint rider_morale_events_source_allowed;
    alter table rider_morale_events add constraint rider_morale_events_source_allowed check(source_type in(
      'social_integration','team_tenure','stage_result','race_result','favorite_race','injury','training_overload',
      'mixed_zone_interview','academy_promotion','manual_adjustment','race_load'));`);
  for(const row of baseline)await db.exec(row.definition);
  await db.exec(`revoke all on function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) from public,anon,authenticated;
    revoke all on function public.apply_youth_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) from public,anon,authenticated;
    grant execute on function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) to service_role;
    grant execute on function public.apply_youth_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) to service_role;
    insert into riders values('${id(700)}','${id(201)}','Pro','One','active'),('${id(701)}','${id(201)}','Pro','Two','active');
    insert into rider_contracts(rider_id,team_id,status) values('${id(700)}','${id(101)}','active'),('${id(701)}','${id(101)}','active');
    insert into rider_condition_states(rider_id,season_day_id,morale) values('${id(700)}','${id(410)}',60),('${id(701)}','${id(410)}',60);
    insert into youth_academy_riders(id,country_id,team_id,birth_game_year,status,first_name,last_name,morale)
      values('${id(800)}','${id(201)}','${id(101)}',-13,'active','Junior','One',60);
    insert into national_federation_selection_slots values('world-junior-road','junior','world_championship_junior','Mondiaux juniors','Route'),
      ('nc-hills','professional','nations_cup','Nations Cup','Vallons');
  `);
  for(const [offset,slot,junior] of [[0,'cc-pro-road',false],[1,'cc-pro-itt',false],[2,'world-pro-road',false],[3,'cc-junior-road',true],[4,'world-junior-road',true],[5,'nc-hills',false]]){
    await db.query("insert into national_federation_selection_lists(id,country_id,season_id,slot_key,status,published_at,updated_at) values($1,$2,$3,$4,'pending_confirmation',now(),now())",[id(1000+offset),id(201),id(301),slot]);
    await db.query("insert into test_targets values($1,$2,$3,$4,'2030-10-23T16:00:00Z')",[id(201),id(301),slot,id(2000+offset)]);
    if(junior)await db.query("insert into development_race_editions values($1,'planned',$2,'Junior championship')",[id(2000+offset),id(301)]);
    else{
      await db.query("insert into races values($1,$2,'europe')",[id(2100+offset),slot.startsWith('world')?'world_championship':slot.startsWith('nc')?'nations_cup':'continental_championship']);
      await db.query("insert into race_editions values($1,$2,$3,'International test','planned')",[id(2000+offset),id(2100+offset),id(301)]);
      await db.query("insert into stages(race_edition_id,season_day_id,day_slot,departure_at) values($1,$2,'afternoon','2030-10-23T16:00:00Z')",[id(2000+offset),id(410)]);
      await db.query('insert into national_federation_selection_race_links values($1,$2,$3,now())',[id(1000+offset),id(2000+offset),id(4000+offset)]);
    }
    await db.query('insert into national_federation_selection_members(id,selection_list_id,owner_team_id,owner_director_id,professional_rider_id,junior_rider_id,response_status) values($1,$2,$3,$4,$5,$6,$7)',[id(3000+offset),id(1000+offset),id(101),id(1),junior?null:id(700),junior?id(800):null,'pending']);
  }
  await db.exec(`insert into international_championship_nation_selections values('${id(5000)}','${id(2000)}','${id(201)}'),('${id(5001)}','${id(2001)}','${id(201)}');
    insert into international_championship_rider_selections(id,nation_selection_id,rider_id,team_id,sporting_director_id,rider_rank,uci_points,overall_rating,response_status,is_selected)
      values('${id(6000)}','${id(5000)}','${id(700)}','${id(101)}','${id(1)}',1,100,70,'pending',true),
      ('${id(6001)}','${id(5001)}','${id(700)}','${id(101)}','${id(1)}',1,100,70,'pending',true);`);
  const oldSources=await rows("select conname,pg_get_expr(conbin,conrelid) expression from pg_constraint where conname in ('rider_morale_events_source_allowed','youth_rider_morale_events_source_allowed') order by conname");
  const before=await snapshot();await db.exec(read(migration));check(await snapshot(),before,'Installation is prospective and never penalizes historical refusals');
  const newSources=await rows("select conname,pg_get_expr(conbin,conrelid) expression from pg_constraint where conname in ('rider_morale_events_source_allowed','youth_rider_morale_events_source_allowed') order by conname");
  for(const previous of oldSources){const next=newSources.find(row=>row.conname===previous.conname);check(next.expression.includes(previous.expression),true,'New check expression contains the exact original source expression');}
  const access=await rows(`select
    not has_function_privilege('authenticated','private.apply_international_callup_refusal_morale(uuid,uuid,uuid,text,jsonb)','execute') helper_protected,
    not has_function_privilege('anon','public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)','execute') anonymous_engine_protected,
    has_function_privilege('service_role','public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)','execute') service_engine_preserved,
    not has_function_privilege('authenticated','public.apply_youth_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)','execute') youth_engine_protected`);
  check(Object.values(access[0]),[true,true,true,true],'The policy does not expose arbitrary morale writes');

  await scenario('explicit federation refusal loses ten points and explains the event',async()=>{
    check(await answer(),'declined');check(await proMorale(),50);const history=await events();check(history.length,1);
    check(Number(history[0].requested_delta),-10);check(Number(history[0].applied_delta),-10);
    check(history[0].source_reference,'international-callup:'+id(2000));check(history[0].description.length>0,true);
    check(await youthMorale(),60);
  });
  await scenario('separate road and time-trial refusals stack',async()=>{await answer();await answer(3001);check(await proMorale(),40);check((await events()).length,2);});
  await scenario('different international competitions stack',async()=>{await answer();await answer(3002);await answer(3005);check(await proMorale(),30);check((await events()).length,3);});
  await scenario('repeated refusal is rejected without a second debit',async()=>{await answer();const saved=await snapshot();await reject('select respond_to_national_federation_preselection($1,false)',[id(3000)]);check(await snapshot(),saved);});
  await scenario('a recreated callup for the same edition does not double-charge',async()=>{
    await answer();await db.query("update national_federation_selection_members set response_status='pending',responded_at=null where id=$1",[id(3000)]);
    await answer();check(await proMorale(),50);check((await events()).length,1);
  });
  await scenario('legacy refusal uses the same permanent morale event',async()=>{await legacy();check(await proMorale(),50);check((await events()).length,1);});
  await scenario('legacy and federation representations of one race debit only once',async()=>{await answer();await legacy();check(await proMorale(),50);check((await events()).length,1);});
  await scenario('bulk legacy refusal stacks distinct races',async()=>{
    const decisions=[6000,6001].map(n=>({candidateId:id(n),accept:false,acknowledgedConflicts:[]}));
    check(Number(await scalar('select respond_to_international_selections_with_conflict_ack($1::jsonb)',[JSON.stringify(decisions)])),2);
    check(await proMorale(),40);check((await events()).length,2);
  });
  await scenario('junior refusal updates the academy and its own history',async()=>{
    check(await answer(3003),'declined');check(await youthMorale(),50);check(await proMorale(),60);
    const history=await rows("select * from youth_rider_morale_events where academy_rider_id=$1 and source_type='international_callup_refusal'",[id(800)]);
    check(history.length,1);check(Number(history[0].applied_delta),-10);
    await answer(3004);check(await youthMorale(),40);
  });
  await scenario('junior morale has the same zero floor',async()=>{await db.query('update youth_academy_riders set morale=4 where id=$1',[id(800)]);await answer(3003);check(await youthMorale(),0);const event=(await rows('select requested_delta,applied_delta from youth_rider_morale_events where academy_rider_id=$1',[id(800)]))[0];check(Number(event.requested_delta),-10);check(Number(event.applied_delta),-4);});
  await scenario('acceptance never incurs a refusal penalty',async()=>{check(await answer(3000,true),'confirmed');check(await proMorale(),60);check((await events()).length,0);});
  await scenario('automatic expiration is not a manager refusal',async()=>{await db.exec("update national_federation_selection_members set response_status='declined',responded_at=now() where response_status='pending';update international_championship_rider_selections set response_status='declined',responded_at=now();");check(await proMorale(),60);check(await youthMorale(),60);check((await events()).length,0);});
  await scenario('invalidated injury callup is not a refusal',async()=>{await db.query("insert into rider_injuries values($1,'active','2030-10-01','2030-11-01')",[id(700)]);check(await answer(),'ineligible');check(await proMorale(),60);check((await events()).length,0);});
  await scenario('morale floors at zero but retains the requested debit',async()=>{await db.query('update rider_condition_states set morale=5 where rider_id=$1',[id(700)]);await answer();check(await proMorale(),0);const history=await events();check(Number(history[0].requested_delta),-10);check(Number(history[0].applied_delta),-5);await answer(3001);check(await proMorale(),0);check((await events()).length,2);});
  await scenario('unauthorized director cannot refuse or debit morale',async()=>{await auth(12);const saved=await snapshot();await reject('select respond_to_national_federation_preselection($1,false)',[id(3000)]);check(await snapshot(),saved);await reject('select respond_to_international_championship_selection($1,false)',[id(6000)]);check(await snapshot(),saved);});
  await scenario('closed response window is atomic',async()=>{await db.exec("select set_config('test.closed','yes',true)");const saved=await snapshot();await reject('select respond_to_national_federation_preselection($1,false)',[id(3000)]);check(await snapshot(),saved);});
  await scenario('failure after explicit refusal rolls back its morale and history',async()=>{await db.exec("select set_config('test.sync_error','yes',true)");const saved=await snapshot();await reject('select respond_to_national_federation_preselection($1,false)',[id(3000)]);check(await snapshot(),saved);await reject('select respond_to_international_championship_selection($1,false)',[id(6000)]);check(await snapshot(),saved);});
  await scenario('a missing active season day never commits a refusal without its morale event',async()=>{await db.exec('delete from season_days');const saved=await snapshot();await reject('select respond_to_national_federation_preselection($1,false)',[id(3000)]);check(await snapshot(),saved);});
  await scenario('existing race-load sources remain permitted',async()=>{await db.query('select apply_rider_morale_event($1,$2,$3,$4,-1,$5)',[id(700),id(410),'race_load','existing-race-load','Existing race-load source']);check(await proMorale(),59);check((await events()).length,0);});
  await scenario('existing junior development-result sources remain permitted',async()=>{await db.query('select apply_youth_rider_morale_event($1,$2,$3,$4,-1,$5)',[id(800),id(410),'development_result','existing-development-result','Existing development result']);check(await youthMorale(),59);check(Number(await scalar('select count(*) from youth_rider_morale_events where source_type=$1',['international_callup_refusal'])),0);});
  console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionData:false,multiSessionConcurrency:false}));
}catch(error){console.error(JSON.stringify({ok:false,scenario:currentCase,checks,error:error.message,where:error.where,detail:error.detail}));process.exitCode=1;}
finally{await db.close();}
