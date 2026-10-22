// Runs only against PostgreSQL in WASM. Never connects to Supabase.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]).href);
const db=new PGlite();let checks=0;
const id=name=>{const s=createHash('md5').update(name).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const prepare=year=>scalar('select public.prepare_cyclogazette_season_gala($1)',[id('s'+year)]);
const awards=year=>rows('select award_key,team_id,stat_value::float8 as stat_value,stat_label from season_awards where season_id=$1 order by award_key',[id('s'+year)]);
async function season(year,status='active',day=14){
 await db.query("insert into seasons values($1,$2,$3,$4,$5,'2026-10-01','2026-10-28')",[id('s'+year),'Saison '+year,year,status,day]);
}
async function team(name,size,homegrown,nations,local='a',year=4,bot=false){
 const teamId=id('team'+name),director=id('ds'+name);
 await db.query('insert into teams values($1) on conflict do nothing',[teamId]);
 await db.query('insert into sporting_directors values($1,$2) on conflict do nothing',[director,name]);
 await db.query("insert into team_seasons values($1,$2,$3,'active',$4,100,1,$5)",[id('ts'+name+year),teamId,id('s'+year),name,id('country'+local)]);
 await db.query("insert into team_manager_assignments values($1,$2,$3,'general_manager','active',$4,null,now()) on conflict do nothing",[id('manager'+name),teamId,director,id('s1')]);
 if(bot)await db.query('insert into alpha_bot_managers values($1)',[director]);
 for(let i=0;i<size;i++){
  const rider=id(`rider${name}${year}-${i}`);
  await db.query('insert into riders values($1,$2,$3,$4)',[rider,name,String(i),id('country'+nations[i%nations.length])]);
  await db.query("insert into rider_contracts values($1,$2,$3,$4,$4,null,'active',1,null,now())",[id(`contract${name}${year}-${i}`),rider,teamId,id('s'+year)]);
  if(i<homegrown)await db.query("insert into youth_academy_riders values($1,$2,$3,'promoted',$4)",[id(`academy${name}${year}-${i}`),teamId,rider,id('s1')]);
 }
}
try{
 await db.exec(await readFile('scripts/fixtures/season-awards-schema.sql','utf8'));
 const initial=await readFile('supabase/migrations/20260905153000_create_season_awards.sql','utf8');
 await db.exec(initial.slice(initial.indexOf('create table public.season_awards'),initial.indexOf('create or replace function private.create_season_awards_for_season')));
 const expansion=await readFile('supabase/migrations/20260921120000_expand_season_awards.sql','utf8');
 await db.exec(expansion.slice(expansion.indexOf('alter table public.season_awards'),expansion.indexOf('alter function private.create_season_awards_for_season')));
 await db.exec(await readFile('scripts/fixtures/season-awards-before-20261022.sql','utf8'));
 await db.exec(`create function private.create_season_awards_after_completion() returns trigger language plpgsql as $$ begin if new.status='completed' and old.status is distinct from 'completed' then perform private.create_season_awards_for_season(new.id); end if; return new; end; $$;
  create trigger create_season_awards_after_completion after update of status on seasons for each row execute function private.create_season_awards_after_completion();`);
 await season(1,'completed',28);await season(3,'active',28);await season(4);await season(5,'planned',1);await season(6,'planned',1);
 await team('Alpha',7,4,['a','a','a','a','b','c','d']);
 await team('Bravo',5,3,['a','a','a','a','b']);
 await team('Charlie',3,0,['a']);
 await team('Delta',6,0,['a']);
 await team('Empty',0,0,['a']);
 await team('Bot',8,8,['a','b','c','d','e','f','g','h'],'a',4,true);
 // A rider trained elsewhere is not homegrown at the current club.
 await db.query("insert into youth_academy_riders values($1,$2,$3,'promoted',$4)",[id('former-academy'),id('teamAlpha'),id('riderBravo4-4'),id('s1')]);
 // Renewal duplicates must not inflate the denominator.
 await db.query("insert into rider_contracts select $1,rider_id,team_id,start_season_id,end_season_id,left_season_id,status,joined_day_number,left_day_number,signed_at-interval '1 day' from rider_contracts where id=$2",[id('duplicate'),id('contractAlpha4-0')]);
 // Cancelled, departed and future riders must not enter the final roster.
 for(const [label,status,start,left] of [['cancelled','cancelled',4,null],['departed','terminated',4,4],['future','planned',5,null]]){
  await db.query('insert into riders values($1,$2,$2,$3)',[id(label),label,id('countryx'+label)]);
  await db.query('insert into rider_contracts values($1,$2,$3,$4,$5,$6,$7,1,14,now())',[id('contract'+label),id(label),id('teamBravo'),id('s'+start),id('s5'),left?id('s'+left):null,status]);
 }
 // Populate all legacy categories with real rows, so all 19 execute unchanged.
 await db.query("insert into race_editions values($1,$2,'in_progress')",[id('race4'),id('s4')]);
 await db.query("insert into stages values($1,$2,'in_progress')",[id('stage4'),id('race4')]);
 await db.query('insert into race_registrations values($1,$2)',[id('reg4'),id('tsAlpha4')]);
 for(let i=0;i<2;i++){
  await db.query('insert into race_rosters values($1,$2,$3)',[id('roster'+i),id('riderAlpha4-'+i),id('reg4')]);
  await db.query("insert into race_results values($1,$2,$3,'classified',$4,$5)",[id('result'+i),id('race4'),id('roster'+i),i+1,id('injury'+i)]);
  await db.query('insert into stage_results values($1,$2)',[id('roster'+i),id('injury'+i)]);
  await db.query('insert into rider_injuries values($1,$2,$3,$4)',[id('injury'+i),id('riderAlpha4-'+i),id('stage4'),i+2]);
 }
 await db.query('insert into rider_season_summaries values($1,$2,500,2,1)',[id('riderAlpha4-0'),id('s4')]);
 await db.query('insert into rider_season_ratings values($1,$2,22)',[id('riderAlpha4-0'),id('s4')]);
 await db.query('insert into direct_transfer_offers values($1,$2,$3)',[id('teamBravo'),id('dsBravo'),id('s4')]);
 await db.query('insert into cyclogazette_editions values($1,$2)',[id('gazette4'),id('s4')]);
 for(const [game,club] of [['sudoku','Alpha'],['crossword','Bravo']])await db.query('insert into cyclogazette_game_completions values($1,$2,$3,$4)',[id('gazette4'),id('ts'+club+4),id('ds'+club),game]);
 await db.query("insert into infrastructure_projects values($1,$2,'completed',1000)",[id('teamCharlie'),id('s4')]);
 await db.query("insert into post_race_interviews values($1,$2,$3,'submitted')",[id('dsAlpha'),id('teamAlpha'),id('s4')]);
 await db.query("insert into pre_race_press_conferences values($1,$2,$3,'published')",[id('dsAlpha'),id('teamAlpha'),id('s4')]);
 await db.query("insert into global_chat_messages values($1,$2,$3,'2026-10-14T12:00:00Z')",[id('message'),id('dsBravo'),id('teamBravo')]);
 await db.query('insert into global_chat_message_reactions values($1)',[id('message')]);
 await db.query("insert into youth_academy_riders values($1,$2,null,'active',$3)",[id('junior'),id('teamDelta'),id('s4')]);
 await db.query("insert into development_ranking_entries values($1,$2,'Junior',100,2,3,$3,'individual')",[id('ranking'),id('junior'),id('s4')]);
 // Exercise the existing completion trigger before replacing the builder.
 await db.query("insert into team_seasons values($1,$2,$3,'completed','Historical',123,1,$4)",[id('historical-ts'),id('teamAlpha'),id('s3'),id('countrya')]);
 await db.query("update seasons set status='completed' where id=$1",[id('s3')]);
 const historical=await awards(3);
 await db.exec(await readFile('supabase/migrations/20261022170000_recurring_season_awards_and_roster_identity.sql','utf8'));
 eq(await awards(3),historical,'Migration preserves every historical award');
 eq(await scalar('select count(*)::int from season_award_finalizations'),0,'No historical backfill or active awards during deployment');
 eq((await prepare(4)).ready,false,'No awards before J28');
 await db.query('update seasons set current_day_number=28 where id=$1',[id('s4')]);
 eq((await prepare(4)).reason,'races-still-pending','Final race must finish');
 eq((await awards(4)).length,0,'Pending races create no partial award set');
 await db.query("update race_editions set status='completed' where id=$1",[id('race4')]);
 const start=performance.now();const result=await prepare(4);const elapsed=performance.now()-start;
 eq(result.ready,true,'J28 awards are ready in every season');
 eq(result.awardCount,22,'All 19 legacy categories and 3 new categories are published');
 const winners=await awards(4);const byKey=Object.fromEntries(winners.map(a=>[a.award_key,a]));
 eq(byKey.homegrown_squad.team_id,id('teamBravo'),'Largest homegrown percentage wins, not largest count; bots excluded');
 eq(Number(byKey.homegrown_squad.stat_value),60,'Homegrown share uses unique current riders, excludes future/cancelled/departed');
 eq(byKey.homegrown_squad.stat_label,'% · 3/5','Frozen numerator and denominator are visible');
 eq(byKey.national_identity.team_id,id('teamDelta'),'Equal percentage is broken by matching rider count');
 eq(Number(byKey.national_identity.stat_value),100,'Team registration nationality is used');
 eq(byKey.international_squad.team_id,id('teamAlpha'),'Diversity counts distinct sporting nationalities, excluding bots');
 eq(Number(byKey.international_squad.stat_value),4,'Multiple riders of a country count once');
 eq(byKey.injury_rider.stat_value,3,'Injury award remains unchanged');
 eq(byKey.youth_developer.team_id,id('teamDelta'),'Existing academy-count award remains distinct from homegrown share');
 eq((await prepare(4)).reason,'already-finalized','Retries use the frozen receipt');
 await db.query("update rider_contracts set status='cancelled' where team_id=$1",[id('teamBravo')]);
 await db.query('update riders set country_id=$1',[id('countryz')]);
 await prepare(4);eq(await awards(4),winners,'Transfers and nationality changes after the ceremony cannot change winners');
 await db.query("update seasons set status='completed' where id=$1",[id('s4')]);
 eq(await awards(4),winners,'Completion trigger does not recalculate already frozen awards');
 eq(await scalar('select count(*)::int from season_award_finalizations where season_id=$1',[id('s4')]),1,'One receipt per season');
 await team('Next',3,2,['a','a','b'],'a',5);
 await db.query("update seasons set status='active',current_day_number=28 where id=$1",[id('s5')]);
 eq((await prepare(5)).ready,true,'The following season automatically runs the same circuit');
 const next=Object.fromEntries((await awards(5)).map(a=>[a.award_key,a]));
 eq(Number(next.homegrown_squad.stat_value),66.67,'Percentage keeps two decimal places');
 eq(Number(next.national_identity.stat_value),66.67,'National share keeps two decimal places');
 eq(Number(next.international_squad.stat_value),2,'Next season gets its own diversity award');
 eq(await awards(4),winners,'A new ceremony preserves previous seasons');
 await db.query("update seasons set status='active',current_day_number=28 where id=$1",[id('s6')]);
 eq(await prepare(6),{ready:true,reason:'ready',pendingStages:0,pendingEditions:0,awardCount:0},'Empty categories do not block publication with an exact award-count requirement');
 await season(7,'active',28);await team('Fallback',3,1,['a','b','c'],'a',7);
 eq((await awards(7)).length,0,'No award is created by ordinary roster changes');
 await db.query("update seasons set status='completed' where id=$1",[id('s7')]);
 eq((await awards(7)).filter(a=>['homegrown_squad','national_identity','international_squad'].includes(a.award_key)).length,3,'Existing completion trigger creates new awards even if J28 publication was missed');
 eq((await prepare(7)).reason,'already-finalized','Completed-season fallback has the same frozen receipt');
 await season(8,'active',28);await team('Foreign',2,0,['b','c'],'a',8);
 eq((await prepare(8)).ready,true,'A season with no eligible homegrown or national winner still publishes');
 eq((await awards(8)).filter(a=>['homegrown_squad','national_identity'].includes(a.award_key)).length,0,'No zero-percent award is invented');
 eq((await awards(8)).find(a=>a.award_key==='international_squad')?.stat_value,2,'Diversity is still awarded independently');
 for(const role of ['anon','authenticated']){
  eq(await scalar(`select has_function_privilege('${role}','public.prepare_cyclogazette_season_gala(uuid)','execute')`),false,role+' cannot award honours');
  eq(await scalar(`select has_table_privilege('${role}','public.season_award_finalizations','insert')`),false,role+' cannot forge a receipt');
  eq(await scalar(`select has_function_privilege('${role}','private.create_season_awards_before_roster_identity(uuid)','execute')`),false,role+' cannot bypass finalization');
 }
 if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(await rows(`select n.nspname||'.'||p.proname as name,md5(replace(p.prosrc,E'\\r\\n',E'\\n')) as md5
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='private' and p.proname in('create_core_season_awards_before_expansion','create_season_awards_before_roster_identity','create_season_awards_for_season','season_awards_ready','create_season_awards_after_completion'))
  or(n.nspname='public' and p.proname='prepare_cyclogazette_season_gala') order by name`),null,2));
 console.log(`${checks} isolated PostgreSQL checks passed. Full 22-award calculation: ${elapsed.toFixed(0)} ms on isolated PGlite (not a production benchmark).`);
}catch(error){console.error(JSON.stringify({message:error.message,detail:error.detail,where:error.where?.slice(0,1600)},null,2));process.exitCode=1;}finally{await db.close();}
