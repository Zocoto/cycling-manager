// Isolated PostgreSQL equivalence checks. No network, env files or live DB.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let assertions=0,sequence=0;
const id=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
const read=f=>readFileSync(f,'utf8').replaceAll('\r','');
const migration=read('supabase/migrations/20261104150000_reduce_completed_race_recovery_work.sql');
const originalRecovery=read('supabase/migrations/20260904182500_exclude_initial_non_starters_from_race_repair.sql');
const originalLineups=read('test/fixtures/performance/federation-lineups-before.sql');
const same=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const execParams=(sql,parameters)=>db.exec(sql.replace(/\$(\d+)/g,(_,n)=>`'${String(parameters[Number(n)-1]).replaceAll("'","''")}'`));
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table seasons(id uuid primary key,status text,game_year int,current_day_number int);
    create table races(id uuid primary key,competition_type text);
    create table race_editions(id uuid primary key,race_id uuid,season_id uuid,status text);
    create table race_registrations(id uuid primary key,race_edition_id uuid,status text,team_season_id uuid);
    create table race_rosters(id uuid primary key,race_registration_id uuid,rider_id uuid,status text);
    create table stages(id uuid primary key,race_edition_id uuid,stage_number int,departure_at timestamptz);
    create table stage_results(race_roster_id uuid,stage_id uuid,status text);
    create table official_stage_simulations(stage_id uuid primary key,input_data jsonb);
    create table race_results(id uuid primary key,race_edition_id uuid,race_roster_id uuid,unique(race_edition_id,race_roster_id));
    create index on race_registrations(race_edition_id);create index on race_rosters(race_registration_id);
    create index on stages(race_edition_id,stage_number);
    create table countries(id uuid primary key,name text,iso_alpha2 text,continent_code text,is_active bool);
    create table riders(id uuid primary key,country_id uuid,status text);
    create table rider_season_ratings(rider_id uuid,season_id uuid);
    create table national_federation_selection_slots(slot_key text,competition_code text,rider_category text,active_from_game_year int,day_number int);
    create table national_federation_selection_lists(id uuid primary key,country_id uuid,season_id uuid,slot_key text,status text,updated_at timestamptz);
    create table national_federation_selection_members(selection_list_id uuid,response_status text,responded_at timestamptz);
    create table test_targets(country_id uuid,season_id uuid,slot_key text,race_edition_id uuid,departure_at timestamptz);
    create table test_trace(event text);
    create function reconcile_federation_callup_eligibility(timestamptz) returns void language sql as $$insert into public.test_trace values('reconcile')$$;
    create function ensure_professional_nations_cup(uuid) returns void language sql as $$insert into public.test_trace values('ensure')$$;
    create function freeze_due_international_nation_qualifications(timestamptz) returns void language sql as $$insert into public.test_trace values('freeze')$$;
    create function federation_selection_slot_is_available(text,int) returns bool language sql as $$select true$$;
    create function get_national_federation_callup_response_closes_at(text,text,timestamptz) returns timestamptz language sql immutable as $$select $3-case when $1='world_championship' then interval '24h' else interval '1h' end$$;
    create function get_national_federation_selection_target(uuid,uuid,text) returns table(race_edition_id uuid,departure_at timestamptz) language plpgsql as $$begin
      insert into public.test_trace values('target');return query select t.race_edition_id,t.departure_at from public.test_targets t where t.country_id=$1 and t.season_id=$2 and t.slot_key=$3;
    end$$;`);
  await db.exec(originalRecovery);
  await db.exec(originalLineups.replace('public.prepare_due_automatic_federation_professional_lineups(', 'public.prepare_lineups_before('));
  await db.exec(originalLineups);
  const originalDef=(await db.query(`select pg_get_functiondef('get_incomplete_completed_race_edition_ids(uuid)'::regprocedure) def`)).rows[0].def;
  await db.exec(originalDef.replace('public.get_incomplete_completed_race_edition_ids(', 'public.recovery_before('));
  const attrs=async()=> (await db.query(`select proname,proacl::text,proconfig,prosecdef,provolatile from pg_proc where oid=any(array['get_incomplete_completed_race_edition_ids(uuid)'::regprocedure,'prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure]) order by proname`)).rows;
  const attributes=await attrs();
  await db.exec(migration);
  same(await attrs(),attributes);
  const season=id(),otherSeason=id();
  await db.query(`insert into seasons values($1,'active',4,26),($2,'completed',3,28)`,[season,otherSeason]);
  async function edition({type='standard',status='completed',count=2,missing=[0],unavailable=[],rosterStatuses=[],registrationStatus='accepted',team=true,seasonId=season,simulation=true,outside=[],wrongOutside=[]}={}) {
    const race=id(),editionId=id(),registration=id(),stage=id(),otherStage=id(),rosters=[],riders=[];
    await db.query('insert into races values($1,$2)',[race,type]);
    await db.query('insert into race_editions values($1,$2,$3,$4)',[editionId,race,seasonId,status]);
    await db.query('insert into race_registrations values($1,$2,$3,$4)',[registration,editionId,registrationStatus,team?id():null]);
    await db.query(`insert into stages values($1,$2,1,'2026-11-01'),($3,$4,1,'2026-11-01')`,[stage,editionId,otherStage,id()]);
    for(let i=0;i<count;i++) {
      rosters.push(id());riders.push(id());
      await db.query('insert into race_rosters values($1,$2,$3,$4)',[rosters[i],registration,riders[i],rosterStatuses[i]??'selected']);
      if(!missing.includes(i)) await db.query('insert into race_results values($1,$2,$3)',[id(),editionId,rosters[i]]);
      if(outside.includes(i)||wrongOutside.includes(i))await db.query(`insert into stage_results values($1,$2,'outside_time_limit')`,[rosters[i],outside.includes(i)?stage:otherStage]);
    }
    if(simulation)await db.query('insert into official_stage_simulations values($1,$2)',[stage,JSON.stringify({unavailableRiderIds:unavailable.map(i=>riders[i])})]);
    return editionId;
  }
  const expected=[];
  expected.push(await edition()); // One missing among two counts both riders.
  await edition({missing:[]});
  await edition({count:1});
  expected.push(await edition({count:1,type:'national_road'}));
  await edition({unavailable:[0]});
  await edition({unavailable:[1]}); // Remaining single entrant is unviable.
  expected.push(await edition({count:3,unavailable:[1]}));
  expected.push(await edition({rosterStatuses:['withdrawn','confirmed'],outside:[0]}));
  await edition({rosterStatuses:['withdrawn','confirmed']});
  await edition({rosterStatuses:['withdrawn','confirmed'],wrongOutside:[0]});
  await edition({registrationStatus:'pending'});await edition({team:false});
  await edition({status:'cancelled'});await edition({status:'planned'});await edition({seasonId:otherSeason});
  expected.push(await edition({simulation:false}));
  expected.push(await edition({count:80,missing:[42]}));
  const result=async(fn,s=season)=>(await db.query(`select * from ${fn}($1)`,[s])).rows.map(r=>r.race_edition_id);
  same(await result('get_incomplete_completed_race_edition_ids'),expected.sort());
  same(await result('get_incomplete_completed_race_edition_ids'),await result('recovery_before'));
  // Deterministic combinations exercise nullable JSON, statuses and thresholds.
  for(let n=0;n<40;n++)await edition({count:n%5,missing:[n%3],type:n%4?'standard':'world_championship',unavailable:n%3?[1]:[],rosterStatuses:n%2?['confirmed','withdrawn']:[],outside:n%7?[1]:[]});
  same(await result('get_incomplete_completed_race_edition_ids'),await result('recovery_before'));
  same(await result('get_incomplete_completed_race_edition_ids',otherSeason),await result('recovery_before',otherSeason));

  // Test the full production PL/pgSQL control flow with isolated dependencies.
  const country=id(),rider=id(),list=id(),target=id(),now='2026-11-04T12:00:00Z';
  await execParams(`insert into countries values($1,'Test','TS','EU',true);insert into riders values($2,$1,'active');insert into rider_season_ratings values($2,$3)`,[country,rider,season]);
  await db.exec(`insert into national_federation_selection_slots values('world','world_championship','professional',3,26),('cc','continental_championship','professional',3,10)`);
  await execParams(`insert into test_targets values($1,$2,'world',$3,'2026-11-01');insert into national_federation_selection_lists values($4,$1,$2,'world','pending_confirmation',null);insert into national_federation_selection_members values($4,'pending',null)`,[country,season,target,list]);
  async function runLineups(fn,clock=now) {
    await db.exec(`truncate test_trace;update national_federation_selection_members set response_status='pending',responded_at=null;update national_federation_selection_lists set status='pending_confirmation',updated_at=null;`);
    const result=(await db.query(`select ${fn}($1) n`,[clock])).rows[0].n;
    const trace=(await db.query(`select event,count(*)::int n from test_trace group by event order by event`)).rows;
    const member=(await db.query('select response_status,responded_at from national_federation_selection_members')).rows;
    const lists=(await db.query('select status,updated_at from national_federation_selection_lists')).rows;
    return {result,trace,member,lists};
  }
  const oldClosed=await runLineups('prepare_lineups_before'),newClosed=await runLineups('prepare_due_automatic_federation_professional_lineups');
  same(newClosed.result,oldClosed.result);same(newClosed.member,oldClosed.member);same(newClosed.lists,oldClosed.lists);
  same(newClosed.trace.filter(r=>r.event!=='target'),oldClosed.trace.filter(r=>r.event!=='target'));
  same(oldClosed.trace.find(r=>r.event==='target').n,3);same(newClosed.trace.find(r=>r.event==='target').n,1);
  same(newClosed.member[0].response_status,'declined'); // Expiry is retained.
  // A future departure keeps the country loop, even if this country is not qualified.
  const futureRace=id(),futureEdition=id();
  await execParams(`insert into races values($1,'world_championship');insert into race_editions values($2,$1,$3,'planned');insert into stages values($4,$2,1,'2026-11-05')`,[futureRace,futureEdition,season,id()]);
  const oldFuture=await runLineups('prepare_lineups_before'),newFuture=await runLineups('prepare_due_automatic_federation_professional_lineups');
  same(newFuture.result,oldFuture.result);same(newFuture.member,oldFuture.member);
  same(newFuture.trace.find(r=>r.event==='target').n,2); // Expiry + world; closed CC skipped.
  await db.query(`update stages set departure_at=null where race_edition_id=$1`,[futureEdition]);
  same((await runLineups('prepare_due_automatic_federation_professional_lineups')).trace.find(r=>r.event==='target').n,2); // Unknown schedules remain eligible for lookup.
  await db.query(`update race_editions set status='cancelled' where id=$1`,[futureEdition]);
  same((await runLineups('prepare_due_automatic_federation_professional_lineups')).trace.find(r=>r.event==='target').n,1);
  await db.exec(`update seasons set current_day_number=1 where status='active'`);
  same((await runLineups('prepare_due_automatic_federation_professional_lineups')).trace.find(r=>r.event==='target').n,1);
  await db.exec(`truncate test_targets;update seasons set current_day_number=26 where status='active'`);
  const nullNew=await runLineups('prepare_due_automatic_federation_professional_lineups',null),nullOld=await runLineups('prepare_lineups_before',null);
  same(nullNew.result,nullOld.result);same(nullNew.member,nullOld.member);same(nullNew.lists,nullOld.lists);
  // PostgreSQL may simplify a NULL expiry predicate before invoking its target
  // function; target-call counts are not a semantic invariant of this case.
  same(nullNew.trace.filter(r=>r.event!=='target'),nullOld.trace.filter(r=>r.event!=='target'));
  await db.exec(migration);same(await attrs(),attributes); // Repeat-safe with ACL/settings intact.

  // Local-only benchmark: completed large simulations, no repairs needed.
  await db.exec('truncate race_results,race_rosters,race_registrations,official_stage_simulations,stages,race_editions,races');
  const payload=Array.from({length:12000},(_,i)=>({id:i,value:(Math.imul(i,2654435761)>>>0).toString(16)}));
  for(let n=0;n<24;n++) {
    const e=await edition({count:80,missing:[]});
    await db.query(`update official_stage_simulations set input_data=$1 where stage_id=(select id from stages where race_edition_id=$2 and stage_number=1)`,[JSON.stringify({unavailableRiderIds:[],simulation:payload}),e]);
  }
  await db.exec('analyze');const timings={};
  for(const fn of ['recovery_before','get_incomplete_completed_race_edition_ids']){
    await result(fn);const values=[];
    for(let n=0;n<3;n++){const start=performance.now();same(await result(fn),[]);values.push(performance.now()-start);}
    timings[fn]=Math.round(values.sort((a,b)=>a-b)[1]*100)/100;
  }
  if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify({assertions,fixture:{editions:24,ridersPerEdition:80,simulationBytes:JSON.stringify(payload).length},localMedianMs:timings},null,2));
  console.log(JSON.stringify({pass:true,assertions,localMedianMs:timings}));
}catch(error){console.error(error.stack,error.where??'');process.exitCode=1;}
finally{await db.close();}
