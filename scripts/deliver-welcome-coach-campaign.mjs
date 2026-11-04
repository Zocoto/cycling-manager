// Exact campaign activation and real missing-grant recovery only. No test users.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--preflight','--apply-reviewed','--verify'].includes(mode)
 ||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked production project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261104170000',name='add_ten_day_welcome_coach_campaign';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
const directory='C:/Dev/artifacts/welcome-coach-campaign-20261104';mkdirSync(directory,{recursive:true});
const query=sql=>{
 const file=path.join(directory,'command.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:50000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local application_name='welcome-coach-campaign-verification';${sql};commit;`);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}'limit 1`)[0];
const protectedState=()=>ro(`select
 md5(pg_get_functiondef('private.grant_new_director_welcome_boost()'::regprocedure)) previous_welcome,
 md5(pg_get_functiondef('public.calculate_staff_salary(text,integer)'::regprocedure)) salary,
 md5(pg_get_functiondef('public.sync_staff_salary_installments(uuid)'::regprocedure)) installments,
 md5(pg_get_functiondef('public.handle_staff_contract_finance_change()'::regprocedure)) finance_trigger,
 (select string_agg(tgname,','order by tgname)from pg_trigger where tgrelid='public.initial_career_generations'::regclass and not tgisinternal and tgname<>'initial_career_welcome_s5_coach') previous_career_triggers
`)[0];
const initialReceipt=receipt();if(initialReceipt)assert.deepEqual(initialReceipt,{name,hash});
const beforeFile=path.join(directory,'before.json');
if(mode==='--preflight'){
 const active=ro("select game_year from public.seasons where status='active' limit 1")[0];assert.ok([4,5].includes(active.game_year));
 const talents=ro("select count(*)::int n from public.staff_talent_catalog where role='trainer' and is_active and minimum_level<=3")[0].n;assert.ok(talents>=2);
 if(!initialReceipt)writeFileSync(beforeFile,JSON.stringify(protectedState(),null,2));
 console.log(JSON.stringify({readOnly:true,activeSeason:active.game_year,eligibleTalents:talents,alreadyInstalled:!!initialReceipt}));
}else{
 if(mode==='--apply-reviewed'&&!initialReceipt){
  assert.ok(existsSync(beforeFile),'Read-only preflight required');
  assert.deepEqual(protectedState(),JSON.parse(readFileSync(beforeFile,'utf8')),'Existing welcome or staff rules changed after review');
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)values('${version}','${name}',array[${quote(source)}]);commit;`));
 }
 assert.deepEqual(receipt(),{name,hash});
 assert.deepEqual(protectedState(),JSON.parse(readFileSync(beforeFile,'utf8')));
 const pending=()=>ro(`select g.id from public.initial_career_generations g
  join public.sporting_directors d on d.id=g.sporting_director_id and d.status='active'
  join auth.users a on a.id=d.auth_user_id
  join public.team_seasons ts on ts.team_id=g.team_id and ts.season_id=g.season_id
  join private.welcome_coach_campaigns c on c.code='welcome_s5_november_2026'
   and a.created_at>=c.starts_at and a.created_at<c.ends_at
  where not exists(select 1 from public.alpha_bot_managers b where b.sporting_director_id=d.id)
   and not exists(select 1 from private.welcome_coach_grants w where w.auth_user_id=a.id)
  order by g.id limit 10`);
 // Close the tiny activation/trigger-installation race for genuine new accounts.
 // This is an actual requested gift, never an onboarding simulation or fixture.
 if(mode==='--apply-reviewed')for(const g of pending()){
  assert.match(g.id,/^[0-9a-f-]{36}$/i);
  query(`begin;set local lock_timeout='500ms';set local statement_timeout='5s';select private.grant_welcome_coach(${quote(g.id)}::uuid);commit;`);
 }
 assert.equal(pending().length,0,'A real eligible account still needs its welcome coach');
 const campaign=ro(`select code,starts_at,ends_at,coach_level,extract(epoch from ends_at-starts_at)::int duration_seconds,
  to_char(starts_at at time zone 'Europe/Paris','YYYY-MM-DD HH24:MI:SS') starts_paris,
  to_char(ends_at at time zone 'Europe/Paris','YYYY-MM-DD HH24:MI:SS') ends_paris
  from private.welcome_coach_campaigns where code='welcome_s5_november_2026'`)[0];
 assert.equal(campaign.coach_level,3);assert.equal(campaign.duration_seconds,864000);
 const check=ro(`select
  (select count(*)::int from pg_trigger where tgrelid='public.initial_career_generations'::regclass and tgname='initial_career_welcome_s5_coach'and tgenabled='O') enabled_trigger,
  has_function_privilege('authenticated','private.grant_welcome_coach(uuid)','execute') authenticated_execution,
  has_table_privilege('authenticated','private.welcome_coach_grants','select') public_receipts,
  (select count(*)::int from private.welcome_coach_grants) gifts,
  (select count(*)::int from private.welcome_coach_grants g join public.staff_members m on m.id=g.staff_member_id join public.staff_contracts c on c.id=g.staff_contract_id
   where m.role<>'trainer' or m.level<3 or c.signing_fee<>0 or c.salary_waived_season_id is distinct from g.season_id) inconsistent_gifts
 `)[0];
 assert.equal(check.enabled_trigger,1);assert.equal(check.authenticated_execution,false);assert.equal(check.public_receipts,false);assert.equal(check.inconsistent_gifts,0);
 const response=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
 const proof={checkedAt:new Date().toISOString(),recorded:true,campaign,check,previousOnboardingAndStaffRulesPreserved:true,noMissingEligibleGift:true,publicHttp:response.status};
 writeFileSync(path.join(directory,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}
