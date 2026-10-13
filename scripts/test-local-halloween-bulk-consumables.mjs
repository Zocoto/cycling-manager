// Run only through the isolated PGlite harness. No production credentials.
import { readFile } from 'node:fs/promises';
export async function verifyHalloweenBulkConsumables(db, { id, action, check, fail, q, scalar, wallet }) {
  await db.exec(`create function get_current_team_item_target_values() returns jsonb language sql stable as $$
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name)),'[]'::jsonb)
      from riders r join rider_contracts c on c.rider_id=r.id and c.status='active'
      join team_manager_assignments a on a.team_id=c.team_id and a.status='active'
      join sporting_directors d on d.id=a.sporting_director_id and d.auth_user_id=auth.uid();$$;`);
  const before = await q('select * from halloween_wallets order by user_id');
  const hashes = await q("select md5(pg_get_functiondef('halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift,md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) training,md5(pg_get_functiondef('get_current_team_item_target_values()'::regprocedure)) targets");
  await db.exec(await readFile('supabase/migrations/20261013143000_bulk_halloween_inventory_consumables.sql','utf8'));
  check(await q('select * from halloween_wallets order by user_id'),before);
  check(await q("select md5(pg_get_functiondef('halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift,md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) training,md5(pg_get_functiondef('get_current_team_item_target_values()'::regprocedure)) targets"),hashes);
  const user=id(9), rider=id(709);
  const stock = async(item,quantity=30)=>q('update halloween_wallets set inventory=jsonb_set(inventory,array[$1],to_jsonb($2::integer)) where user_id=$3',[item,quantity,user]);
  const use = (item,quantity=1,target=rider,request)=>action('use',{item,quantity,...(target?{target}:{})},user,request);
  const count = async item=>(await wallet(user)).inventory[item];
  const form = async()=>Number(await scalar('select form as value from rider_condition_states where rider_id=$1 and season_day_id=$2',[rider,id(401)]));
  await q('update rider_condition_states set form=60 where rider_id=$1',[rider]);
  await stock('pumpkin-juice');
  const result=await use('pumpkin-juice',6,rider,id(980001));
  check(result.quantityApplied,6);check(Number(result.before.form),60);check(Number(result.after.form),90);check(await form(),90);check(await count('pumpkin-juice'),24);
  await use('pumpkin-juice',6,rider,id(980001));check(await form(),90);check(await count('pumpkin-juice'),24);
  await fail(()=>use('pumpkin-juice',5,rider,id(980001)),/autrement/);
  const capped=await use('pumpkin-juice',6);check(capped.quantityApplied,2);check(await form(),100);check(await count('pumpkin-juice'),22);
  await fail(()=>use('pumpkin-juice'),/Aucun effet/);check(await count('pumpkin-juice'),22);
  for(const quantity of [0,-1,31,1.5,'2',null]) await fail(()=>use('pumpkin-juice',quantity),/quantité|Quantité|entière/);
  await stock('pumpkin-juice',2);await fail(()=>use('pumpkin-juice',3),/stock/);check(await count('pumpkin-juice'),2);
  await fail(()=>use('pumpkin-cap'),/consommable/);
  await fail(()=>use('pumpkin-juice',1,id(501)),/votre équipe/);

  // Fatigue floor used in production: prevent every zero-gain application.
  await q("insert into rider_injuries values($1,$2,'active',now()+interval '1 day','fatigue_exhaustion',null,now())",[id(980010),rider]);
  await q('update rider_condition_states set form=0 where rider_id=$1',[rider]);
  await stock('full-moon-elixir',3);
  await fail(()=>use('pumpkin-juice'),/blessure de fatigue/);check(await count('pumpkin-juice'),2);check(await form(),0);
  await fail(()=>use('full-moon-elixir'),/blessure de fatigue/);check(await count('full-moon-elixir'),3);
  await stock('mummy-resurrection',2);await use('mummy-resurrection');check(await form(),0);
  await use('full-moon-elixir');check(await form(),100);check(await count('full-moon-elixir'),2);
  for(const item of ['full-moon-elixir','mummy-resurrection','cursed-builders-seal','headless-frame-claim']) await fail(()=>use(item,2),/un exemplaire/);

  // Existing future snapshots receive the actual capped delta; fatigue survives.
  await q('insert into season_days values($1,$2,3,(now() at time zone \'Europe/Paris\')::date+1)',[id(980020),id(400)]);
  await q("insert into rider_condition_states values($1,$2,85,7,'nutritionist',now())",[rider,id(980020)]);
  await q('update rider_condition_states set form=97,fatigue=9 where rider_id=$1 and season_day_id=$2',[rider,id(401)]);
  await use('pumpkin-juice',2);check(await form(),100);
  check(Number(await scalar('select form as value from rider_condition_states where rider_id=$1 and season_day_id=$2',[rider,id(980020)])),88);
  check(await scalar('select fatigue as value from rider_condition_states where rider_id=$1 and season_day_id=$2',[rider,id(980020)]),7);
  await db.exec(`set role authenticated;select set_config('test.user','${user}',false)`);
  const targets=await scalar('select get_current_halloween_item_target_values() as value');check(targets.length,1);check(Number(targets[0].form),100);check(Number(targets[0].weightKg),69);check(targets[0].age,24);
  await fail(()=>q('select halloween_use_items($1,$2,$3,1)',[user,'pumpkin-juice',rider]),/permission denied/);
  await fail(()=>q('select halloween_item_target_state($1,$2,$3)',[user,'pumpkin-juice',rider]),/permission denied/);
  await db.exec('reset role');
  await q('delete from rider_condition_states where season_day_id=$1',[id(980020)]);

  await q('update riders set height_cm=180,weight_kg=72,potential_steps=2 where id=$1',[rider]);
  await stock('spectres-tea');await use('spectres-tea',3);check(Number(await scalar('select weight_kg as value from riders where id=$1',[rider])),69);
  await stock('giants-syrup');await use('giants-syrup',2);check(Number(await scalar('select height_cm as value from riders where id=$1',[rider])),184);
  await q('update riders set weight_kg=62 where id=$1',[rider]);
  await fail(()=>use('spectres-tea',3),/limites physiques/);check(Number(await scalar('select weight_kg as value from riders where id=$1',[rider])),62);check(await count('spectres-tea'),27);
  await q('update riders set height_cm=208,weight_kg=90 where id=$1',[rider]);
  await fail(()=>use('giants-syrup',2),/limites physiques/);check(Number(await scalar('select height_cm as value from riders where id=$1',[rider])),208);check(await count('giants-syrup'),28);
  await stock('witches-star',5);await use('witches-star',3);check(await scalar('select potential_steps as value from riders where id=$1',[rider]),8);
  await fail(()=>use('witches-star'),/3 étoiles/);check(await count('witches-star'),2);
  await q('update riders set potential_steps=6 where id=$1',[rider]);await fail(()=>use('witches-star',2),/3 étoiles/);check(await scalar('select potential_steps as value from riders where id=$1',[rider]),6);check(await count('witches-star'),2);
  await stock('youth-fountain',5);await q('update rider_season_ratings set age=27 where rider_id=$1',[rider]);
  await use('youth-fountain',3);check(await scalar('select age as value from rider_season_ratings where rider_id=$1 and season_id=$2',[rider,id(400)]),24);
  await q('update rider_season_ratings set age=25 where rider_id=$1',[rider]);await fail(()=>use('youth-fountain',2),/25 ans/);check(await count('youth-fountain'),2);check(await scalar('select age as value from rider_season_ratings where rider_id=$1 and season_id=$2',[rider,id(400)]),25);
  await stock('midnight-chocolate');const experience=await scalar('select career_race_days as value from riders where id=$1',[rider]);await use('midnight-chocolate',6);check(await scalar('select career_race_days as value from riders where id=$1',[rider]),experience+6);
  await stock('scouts-candy');await use('scouts-candy',3,null);check(await count('scouts-candy'),27);
  const protectionBefore=await scalar("select max(protection_expires_at) as value from halloween_rider_effects where rider_id=$1 and item_id='immortality-pact'",[rider]);
  await stock('immortality-pact',5);await use('immortality-pact',3);check(await count('immortality-pact'),2);
  check(await scalar("select (max(protection_expires_at) at time zone 'Europe/Paris')::date-($2::timestamptz at time zone 'Europe/Paris')::date as value from halloween_rider_effects where rider_id=$1 and item_id='immortality-pact'",[rider,protectionBefore]),252);
  await q("insert into rider_injuries values($1,$2,'active',now()+interval '25 hours','sprain',null,now())",[id(980030),rider]);
  await stock('mummy-bandage',5);const bandages=await use('mummy-bandage',5);check(bandages.quantityApplied,3);check(await count('mummy-bandage'),2);
  check(await scalar('select status as value from rider_injuries where id=$1',[id(980030)]),'recovered');
  await stock('gravediggers-hourglass',8);await stock('cursed-builders-seal',1);
  await q("insert into infrastructure_projects(id,team_id,status,infrastructure_code,target_level,starts_game_day_index,completes_game_day_index,final_duration_days) values($1,$2,'active','medical_center',2,113,122,9)",[id(980040),id(209)]);
  const hourglass=await use('gravediggers-hourglass',8,id(980040));check(hourglass.quantityApplied,4);check(await count('gravediggers-hourglass'),4);check(Number(hourglass.after.remainingDays),1);
  await fail(()=>use('gravediggers-hourglass',1,id(980040)),/Aucun effet/);
  await use('cursed-builders-seal',1,id(980040));check(await scalar('select status as value from infrastructure_projects where id=$1',[id(980040)]),'completed');
  await stock('cursed-builders-seal',1);
  await fail(()=>use('cursed-builders-seal',1,id(980040)),/chantier/);
  await stock('cursed-builders-seal',1);await q("insert into infrastructure_projects(id,team_id,status,infrastructure_code,country_id,target_level,starts_game_day_index,completes_game_day_index,final_duration_days) values($1,$2,'active','international_youth_center',$3,2,113,122,9)",[id(980041),id(209),id(980099)]);
  await fail(()=>use('cursed-builders-seal',1,id(980041)),/hors école/);check(await count('cursed-builders-seal'),1);
  await stock('headless-frame-claim',1);await use('headless-frame-claim',1,null);check(await count('headless-frame-claim'),0);
  await q('delete from team_equipment_inventory where team_season_id=$1',[id(309)]);
  // Race locks and retired riders apply to the entire batch, never one dose only.
  await stock('midnight-chocolate',3);await q("update riders set status='retired' where id=$1",[rider]);await fail(()=>use('midnight-chocolate',3),/retraité/);check(await count('midnight-chocolate'),3);
  await q("update riders set status='active' where id=$1",[rider]);await q("update stages set status='in_progress' where race_edition_id=$1",[id(9101)]);await fail(()=>use('midnight-chocolate',3),/course en cours/);check(await count('midnight-chocolate'),3);
  await q("update stages set status='completed' where race_edition_id=$1",[id(9101)]);
  await stock('midnight-chocolate',10);
  const experienceBefore=await scalar('select career_race_days as value from riders where id=$1',[rider]);
  await Promise.all([use('midnight-chocolate',3,rider,id(980070)),use('midnight-chocolate',3,rider,id(980070))]);
  check(await count('midnight-chocolate'),7);check(await scalar('select career_race_days as value from riders where id=$1',[rider]),experienceBefore+3);
  check(await scalar('select count(*)::integer as value from halloween_requests where user_id=$1 and id=$2',[user,id(980070)]),1);
  const installer=await readFile('scripts/apply-reviewed-halloween-bulk-consumables.mjs','utf8');
  const verification=installer.match(/const check=`([\s\S]*?)`;/)[1].replaceAll('${version}','20261013143000');
  const verified=(await db.exec(verification)).find(result=>result.rows?.[0]?.installed!==undefined).rows[0];
  check(verified.installed,true);
}
