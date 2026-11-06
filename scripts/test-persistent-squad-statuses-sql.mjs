// Isolated PostgreSQL/WASM only. No credentials, remote URL or production mutations.
// Reuse versioned contract/finance/roster/deferred-transfer hooks, then exercise
// real renewal, single/bulk role RPCs and the season-status lifecycle trigger.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const baseline=readFileSync('scripts/test-direct-transfer-trades-sql.mjs','utf8').replaceAll('\r\n','\n');
const split=baseline.indexOf("  await scenario('future entries are withdrawn at submission only for the proposing manager'");
assert(split>0,'Versioned transfer bootstrap boundary is required');
const deferred=readFileSync('scripts/test-deferred-direct-transfers-sql.mjs','utf8').replaceAll('\r\n','\n');
const setupStart=deferred.indexOf('  await root();\n  // These are schema/calendar fixtures');
const setupEnd=deferred.indexOf('  const before = await snapshot();',setupStart);
assert(setupStart>0&&setupEnd>setupStart,'Versioned lifecycle setup boundary is required');
const setup=deferred.slice(setupStart,setupEnd);

async function regressions({db,id,check,rows,scalar,root,auth,reject,scenario,snapshot,historicalFunction}){
  const migration='supabase/migrations/20261106213000_persist_team_squad_statuses_on_renewal.sql';
  const contract=async(rider,team=10,{status='active',start=4,end=4,acquisition='initial',role=null,salary=6000,signed='2026-10-01T10:00:00Z'}={})=>{
    await root();
    await db.query("insert into public.riders(id,first_name,last_name,status) values($1,$2,'Fixture','active') on conflict do nothing",[id(rider),'Coureur '+rider]);
    return scalar(`insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,squad_status,salary_per_season,signed_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,[id(rider),id(team),id(start),id(end),status,acquisition,role,salary,signed]);
  };
  const byId=async contractId=>(await rows('select * from public.rider_contracts where id=$1',[contractId]))[0];
  const role=async contractId=>(await byId(contractId)).squad_status;
  const single=(rider,status)=>scalar('select public.set_current_team_rider_squad_status($1,$2)',[id(rider),status]);
  const batch=(rider,status,expected)=>scalar('select public.set_current_team_rider_squad_statuses($1)',[[{riderId:id(rider),squadStatus:status,expectedStatus:expected}]]);
  const renew=(rider,year=5)=>scalar('select public.renew_current_team_rider_until($1,$2)',[id(rider),year]);
  const rollover=async(source=4,target=5)=>{
    await root();
    await db.query("update public.seasons set status='completed',current_day_number=28 where id=$1",[id(source)]);
    await db.query("update public.team_seasons set status='completed' where season_id=$1",[id(source)]);
    await db.query("update public.team_seasons set status='active' where season_id=$1",[id(target)]);
    await db.query("update public.seasons set status='active',current_day_number=1 where id=$1",[id(target)]);
  };
  const finances=()=>rows('select id,team_season_id,amount,status,source_reference from public.team_finance_transactions order by id');
  await root();
  await db.exec("alter table public.rider_contracts add constraint rider_contracts_unique unique(rider_id,team_id,start_season_id);");
  await db.query("insert into public.seasons(id,game_year,status,current_day_number,name,starts_on,ends_on) values($1,3,'completed',28,'Saison 3',date '2026-09-11',date '2026-10-08') on conflict(id) do nothing",[id(3)]);
  await db.query("insert into public.team_seasons(id,team_id,season_id,display_name,status) values($1,$2,$3,'Acheteur S6','planned'),($4,$5,$3,'Vendeur S6','planned'),($6,$7,$3,'Tiers S6','planned')",[id(106),id(10),id(6),id(116),id(11),id(126),id(12)]);
  await db.query("insert into public.race_editions(id,status,season_id) values($1,'planned',$2)",[id(998),id(6)]);
  const squadSource=readFileSync('supabase/migrations/20260925133000_add_team_squad_statuses.sql','utf8').replaceAll('\r\n','\n');
  const singleStart=squadSource.indexOf('create function public.set_current_team_rider_squad_status(');
  const singleEnd=squadSource.indexOf('alter function public.get_current_team_roster_with_potential()');
  assert(singleStart>0&&singleEnd>singleStart);
  await db.exec(squadSource.slice(singleStart,singleEnd));
  await db.exec(readFileSync('supabase/migrations/20261105180000_batch_team_squad_statuses.sql','utf8').replaceAll('\r\n','\n'));
  await db.exec(historicalFunction('supabase/migrations/20260918180000_multi_season_rider_contract_renewals.sql','renew_current_team_rider_until'));
  // Apply only the real versioned renewal evolution blocks, not their unrelated
  // historical market updates or data repairs. Quotes remain deterministic.
  const patchBlock=async(file,tag)=>{
    const sql=readFileSync(file,'utf8').replaceAll('\r\n','\n');
    const start=sql.indexOf('do '+tag),end=sql.indexOf(tag+';',start);
    assert(start>=0&&end>start,file+': '+tag);await db.exec(sql.slice(start,end+tag.length+1));
  };
  await patchBlock('supabase/migrations/20260921130000_create_team_roster_management_center.sql','$renewal$');
  await db.exec('create table public.rider_season_ratings(rider_id uuid,season_id uuid,age integer);');
  await db.exec(historicalFunction('supabase/migrations/20261014140000_profile_based_future_rider_salaries.sql','rider_two_season_salary_adjustment'));
  await patchBlock('supabase/migrations/20261014140000_profile_based_future_rider_salaries.sql','$patch$');
  await patchBlock('supabase/migrations/20261022154500_fix_instant_youth_promotion_salary.sql','$renewal$');
  // Pre-existing NULL is ambiguous: install must never blindly restore it.
  await contract(280,10,{status:'completed',start:3,end:3,role:'absolute_leader'});
  const priorNull=await contract(280,10,{acquisition:'renewal'});
  const protectedBefore=await rows(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc
    where oid in('public.set_current_team_rider_squad_status(uuid,text)'::regprocedure,
      'public.set_current_team_rider_squad_statuses(jsonb)'::regprocedure,
      'public.renew_current_team_rider_until(uuid,integer)'::regprocedure,
      'public.settle_expiring_rider_contracts()'::regprocedure,
      'private.guard_deferred_transfer_contract()'::regprocedure) order by signature`);
  if(process.env.PERSISTENT_SQUAD_SQL_TEST_BASELINE){
    const audited=JSON.parse(readFileSync(process.env.PERSISTENT_SQUAD_SQL_TEST_BASELINE,'utf8')).rows;
    for(const expected of audited){
      const current=protectedBefore.find(row=>row.signature===expected.signature||'public.'+row.signature===expected.signature);
      assert(current,expected.signature);check(current.definition.replaceAll('\r',''),expected.definition.replaceAll('\r',''),'The versioned test body matches the audited production body: '+expected.signature);
    }
  }
  const before=await snapshot();
  await db.exec(readFileSync(migration,'utf8').replaceAll('\r\n','\n'));
  check(await snapshot(),before,'Installing persistence changes no existing contracts, roles, funds or notifications');
  check(await role(priorNull),null,'Ambiguous historical NULL is not backfilled');
  check(await rows(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc
    where oid in('public.set_current_team_rider_squad_status(uuid,text)'::regprocedure,
      'public.set_current_team_rider_squad_statuses(jsonb)'::regprocedure,
      'public.renew_current_team_rider_until(uuid,integer)'::regprocedure,
      'public.settle_expiring_rider_contracts()'::regprocedure,
      'private.guard_deferred_transfer_contract()'::regprocedure) order by signature`),protectedBefore,'Renewal, lifecycle, existing RPCs, deferred guard and ACLs are unchanged');

  await scenario('the real renewal RPC retains the latest same-club role at rollover',async()=>{
    const previous=await contract(301,10,{role:'absolute_leader',salary:7300});
    await auth(1);const next=await renew(301);await root();
    check((await byId(next)).acquisition_type,'renewal');check(await role(next),null,'Do not freeze a role on a planned renewal');
    await auth(1);await single(301,'co_leader');await root();
    check(await role(previous),'co_leader');
    await rollover();
    const activated=await byId(next);
    check(activated.status,'active');check(activated.squad_status,'co_leader');check(Number(activated.salary_per_season),6000,'The agreed renewal salary is unchanged');
    check((await byId(previous)).status,'completed');
    const countBefore=Number(await scalar('select count(*)::int from public.team_finance_transactions'));
    await db.query("update public.rider_contracts set status='active' where id=$1",[next]);
    check(await role(next),'co_leader');check(Number(await scalar('select count(*)::int from public.team_finance_transactions')),countBefore,'Replayed activation creates no duplicate salary installment');
  });

  await scenario('an explicit clear after renewal signing remains NULL through two seasons',async()=>{
    await contract(302,10,{role:'road_captain'});await auth(1);const next=await renew(302);await single(302,null);await root();
    await rollover();check(await role(next),null,'An explicitly cleared predecessor is not skipped');
    await auth(1);const later=await renew(302,6);await root();await rollover(5,6);
    check(await role(later),null,'A much older non-NULL role is never resurrected');
  });

  await scenario('bulk late edits are inherited, and active edits remain independently editable',async()=>{
    await contract(303,10,{role:'domestique'});await auth(1);const next=await renew(303);
    check(await batch(303,'lieutenant','domestique'),1);await root();await rollover();check(await role(next),'lieutenant');
    const stableFinance=await finances();await auth(1);
    check(await batch(303,'free_role','lieutenant'),1);check(await batch(303,'free_role','lieutenant'),0);await root();
    check(await role(next),'free_role');check(await finances(),stableFinance,'Role-only changes do not alter wages, fees or paid/pending salary records');
    await auth(1);await single(303,null);await root();check(await role(next),null,'Clearing an active role does not invoke inheritance');
    await db.query('update public.rider_contracts set salary_per_season=salary_per_season where id=$1',[next]);
    check(await role(next),null,'Unrelated contract edits never reapply the historical role');
  });

  await scenario('a prefilled future role is preserved over the predecessor',async()=>{
    await contract(304,10,{role:'co_leader'});
    const next=await contract(304,10,{status:'planned',start:5,end:5,acquisition:'renewal',role:'prospect'});
    await rollover();check(await role(next),'prospect');
  });

  await scenario('an already-active renewal INSERT inherits a completed predecessor',async()=>{
    await contract(305,10,{role:'stage_hunter'});await rollover();
    const next=await contract(305,10,{start:5,end:5,acquisition:'renewal'});
    check(await role(next),'stage_hunter');
  });

  await scenario('an explicit role on an active renewal INSERT is preserved',async()=>{
    await contract(306,10,{role:'co_leader'});await rollover();
    const next=await contract(306,10,{start:5,end:5,acquisition:'renewal',role:'absolute_leader'});
    check(await role(next),'absolute_leader');
  });

  await scenario('a continuous multi-season active contract retains its role unchanged',async()=>{
    const current=await contract(307,10,{end:5,role:'bottle_carrier'});await rollover();
    check((await byId(current)).status,'active');check(await role(current),'bottle_carrier');
  });

  for(const acquisition of ['initial','free_agent','daily_auction','director_auction','direct_offer','academy']){
    await scenario(acquisition+' arrival never inherits a historical same-club role',async()=>{
      await contract(308,10,{role:'absolute_leader'});await rollover();
      const arrival=await contract(308,10,{start:5,end:5,acquisition});check(await role(arrival),null);
    });
  }

  await scenario('a new club does not inherit the departing club role',async()=>{
    await contract(309,11,{role:'absolute_leader'});await rollover();
    const arrival=await contract(309,10,{start:5,end:5,acquisition:'renewal'});check(await role(arrival),null);
  });

  await scenario('an old same-club role separated by a season gap is not restored',async()=>{
    await contract(310,10,{status:'completed',start:3,end:3,role:'co_leader'});await rollover();
    const returning=await contract(310,10,{start:5,end:5,acquisition:'renewal'});check(await role(returning),null);
  });

  await scenario('the latest matching NULL wins rather than the last non-NULL value',async()=>{
    await contract(311,10,{status:'completed',start:3,end:4,role:'road_captain',signed:'2026-09-01T10:00:00Z'});
    await contract(311,10,{role:null,signed:'2026-10-01T10:00:00Z'});
    const next=await contract(311,10,{status:'planned',start:5,end:5,acquisition:'renewal'});
    await rollover();check(await role(next),null);
  });

  await scenario('cancelled or terminated prior contracts cannot supply a role',async()=>{
    await contract(312,10,{status:'cancelled',role:'co_leader'});
    await contract(312,10,{status:'terminated',start:3,end:4,role:'road_captain'});
    const next=await contract(312,10,{status:'planned',start:5,end:5,acquisition:'renewal'});
    await rollover();check(await role(next),null);
  });

  await scenario('an accepted deferred transfer to another club keeps its independent role',async()=>{
    const previous=await contract(313,11,{role:'absolute_leader'});await auth(1);
    const proposal=await scalar('select public.submit_deferred_direct_transfer_offer($1,1000,null,null)',[id(313)]);
    const offer=typeof proposal==='string'?proposal:proposal.offerId;
    await auth(2);await scalar('select public.respond_to_direct_transfer_offer($1,true)',[offer]);await root();
    const next=await scalar('select effective_contract_id from public.direct_transfer_offers where id=$1',[offer]);
    check(await scalar('select status from public.direct_transfer_offers where id=$1',[offer]),'accepted');
    check(await role(next),null,'The future buyer has not assigned the old club role');
    await rollover();check(await role(next),null);check((await byId(next)).team_id,id(10));check(await role(previous),'absolute_leader');
    check(await scalar('select released_at is not null from public.direct_transfer_offers where id=$1',[offer]),true,'Normal deferred activation still releases escrow');
  });

  await scenario('owner authorization and optimistic batch baselines remain enforced',async()=>{
    await contract(314,10,{role:'domestique'});await auth(1);const next=await renew(314);await root();await rollover();
    await auth(2);await reject('select public.set_current_team_rider_squad_status($1,$2)',[id(314),'absolute_leader']);await root();check(await role(next),'domestique');
    await auth(1);await reject('select public.set_current_team_rider_squad_statuses($1)',[[{riderId:id(314),squadStatus:'co_leader',expectedStatus:'free_role'}]]);await root();check(await role(next),'domestique');
    await auth(1);check(await batch(314,'co_leader','domestique'),1);await root();check(await role(next),'co_leader');
  });

  await scenario('late activation failure rolls inheritance and all finance effects back',async()=>{
    await contract(315,10,{role:'lieutenant'});const next=await contract(315,10,{status:'planned',start:5,end:5,acquisition:'renewal'});
    await db.query("update public.seasons set status='completed' where id=$1",[id(4)]);
    const stable=await snapshot();
    await db.exec(`create function public.isolated_fail_squad_activation() returns trigger language plpgsql as $$begin if new.id='${next}'::uuid and new.status='active' then raise exception 'isolated role activation failure';end if;return new;end$$;
      create trigger zz_isolated_fail_squad_activation after update of status on public.rider_contracts for each row execute function public.isolated_fail_squad_activation();`);
    await reject("update public.seasons set status='active' where id=$1",[id(5)]);check(await snapshot(),stable,'The failed rollover preserves the planned NULL and normal finances');
  });

  check(await scalar("select has_function_privilege('authenticated','private.inherit_team_squad_status_on_renewal()','execute')"),false,'The helper cannot be called by a player');
  check(await scalar("select has_function_privilege('anon','private.inherit_team_squad_status_on_renewal()','execute')"),false,'Anonymous callers have no helper access');
}

const footer=[
  'console.log(JSON.stringify({ok:true,checks,scenarios,isolated:true,productionAccess:false,multiSessionConcurrency:false,migration:"20261106213000"}));',
  '}catch(error){console.error(JSON.stringify({ok:false,scenario:currentCase,checks,error:error.message,code:error.code,where:error.where}));process.exitCode=1;}',
  'finally{await db.close();}',
].join('\n');
const entry=baseline.slice(0,split)+'\n'+setup+
  '\nawait db.exec(readFileSync("supabase/migrations/20261102090000_add_deferred_direct_transfers.sql","utf8").replaceAll("\\r\\n","\\n"));\n'+
  'await ('+regressions.toString()+')({db,id,check,rows,scalar,root,auth,reject,scenario,snapshot,historicalFunction});\n'+footer;
await import('data:text/javascript;base64,'+Buffer.from(entry).toString('base64'));
