// Real migration chain in isolated PostgreSQL/WASM. This harness has no network,
// credentials, Supabase connection or production execution path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

const modulePath=process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
assert.ok(isAbsolute(modulePath)&&modulePath.replaceAll('\\','/').endsWith('/@electric-sql/pglite/dist/index.js'),'An absolute local PGlite module is required');
const fixtureUrl=new URL('./test-secondary-sponsor-library-sql.mjs',import.meta.url);
const fixture=readFileSync(fixtureUrl,'utf8').replaceAll('\r\n','\n');
const boundary='  await rejects(()=>replace(2,oldPayload),/bibliothèque/);';
assert.equal(fixture.split(boundary).length,2,'Reviewed canonical V3 bootstrap changed');
const bootstrap=fixture.slice(0,fixture.indexOf(boundary)).replaceAll('import.meta.url',JSON.stringify(fixtureUrl.href));
const exercise=String.raw`
  // Seed the actual previous public API before installing the new migration.
  await replace(2); await replace(3);
  const oldOpen=(await rows("select id from secondary_sponsor_offers where team_id=$1 and status='open' order by id",[id(302)])).map(row=>row.id);
  const oldSigned=await scalar("select id from secondary_sponsor_offers where team_id=$1 and secondary_sponsor_id=$2 and status='open'",[id(303),fr]);
  await asUser(203,'select public.sign_secondary_sponsor_offer($1)',[oldSigned]);
  const paidGoal=await scalar('select id from secondary_sponsor_objectives where offer_id=$1',[id(1501)]);
  await db.query("insert into team_finance_transactions(team_season_id,day_number,amount,category,status,description,source_reference,posted_at) values($1,23,900000,'sponsor','posted','Historical paid fixture',$2,now())",[id(401),'secondary-sponsor-objective:'+paidGoal]);
  const allTables=['secondary_sponsor_offers','secondary_sponsor_contracts','secondary_sponsor_objectives','secondary_sponsor_catalog','sponsors','team_finance_transactions','team_seasons','reputation_ledger'];
  const beforeInstall=Object.fromEntries(await Promise.all(allTables.map(async table=>[table,await snapshot(table)])));
  const untouchedNames=['private.settle_secondary_sponsor_objective()','private.evaluate_secondary_sponsor_objectives_after_race()',
    'private.apply_secondary_sponsor_team_season_transition()','private.evaluate_secondary_sponsor_roster(uuid,uuid)'];
  const functionDefs=async()=>rows('select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where oid=any($1::regprocedure[]) order by 1',[untouchedNames]);
  const unchangedDefinitions=await functionDefs();
  await db.exec(read('../supabase/migrations/20261128213500_varied_secondary_sponsor_rewards.sql'));
  for(const table of allTables)check(await snapshot(table),beforeInstall[table],table+' is untouched by installation');
  check(await functionDefs(),unchangedDefinitions,'Race evaluation, rollover and payment functions stay byte-identical');
  check(await number("select count(*) from pg_trigger where tgrelid='public.team_sponsor_contracts'::regclass and tgname='secondary_sponsor_budget_changed'"),0,'Destructive budget repricing trigger is removed');
  check(await number("select count(*) from pg_trigger where tgrelid='public.team_sponsor_contracts'::regclass and tgname='secondary_sponsor_principal_changed'"),1,'Principal identity/nationality invalidation is retained');

  const varied=structuredClone(payload);
  varied[0].objectives.forEach((goal,index)=>{goal.cash_reward=index===4?100000:200000;goal.reputation_penalty=index===4?0:10;});
  varied[1].objectives.forEach(goal=>{goal.cash_reward=260000;goal.reputation_penalty=15;});
  varied[2].objectives.forEach(goal=>{goal.cash_reward=400000;goal.reputation_penalty=25;});
  const replaceV4=(team,proposals=varied,version=4)=>scalar('select public.replace_secondary_sponsor_offers($1,$2,$3,$4::jsonb,$5)',[id(100+team),id(300+team),id(501),JSON.stringify(proposals),version]);
  const terms=offerId=>rows('select id,display_order,race_edition_id,objective_kind,target_country_id,required_rider_count,cash_reward::text,reputation_penalty::text,status from secondary_sponsor_objectives where offer_id=$1 order by display_order,id',[offerId]);
  const total=offerId=>number('select sum(cash_reward) from secondary_sponsor_objectives where offer_id=$1',[offerId]);
  const signedTerms=await terms(oldSigned);
  const legacyPlannedTerms=await terms(id(1500));
  const legacyActiveTerms=await terms(id(1501));
  for(const version of [2,3,5])await rejects(()=>replaceV4(2,varied,version),/rééquilibrées/);
  await rejects(()=>asUser(202,'select public.sign_secondary_sponsor_offer($1)',[oldOpen[0]]),/rééquilibrées/);
  check(await rows("select id from secondary_sponsor_offers where team_id=$1 and status='open' order by id",[id(302)]),oldOpen.map(id=>({id})),'Rejecting stale clients never deletes their offers');
  const equal=structuredClone(varied);equal[2].objectives.forEach(goal=>{goal.cash_reward=260000;});
  await rejects(()=>replaceV4(2,equal),/dotations différentes/);
  const roundedEqual=structuredClone(varied);roundedEqual.forEach((proposal,index)=>proposal.objectives.forEach(goal=>{goal.cash_reward=0.011+index/1000;}));
  await rejects(()=>replaceV4(2,roundedEqual),/dotations différentes/);
  const duplicate=structuredClone(varied);duplicate[1].secondary_sponsor_id=fr;
  await rejects(()=>replaceV4(2,duplicate),/trois marques distinctes/);
  const quota=structuredClone(varied);quota[0].objectives[4].required_rider_count=3;
  await rejects(()=>replaceV4(2,quota),/10 %/);
  const oversized=structuredClone(varied);oversized[0].objectives[0].cash_reward=5000001;
  await rejects(()=>replaceV4(2,oversized),/prime ou le risque/);
  await db.exec('begin');
  try{
    const maximum=structuredClone(varied);maximum[0].objectives[0].cash_reward=5000000;
    check(await replaceV4(2,maximum),true,'The existing five-million per-objective validation bound remains inclusive');
    const maximumOffer=await scalar("select id from secondary_sponsor_offers where team_id=$1 and secondary_sponsor_id=$2 and status='open'",[id(302),fr]);
    check(await number('select max(cash_reward) from secondary_sponsor_objectives where offer_id=$1',[maximumOffer]),5000000,'A valid large reward is not silently reduced to thirty percent');
  }finally{await db.exec('rollback');}
  await rejects(()=>scalar('select public.replace_secondary_sponsor_offers($1,$2,$3,$4::jsonb,4)',[id(101),id(302),id(501),JSON.stringify(varied)]),/équipe ne dépend/);

  await db.exec('set role service_role');
  try{check(await replaceV4(2),true,'The service-role entry point creates varied V4 offers');}finally{await db.exec('reset role');}
  const fresh=await rows("select id,secondary_sponsor_id,generation_version,principal_budget_per_season::text,maximum_reward_budget::text from secondary_sponsor_offers where team_id=$1 and status='open' order by secondary_sponsor_id",[id(302)]);
  check(fresh.length,3,'Exactly three proposals are created');
  check(fresh.map(offer=>offer.generation_version),[4,4,4],'The completed set is atomically marked V4');
  check(fresh.some(offer=>oldOpen.includes(offer.id)),false,'Refreshing old capped quotes replaces their stale identifiers');
  const expectedTotals=new Map([[fr,900000],[co,1300000],[am,2000000]]);
  for(const offer of fresh){
    check(await total(offer.id),expectedTotals.get(offer.secondary_sponsor_id),'An above-thirty-percent promise is retained without clipping');
    check(Number(offer.maximum_reward_budget),expectedTotals.get(offer.secondary_sponsor_id),'The stored envelope is the exact contractual total');
    check(Number(offer.principal_budget_per_season),2000000,'The quote retains its primary-budget reference');
  }
  const completeQuotes=await snapshot('secondary_sponsor_objectives');
  check(await replaceV4(2),false,'Refreshing V4 is idempotent');
  check(await snapshot('secondary_sponsor_objectives'),completeQuotes,'A normal refresh preserves all quoted terms');
  check(await replaceV4(3),false,'Previously signed canonical V3 agreements are never replaced');
  check(await terms(oldSigned),signedTerms,'Previously signed canonical V3 objectives are preserved');
  await db.exec("update team_sponsor_contracts set budget_per_season=1000000 where team_id=fixture_id(302);update team_sponsor_contracts set budget_per_season=500000 where team_id=fixture_id(303)");
  check(await snapshot('secondary_sponsor_objectives'),completeQuotes,'Reducing principal budgets cannot reduce quoted or signed rewards');
  await db.exec("update team_sponsor_contracts set budget_per_season=3000000 where team_id=fixture_id(302)");
  check(await snapshot('secondary_sponsor_objectives'),completeQuotes,'Increasing a principal budget cannot change existing promises either');

  const pick=fresh.find(offer=>offer.secondary_sponsor_id===fr).id;
  await rejects(()=>asUser(200,'select public.sign_secondary_sponsor_offer($1)',[pick]),/rééquilibrées/);
  await db.exec("update team_sponsor_contracts set budget_per_season=0 where team_id=fixture_id(302)");
  await rejects(()=>asUser(202,'select public.sign_secondary_sponsor_offer($1)',[pick]),/sponsor principal couvrant/);
  await rejects(()=>replaceV4(2),/sponsor principal couvrant/);
  check(await snapshot('secondary_sponsor_objectives'),completeQuotes,'An unavailable primary never zeroes rewards or alters another contract');
  await db.exec("update team_sponsor_contracts set budget_per_season=1000000 where team_id=fixture_id(302)");
  const contract=(await asUser(202,'select public.sign_secondary_sponsor_offer($1)',[pick])).rows[0].sign_secondary_sponsor_offer;
  check(await scalar('select status from secondary_sponsor_contracts where id=$1',[contract]),'planned','An authenticated owner can sign a varied quote');
  check(await total(pick),900000,'Signing preserves the whole promise even when it is 90 percent of the current primary');
  check(await terms(oldSigned),signedTerms,'Signing another agreement never touches the previous canonical contract');
  check(await replaceV4(2),false,'A signed V4 agreement is not regenerated');
  await rejects(()=>asUser(202,'select public.sign_secondary_sponsor_offer($1)',[pick]),/rééquilibrées/);
  await db.exec("update team_sponsor_contracts set budget_per_season=10000 where team_id=fixture_id(302)");
  check(await total(pick),900000,'A signed planned contract survives later primary-budget cuts unchanged');
  check(await terms(id(1500)),legacyPlannedTerms,'The signed legacy planned agreement remains exact');
  check(await terms(id(1501)),legacyActiveTerms,'The active paid legacy agreement remains exact');
  check(await snapshot('team_finance_transactions'),beforeInstall.team_finance_transactions,'Generation and signing never issue compensation or fictional payouts');
  check(await snapshot('reputation_ledger'),beforeInstall.reputation_ledger,'Generation and signing never issue reputation changes');

  const acl=(await rows("select has_function_privilege('service_role','public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer)','execute') service_generation,has_function_privilege('authenticated','public.replace_secondary_sponsor_offers(uuid,uuid,uuid,jsonb,integer)','execute') player_generation,has_function_privilege('authenticated','public.sign_secondary_sponsor_offer(uuid)','execute') player_sign,has_function_privilege('anon','public.sign_secondary_sponsor_offer(uuid)','execute') anonymous_sign,has_function_privilege('service_role','private.replace_secondary_sponsor_offers_budgeted(uuid,uuid,uuid,jsonb,integer)','execute') private_generation,has_function_privilege('authenticated','private.sign_secondary_sponsor_offer_budgeted(uuid)','execute') private_sign,has_function_privilege('service_role','private.apply_secondary_sponsor_budget_cap(uuid,boolean)','execute') old_cap"))[0];
  check(acl,{service_generation:true,player_generation:false,player_sign:true,anonymous_sign:false,private_generation:false,private_sign:false,old_cap:false},'Only the intended API entry points remain accessible');
  await db.exec('set role authenticated');
  try{await rejects(()=>replaceV4(2),/permission denied/);}finally{await db.exec('reset role');}

  // Exercise the unchanged real rollover and idempotent settlement triggers.
  await db.exec("update seasons set status='completed' where id=fixture_id(500);update seasons set status='active' where id=fixture_id(501);update team_seasons set status='active' where id=fixture_id(412)");
  check(await scalar('select status from secondary_sponsor_contracts where id=$1',[contract]),'active','Real rollover activates the varied contract');
  const pickGoal=await scalar("select id from secondary_sponsor_objectives where offer_id=$1 and objective_kind='race_result' order by display_order limit 1",[pick]);
  await db.query("update secondary_sponsor_objectives set status='achieved',settled_at=now() where id=$1",[pickGoal]);
  const ledgerRef='secondary-sponsor-objective:'+pickGoal;
  check(await number('select amount from team_finance_transactions where team_season_id=$1 and source_reference=$2',[id(412),ledgerRef]),200000,'The contractual objective is paid in full');
  await db.query("update secondary_sponsor_objectives set status='achieved',settled_at=now() where offer_id=$1 and status='active'",[pick]);
  check(await number("select sum(amount) from team_finance_transactions where team_season_id=$1 and category='sponsor'",[id(412)]),900000,'All actual rewards can exceed thirty percent without any settlement clipping');
  check(await number('select cash_balance from team_seasons where id=$1',[id(412)]),1000000,'Actual cash receives every contractual reward exactly');
  const paidLedger=await snapshot('team_finance_transactions');
  await db.query("update secondary_sponsor_objectives set status='active' where id=$1",[pickGoal]);
  await db.query("update secondary_sponsor_objectives set status='achieved',settled_at=now() where id=$1",[pickGoal]);
  check(await snapshot('team_finance_transactions'),paidLedger,'The settlement ledger prevents paying a repeated achievement twice');
  check(await number('select cash_balance from team_seasons where id=$1',[id(412)]),1000000,'An achievement replay cannot inflate cash');
  console.log(JSON.stringify({isolatedPostgresAssertions:checks,productionAccess:false,fixtures:'synthetic only',migrationWrites:0,threeDistinctEnvelopes:true,aboveThirtyPercentPaid:true,signedTermsPreserved:true}));
}finally{await db.close();}
`;

try{
  await import('data:text/javascript;base64,'+Buffer.from(bootstrap+exercise).toString('base64'));
}catch(error){
  console.error(JSON.stringify({message:error.message,actual:error.actual,expected:error.expected,detail:error.detail,where:error.where},null,2));
  process.exitCode=1;
}
