// Isolated PostgreSQL only. No credentials, network, player recovery or production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fixture=readFileSync('scripts/test-future-draft-performance-sql.mjs','utf8').replaceAll('\r\n','\n');
const boundary=fixture.indexOf('  // Freeze a real S5 pool using its actual rollover receipt hook before install.');
assert.ok(boundary>0,'Expected isolated bootstrap');

async function regressions({db,id,rows,value,check}) {
  const fs=await import('node:fs/promises');
  const baseline=JSON.parse(await fs.readFile('scripts/fixtures/draft-preferences-baseline.json','utf8')).rows;
  for(const fn of baseline)await db.exec(fn.definition);
  await db.exec(`create schema if not exists private;alter table seasons add column ends_on date;
    update seasons set status='completed' where id='${id(4)}';update seasons set status='active' where id='${id(5)}';
    insert into seasons(id,game_year,name,status,starts_on,current_day_number)values('${id(6)}',6,'S6','planned',current_date+28,1);
    create table test_draft_capacity(team_id uuid,game_year int,allowed boolean,primary key(team_id,game_year));
    create or replace function can_team_reserve_roster_rider(uuid,int,uuid)returns boolean language sql stable set search_path=public as $$
      select coalesce((select allowed from test_draft_capacity where team_id=$1 and game_year=$2),true)
        and get_team_roster_commitment_count($1,$2)<get_team_roster_limit($1)$$;
    create function test_draft_salary_discount()returns trigger language plpgsql set search_path=public as $$begin
      new.salary_per_season:=round(new.salary_per_season*(1-.03*get_team_specialization_power(new.team_id,'recruitment_data_room','deal_room')),2);return new;end$$;
    create trigger z_test_draft_salary_discount before insert on rider_contracts for each row execute function test_draft_salary_discount();`);
  // Use the real contract extension trigger, not a hand-written approximation.
  const duration=(await fs.readFile('supabase/migrations/20261106140000_guarantee_recruited_rider_next_season.sql','utf8')).replaceAll('\r\n','\n');
  const durationStart=duration.indexOf('create function private.ensure_recruited_rider_next_season_contract()');
  const durationEnd=duration.indexOf('-- Keep previews, early capacity checks');
  assert.ok(durationStart>0&&durationEnd>durationStart);await db.exec(duration.slice(durationStart,durationEnd));

  const edition=id(9000),r1=id(2001),r2=id(2002);
  await db.query(`insert into season_draft_editions(id,game_year,season_id,previous_season_id,announcement_at,opens_at,starts_at,status,initialized_at,current_position,pick_deadline,participant_count,pool_count)
    values($1,5,$2,$3,now()-interval '3 hours',now()-interval '2 hours',now()-interval '1 hour','running',now()-interval '2 hours',1,now()+interval '10 minutes',3,5)`,[edition,id(5),id(4)]);
  for(let n=1;n<=3;n++){
    await db.query("insert into teams values($1,'active',35)",[id(100+n)]);
    await db.query("insert into sporting_directors values($1,$2,'active',true,now()-interval '100 days',$3)",[id(500+n),id(1000+n),'DS '+n]);
    await db.query("insert into team_manager_assignments values($1,$2,'general_manager','active')",[id(100+n),id(500+n)]);
    await db.query("insert into team_seasons values($1,$2,$3,'active',$4,0,-25000)",[id(4000+n),id(100+n),id(5),'Team '+n]);
    await db.query(`insert into season_draft_participants(edition_id,team_id,sporting_director_id,position,team_name,director_name,previous_points,registered_at,auto_enabled)
      values($1,$2,$3,$4,$5,$6,0,now()-interval '100 days',false)`,[edition,id(100+n),id(500+n),n,'Team '+n,'DS '+n]);
  }
  for(let n=1;n<=5;n++){
    await db.query("insert into riders values($1,$2,'Draft',$3,'free_agent',4,'classic',$4)",[id(2000+n),id(99),'Rider '+n,n]);
    await db.query(`insert into rider_season_ratings values($1,$2,25,${Array(13).fill(55).join(',')})`,[id(2000+n),id(5)]);
    await db.query(`insert into season_draft_riders(edition_id,rider_id,pool_rank,score,salary_per_season,snapshot)values($1,$2,$3,55,10000,'{"firstName":"Draft","lastName":"Rider"}')`,[edition,id(2000+n),n]);
  }
  const snapshot=async()=>({
    editions:await rows('select * from season_draft_editions order by id'),
    participants:await rows('select * from season_draft_participants order by position'),
    pool:await rows('select * from season_draft_riders order by pool_rank'),
    contracts:await rows('select * from rider_contracts order by id'),
    balances:await rows('select id,cash_balance from team_seasons order by id'),
  });
  const before=await snapshot();
  await db.exec(await fs.readFile('supabase/migrations/20261106203000_allow_draft_recruitment_with_negative_projection.sql','utf8'));
  check(await snapshot(),before,'Migration changes no resolved/pending player, pool, salary or finances');
  const auth=n=>db.query("select set_config('test.auth_uid',$1,false)",[id(1000+n)]);
  const player=async n=>(await rows('select * from season_draft_participants where edition_id=$1 and team_id=$2',[edition,id(100+n)]))[0];
  const pick=(n,rider=r1)=>value('select try_season_draft_pick($1,$2,$3)value',[edition,id(100+n),rider]);
  let scenarios=0;
  const scenario=async(name,body)=>{scenarios++;await db.exec('begin');try{await auth(1);await body();}catch(error){error.message=name+': '+error.message;throw error;}finally{await db.exec('rollback');}};

  await scenario('manual pick succeeds despite a negative projection, keeping payroll and duration',async()=>{
    check(await value('select get_projected_transfer_budget($1)value',[id(4001)]),'-25000','Negative fixture budget is real');
    check(await pick(1),'picked','A draft has no projected-budget veto');
    const contract=(await rows('select * from rider_contracts where rider_id=$1',[r1]))[0];
    check(Number(contract.salary_per_season),10000,'Normal salary is retained');check(contract.end_season_id,id(6),'Real duration trigger retains the following full season');
    check(Number(contract.transfer_fee),0,'No invented acquisition fee');check(contract.transfer_locked_season_id,id(5),'Resale lock remains intact');
    check(await value('select cash_balance value from team_seasons where id=$1',[id(4001)]),'-25000','No cash grant or imaginary upfront payment');
    check(await pick(1),'not_turn','Replay cannot duplicate a completed pick');
    check((await rows('select * from rider_contracts')).length,1,'One contract only');
  });
  await scenario('automatic negative-budget picks follow preference order and advance immediately',async()=>{
    await db.query('update season_draft_participants set auto_enabled=true,preferences=$2 where edition_id=$1 and position<=2',[edition,[r1,r2]]);
    await db.query('select advance_season_draft($1)',[edition]);
    check((await player(1)).selected_rider_id,r1,'First participant receives first choice immediately');
    check((await player(2)).selected_rider_id,r2,'Second participant skips taken first choice');
    check(await value('select current_position value from season_draft_editions where id=$1',[edition]),3,'No ten-minute pause between compatible automatic lists');
    check((await player(3)).status,'pending','Manual participant keeps their actual turn');
  });
  await scenario('already passed participant is never reopened by advancement',async()=>{
    await db.query("update season_draft_participants set status='passed',resolution_reason='timeout',resolved_at=now()-interval '1 minute',preferences=$2,auto_enabled=true where edition_id=$1 and position=1",[edition,[r1]]);
    const passed=await player(1);
    await db.query('update season_draft_participants set auto_enabled=true,preferences=$2 where edition_id=$1 and position=2',[edition,[r1]]);
    await db.query('select advance_season_draft($1)',[edition]);
    check(await player(1),passed,'All resolved metadata stays unchanged');
    check((await player(2)).selected_rider_id,r1,'Remaining pending participant can draft');
    check((await rows('select * from rider_contracts where team_id=$1',[id(101)])).length,0,'No retrospective Busan-style recovery');
  });
  await scenario('full current roster still prevents signing',async()=>{
    await db.query('update teams set roster_limit=0 where id=$1',[id(101)]);check(await pick(1),'roster_full','Current capacity remains enforced');
    check((await rows('select * from rider_contracts')).length,0,'No partial contract');
  });
  await scenario('full following-season roster still prevents signing',async()=>{
    await db.query('insert into test_draft_capacity values($1,6,false)',[id(101)]);check(await pick(1),'roster_full','S6 capacity remains enforced');
    check((await player(1)).status,'pending','Roster rejection does not fabricate a pick');
  });
  await scenario('automatic list skips future-capacity-incompatible candidates',async()=>{
    await db.query('insert into test_draft_capacity values($1,6,false)',[id(101)]);
    await db.query('update season_draft_participants set auto_enabled=true,preferences=$2 where edition_id=$1 and position=1',[edition,[r1,r2]]);
    await db.query('select advance_season_draft($1)',[edition]);check((await player(1)).status,'pending','No signing bypasses a real future capacity restriction');
  });
  await scenario('unavailable rider remains protected and next available preference is selected',async()=>{
    // Reconstruct a historical external contract locally, before the reservation
    // could protect it. Restore the real trigger before exercising either RPC.
    await db.exec('alter table rider_contracts disable trigger aa_season_draft_contract_reservation');
    await db.query("insert into rider_contracts(rider_id,team_id,start_season_id,end_season_id,status,acquisition_type,salary_per_season)values($1,$2,$3,$4,'active','initial',10000)",[r1,id(103),id(5),id(6)]);
    await db.exec('alter table rider_contracts enable trigger aa_season_draft_contract_reservation');
    check(await pick(1),'unavailable','Existing contract cannot be stolen');
    await db.query('update season_draft_participants set auto_enabled=true,preferences=$2 where edition_id=$1 and position=1',[edition,[r1,r2]]);
    await db.query('select advance_season_draft($1)',[edition]);check((await player(1)).selected_rider_id,r2,'Availability ordering survives budget removal');
  });
  await scenario('the normal payroll discount continues to apply',async()=>{
    await db.exec("create or replace function get_team_specialization_power(uuid,text,text)returns numeric language sql stable set search_path=public as $$select 2::numeric$$");
    check(await pick(1),'picked','Discounted recruit remains valid');
    check(Number(await value('select salary_per_season value from rider_contracts where rider_id=$1',[r1])),9400,'No salary is waived or doubled');
  });
  await scenario('draft choices no longer read unrelated transfer-budget reservations',async()=>{
    await db.exec("create or replace function get_projected_transfer_budget(uuid)returns numeric language plpgsql stable set search_path=public as $$begin raise exception 'Unexpected draft budget read';end$$");
    await db.query('update season_draft_participants set auto_enabled=true,preferences=$2 where edition_id=$1 and position=1',[edition,[r1]]);
    await db.query('select advance_season_draft($1)',[edition]);check((await player(1)).status,'picked','Neither selector nor worker invokes the removed projection gate');
  });
  return {scenarios,isolated:true,productionTouched:false};
}

const footer=`
  const result=await (${regressions.toString()})({db,id,rows,value,check});
  console.log(JSON.stringify({checks,...result}));
}catch(error){console.error(JSON.stringify({checks,message:error.message,where:error.where},null,2));process.exitCode=1;}
finally{await db.close();}`;
await import('data:text/javascript;base64,'+Buffer.from(fixture.slice(0,boundary)+footer).toString('base64'));
