// Isolated PostgreSQL only. No credentials, HTTP or production connection.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('Pass a local PGlite module.');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const folder='C:/Dev/artifacts/managed-teams-s5-20261106/';
const metadata=JSON.parse(readFileSync(folder+'sponsor-repair-metadata.json','utf8'))[0].snapshot;
const live=JSON.parse(readFileSync(folder+'function-sponsor-repair.json','utf8'));
const identity=JSON.parse(readFileSync(folder+'identity.json','utf8'));
const migration=readFileSync('supabase/migrations/20261106173541_restore_managed_s5_sponsors.sql','utf8').replaceAll('\r\n','\n');
const body=migration.replace(/^begin;\n/,'').replace(/\ncommit;\n?$/,'');
const s4='c0c5824c-43a4-442e-907c-265c479efa0a',s5='7ea43c15-30fd-4878-b18f-ab2a43ad3be8';
const newContracts=['476e16f2-d644-41b0-9715-c4ac64ed9872','10e6063e-7928-43b8-a361-b9c2d0239413'];
let checks=0;
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows;
const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const state=async()=>({contracts:await rows('select * from team_sponsor_contracts order by id'),offers:await rows('select * from sponsor_offers order by id'),
  accounts:await rows('select * from team_seasons order by id'),ledger:await rows('select * from team_finance_transactions order by id')});
