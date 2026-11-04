// Disposable local PostgreSQL only. No production credentials or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();let checks=0;
const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const rows=async(sql,params=[])=> (await db.query(sql,params)).rows;
const scalar=async(sql,params=[])=>Object.values((await rows(sql,params))[0])[0];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const read=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8').replaceAll('\r\n','\n');
const table=(source,name)=>{const start=source.indexOf(`create table public.${name} (`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n);',start)+4);};
const migration=read('20261104170000_add_ten_day_welcome_coach_campaign');
const baseline=JSON.parse(readFileSync('scripts/fixtures/welcome-coach-core-baseline.json','utf8'));
process.on('uncaughtException',error=>{console.error(error.message?.slice(0,1600),error.where??'');process.exitCode=1;});
await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create table auth.users(id uuid primary key,created_at timestamptz not null);
 create table countries(id uuid primary key);
 create table seasons(id uuid primary key,game_year int,status text);
 create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid references seasons,day_number int);
 create table teams(id uuid primary key,home_country_id uuid references countries);
 create table sporting_directors(id uuid primary key,auth_user_id uuid references auth.users on delete cascade,status text);
 create table team_seasons(id uuid primary key,team_id uuid references teams,season_id uuid references seasons,country_id uuid references countries,currency_code text,status text,cash_balance numeric default 10000,unique(team_id,season_id));
 create table initial_career_generations(id uuid primary key,team_id uuid references teams,season_id uuid references seasons,sporting_director_id uuid references sporting_directors on delete cascade);
 create table riders(id uuid primary key,first_name text,last_name text);
 create table rider_contracts(rider_id uuid references riders,team_id uuid references teams,start_season_id uuid references seasons);
 create table alpha_bot_managers(sporting_director_id uuid references sporting_directors on delete cascade);
 create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid references team_seasons,season_day_id uuid references season_days,day_number int,amount numeric,category text,status text,description text,source_reference text,unique(team_season_id,source_reference));
 create table sporting_director_messages(id uuid primary key default gen_random_uuid(),sporting_director_id uuid references sporting_directors on delete cascade,season_id uuid references seasons,team_season_id uuid references team_seasons,message_type text,sender_name text,subject text,preview text,body text,action_href text,action_label text,source_reference text,is_important boolean,unique(sporting_director_id,source_reference));
 insert into countries values('${id(1)}'),('${id(2)}');
 insert into seasons values('${id(4)}',4,'active'),('${id(5)}',5,'planned');
 insert into season_days(season_id,day_number)select id,n from seasons cross join generate_series(1,28)n;
