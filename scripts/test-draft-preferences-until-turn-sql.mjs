// Isolated PostgreSQL/WASM only: no credentials, network or production writes.
// Use the established draft fixture schema and actual audited save/worker/pick
// functions. The local dates model selections already started (after 14 h).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fixture=readFileSync('scripts/test-future-draft-performance-sql.mjs','utf8').replaceAll('\r\n','\n');
const boundary=fixture.indexOf('  // Freeze a real S5 pool using its actual rollover receipt hook before install.');
assert(boundary>0,'The versioned isolated draft bootstrap boundary is required');

async function regressions({db,id,rows,value,check}) {
  const baseline=JSON.parse(await (await import('node:fs/promises')).readFile('scripts/fixtures/draft-preferences-baseline.json','utf8')).rows;
  for(const row of baseline) await db.exec(row.definition);
  const edition=id(9000),rider=id(2001),otherRider=id(2002);
  const auth=n=>db.query("select set_config('test.auth_uid',$1,false)",[n===null?'':id(1000+n)]);
  const save=(riders=[rider],auto=false)=>db.query('select public.save_current_season_draft_preferences($1,$2,$3)',[edition,riders,auto]);
  const player=async(team=1)=>(await rows('select * from public.season_draft_participants where edition_id=$1 and team_id=$2',[edition,id(100+team)]))[0];
  const snapshot=async()=>({
    edition:await rows('select * from public.season_draft_editions order by id'),
    participants:await rows('select * from public.season_draft_participants order by edition_id,position'),
    pool:await rows('select * from public.season_draft_riders order by edition_id,pool_rank'),
    contracts:await rows('select * from public.rider_contracts order by id'),
    messages:await rows('select * from public.sporting_director_messages order by source_reference'),
    budgets:await rows('select id,cash_balance from public.team_seasons order by id'),
  });
  let scenarios=0;
  const scenario=async(name,body)=>{
    scenarios++;await db.exec('begin');
    try{await auth(1);await body();}
    catch(error){error.message=name+': '+error.message;throw error;}
    finally{await db.exec('rollback');}
  };
  const reject=async(statement,args)=>{
    await db.exec('savepoint expected_rejection');
    try{await assert.rejects(()=>db.query(statement,args));check(true,true,'Expected SQL rejection');}
    finally{await db.exec('rollback to savepoint expected_rejection;release savepoint expected_rejection');}
  };
  const rejectSave=async(riders=[rider],auto=false)=>{
    const before=await snapshot();
    await reject('select public.save_current_season_draft_preferences($1,$2,$3)',[edition,riders,auto]);
    check(await snapshot(),before,'Rejected changes cannot modify preferences, picks or payroll');
  };

  await db.exec(`update public.seasons set status='completed' where id='${id(4)}';
    update public.seasons set status='active' where id='${id(5)}';
    insert into public.season_draft_editions(id,game_year,season_id,previous_season_id,announcement_at,opens_at,starts_at,
      status,initialized_at,current_position,pick_deadline,participant_count,pool_count)
    values('${edition}',5,'${id(5)}','${id(4)}',now()-interval '3 hours',now()-interval '2 hours',now()-interval '1 hour',
      'running',now()-interval '2 hours',1,now()+interval '10 minutes',2,5);`);
  for(let n=1;n<=3;n++){
    await db.query("insert into public.teams values($1,'active',35)",[id(100+n)]);
    await db.query("insert into public.sporting_directors values($1,$2,'active',true,now()-interval '100 days',$3)",[id(500+n),id(1000+n),'DS '+n]);
    await db.query("insert into public.team_manager_assignments values($1,$2,'general_manager','active')",[id(100+n),id(500+n)]);
    await db.query("insert into public.team_seasons values($1,$2,$3,'active',$4,0,1000000)",[id(4000+n),id(100+n),id(5),'Team '+n]);
    if(n<=2) await db.query(`insert into public.season_draft_participants(edition_id,team_id,sporting_director_id,position,
      team_name,director_name,previous_points,registered_at,auto_enabled)
      values($1,$2,$3,$4,$5,$6,0,now()-interval '100 days',false)`,[edition,id(100+n),id(500+n),n,'Team '+n,'DS '+n]);
  }
  for(let n=1;n<=5;n++){
    await db.query("insert into public.riders values($1,$2,'Draft',$3,'free_agent',4,'classic',$4)",[id(2000+n),id(99),'Rider '+n,n]);
    await db.query(`insert into public.rider_season_ratings values($1,$2,25,${Array(13).fill(55).join(',')})`,[id(2000+n),id(5)]);
    await db.query(`insert into public.season_draft_riders(edition_id,rider_id,pool_rank,score,salary_per_season,snapshot)
      values($1,$2,$3,55,10000,'{"firstName":"Draft","lastName":"Rider"}')`,[edition,id(2000+n),n]);
  }
  const beforeInstall=await snapshot();
  const beforeFunctions=await rows(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text acl
    from pg_proc p where p.oid in(select signature::regprocedure from unnest($1::text[]) signature) order by signature`,[baseline.map(row=>row.signature)]);
  await db.exec(await (await import('node:fs/promises')).readFile('supabase/migrations/20261106183000_allow_draft_preferences_until_turn.sql','utf8'));
  check(await snapshot(),beforeInstall,'Installation does not advance a draft or alter any player list/pick/funds');
  const afterFunctions=await rows(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text acl
    from pg_proc p where p.oid in(select signature::regprocedure from unnest($1::text[]) signature) order by signature`,[baseline.map(row=>row.signature)]);
  for(const before of beforeFunctions){
    const after=afterFunctions.find(row=>row.signature===before.signature);
    check(after.acl,before.acl,'Existing function permissions remain unchanged');
    if(!before.signature.startsWith('save_current_season_draft_preferences(')&&!before.signature.startsWith('public.save_current_season_draft_preferences('))
      check(after.definition,before.definition,'The worker, view, pick and pass functions remain unchanged');
  }

  await scenario('preparing list remains editable before selections begin',async()=>{
    await db.query("update public.season_draft_editions set status='preparing',starts_at=now()+interval '1 hour',current_position=null,pick_deadline=null where id=$1",[edition]);
    await save([rider],true);
    check((await player()).preferences,[rider]);check((await player()).status,'pending');
    check((await rows('select * from public.rider_contracts')).length,0,'Preparation never recruits before the start');
  });
  await scenario('future participant can save an automatic list after the 14h start',async()=>{
    await auth(2);await save([otherRider,rider],true);
    check(await value('select starts_at<now() value from public.season_draft_editions where id=$1',[edition]),true);
    check((await player(2)).preferences,[otherRider,rider]);check((await player(2)).auto_enabled,true);
    check((await player(2)).status,'pending');check((await rows('select * from public.rider_contracts')).length,0,'Waiting automatic lists are not recruited before their turn');
  });
  await scenario('current participant can change manual preferences while the deadline is open',async()=>{
    await save([otherRider,rider],false);
    check((await player()).preferences,[otherRider,rider]);check((await player()).status,'pending');
  });
  await scenario('automatic validation during the current turn uses the newly saved list immediately',async()=>{
    await save([otherRider,rider],true);
    check((await player()).status,'picked');check((await player()).selected_rider_id,otherRider);
    check(await value('select rider_id value from public.rider_contracts where team_id=$1',[id(101)]),otherRider);
    await rejectSave([rider],true);
  });
  await scenario('future participant may save while the preceding turn has expired',async()=>{
    await db.query("update public.season_draft_editions set pick_deadline=now()-interval '1 second' where id=$1",[edition]);
    await auth(2);await save([otherRider],false);
    check((await player(1)).resolution_reason,'timeout');check((await player(2)).status,'pending');
    check((await player(2)).preferences,[otherRider]);
    check(await value('select current_position value from public.season_draft_editions where id=$1',[edition]),2);
  });
  await scenario('expired own turn cannot save even if its worker status is still pending',async()=>{
    await db.query("update public.season_draft_editions set pick_deadline=now()-interval '1 second' where id=$1",[edition]);
    await rejectSave();
  });
  await scenario('stale pending participant behind current position cannot save',async()=>{
    await db.query('update public.season_draft_editions set current_position=2 where id=$1',[edition]);
    await rejectSave();
  });
  await scenario('waiting list remains editable between bounded automatic worker bursts',async()=>{
    await db.query('update public.season_draft_editions set current_position=null,pick_deadline=null where id=$1',[edition]);
    await auth(2);await save([otherRider],false);
    check((await player(2)).preferences,[otherRider]);check((await player(2)).status,'pending');
    check((await rows('select * from public.rider_contracts')).length,0,'A waiting list remains private until its actual turn');
  });
  await scenario('running without an own deadline cannot accept stale client changes',async()=>{
    // Real schema prevents a half-populated position/deadline. Exercise the
    // explicit deadline guard in an isolated historical-corruption fixture.
    await db.exec('alter table public.season_draft_editions drop constraint season_draft_editions_check1');
    await db.query('update public.season_draft_editions set pick_deadline=null where id=$1',[edition]);
    await rejectSave();
  });
  await scenario('voluntary pass closes preference editing definitively',async()=>{
    await db.query('select public.select_current_season_draft_rider($1,null,true)',[edition]);
    check((await player()).status,'passed');await rejectSave();
  });
  for(const status of ['completed','cancelled']) await scenario(status+' edition cannot save',async()=>{
    await db.query('update public.season_draft_editions set status=$2 where id=$1',[edition,status]);await rejectSave();
  });
  await scenario('nonparticipant cannot save another team list',async()=>{await auth(3);await rejectSave();});
  await scenario('logged-out client cannot save',async()=>{await auth(null);await rejectSave();});
  await scenario('invalid or duplicate preferences and empty automatic list still fail atomically',async()=>{
    for(const [riders,auto] of [[[rider,rider],false],[[id(2999)],false],[[],true],[null,false],[[rider],null]]) await rejectSave(riders,auto);
  });
  return {scenarios,isolated:true,productionTouched:false,multiSessionConcurrency:false};
}

const footer=`
  const result=await (${regressions.toString()})({db,id,rows,value,check});
  console.log(JSON.stringify({checks,...result}));
}catch(error){console.error(JSON.stringify({checks,message:error.message,where:error.where},null,2));process.exitCode=1;}
finally{await db.close();}`;
await import('data:text/javascript;base64,'+Buffer.from(fixture.slice(0,boundary)+footer).toString('base64'));