try{
  await db.exec(`create schema private;
    create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
    create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number int);
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text,reputation_points numeric);
    create table alpha_bot_managers(bot_key text,team_id uuid,sporting_director_id uuid,auth_user_id uuid,enabled bool);
    create table team_manager_assignments(team_id uuid,sporting_director_id uuid,role text,status text);
    create table sponsors(id uuid primary key,name text,country_id uuid,status text default 'active');
    create table sponsor_offers(id uuid primary key,sponsor_id uuid,season_id uuid,sporting_director_id uuid,
      title text,description text,budget_per_season numeric,base_budget_per_season numeric,negotiation_budget_ceiling numeric,
      objective_difficulty text,currency_code text,contract_duration_seasons int,available_from timestamptz,available_until timestamptz,
      status text,generation_version int,continuing_contract_id uuid,created_at timestamptz default now());
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,sponsor_id uuid,sponsor_offer_id uuid,
      role text,start_season_id uuid,end_season_id uuid,budget_per_season numeric,currency_code text,status text,
      contract_duration_seasons int,selected_jersey_id text,selected_jersey_style text,signed_at timestamptz,
      activated_at timestamptz,completed_at timestamptz,terminated_at timestamptz,termination_reason text,termination_season_id uuid,
      created_at timestamptz default now(),objective_season_id uuid,pending_sponsor_offer_id uuid,
      previous_registration_country_id uuid,previous_team_display_name text,previous_team_short_name text,
      pending_jersey_id text,pending_jersey_style text,pending_jersey_season_id uuid,
      satisfaction_score int default 0,satisfaction_updated_at timestamptz,objective_reputation_penalty int default 0,
      renewal_budget_adjustment_percent numeric default 0,reputation_budget_bonus_percent int default 0,
      reputation_investment_cost int default 0,reputation_penalty int default 0);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,registration_country_id uuid,
      cash_balance numeric,operating_budget numeric,next_sponsor_budget_bonus_percent numeric,display_name text,short_name text,
      currency text,currency_code text,created_at timestamptz,division_id uuid,final_rank int,finance_start_day_number int,
      negative_season_streak int,opening_cash_balance numeric,points numeric,scouting_reports_revealed_until timestamptz,
      spent_budget numeric,status text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,
      day_number int,amount numeric,category text,status text,description text,source_reference text,posted_at timestamptz,
      created_at timestamptz default now(),unique(team_season_id,source_reference));
    create table sponsor_annual_objective_history(team_sponsor_contract_id uuid,season_id uuid,budget_per_season numeric);
    create table rider_contracts(id uuid,rider_id uuid,team_id uuid,status text,salary_per_season numeric,start_season_id uuid);
    create table staff_contracts(id uuid,team_id uuid,status text);
    create table sponsor_objectives(id uuid,status text,objective_type text,satisfaction_points int,sponsor_offer_id uuid,season_id uuid);
    create table objective_progress(sponsor_objective_id uuid,team_sponsor_contract_id uuid,season_id uuid,details jsonb);
    create table sponsor_satisfaction_events(team_sponsor_contract_id uuid,season_id uuid,event_type text,points numeric);
    create table race_categories(id uuid,code text);create table race_editions(id uuid,race_category_id uuid,status text);
    create table race_registrations(id uuid,team_season_id uuid,race_edition_id uuid,status text,decided_at timestamptz);
    create table race_rosters(race_registration_id uuid,status text);
    create function public.get_team_specialization_power(uuid,text,text) returns numeric language sql as $$select 0::numeric$$;
    create function private.sponsor_partial_objective_points(int,jsonb) returns numeric language sql as $$select 0::numeric$$;
    create function public.withdraw_ineligible_federation_candidates(uuid) returns void language sql as $$select$$;
    create function public.enforce_federation_president_nationality() returns void language sql as $$select$$;
    insert into seasons values('${s4}',4,'completed',28),('${s5}',5,'active',1);
    insert into season_days(season_id,day_number) select '${s5}',n from generate_series(7,28,7)n;
  `);
  for(const t of identity.filter(t=>['antoine_morel_29','giulia_rinaldi'].includes(t.bot_key))){
    await db.query('insert into sporting_directors values($1,$2,\'active\',$3)',[t.director_id,t.auth_user_id,t.reputation_points]);
    await db.query('insert into alpha_bot_managers values($1,$2,$3,$4,false)',[t.bot_key,t.team_id,t.director_id,t.auth_user_id]);
    await db.query("insert into team_manager_assignments values($1,$2,'general_manager','active')",[t.team_id,t.director_id]);
  }
  const names=new Map([['817db772-6373-4b4a-bb01-a78b1107d546','Maison Lannic'],['61c5aac7-4917-48ed-b861-ebf5eea2d754','Đông Dương Phanh']]);
  for(const c of metadata.contracts){
    await db.query('insert into sponsors(id,name,country_id) values($1,$2,$3)',[c.sponsor_id,names.get(c.team_id),c.sponsor_country_id]);
    const director=identity.find(t=>t.team_id===c.team_id).director_id;
    await db.query(`insert into sponsor_offers(id,sponsor_id,season_id,sporting_director_id,title,budget_per_season,
      base_budget_per_season,negotiation_budget_ceiling,objective_difficulty,currency_code,contract_duration_seasons,status,generation_version)
      values($1,$2,$3,$4,'Historical S4 offer',$5,$5,$5,'balanced','EUR',1,'accepted',10)`,[c.sponsor_offer_id,c.sponsor_id,s4,director,c.budget_per_season]);
    await db.query('insert into team_sponsor_contracts select (jsonb_populate_record(null::team_sponsor_contracts,$1::jsonb)).*',[JSON.stringify(c)]);
  }
  for(const a of metadata.accounts)await db.query('insert into team_seasons select(jsonb_populate_record(null::team_seasons,$1::jsonb)).*',[JSON.stringify(a)]);
  for(const f of metadata.ledger)await db.query('insert into team_finance_transactions select(jsonb_populate_record(null::team_finance_transactions,$1::jsonb)).*',[JSON.stringify(f)]);
  for(const c of metadata.constraints)await db.exec(`alter table public.team_sponsor_contracts add constraint "${c.name}" ${c.definition};`);
  const loaded=new Set();
  for(const signature of [
    'initialize_professional_team_finances(uuid)','sync_sponsor_installments(uuid)','handle_finance_contract_change()',
    'private.prevent_sponsor_team_conflicts()','private.enforce_global_sponsoring_unlock()','apply_media_sponsor_contract_bonus()',
    'private.capture_team_sponsor_previous_country()','private.sync_team_sponsor_country()','align_team_country_with_principal_sponsor()',
    'synchronize_s3_sponsor_satisfaction_score()','handle_sponsor_federation_eligibility_change()',
    'withdraw_team_from_regional_races_after_sponsoring()'
  ]){const f=live.find(f=>f.signature===signature);assert.ok(f,signature);await db.exec(f.definition);loaded.add(signature);}
  for(const t of metadata.triggers){
    const signature=t.definition.match(/EXECUTE FUNCTION ([^(]+\(\))/)?.[1]?.replace(/^public\./,'');
    if(signature&&loaded.has(signature))await db.exec(t.definition+';');
  }
  const baseline=await state();
  await db.exec('begin');await db.exec(body);
  const after=await state();
  check(after.contracts.length,4,'exactly two new S5 contracts');
  check(after.offers.length,4,'exactly two new accepted S5 offers');
  check(after.ledger.length-baseline.ledger.length,8,'only eight normal future sponsor entries');
  for(const original of baseline.contracts)check(after.contracts.find(c=>c.id===original.id),original,'old S4 contract byte-for-byte intact');
  for(const original of baseline.offers)check(after.offers.find(c=>c.id===original.id),original,'old S4 offer intact');
  check(after.accounts.filter(a=>a.season_id===s4),baseline.accounts.filter(a=>a.season_id===s4),'all S4 accounts/countries/cash unchanged');
  check(after.ledger.filter(f=>baseline.ledger.some(o=>o.id===f.id)),baseline.ledger,'all S4 ledger rows unchanged');
  for(const original of baseline.accounts.filter(a=>a.season_id===s5))check(after.accounts.find(a=>a.id===original.id).cash_balance,original.cash_balance,'no immediate cash granted');
  for(let i=0;i<2;i++){
    const c=after.contracts.find(c=>c.id===newContracts[i]);
    const f=after.ledger.filter(f=>f.source_reference.startsWith('sponsor:'+c.id+':'));
    check(c.start_season_id,s5,'new contract starts in S5');check(c.end_season_id,s5,'new contract ends in S5');
    check(c.contract_duration_seasons,1,'one authorized season only');check(c.satisfaction_score,0,'new S5 score starts at zero');
    check(f.map(x=>x.day_number).sort((a,b)=>a-b),[7,14,21,28],'four standard due dates');
    check(f.every(x=>x.status==='pending'),true,'all eight future payments remain pending');
    check(f.reduce((n,x)=>n+Number(x.amount),0),Number(c.budget_per_season),'annual budget paid exactly once');
    check(Number(after.accounts.find(a=>a.team_id===c.team_id&&a.season_id===s5).operating_budget),Number(c.budget_per_season),'S5 operating budget aligned');
    check(after.accounts.find(a=>a.team_id===c.team_id&&a.season_id===s5).registration_country_id,metadata.contracts.find(o=>o.team_id===c.team_id).sponsor_country_id,'normal sponsor country alignment applies only S5');
  }
  await db.exec(body);check(await state(),after,'replay creates no duplicates or cash changes');
  await db.exec('rollback');check(await state(),baseline,'successful fixture rollback restores baseline');
  const fails=async(setup,label)=>{
    await db.exec('begin');await db.exec(setup);
    await assert.rejects(()=>db.exec(body),label);checks++;
    await db.exec('rollback');check(await state(),baseline,label+' leaves no partial renewal');
  };
  await fails(`update seasons set current_day_number=2 where id='${s5}'`,'refuse changed day');
  await fails("update team_sponsor_contracts set budget_per_season=340001 where id='d77de87f-c544-43d2-897c-2ae80842cdcb'",'second team drift rolls back first renewal');
  await fails(`delete from season_days where season_id='${s5}' and day_number=21`,'missing payment date rolls back both renewals');
  await fails(`update team_seasons set next_sponsor_budget_bonus_percent=1 where season_id='${s5}'`,'unexpected bonus requires new audit');
  await fails(`create function poison_sponsor_cash() returns trigger language plpgsql as $$begin update team_seasons set cash_balance=cash_balance+1 where team_id=new.team_id and season_id='${s5}';return new;end$$;
    create trigger zz_poison after insert on team_sponsor_contracts for each row execute function poison_sponsor_cash();`,'detect immediate cash side effect');
  await fails(`create function poison_sponsor_history() returns trigger language plpgsql as $$begin update team_seasons set spent_budget=spent_budget+1 where team_id=new.team_id and season_id='${s4}';return new;end$$;
    create trigger zz_poison after insert on team_sponsor_contracts for each row execute function poison_sponsor_history();`,'detect S4 history side effect');
  await fails(`create function poison_sponsor_payment() returns trigger language plpgsql as $$begin update team_finance_transactions set amount=amount+1 where id=new.id;return new;end$$;
    create trigger zz_poison after insert on team_finance_transactions for each row execute function poison_sponsor_payment();`,'detect wrong installment total');
  console.log(JSON.stringify({checks,realFinancialFunctions:true,constraints:metadata.constraints.length,isolated:true,productionTouched:false}));
}catch(error){console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail,stack:error.name==='AssertionError'?error.stack:undefined},null,2));process.exitCode=1;}
finally{await db.close();}
