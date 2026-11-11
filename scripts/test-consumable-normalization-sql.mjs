// Isolated PostgreSQL/WASM only. Real redemption bodies, no production actions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]??'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite();let checks=0;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=async(sql,params=[])=>(await db.query(sql,params)).rows;
const scalar=async(sql,params=[])=>Object.values((await rows(sql,params))[0])[0];
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const denied=async(sql,params=[])=>{await assert.rejects(()=>db.query(sql,params));checks++;};
const baseline=JSON.parse(readFileSync('scripts/fixtures/ordinary-consumables-baseline.json','utf8'));
const groups=JSON.parse(readFileSync('lib/game/consumable-equivalences.json','utf8'));
const migration=readFileSync('supabase/migrations/20261105103000_normalize_ordinary_consumable_duplicates.sql','utf8');
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.sync_active_season_day() returns void language sql as $$select$$;
 create table seasons(id uuid primary key,game_year int,status text,current_day_number int);
 create table season_days(id uuid primary key,season_id uuid references seasons,day_number int);
 create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
 create table team_manager_assignments(sporting_director_id uuid references sporting_directors,team_id uuid,role text,status text);
 create table team_seasons(id uuid primary key,team_id uuid,season_id uuid references seasons,status text,registration_country_id uuid);
 create table riders(id uuid primary key,potential_steps int check(potential_steps between 0 and 8),status text,country_id uuid,career_race_days int default 0);
 create table rider_contracts(rider_id uuid references riders,team_id uuid,status text);
 create table rider_season_ratings(rider_id uuid references riders,season_id uuid references seasons,
 mountain int default 50,hills int default 50,flat int default 50,time_trial int default 50,cobbles int default 50,sprint int default 50,
 acceleration int default 50,downhill int default 50,endurance int default 50,resistance int default 50,recovery int default 50,breakaway int default 50,prologue int default 50,updated_at timestamptz default now());
 create table inventory_catalog_items(id uuid primary key default gen_random_uuid(),item_key text unique,name text,description text,effect_summary text,icon_key text,category text,effect_payload jsonb,rarity text,status text default 'active',is_consumable bool default true,updated_at timestamptz default now());
 create table team_item_inventory(id uuid primary key default gen_random_uuid(),team_season_id uuid references team_seasons,inventory_item_id uuid references inventory_catalog_items,quantity int check(quantity>=0),acquired_at timestamptz default now(),updated_at timestamptz default now(),unique(team_season_id,inventory_item_id));
 create table rider_consumable_item_applications(id uuid primary key,rider_id uuid,inventory_item_id uuid,team_season_id uuid,category text,item_name text,effect_summary text,ability_code text,potential_bonus int,rating_key text,rating_bonus int);
 create table daily_reward_catalog(reward_key text primary key,name text,description text,effect_summary text,icon_key text,effect_kind text,effect_payload jsonb,importance int,is_active bool);
 create table daily_reward_inventory(id uuid primary key default gen_random_uuid(),sporting_director_id uuid references sporting_directors,team_season_id uuid references team_seasons,reward_key text references daily_reward_catalog,
 status text default 'available',expires_after_game_year int,acquired_at timestamptz default now(),used_at timestamptz,usage_payload jsonb,source_reference text);
 create table special_ability_catalog(code text primary key,name text not null,effect_description text not null,icon_key text not null,medallion_tone text not null,is_active bool default true,
 constraint special_ability_catalog_code_allowed check(code='panache'));
 create table rider_special_abilities(rider_id uuid,ability_code text references special_ability_catalog(code),source_type text,source_reference text,unique(rider_id,ability_code));
 insert into special_ability_catalog values('panache','Panache','Baseline description','fireworks','gold',true);
 insert into seasons values('${id(1)}',4,'active',10),('${id(2)}',5,'planned',1);
 insert into season_days values('${id(3)}','${id(1)}',10);
 insert into sporting_directors values('${id(10)}','${id(11)}','active'),('${id(20)}','${id(21)}','active');
 insert into team_manager_assignments values('${id(10)}','${id(12)}','general_manager','active'),('${id(20)}','${id(22)}','general_manager','active');
 insert into team_seasons values('${id(13)}','${id(12)}','${id(1)}','active','${id(99)}'),('${id(23)}','${id(22)}','${id(1)}','active','${id(99)}');
 insert into riders values('${id(30)}',2,'active','${id(99)}',0),('${id(31)}',2,'active','${id(99)}',0);
 insert into rider_contracts values('${id(30)}','${id(12)}','active'),('${id(31)}','${id(22)}','active');
 insert into rider_season_ratings(rider_id,season_id)select '${id(30)}',id from seasons;
 select set_config('request.jwt.claim.sub','${id(11)}',false);
 `);
 for(const r of baseline.catalog) {
  if(r.source==='daily_reward') await db.query('insert into daily_reward_catalog values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',[r.key,r.name,r.description,r.effect_summary,r.icon_key,r.effect_kind,JSON.stringify(r.effect_payload),Number(r.tier),r.status==='true']);
  else await db.query('insert into inventory_catalog_items(item_key,name,description,effect_summary,icon_key,category,effect_payload,rarity,status)values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',[r.key,r.name,r.description,r.effect_summary,r.icon_key,r.effect_kind,JSON.stringify(r.effect_payload),r.tier,r.status]);
 }
 for(const fn of baseline.functions)await db.exec(fn.definition);
 const before=await scalar("select md5(string_agg(reward_key||importance::text||effect_kind||effect_payload::text,','order by reward_key))from daily_reward_catalog");
 await db.exec(migration);
 check(await scalar("select md5(string_agg(reward_key||importance::text||effect_kind||effect_payload::text,','order by reward_key))from daily_reward_catalog"),before);
 check(await scalar('select count(*)::int from daily_reward_inventory'),0);
 for(const g of groups)for(const m of g.members) {
  check(await scalar('select private.inventory_consumable_equivalence($1,$2,$3,$4::jsonb)',[m.source,m.key,m.kind,JSON.stringify(m.payload)]),g.key);
  check(await scalar('select private.inventory_consumable_equivalence($1,$2,$3,$4::jsonb)',[m.source,m.key,m.kind,JSON.stringify({...m.payload,maximumRating:79})]),m.source+':'+m.key);
 }
 for(const role of ['anon','authenticated'])check(await scalar(`select has_function_privilege('${role}','private.inventory_consumable_equivalence(text,text,text,jsonb)','execute')`),false);
 check(await scalar("select has_function_privilege('authenticated','redeem_current_daily_rewards(uuid,integer,uuid,text,text,uuid)','execute')"),true);
 check(await scalar("select has_function_privilege('anon','use_current_team_inventory_items(uuid,uuid,integer)','execute')"),false);
 const daily=async(n,key,expiry=5,director=10)=> db.query('insert into daily_reward_inventory(id,sporting_director_id,team_season_id,reward_key,expires_after_game_year,source_reference)values($1,$2,$3,$4,$5,$6)',[id(n),id(director),id(director===10?13:23),key,expiry,'origin-'+n]);
 const redeem=(n,q,stat='endurance')=>scalar('select redeem_current_daily_rewards($1,$2,$3,$4)',[id(n),q,id(30),stat]);
 await daily(101,'secondary-technique',5);await daily(102,'secondary-specialization',4);await daily(103,'secondary-specialization',3);await daily(104,'secondary-specialization',5,20);
 await redeem(101,1);
 check(await scalar(`select status from daily_reward_inventory where id='${id(102)}'`),'used');
 check(await scalar(`select status from daily_reward_inventory where id='${id(101)}'`),'available');
 await denied('select redeem_current_daily_rewards($1,2,$2,$3)',[id(101),id(30),'endurance']);
 check(await scalar(`select endurance from rider_season_ratings where season_id='${id(1)}'`),51);
 check(await scalar(`select status from daily_reward_inventory where id='${id(101)}'`),'available');
 await daily(105,'secondary-specialization',4);await redeem(101,2);
 check(await scalar(`select endurance from rider_season_ratings where season_id='${id(1)}'`),53);
 check(await scalar(`select endurance from rider_season_ratings where season_id='${id(2)}'`),53);
 check(await scalar("select count(*)::int from daily_reward_inventory where status='used'"),3);
 check(await scalar("select count(*)::int from daily_reward_inventory where source_reference like 'origin-%'"),5);
 await daily(106,'high-performance-cell',5);await daily(107,'high-performance-cell',5);
 await db.exec(`update rider_season_ratings set mountain=78;`);
 await denied('select redeem_current_daily_rewards($1,2,$2,$3)',[id(106),id(30),'mountain']);
 check(await scalar(`select mountain from rider_season_ratings where season_id='${id(1)}'`),78);
 check(await scalar("select count(*)::int from daily_reward_inventory where reward_key='high-performance-cell' and status='available'"),2);
 const stock=async(key,q,team=13)=> db.query('insert into team_item_inventory(team_season_id,inventory_item_id,quantity)select $1,id,$2 from inventory_catalog_items where item_key=$3 on conflict(team_season_id,inventory_item_id)do update set quantity=excluded.quantity',[id(team),q,key]);
 const consume=async(key,q,rider=30)=>scalar('select use_current_team_inventory_items($1,(select id from inventory_catalog_items where item_key=$2),$3)',[id(rider),key,q]);
 await stock('potential-notebook',1);await stock('classified-talent-dossier',2);await stock('potential-spark',2);await stock('classified-talent-dossier',7,23);
 await consume('classified-talent-dossier',3);
 check(await scalar(`select potential_steps from riders where id='${id(30)}'`),8);
 check(await scalar(`select count(*)::int from team_item_inventory s join inventory_catalog_items c on c.id=s.inventory_item_id where s.team_season_id='${id(13)}' and c.item_key in('potential-notebook','classified-talent-dossier')`),0);
 check(await scalar(`select quantity from team_item_inventory where team_season_id='${id(23)}'`),7);
 check(await scalar('select count(*)::int from rider_consumable_item_applications'),3);
 await stock('potential-notebook',1);await stock('classified-talent-dossier',1);
 await db.exec(`update riders set potential_steps=6 where id='${id(30)}'`);
 await assert.rejects(()=>consume('potential-notebook',2));checks++;
 check(await scalar(`select potential_steps from riders where id='${id(30)}'`),6);
 check(await scalar(`select sum(quantity)::int from team_item_inventory where team_season_id='${id(13)}'`),4);
 await assert.rejects(()=>consume('potential-notebook',3));checks++;
 check(await scalar('select count(*)::int from rider_consumable_item_applications'),3);
 await assert.rejects(()=>consume('potential-notebook',1,31));checks++;
 await stock('acceleration-focus',2);
 await db.exec('update rider_season_ratings set acceleration=99;');
 await assert.rejects(()=>consume('acceleration-focus',2));checks++;
 check(await scalar(`select acceleration from rider_season_ratings where season_id='${id(1)}'`),99);
 await consume('acceleration-focus',1);
 check(await scalar(`select acceleration from rider_season_ratings where season_id='${id(1)}'`),100);

 const etapovore=readFileSync('supabase/migrations/20261109161000_add_etapovore_special_ability.sql','utf8');
 await db.exec(etapovore);
 await db.exec(etapovore);
 check(await rows("select code,name,is_active from special_ability_catalog order by code"),[
  {code:'etapovore',name:'Étapovore',is_active:true},{code:'panache',name:'Panache',is_active:true},
 ]);
 check(await rows("select category,rarity,status,effect_payload from inventory_catalog_items where item_key='medallion-etapovore'"),[
  {category:'special_ability',rarity:'epic',status:'active',effect_payload:{abilityCode:'etapovore'}},
 ]);
 check(await scalar('select count(*)::int from rider_special_abilities'),0);
 check(await scalar("select count(*)::int from team_item_inventory stock join inventory_catalog_items item on item.id=stock.inventory_item_id where item.item_key='medallion-etapovore'"),0);
 await stock('medallion-etapovore',2);
 await consume('medallion-etapovore',1);
 check(await scalar('select ability_code from rider_special_abilities where rider_id=$1',[id(30)]),'etapovore');
 await assert.rejects(()=>consume('medallion-etapovore',1),/déjà cette capacité spéciale/);checks++;
 check(await scalar("select quantity from team_item_inventory stock join inventory_catalog_items item on item.id=stock.inventory_item_id where item.item_key='medallion-etapovore'"),1);
 await db.query("insert into riders(id,potential_steps,status,country_id) values($1,2,'active',$2)",[id(32),id(99)]);
 await db.query("insert into rider_contracts values($1,$2,'active')",[id(32),id(12)]);
 await daily(109,'talent-revealed');
 await scalar('select redeem_current_daily_rewards($1,1,$2,null,$3)',[id(109),id(32),'etapovore']);
 check(await scalar('select ability_code from rider_special_abilities where rider_id=$1',[id(32)]),'etapovore');

 // Use the real persistent morale helper and the existing inventory RPCs.
 const extract=(source,start,end)=>{
  const first=source.indexOf(start), last=source.indexOf(end,first);
  assert(first>=0&&last>first,start);
  return source.slice(first,last+end.length);
 };
 const moraleSource=readFileSync('supabase/migrations/20260927233500_reapply_persistent_rider_morale.sql','utf8').replaceAll('\r','');
 const targetSource=readFileSync('supabase/migrations/20260827110000_add_injury_care_items.sql','utf8').replaceAll('\r','');
 const oldCatalogSource=readFileSync('supabase/migrations/20260930120000_add_scouting_visibility_consumable.sql','utf8').replaceAll('\r','');
 await db.exec(`
   alter table rider_contracts add column start_season_id uuid,add column end_season_id uuid;
   update rider_contracts set start_season_id='${id(1)}',end_season_id='${id(2)}';
   alter table riders add column first_name text not null default 'Test',add column last_name text not null default 'Coureur';
   create table countries(id uuid primary key,name text);
   insert into countries values('${id(99)}','France');
   create table rider_injuries(id uuid primary key,rider_id uuid,status text,diagnosis_code text,expected_recovery_at timestamptz);
   create table rider_condition_states(id uuid primary key default gen_random_uuid(),rider_id uuid,season_day_id uuid,
     form numeric not null,fatigue int not null,morale numeric not null default 60,source text,updated_at timestamptz not null default now(),
     unique(rider_id,season_day_id),check(morale between 0 and 100));
   insert into season_days values('${id(4)}','${id(1)}',9);
   insert into rider_condition_states(rider_id,season_day_id,form,fatigue,morale) values('${id(30)}','${id(4)}',81,12,83);
   ${extract(oldCatalogSource,'alter table public.daily_reward_catalog\n  add constraint daily_reward_catalog_effect_allowed','  );')}
   ${extract(moraleSource,'create table public.rider_morale_events (','\n);')}
   ${extract(moraleSource,'create or replace function public.apply_rider_morale_event(','\n$$;').replace("'manual_adjustment'","'manual_adjustment', 'race_load', 'international_callup_refusal'")}
   alter table public.rider_morale_events drop constraint rider_morale_events_source_allowed;
   alter table public.rider_morale_events add constraint rider_morale_events_source_allowed
     check (source_type in ('social_integration','team_tenure','stage_result','race_result','favorite_race',
       'injury','training_overload','mixed_zone_interview','academy_promotion','manual_adjustment','race_load')
       or source_type='international_callup_refusal') not valid;
   revoke all on function public.apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb) from public,anon,authenticated;
   revoke all on function public.redeem_current_daily_reward_without_high_performance_cap(uuid,uuid,text,text,uuid) from public,anon,authenticated;
   ${extract(targetSource,'create or replace function public.get_current_team_item_target_values()','\n$$;')}
 `);
 const moraleMigration=readFileSync('supabase/migrations/20261111191000_add_rider_morale_consumables.sql','utf8');
 await db.exec(moraleMigration);
 const moraleKeys=['morale_boost_5','morale_boost_10'];
 check(await rows('select reward_key,importance,effect_payload,is_active from daily_reward_catalog where reward_key=any($1) order by importance',[moraleKeys]),[
  {reward_key:moraleKeys[0],importance:3,effect_payload:{amount:5,level:3},is_active:true},
  {reward_key:moraleKeys[1],importance:5,effect_payload:{amount:10,level:5},is_active:true},
 ]);
 const condition=()=>rows("select form::float,fatigue,morale::float from rider_condition_states where rider_id=$1 and season_day_id=$2",[id(30),id(3)]);
 const useMorale=(reward,quantity=1,rider=30)=>scalar('select redeem_current_daily_rewards($1,$2,$3)',[id(reward),quantity,id(rider)]);
 const stockStatus=reward=>scalar('select status from daily_reward_inventory where id=$1',[id(reward)]);
 const events=()=>rows("select requested_delta::float,applied_delta::float,morale_after::float from rider_morale_events where source_type='consumable' order by morale_before,applied_delta");
 const currentTarget=async()=> (await scalar('select get_current_team_item_target_values()')).find(rider=>rider.id===id(30));
 check((await currentTarget()).morale,83);
 await daily(120,moraleKeys[0]);await daily(121,moraleKeys[0]);await daily(122,moraleKeys[1]);await daily(123,moraleKeys[1],5,20);
 await denied('select redeem_current_daily_rewards($1,3,$2)',[id(120),id(30)]);
 await assert.rejects(()=>useMorale(120,1,31));checks++;
 await assert.rejects(()=>useMorale(123));checks++;
 await db.query('update rider_contracts set start_season_id=$1 where rider_id=$2',[id(2),id(30)]);
 await assert.rejects(()=>useMorale(120));checks++;
 await db.query('update rider_contracts set start_season_id=$1 where rider_id=$2',[id(1),id(30)]);
 await assert.rejects(()=>scalar('select redeem_current_daily_rewards($1,1,null)',[id(120)]));checks++;
 check(await Promise.all([120,121,122,123].map(stockStatus)),['available','available','available','available']);
 check(await condition(),[]);
 check(await events(),[]);
 const group=await useMorale(120,2);
 check(group.quantityApplied,2);
 check(await condition(),[{form:81,fatigue:12,morale:93}]);
 check(await Promise.all([120,121,122,123].map(stockStatus)),['used','used','available','available']);
 const capped=await useMorale(122);
 check(capped.moraleAppliedDelta,7);
 check(capped.moraleAfter,100);
 check((await currentTarget()).morale,100);
 check(await condition(),[{form:81,fatigue:12,morale:100}]);
 check(await events(),[
  {requested_delta:5,applied_delta:5,morale_after:88},
  {requested_delta:5,applied_delta:5,morale_after:93},
  {requested_delta:10,applied_delta:7,morale_after:100},
 ]);
 await assert.rejects(()=>useMorale(122));checks++;
 check((await events()).length,3);
 await daily(124,'energy-ration');
 await useMorale(124);
 check(await condition(),[{form:86,fatigue:12,morale:100}]);
 check(await scalar("select has_function_privilege('authenticated','apply_rider_morale_event(uuid,uuid,text,text,numeric,text,jsonb)','execute')"),false);

 const cycle=readFileSync('supabase/migrations/20260809141000_extend_daily_reward_cycle.sql','utf8').replaceAll('\r','');
 const claim=readFileSync('supabase/migrations/20260829100000_preserve_daily_reward_cycle_after_absence.sql','utf8').replaceAll('\r','');
 const persistence=readFileSync('supabase/migrations/20261106223000_persist_owned_inventory_rewards_across_seasons.sql','utf8').replaceAll('\r','');
 await db.exec(`
   create table daily_reward_claims(id uuid primary key,sporting_director_id uuid,team_season_id uuid,season_id uuid,
     season_day_id uuid,streak_day int,importance int,reward_key text,unique(sporting_director_id,season_day_id));
   create table daily_reward_streak_states(sporting_director_id uuid primary key,cycle_day int,
     last_claimed_game_day_index int,last_claim_id uuid,updated_at timestamptz);
   alter table daily_reward_inventory add column source_claim_id uuid references daily_reward_claims;
   ${extract(cycle,'create or replace function public.get_daily_reward_importance(','\n$$;')}
   ${extract(cycle,'create or replace function public.get_next_daily_reward_cycle_day(','\n$$;')}
   ${extract(claim,'create or replace function public.claim_current_daily_reward(','\n$$;')}
   ${extract(persistence,'create or replace function private.preserve_owned_inventory_reward_lifetime()','\n$$;')}
   ${extract(persistence,'create trigger zzz_preserve_owned_inventory_reward_lifetime','for each row execute function private.preserve_owned_inventory_reward_lifetime();')}
 `);
 for (const [key,tier,cycleDay,day] of [[moraleKeys[0],3,7,11],[moraleKeys[1],5,25,12]]) {
  const offeredDay=await scalar(`select seed from generate_series(200,399) as seed
   where not exists (select 1 from season_days where id=('00000000-0000-4000-8000-'||lpad(seed::text,12,'0'))::uuid)
   and (select reward_key from daily_reward_catalog where is_active and importance=$1
   order by md5(reward_key||$2||('00000000-0000-4000-8000-'||lpad(seed::text,12,'0'))) limit 1)=$3
   order by seed limit 1`,[tier,id(10),key]);
  assert.ok(offeredDay,`Expected a winning daily offer for ${key}`);
  await db.query('insert into season_days values($1,$2,$3)',[id(offeredDay),id(1),day]);
  await db.query('update seasons set current_day_number=$1 where id=$2',[day,id(1)]);
  await db.query(`insert into daily_reward_streak_states(sporting_director_id,cycle_day,last_claimed_game_day_index)
    values($1,$2,$3) on conflict(sporting_director_id) do update set cycle_day=excluded.cycle_day`,
    [id(10),cycleDay-1,4*28+day-1]);
  const received=await scalar('select claim_current_daily_reward($1)',[key]);
  check(received.importance,tier);
  check(await rows('select reward_key,status,expires_after_game_year,source_claim_id from daily_reward_inventory where id=$1',[received.inventoryId]),[
    {reward_key:key,status:'available',expires_after_game_year:2147483647,source_claim_id:received.claimId},
  ]);
  await denied('select claim_current_daily_reward($1)',[key]);
 }

 await db.exec("select set_config('request.jwt.claim.sub','',false)");
 await assert.rejects(()=>consume('potential-notebook',1));checks++;
 await denied('select redeem_current_daily_rewards($1,1,$2,$3)',[id(106),id(30),'mountain']);
 // Reapplying canonical wording never touches ownership, effects or reward odds.
 const ledger=await scalar("select md5(string_agg(row_to_json(i)::text,','order by id))from daily_reward_inventory i");
 await db.exec(migration);
 check(await scalar("select md5(string_agg(row_to_json(i)::text,','order by id))from daily_reward_inventory i"),ledger);
 console.log(JSON.stringify({checks,isolated:true,realRedemptionBodies:true,provenancePreserved:true}));
}catch(error){console.error(error.message,error.where??'');process.exitCode=1;}finally{await db.close();}
