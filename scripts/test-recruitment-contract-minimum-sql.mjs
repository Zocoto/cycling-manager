// Disposable PostgreSQL/WASM only. No credentials, database URL or network.
// Reuses the versioned transfer, roster, salary and rollover integration setup.
// Run with TRADE_SQL_TEST_MODULE pointing to an existing local PGlite module.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const baseline=readFileSync('scripts/test-direct-transfer-trades-sql.mjs','utf8').replaceAll('\r\n','\n');
const split=baseline.indexOf("  await scenario('future entries are withdrawn at submission only for the proposing manager'");
assert(split>0,'Versioned trade fixture bootstrap boundary is required');
const deferred=readFileSync('scripts/test-deferred-direct-transfers-sql.mjs','utf8').replaceAll('\r\n','\n');
const setupStart=deferred.indexOf('  await root();\n  // These are schema/calendar fixtures');
const setupEnd=deferred.indexOf('  // Recruitment duration normalization');
assert(setupStart>0&&setupEnd>setupStart,'Versioned deferred setup boundary is required');
const setup=deferred.slice(setupStart,setupEnd);

async function regressions({db,id,check,rows,scalar,root,auth,reject,scenario,addRider,owner,snapshot}) {
  const minimum='supabase/migrations/20261106140000_guarantee_recruited_rider_next_season.sql';
  const contract=async rider=>(await rows("select * from public.rider_contracts where rider_id=$1 and status='active'",[id(rider)]))[0];
  const cash=async teamSeason=>Number(await scalar('select cash_balance from public.team_seasons where id=$1',[id(teamSeason)]));
  const offerId=result=>typeof result==='string'?result:result.offerId;
  const respond=offer=>scalar('select public.respond_to_direct_transfer_offer($1,true)',[offer]);
  const recruit=(rider,team=10,options={})=>addRider(rider,team,{acquisition:'free_agent',...options});
  // Calendar schema defaults and the existing draft reservation tables/guard.
  // Business functions below are loaded from their versioned production SQL.
  await db.exec(`alter table public.seasons alter column id set default gen_random_uuid();
    create table public.season_draft_editions(id uuid primary key,season_id uuid,status text,current_position int,pick_deadline timestamptz,version int default 0);
    create table public.season_draft_riders(edition_id uuid,rider_id uuid,selected_team_id uuid,salary_per_season numeric,snapshot jsonb);
    create table public.season_draft_participants(edition_id uuid,team_id uuid,sporting_director_id uuid,status text,position int,selected_rider_id uuid,selected_contract_id uuid,resolved_at timestamptz,resolution_reason text);
    alter table public.rider_contracts drop constraint rider_contracts_acquisition_type_allowed;
    alter table public.rider_contracts add constraint rider_contracts_acquisition_type_allowed
      check(acquisition_type in ('initial','daily_auction','director_auction','free_agent','renewal','academy','direct_offer','season_draft'));`);
  const draftSource=readFileSync('supabase/migrations/20261022160000_create_recurring_season_draft.sql','utf8').replaceAll('\r\n','\n');
  const guardStart=draftSource.indexOf('create function public.guard_season_draft_reservation()');
  const guardEnd=draftSource.indexOf('create trigger aa_season_draft_listing_reservation',guardStart);
  assert(guardStart>0&&guardEnd>guardStart);
  await db.exec(draftSource.slice(guardStart,guardEnd));
  for(const name of ['try_season_draft_pick','season_draft_message']){
    const start=draftSource.indexOf('create function public.'+name+'(');
    const end=draftSource.indexOf('\n$$;',start);
    assert(start>0&&end>start);
    await db.exec(draftSource.slice(start,end+4));
  }
  const before=await snapshot();
  await db.exec(readFileSync(minimum,'utf8').replaceAll('\r\n','\n'));
  check(await snapshot(),before,'Installing the minimum never backfills existing player contracts or changes funds');
  check(await scalar("select count(*)::int from pg_trigger where tgrelid='public.rider_contracts'::regclass and tgname='ab_recruited_rider_contract_duration' and not tgisinternal"),1);
  check(await scalar("select position('BEFORE INSERT ON' in pg_get_triggerdef(oid))>0 from pg_trigger where tgrelid='public.rider_contracts'::regclass and tgname='ab_recruited_rider_contract_duration'"),true,'Only new recruits are normalized');

  await scenario('cash RPC grants current and next season without changing the agreed price or salary',async()=>{
    await auth(1);
    const offer=offerId(await scalar('select public.submit_direct_transfer_offer_with_message($1,1234,null)',[id(202)]));
    await auth(2); await respond(offer); await root();
    const signed=await contract(202);
    check(signed.team_id,id(10));check(signed.start_season_id,id(4));check(signed.end_season_id,id(5));
    check(Number(signed.salary_per_season),8200);check(signed.acquisition_type,'direct_offer');
    check(Number(signed.transfer_fee),1200,'Historical cash rounding is preserved');check(signed.transfer_locked_season_id,id(4));
    check(await cash(104),1000000-1200);check(await cash(114),1000000+1200);
    check(await scalar("select count(*)::int from public.rider_contracts where rider_id=$1 and status='planned'",[id(202)]),0,'No redundant renewal is created');
    check(await scalar("select count(*)::int from public.team_finance_transactions where source_reference like $1",['rider-salary:'+signed.id+':%']),8,'Both seasons receive their normal four salary installments');
    check(await rows("select team_season_id,count(*)::int n from public.team_finance_transactions where source_reference like $1 group by team_season_id order by team_season_id",['rider-salary:'+signed.id+':%']),[{team_season_id:id(104),n:4},{team_season_id:id(105),n:4}],'The guarantee has no duplicate salary installments');
  });

  await scenario('trade RPC gives both arriving riders the same next-season guarantee',async()=>{
    await auth(1);
    const offer=offerId(await scalar('select public.submit_direct_transfer_trade_offer($1,1200,$2,null)',[id(202),id(201)]));
    await auth(2);await respond(offer);await root();
    for(const [rider,team,salary] of [[202,10,8200],[201,11,7100]]){
      const signed=await contract(rider);
      check(signed.team_id,id(team));check(signed.end_season_id,id(5));check(Number(signed.salary_per_season),salary);
    }
    check(await cash(104),998800);check(await cash(114),1001200);
  });

  // Every recruitment source writes a real contract through all installed
  // capacity, payroll, homegrown, naturalization and transition triggers.
  for(const acquisition of ['free_agent','daily_auction','director_auction','academy']){
    await scenario(acquisition+' short immediate contract is guaranteed through next season',async()=>{
      const signedId=await recruit(301,10,{acquisition,salary:7700,locked:4});
      const signed=await contract(301);
      check(signed.id,signedId);check(signed.end_season_id,id(5));check(signed.start_season_id,id(4));
      check(signed.acquisition_type,acquisition);check(Number(signed.salary_per_season),7700);
      check(signed.transfer_locked_season_id,acquisition==='academy'?id(4):null,'Existing first-club transfer-lock rules are preserved');
      check(await scalar('select public.get_team_roster_commitment_count($1,5)',[id(10)]),1,'The guarantee reserves a real next-season place');
    });
  }

  await scenario('last-day instant academy promotion still receives the complete following season',async()=>{
    await db.query('update public.seasons set current_day_number=28 where id=$1',[id(4)]);
    await recruit(302,10,{acquisition:'academy',salary:5300});
    check((await contract(302)).end_season_id,id(5));
    check(Number((await contract(302)).salary_per_season),5300,'The duration guard does not recompute the instant-promotion salary');
  });

  await scenario('draft reservation accepts its short incoming shape before normalization',async()=>{
    await db.query("insert into public.season_draft_editions(id,season_id,status,current_position,pick_deadline) values($1,$2,'running',1,now()+interval '5 minutes')",[id(390),id(4)]);
    await db.query("insert into public.riders(id,first_name,last_name,status) values($1,'Draft','Fixture','free_agent')",[id(303)]);
    await db.query("insert into public.season_draft_riders values($1,$2,null,6000,'{\"firstName\":\"Draft\",\"lastName\":\"Fixture\"}')",[id(390),id(303)]);
    await db.query("insert into public.season_draft_participants(edition_id,team_id,sporting_director_id,status,position) values($1,$2,$3,'pending',1)",[id(390),id(10),id(20)]);
    check(await scalar('select public.try_season_draft_pick($1,$2,$3)',[id(390),id(10),id(303)]),'picked');
    check((await contract(303)).end_season_id,id(5),'The draft guard runs before the minimum-duration guard');
    check((await contract(303)).transfer_locked_season_id,id(4),'The existing draft resale season remains unchanged');
    check(await scalar("select body like '%saison en cours et la suivante%' from public.sporting_director_messages where source_reference=$1",['season-draft:'+id(390)+':result']),true,'Draft confirmation explains the real term');
  });

  await scenario('existing longer recruitment terms are preserved',async()=>{
    await recruit(304,10,{end:6});
    check((await contract(304)).end_season_id,id(6));
  });

  await scenario('onboarding and recovery initial contracts retain their original duration',async()=>{
    await addRider(305,10);
    check((await contract(305)).end_season_id,id(4));
  });

  await scenario('renewals retain their negotiated start and end seasons',async()=>{
    await recruit(306,10,{status:'planned',start:5,end:6,acquisition:'renewal',salary:9200});
    const renewed=(await rows('select * from public.rider_contracts where rider_id=$1',[id(306)]))[0];
    check(renewed.start_season_id,id(5));check(renewed.end_season_id,id(6));check(Number(renewed.salary_per_season),9200);
    await recruit(307,10,{acquisition:'renewal'});
    check((await contract(307)).end_season_id,id(4),'An active renewal is not a new recruitment');
  });

  await scenario('planned transfer is unchanged when it activates at rollover',async()=>{
    const signedId=await recruit(308,10,{status:'planned',start:5,end:5,acquisition:'direct_offer'});
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    const signed=await contract(308);
    check(signed.id,signedId);check(signed.start_season_id,id(5));check(signed.end_season_id,id(5),'Activation cannot add another year');
  });

  await scenario('already signed current-season recruit survives rollover through its guaranteed season',async()=>{
    const signedId=await recruit(309);
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    check((await contract(309)).id,signedId);check((await contract(309)).end_season_id,id(5));
    check(await scalar('select status from public.riders where id=$1',[id(309)]),'active');
  });

  await scenario('automatic future-season academy insertion is not extended from the outgoing active season',async()=>{
    await recruit(310,10,{start:5,end:5,acquisition:'academy'});
    check((await contract(310)).end_season_id,id(5));
  });

  await scenario('automatic academy promotion in the active rollover target retains its one complete season',async()=>{
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    await db.query("select set_config('cycling_manager.rollover_target_season',$1,true)",[id(5)]);
    await recruit(314,10,{start:5,end:5,acquisition:'academy'});
    check((await contract(314)).end_season_id,id(5),'Scheduled automatic promotion does not promise an extra season');
    await db.query("select set_config('cycling_manager.rollover_target_season','',true)");
    await recruit(315,10,{start:5,end:5,acquisition:'academy'});
    check((await contract(315)).end_season_id,id(6),'An instant promotion outside rollover receives the next-season guarantee');
  });

  await scenario('later updates can shorten a contract for a deferred handover',async()=>{
    const signedId=await recruit(311);
    await db.query('update public.rider_contracts set end_season_id=$1 where id=$2',[id(4),signedId]);
    check((await contract(311)).end_season_id,id(4),'Duration normalization applies only on insertion');
  });

  await scenario('a stale immediate signing cannot insert a contract for the previous season after rollover',async()=>{
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    await db.query("update public.seasons set status='active' where id=$1",[id(5)]);
    await db.query("insert into public.riders(id,first_name,last_name,status) values($1,'Stale','Fixture','free_agent')",[id(316)]);
    const stable=await snapshot();
    await reject("insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season) values($1,$2,$3,$3,'active','free_agent',7700)",[id(316),id(10),id(4)]);
    check(await snapshot(),stable,'A stale submission never creates ownership or salary effects');
  });

  for(const team of [10,11]){
    await scenario('a conflicting next-season commitment to team '+team+' rejects recruitment atomically',async()=>{
      await recruit(312,team,{status:'planned',start:5,end:5,acquisition:team===10?'renewal':'direct_offer'});
      const stable=await snapshot();
      await reject("insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season) values($1,$2,$3,$3,'active','free_agent',7700)",[id(312),id(10),id(4)]);
      check(await snapshot(),stable,'The promised future contract, funds and payroll remain intact');
    });
  }

  await scenario('next-season roster capacity rejects a pending cash transfer without charging either team',async()=>{
    await auth(1);
    const offer=offerId(await scalar('select public.submit_direct_transfer_offer_with_message($1,1000,null)',[id(202)]));
    await root();
    const limit=Number(await scalar('select public.get_team_roster_base_limit($1)',[id(10)]));
    for(let n=0;n<limit;n++) await addRider(1000+n,10,{status:'planned',start:5,end:5});
    const stable=await snapshot();
    await auth(2);await reject('select public.respond_to_direct_transfer_offer($1,true)',[offer]);await root();
    check(await snapshot(),stable);check(await owner(202),id(11));
    check(await cash(104),1000000);check(await cash(114),1000000);
  });

  await scenario('failure of the counterpart next-season capacity rolls back the entire exchange',async()=>{
    await auth(1);
    const offer=offerId(await scalar('select public.submit_direct_transfer_trade_offer($1,250,$2,null)',[id(202),id(201)]));
    await root();
    const limit=Number(await scalar('select public.get_team_roster_base_limit($1)',[id(11)]));
    for(let n=0;n<limit;n++) await addRider(1100+n,11,{status:'planned',start:5,end:5});
    const stable=await snapshot();
    await auth(2);await reject('select public.respond_to_direct_transfer_offer($1,true)',[offer]);await root();
    check(await snapshot(),stable);check(await owner(201),id(10));check(await owner(202),id(11));
  });

  await scenario('the final INSERT guard checks next-season capacity even without an RPC preflight',async()=>{
    const limit=Number(await scalar('select public.get_team_roster_base_limit($1)',[id(10)]));
    for(let n=0;n<limit;n++) await addRider(1200+n,10,{status:'planned',start:5,end:5});
    await db.query("insert into public.riders(id,first_name,last_name,status) values($1,'Capacity','Fixture','free_agent')",[id(317)]);
    const stable=await snapshot();
    await reject("insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season) values($1,$2,$3,$3,'active','free_agent',7700)",[id(317),id(10),id(4)],'saison 5');
    check(await snapshot(),stable,'Failed normalization cannot leave a short fallback contract or salary entries');
  });

  await scenario('draft preflight refuses a full following season without consuming the pick',async()=>{
    const limit=Number(await scalar('select public.get_team_roster_base_limit($1)',[id(10)]));
    for(let n=0;n<limit;n++) await addRider(1300+n,10,{status:'planned',start:5,end:5});
    await db.query("insert into public.season_draft_editions(id,season_id,status,current_position,pick_deadline) values($1,$2,'running',1,now()+interval '5 minutes')",[id(391),id(4)]);
    await db.query("insert into public.riders(id,first_name,last_name,status) values($1,'Full','Draft','free_agent')",[id(318)]);
    await db.query("insert into public.season_draft_riders values($1,$2,null,6000,'{}')",[id(391),id(318)]);
    await db.query("insert into public.season_draft_participants(edition_id,team_id,sporting_director_id,status,position) values($1,$2,$3,'pending',1)",[id(391),id(10),id(20)]);
    const stable=await snapshot();
    check(await scalar('select public.try_season_draft_pick($1,$2,$3)',[id(391),id(10),id(318)]),'roster_full');
    check(await snapshot(),stable);check(await scalar('select status from public.season_draft_participants where edition_id=$1',[id(391)]),'pending');
    check(await scalar('select selected_team_id from public.season_draft_riders where rider_id=$1',[id(318)]),null);
  });

  await scenario('missing next season is created as a lightweight identity',async()=>{
    await db.query('delete from public.race_editions where season_id=$1',[id(5)]);
    await db.query('delete from public.team_seasons where season_id=$1',[id(5)]);
    await db.query('delete from public.season_days where season_id=$1',[id(5)]);
    await db.query('delete from public.seasons where id=$1',[id(5)]);
    await recruit(313);
    const next=(await rows('select * from public.seasons where game_year=5'))[0];
    check(next.status,'planned');check(next.current_day_number,1);check((await contract(313)).end_season_id,next.id);
    check(new Date(next.starts_on).toISOString().slice(0,10),'2026-11-06');check(new Date(next.ends_on).toISOString().slice(0,10),'2026-12-03');
    check(await scalar('select count(*)::int from public.season_days where season_id=$1',[next.id]),0,'Recruitment never provisions the complete calendar');
  });
}

const footer=[
  'console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionData:false,multiSessionConcurrency:false,migration:"20261106140000"}));',
  '}catch(error){console.error(JSON.stringify({ok:false,scenario:currentCase,checks,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}',
  'finally{await db.close();}',
].join('\n');
const entry=baseline.slice(0,split)+'\nconst migration="supabase/migrations/20261102090000_add_deferred_direct_transfers.sql";\n'+setup+
  '\nawait ('+regressions.toString()+')({db,id,check,rows,scalar,root,auth,reject,scenario,addRider,owner,snapshot,historicalFunction});\n'+footer;
await import('data:text/javascript;base64,'+Buffer.from(entry).toString('base64'));
