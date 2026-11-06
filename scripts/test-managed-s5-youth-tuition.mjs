// Isolated bookkeeping checks: never connects to the live project.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {managedS5YouthTuitionPostcheckSql} from './lib/managed-s5-youth-tuition-20261106.mjs';
if(!process.argv[2]?.replaceAll('\\','/').endsWith('/pglite/dist/index.js'))throw Error('Pass a local PGlite module.');
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const team={bot_key:'test',team_id:id(1),team_season_id:id(2),season_id:id(5)};
const action={bot_key:'test',rpc:'sign_current_team_youth_candidate',args:{p_candidate_id:id(3)}};
const post=managedS5YouthTuitionPostcheckSql(action,team);
const sql=(rider=id(4))=>`do $$declare v_result jsonb:='["${rider}"]'::jsonb;begin ${post} end$$;`;
let checks=0;
const rows=async(s,args=[]) => (await db.query(s,args)).rows;
const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const state=async()=>({ledger:await rows('select * from team_finance_transactions order by source_reference'),accounts:await rows('select * from team_seasons order by id')});
try{
  await db.exec(`create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,cash_balance numeric);
    create table youth_academy_riders(id uuid primary key,candidate_id uuid,team_id uuid,joined_season_id uuid,
      joined_day_number int,status text,tuition_per_season numeric,first_name text,last_name text);
    create table season_days(id uuid primary key default gen_random_uuid(),season_id uuid,day_number int);
    create table team_finance_transactions(team_season_id uuid,season_day_id uuid,day_number int,amount numeric,
      category text,status text,description text,source_reference text,unique(team_season_id,source_reference));
    insert into team_seasons values('${id(2)}','${id(1)}','${id(5)}',100000),('${id(22)}','${id(21)}','${id(5)}',50000);
    insert into youth_academy_riders values('${id(4)}','${id(3)}','${id(1)}','${id(5)}',1,'active',8500,'Test','Junior'),
      ('${id(24)}','${id(23)}','${id(21)}','${id(5)}',1,'active',5000,'Other','Junior');
    insert into season_days(season_id,day_number)select '${id(5)}',n from generate_series(7,28,7)n;`);
  const before=await state();await db.exec(sql());const after=await state();
  check(after.ledger.length,4,'four standard bills are created');
  check(after.ledger.map(f=>f.day_number),[7,14,21,28],'normal future due dates');
  check(after.ledger.map(f=>Number(f.amount)),[-2125,-2125,-2125,-2125],'annual tuition is split equally');
  check(after.ledger.every(f=>f.category==='training'&&f.status==='pending'),true,'pending training entries only');
  check(after.ledger.every(f=>f.team_season_id===team.team_season_id&&f.source_reference.startsWith('youth-tuition:'+id(4)+':'+id(5)+':')),true,'only the new owned academy rider is billed');
  check(after.accounts,before.accounts,'no immediate cash mutation');
  await db.exec(sql());check(await state(),after,'duplicate scheduling is a no-op');
  const fails=async(setup,statement,label)=>{
    await db.exec('begin');await db.exec(setup);await assert.rejects(()=>db.exec(statement),label);checks++;
    await db.exec('rollback');check(await state(),after,label+' rolls back atomically');
  };
  await fails('',sql(id(24)),'foreign academy rider rejected');
  const foreignPost=managedS5YouthTuitionPostcheckSql(action,{...team,team_season_id:id(22)});
  await fails('',`do $$declare v_result jsonb:='["${id(4)}"]'::jsonb;begin ${foreignPost} end$$;`,'foreign bank account rejected');
  await fails(`delete from team_finance_transactions;delete from season_days where day_number=21`,sql(),'missing date cannot underbill tuition');
  await fails('update team_finance_transactions set amount=-2000 where day_number=7',sql(),'inconsistent preexisting bill rejected');
  await fails("update team_finance_transactions set status='posted' where day_number=7",sql(),'prematurely posted bill rejected');
  assert.throws(()=>managedS5YouthTuitionPostcheckSql({...action,args:{p_candidate_id:"bad'id"}},team));checks++;
  console.log(JSON.stringify({checks,isolated:true,productionTouched:false}));
}catch(error){console.error(JSON.stringify({checks,message:error.message,where:error.where,detail:error.detail},null,2));process.exitCode=1;}
finally{await db.close();}
