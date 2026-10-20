// All fixtures live ONLY inside a disposable in-memory PostgreSQL database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.FINANCE_SQL_TEST_MODULE) throw Error('An isolated PGlite module is required');
const {PGlite}=await import(pathToFileURL(process.env.FINANCE_SQL_TEST_MODULE).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
let checks=0;
const check=(actual,expected)=>{assert.equal(actual,expected);checks++;};
const original=readFileSync('supabase/migrations/20261016120000_add_financial_director.sql','utf8');
const extract=name=>{const start=original.indexOf(`create function ${name}(`);if(start<0)throw Error(name);return original.slice(start,original.indexOf('$$;',start)+3);};
const migration=readFileSync('supabase/migrations/20261020100000_financial_director_base_income_and_salary_savings.sql','utf8');
try{
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create table countries(id uuid primary key);
 create table seasons(id uuid primary key,status text,current_day_number integer);
 create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
 create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text default 'active',registration_country_id uuid,cash_balance numeric default 0);
 create table staff_members(id uuid primary key,role text,level integer,country_id uuid);
 create table staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text default 'active',signed_at timestamptz default now());
 create table rider_contracts(id uuid primary key,team_id uuid);
 create table staff_talent_catalog(code text primary key,role text,display_name text,minimum_level integer,is_active boolean default true);
 create table staff_member_talents(staff_member_id uuid,slot_number integer,talent_code text,created_at timestamptz default now(),unique(staff_member_id,talent_code));
 create table team_sponsor_contracts(id uuid primary key,team_id uuid,role text);
 create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric check(amount<>0),category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
 insert into staff_talent_catalog(code,role,display_name,minimum_level) values
 ('finance_daily_income','financial_director','Réseau d’affaires',1),('finance_race_prizes','financial_director','Primes de performance',1),
 ('finance_main_sponsor','financial_director','Principal',1),('finance_secondary_sponsor','financial_director','Secondaire',1);
 insert into countries values('${id(1)}'),('${id(2)}');
 insert into seasons values('${id(3)}','active',7);
 insert into season_days values('${id(4)}','${id(3)}',7,(now() at time zone 'Europe/Paris')::date),
 ('${id(5)}','${id(3)}',14,(now() at time zone 'Europe/Paris')::date+7);
 insert into team_seasons(id,team_id,season_id,registration_country_id) values('${id(6)}','${id(7)}','${id(3)}','${id(1)}');
 insert into staff_members values('${id(10)}','financial_director',5,'${id(1)}'),('${id(11)}','trainer',5,'${id(1)}');
 insert into staff_contracts(id,staff_member_id,team_id,signed_at) values
 ('${id(12)}','${id(10)}','${id(7)}',now()-interval '2 days'),('${id(13)}','${id(11)}','${id(7)}',now()-interval '2 days');
 insert into rider_contracts values('${id(14)}','${id(7)}'),('${id(15)}','${id(999)}'),
 ('${id(16)}','${id(7)}'),('${id(17)}','${id(7)}'),('${id(18)}','${id(7)}');
 insert into staff_member_talents values('${id(10)}',1,'finance_daily_income',now()-interval '2 days');`);
 await db.exec(extract('public.settle_due_financial_director_income'));
 await db.exec(extract('private.credit_financial_director_transaction_bonus'));
 await db.exec(`create trigger financial_director_transaction_bonus after insert or update of status,amount on team_finance_transactions for each row when(new.category in('race_prize','sponsor')) execute function private.credit_financial_director_transaction_bonus();`);
 check(await scalar('select settle_due_financial_director_income()'),1);
 check(Number(await scalar('select cash_balance from team_seasons')),825);
 // A posted salary from before installation must never acquire a new saving.
 await db.query(`insert into team_finance_transactions(id,team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at) values($1,$2,$3,7,-10000,'staff_salary','posted','Historical salary',$4,now()-interval '1 day')`,[id(30),id(6),id(4),`staff-contract:${id(13)}:${id(3)}:1`]);
 await db.exec(migration);
 check(await scalar(`select count(*)::int from staff_talent_catalog where is_active and role='financial_director'`),5);
 check(await scalar(`select display_name from staff_talent_catalog where code='finance_daily_income'`),'Optimisation des charges');
 check(await scalar(`select count(*)::int from staff_member_talents`),1);
 check(await scalar('select settle_due_financial_director_income()'),0);
 check(Number(await scalar('select cash_balance from team_seasons')),825);
 check(await scalar(`select count(*)::int from private.financial_director_salary_savings`),0);
 await db.query(`update team_finance_transactions set amount=-12000 where id=$1`,[id(30)]);
 check(await scalar(`select count(*)::int from private.financial_director_salary_savings`),0);
 // A new team/day still gets income with any one of the five affixes.
 const salaryRef=(kind,contract,installment=1)=>`${kind}:${id(contract)}:${id(3)}:${installment}`;
 const post=async(n,category,source,amount=-10000,status='posted',day=id(4),dayNumber=7)=>db.query(`insert into team_finance_transactions(id,team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at) values($1,$2,$3,$4,$5,$6,$7,'Test receipt',$8,now()) on conflict(team_season_id,source_reference) do nothing`,[id(n),id(6),day,dayNumber,amount,category,status,source]);
 const saving=async n=>Number(await scalar(`select coalesce(sum(amount) filter(where status='posted'),0) from team_finance_transactions where source_reference=$1`,[`financial-director:salary-savings:${id(n)}`]));
 const advance=async()=>db.exec(`update season_days set calendar_date=calendar_date-1;insert into season_days values(gen_random_uuid(),'${id(3)}',(select current_day_number+1 from seasons),(now() at time zone 'Europe/Paris')::date);update seasons set current_day_number=current_day_number+1;`);
 for(const [index,code]of ['finance_daily_income','finance_race_prizes','finance_main_sponsor','finance_secondary_sponsor','finance_rider_salary'].entries()){
   await advance();await db.query('update staff_members set level=$1 where id=$2',[index+1,id(10)]);
   await db.query('update staff_member_talents set talent_code=$1 where staff_member_id=$2',[code,id(10)]);
   check(await scalar('select settle_due_financial_director_income()'),1);
   check(Number(await scalar(`select amount from team_finance_transactions where source_reference='financial-director:daily:'||(select id::text from season_days where season_id='${id(3)}' and day_number=(select current_day_number from seasons))`)),[220,495,935,1760,3190][index]);
   check(await scalar('select settle_due_financial_director_income()'),0);
 }
 // Restore a salary due today, with both savings talents and an unrelated race talent.
 await db.exec(`update seasons set current_day_number=14;
 update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date-7 where id='${id(4)}';
 update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date where id='${id(5)}';
 update staff_contracts set signed_at=now()-interval '20 days';
 delete from staff_member_talents;insert into staff_member_talents values
 ('${id(10)}',1,'finance_daily_income',now()-interval '20 days'),('${id(10)}',2,'finance_rider_salary',now()-interval '20 days'),('${id(10)}',3,'finance_race_prizes',now()-interval '20 days');`);
 await post(31,'staff_salary',salaryRef('staff-contract',13,2),-10000,'pending',id(5),14);
 check(await saving(31),0);
 await db.query(`update team_finance_transactions set status='posted' where id=$1`,[id(31)]);
 check(await saving(31),1100); // 10% plus national affinity.
 await db.query(`update team_finance_transactions set status='posted' where id=$1`,[id(31)]);
 check(await saving(31),1100);
 await db.exec(`update staff_members set level=1,country_id='${id(2)}' where id='${id(10)}';`);
 await db.query(`update team_finance_transactions set amount=-20000 where id=$1`,[id(31)]);
 check(await saving(31),2200); // Frozen 11%, not today's level/country.
 await db.query(`update team_finance_transactions set status='cancelled' where id=$1`,[id(31)]);
 check(await saving(31),0);
 await db.exec(`update staff_contracts set status='terminated' where id='${id(12)}'`);
 await db.query(`update team_finance_transactions set status='posted' where id=$1`,[id(31)]);
 check(await saving(31),2200); // Restoring a receipt restores its original entitlement.
 await post(32,'rider_salary',salaryRef('rider-salary',14),-10000);
 check(await saving(32),0); // No current director.
 await db.exec(`update staff_contracts set status='active' where id='${id(12)}'`);
 await post(33,'rider_salary',salaryRef('rider-salary',14,2),-10000,'posted',id(5),14);
 check(await saving(33),200); // One-star director without national affinity.
 await post(34,'staff_salary',salaryRef('staff-contract',12),-22500);
 check(await saving(34),0); // Never discounts the finance director's own wages.
 await post(35,'staff_salary',`staff-dismissal:${id(13)}`);
 await post(36,'staff_salary',`staff-signing:${id(13)}`);
 await post(37,'rider_salary',`rider-dismissal:${id(14)}`);
 await post(38,'rider_salary',salaryRef('rider-salary',15)); // Another team's contract.
 await post(39,'transfer',`transfer:${id(14)}`);
 for(const n of [35,36,37,38,39])check(await saving(n),0);
 await post(40,'staff_salary',`staff-contract:------------------------------------:${id(3)}:1`);
 check(await saving(40),0); // Malformed references cannot stop a salary settlement.
 // Rate is attached to the right domain, never both for one salary.
 await db.exec(`delete from staff_member_talents where talent_code='finance_rider_salary'`);
 await post(41,'rider_salary',salaryRef('rider-salary',16,2),-10000,'posted',id(5),14);
 check(await saving(41),0);
 await db.exec(`insert into staff_member_talents values('${id(10)}',2,'finance_rider_salary',now()+interval '1 day')`);
 await post(42,'rider_salary',salaryRef('rider-salary',17,2),-10000,'posted',id(5),14);
 check(await saving(42),0); // Future/unearned talent cannot affect an earlier payment.
 await post(43,'staff_salary',`staff-contract:${id(13)}:${id(999)}:1`);
 check(await saving(43),0); // Wrong season.
 await db.exec(`insert into season_days values('${id(9)}','${id(3)}',28,(now() at time zone 'Europe/Paris')::date+14);
 update staff_member_talents set created_at=now()-interval '20 days';`);
 await post(45,'rider_salary',salaryRef('rider-salary',18,4),-10000,'posted',id(9),28);
 check(await saving(45),0); // Future payroll cannot be paid early for a rebate.
 await db.exec(`update staff_contracts set signed_at=now() where id='${id(12)}'`);
 await post(46,'rider_salary',salaryRef('rider-salary',18,1));
 check(await saving(46),0); // A director hired today cannot discount overdue past wages.
 await db.exec(`update staff_contracts set signed_at=now()-interval '20 days' where id='${id(12)}'`);
 await post(44,'race_prize','race:unchanged',10000);
 check(Number(await scalar(`select amount from team_finance_transactions where source_reference='financial-director:bonus:${id(44)}'`)),200);
 await db.query(`update team_finance_transactions set amount=5000 where id=$1`,[id(44)]);
 check(Number(await scalar(`select amount from team_finance_transactions where source_reference='financial-director:bonus:${id(44)}'`)),100);
 check(await scalar(`select has_function_privilege('authenticated','public.settle_due_financial_director_income()','execute')`),false);
 check(await scalar(`select has_table_privilege('authenticated','private.financial_director_salary_savings','select')`),false);
 check(await scalar(`select has_function_privilege('authenticated','private.credit_financial_director_salary_savings()','execute')`),false);
 // Daily replacement and level changes still cannot create two team/day receipts.
 check(await scalar('select settle_due_financial_director_income()'),1);
 check(await scalar('select settle_due_financial_director_income()'),0);
 check(Number(await scalar('select cash_balance from team_seasons')),
   Number(await scalar(`select sum(amount) from team_finance_transactions where status='posted' and source_reference like 'financial-director:%'`)));
 console.log(JSON.stringify({isolatedPostgres:true,checks,productionFixtures:false}));
}finally{await db.close();}