`);
const staff=read('20260721160000_create_staff_management');
await db.exec(table(staff,'staff_members'));
await db.exec(table(staff,'staff_contracts'));
await db.exec(`alter table staff_contracts add salary_waived_season_id uuid references seasons,
 add termination_compensation numeric,add termination_day_number integer;
 alter table staff_contracts drop constraint staff_contracts_signing_fee_positive;`);
for(const c of baseline.contract_constraints){await db.exec(`alter table staff_contracts drop constraint if exists ${c.name};alter table staff_contracts add constraint ${c.name} ${c.definition};`);}
const talents=read('20260727160000_create_unique_staff_talents');
await db.exec(table(talents,'staff_talent_catalog'));
await db.exec('alter table staff_talent_catalog add minimum_level int default 1;');
await db.exec(table(talents,'staff_member_talents'));
await db.exec(`insert into staff_talent_catalog(code,role,display_name)
 select 'trainer_'||x,'trainer',x from unnest(array['mountain','hills','flat','sprint','time_trial','cobbles','endurance'])x;`);
for(const name of ['calculate_staff_salary','sync_staff_salary_installments','handle_staff_contract_finance_change'])await db.exec(baseline.functions.find(f=>f.signature.startsWith(name+'(')).definition);
await db.exec(`create trigger staff_contract_finance_sync after insert or update of status,salary_per_season,salary_waived_season_id on staff_contracts for each row execute function handle_staff_contract_finance_change();`);
let sequence=100;
async function account(at,{state='active',bot=false,first='Camille',scout=false,year=4,found=true}={}){
 const n=(sequence+=20),a=id(n),director=id(n+1),team=id(n+2),generation=id(n+3);
 await db.query('insert into auth.users values($1,$2)',[a,at]);
 await db.query('insert into sporting_directors values($1,$2,$3)',[director,a,state]);
 await db.query('insert into teams values($1,$2)',[team,id(1)]);
 for(const y of [4,5])await db.query('insert into team_seasons(id,team_id,season_id,country_id,currency_code,status)values($1,$2,$3,$4,$5,$6)',[id(n+y),team,id(y),id(2),'EUR',y===4?'active':'planned']);
 await db.query('insert into riders values($1,$2,$3)',[id(n+6),first,'National']);
 await db.query('insert into rider_contracts values($1,$2,$3)',[id(n+6),team,id(year)]);
 if(bot)await db.query('insert into alpha_bot_managers values($1)',[director]);
 let oldContract=null;
 if(scout){
  const member=await scalar("insert into staff_members(country_id,first_name,last_name,role,level)values($1,'Existing','Scout','scout',1)returning id",[id(1)]);
  oldContract=await scalar("insert into staff_contracts(staff_member_id,team_id,start_season_id,salary_per_season,currency_code,signing_fee,status)values($1,$2,$3,15000,'EUR',0,'active')returning id",[member,team,id(year)]);
 }
 if(found)await db.query('insert into initial_career_generations values($1,$2,$3,$4)',[generation,team,id(year),director]);
 return {a,director,team,generation,year,oldContract};
}
const old=await account('2026-01-01T00:00:00Z');
await db.exec(migration);
const campaign=(await rows('select starts_at::text start,ends_at::text finish from private.welcome_coach_campaigns'))[0];
check(await scalar("select extract(epoch from ends_at-starts_at)::int from private.welcome_coach_campaigns"),864000,'Exactly ten real days');
check(await scalar('select count(*)::int from private.welcome_coach_grants'),0,'No existing careers awarded');
const stamp=async delta=>scalar("select (starts_at+$1::interval)::text from private.welcome_coach_campaigns",[delta]);
const start=await stamp('0 seconds'),inside=await stamp('1 second');
const eligible=await account(start,{scout:true});
const gift=(await rows(`select g.*,m.role,m.level,m.country_id,m.trainer_specialty,c.salary_per_season,c.salary_waived_season_id,c.signing_fee,c.status from private.welcome_coach_grants g join staff_members m on m.id=g.staff_member_id join staff_contracts c on c.id=g.staff_contract_id where g.auth_user_id=$1`,[eligible.a]))[0];
check(gift.role,'trainer');check(gift.level,3);check(gift.country_id,id(2),'Team nationality, not manager/home nationality');
check(gift.status,'active');check(Number(gift.signing_fee),0);check(gift.salary_waived_season_id,id(4));
check(Number(gift.salary_per_season),Number(await scalar("select calculate_staff_salary('trainer',3)")));
check(await scalar('select count(*)::int from staff_contracts where team_id=$1',[eligible.team]),2,'Additional to existing staff');
check(await scalar('select count(*)::int from staff_member_talents where staff_member_id=$1',[gift.staff_member_id]),1);
check(await scalar('select talent_code from staff_member_talents where staff_member_id=$1',[gift.staff_member_id])==='trainer_'+gift.trainer_specialty,false,'Complementary specialty is distinct');
check(await scalar("select count(*)::int from team_finance_transactions where team_season_id=$1 and source_reference like $2 and status='pending'",[id(Number(eligible.a.slice(-12))+4),`staff-contract:${gift.staff_contract_id}:%`]),0,'No arrival-season salary due');
check(await scalar("select count(*)::int from team_finance_transactions where source_reference like $1 and status='pending'",[`staff-contract:${eligible.oldContract}:${id(4)}:%`]),4,'Existing staff salaries retained');
check(await scalar("select count(*)::int from team_finance_transactions where source_reference like $1 and status='pending'",[`staff-contract:${gift.staff_contract_id}:${id(5)}:%`]),4,'Ordinary salary resumes next season');
check(await scalar('select min(cash_balance)::int from team_seasons where team_id=$1',[eligible.team]),10000,'No cash debit or added cash');
check(await scalar('select count(*)::int from sporting_director_messages where sporting_director_id=$1',[eligible.director]),1);
check(await scalar('select private.grant_welcome_coach($1)',[eligible.generation]),false,'Retry is idempotent');
check(await scalar('select count(*)::int from private.welcome_coach_grants where auth_user_id=$1',[eligible.a]),1);
for(const [offset,options,expected]of [
 ['-1 second',{},0],['10 days',{},0],['10 days -1 second',{},1],
 ['2 seconds',{state:'suspended'},0],['3 seconds',{bot:true},0],['4 seconds',{first:''},1],['5 seconds',{year:5},1],
]){
 const person=await account(await stamp(offset),options);
 check(await scalar('select count(*)::int from private.welcome_coach_grants where auth_user_id=$1',[person.a]),expected,`Eligibility ${offset}/${JSON.stringify(options)}`);
}
// A career reset cannot erase the account's one-time receipt.
await db.query('delete from initial_career_generations where id=$1',[eligible.generation]);
check(await scalar('select generation_id from private.welcome_coach_grants where auth_user_id=$1',[eligible.a]),null);
await db.query('insert into initial_career_generations values($1,$2,$3,$4)',[id(9990),eligible.team,id(4),eligible.director]);
check(await scalar('select count(*)::int from staff_contracts where team_id=$1',[eligible.team]),2,'No second coach after a reset');
// The registered-at timestamp, not today's date, determines late team creation.
await db.exec("update private.welcome_coach_campaigns set starts_at=starts_at-interval '11 days',ends_at=ends_at-interval '11 days'");
const late=await account(await stamp('1 second'));
check(await scalar('select count(*)::int from private.welcome_coach_grants where auth_user_id=$1',[late.a]),1,'Late career after closing remains eligible');
await db.exec("update private.welcome_coach_campaigns set starts_at=starts_at+interval '11 days',ends_at=ends_at+interval '11 days'");
// Any optional failure rolls back its own writes, never the player's career.
await db.exec(`create function fail_test_coach()returns trigger language plpgsql as $$begin if new.first_name='Force' then raise exception 'isolated gift failure';end if;return new;end$$;
 create trigger fail_test_coach before insert on staff_members for each row execute function fail_test_coach();`);
const deferred=await account(inside,{first:'Force'});
check(await scalar('select count(*)::int from initial_career_generations where id=$1',[deferred.generation]),1,'Registration survives an optional failure');
check(await scalar('select count(*)::int from private.welcome_coach_grants where auth_user_id=$1',[deferred.a]),0,'No partial grant');
check(await scalar('select count(*)::int from staff_contracts where team_id=$1',[deferred.team]),0);
await db.exec('drop trigger fail_test_coach on staff_members');
check(await scalar('select private.grant_welcome_coach($1)',[deferred.generation]),true,'Exactly-once recovery works');
for(const role of ['anon','authenticated']){
 check(await scalar(`select has_function_privilege('${role}','private.grant_welcome_coach(uuid)','execute')`),false);
 check(await scalar(`select has_table_privilege('${role}','private.welcome_coach_grants','select')`),false);
}
const count=await scalar('select count(*)::int from private.welcome_coach_grants');
await db.exec(migration);
check((await rows('select starts_at::text start,ends_at::text finish from private.welcome_coach_campaigns'))[0],campaign,'Reapplication preserves exact window');
check(await scalar('select count(*)::int from private.welcome_coach_grants'),count,'Reapplication grants nothing again');
check(await scalar('select private.grant_welcome_coach($1)',[old.generation]),false,'Old accounts remain excluded');
await db.query('delete from auth.users where id=$1',[deferred.a]);
check(await scalar('select count(*)::int from private.welcome_coach_grants where auth_user_id=$1',[deferred.a]),0,'Account deletion is not blocked');
console.log(JSON.stringify({checks,result:'passed',realSalaryFunctions:true,tenDayBoundaries:true,additionalNationalCoach:true,noDuplicateOrCashChange:true,freeArrivalSeason:true,nextSeasonSalaryRetained:true,optionalFailureRecovery:true}));
await db.close();
