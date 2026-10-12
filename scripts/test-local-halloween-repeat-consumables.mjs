// Called exclusively by the isolated PGlite harness, never against production.
import { readFile } from 'node:fs/promises';

export async function verifyHalloweenRepeatConsumables(db, { id, action, check, fail, q, scalar, wallet }) {
  const effectsBefore = await q('select rider_id,item_id,user_id,used_at,protection_expires_at from halloween_rider_effects order by rider_id,item_id');
  const walletsBefore = await q('select * from halloween_wallets order by user_id');
  const hashesBefore = await q("select md5(pg_get_functiondef('halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift,md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) training");
  await db.exec(await readFile('supabase/migrations/20261012120000_repeat_halloween_consumables.sql', 'utf8'));
  check(await q('select rider_id,item_id,user_id,used_at,protection_expires_at from halloween_rider_effects order by rider_id,item_id'), effectsBefore);
  check(await q('select * from halloween_wallets order by user_id'), walletsBefore);
  check(await q("select md5(pg_get_functiondef('halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift,md5(pg_get_functiondef('settle_due_training_sessions()'::regprocedure)) training"), hashesBefore);
  check(await scalar("select pg_get_constraintdef(oid) as value from pg_constraint where conrelid='halloween_rider_effects'::regclass and contype='p'"), 'PRIMARY KEY (id)');
  const prices = { 'pumpkin-juice':12, 'mummy-bandage':16, 'scouts-candy':20, 'gravediggers-hourglass':24,
    'midnight-chocolate':16, 'spectres-tea':100, 'giants-syrup':100, 'immortality-pact':1800,
    'mummy-resurrection':720, 'full-moon-elixir':560, 'cursed-builders-seal':900, 'witches-star':3600, 'youth-fountain':6000 };
  for (const [item, price] of Object.entries(prices)) check(await scalar('select price as value from halloween_catalog where id=$1', [item]), price);
  // Parse and exercise the exact read-only verification used by the production installer.
  await db.exec("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text); create function settle_due_free_agent_training(integer) returns integer language sql as $$select 0$$");
  const installer = await readFile('scripts/apply-reviewed-halloween-consumables.mjs','utf8');
  const verification = installer.match(/const check = `([\s\S]*?)`;/)[1].replaceAll('${version}','20261012120000');
  const verified = (await db.exec(verification)).find(result=>result.rows?.[0]?.installed!==undefined).rows[0];
  check(verified.installed,true); check(verified.catalog_updated,true); check(verified.repeat_key,true);
  // A second pact extends an already protected rider without multiplying training effects.
  await action('buy',{item:'immortality-pact'});
  await action('use',{item:'immortality-pact',target:id(501)});
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+120");
  check(await scalar('select settle_due_training_sessions() as value'),0);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+169");
  check(await scalar('select settle_due_training_sessions() as value'),5);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date-1");
  check(await scalar('select settle_due_training_sessions() as value'),5);
  await db.exec("update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date");
  await q('insert into auth.users values($1)', [id(9)]);
  await q("insert into sporting_directors values($1,$2,'active','Repeated consumables','director_m_01')", [id(109),id(9)]);
  await q("insert into team_manager_assignments values($1,$2,'active','general_manager')", [id(109),id(209)]);
  await q('insert into team_seasons values($1,$2,$3,null)', [id(309),id(209),id(400)]);
  await q("insert into riders(id,first_name,last_name,height_cm,weight_kg,baseline_weight_kg,potential_steps) values($1,'Repeat','Test',180,72,72,2)", [id(709)]);
  await q("insert into rider_contracts values($1,$2,'active')", [id(709),id(209)]);
  await q('insert into rider_season_ratings values($1,$2,26,now())', [id(709),id(400)]);
  await q("insert into seasons values($1,'planned',5,1)",[id(402)]);
  await q('insert into rider_season_ratings values($1,$2,27,now())',[id(709),id(402)]);
  await q("insert into rider_condition_states values($1,$2,80,9,'daily_reward',now())", [id(709),id(401)]);
  await action('join', {}, id(9));
  await q('update halloween_wallets set coins=200000 where user_id=$1', [id(9)]);
  const buy = (item, request) => action('buy', {item}, id(9), request);
  const applyDose = (item, request, target=id(709)) => action('use', {item,target}, id(9), request);
  const stock = async item => (await wallet(id(9))).inventory[item];

  // A repeated HTTP request is not an additional purchase or application.
  const moneyBefore = (await wallet(id(9))).coins;
  await buy('spectres-tea', id(9901)); await buy('spectres-tea', id(9901));
  check((await wallet(id(9))).coins, moneyBefore-100); check(await stock('spectres-tea'),1);
  await applyDose('spectres-tea', id(9902)); await applyDose('spectres-tea', id(9902));
  check(Number(await scalar('select weight_kg as value from riders where id=$1',[id(709)])),71);
  check(await stock('spectres-tea'),0);
  await buy('spectres-tea'); await applyDose('spectres-tea');
  check(Number(await scalar('select weight_kg as value from riders where id=$1',[id(709)])),70);
  check(await scalar("select count(*)::integer as value from halloween_rider_effects where rider_id=$1 and item_id='spectres-tea'",[id(709)]),2);
  // A transfer does not reintroduce the former career lock; ownership is still checked.
  await q('update rider_contracts set team_id=$1 where rider_id=$2',[id(208),id(709)]);
  await action('join',{},id(8)); await q('update halloween_wallets set coins=10000 where user_id=$1',[id(8)]);
  await action('buy',{item:'spectres-tea'},id(8)); await action('use',{item:'spectres-tea',target:id(709)},id(8));
  check(Number(await scalar('select weight_kg as value from riders where id=$1',[id(709)])),69);
  await buy('spectres-tea'); await fail(()=>applyDose('spectres-tea'),/votre équipe/); check(await stock('spectres-tea'),1);
  await q('update rider_contracts set team_id=$1 where rider_id=$2',[id(209),id(709)]);
  for(let n=0;n<2;n++){await buy('giants-syrup'); await applyDose('giants-syrup');}
  check(Number(await scalar('select height_cm as value from riders where id=$1',[id(709)])),184);
  check(Number(await scalar('select baseline_weight_kg as value from riders where id=$1',[id(709)])),72);
  await q('update riders set weight_kg=61 where id=$1',[id(709)]);
  await fail(()=>applyDose('spectres-tea'),/limites physiques/); check(await stock('spectres-tea'),1);
  await q('update riders set height_cm=209,weight_kg=90 where id=$1',[id(709)]);
  await buy('giants-syrup'); await fail(()=>applyDose('giants-syrup'),/limites physiques/); check(await stock('giants-syrup'),1);
  await q('update riders set height_cm=184,weight_kg=69 where id=$1',[id(709)]);
  await q("update riders set status='retired' where id=$1",[id(709)]);
  await fail(()=>applyDose('spectres-tea'),/retraité/); check(await stock('spectres-tea'),1);
  await q("update riders set status='active' where id=$1",[id(709)]);
  await q("insert into race_registrations values($1,$2,'accepted')",[id(9100),id(9101)]);
  await q('insert into race_rosters values($1,$2)',[id(709),id(9100)]);
  await q("insert into stages values($1,'in_progress',now(),100)",[id(9101)]);
  await fail(()=>applyDose('spectres-tea'),/course en cours/); check(await stock('spectres-tea'),1);
  await q("update stages set status='completed',departure_at=now()-interval '1 day' where race_edition_id=$1",[id(9101)]);

  for(let n=0;n<5;n++) await buy('witches-star');
  await fail(()=>buy('witches-star'),/Limite/); check(await stock('witches-star'),5);
  for(let n=0;n<3;n++) await applyDose('witches-star');
  check(await scalar('select potential_steps as value from riders where id=$1',[id(709)]),8);
  await fail(()=>applyDose('witches-star'),/3 étoiles ou moins/); check(await stock('witches-star'),2);
  for(let n=0;n<3;n++) await buy('youth-fountain');
  await applyDose('youth-fountain'); await applyDose('youth-fountain');
  check(await scalar('select age as value from rider_season_ratings where rider_id=$1 and season_id=$2',[id(709),id(400)]),24);
  check(await scalar('select age as value from rider_season_ratings where rider_id=$1 and season_id=$2',[id(709),id(402)]),25);
  await fail(()=>applyDose('youth-fountain'),/25 ans ou plus/); check(await stock('youth-fountain'),1);

  await buy('immortality-pact'); await applyDose('immortality-pact');
  await buy('immortality-pact'); await applyDose('immortality-pact');
  check(await scalar("select (max(protection_expires_at) at time zone 'Europe/Paris')::date-(min(protection_expires_at) at time zone 'Europe/Paris')::date as value from halloween_rider_effects where rider_id=$1 and item_id='immortality-pact'",[id(709)]),84);
  check(await scalar("select count(*)::integer as value from halloween_rider_effects where rider_id=$1 and item_id='immortality-pact'",[id(709)]),2);
  await q("update halloween_rider_effects set protection_expires_at=now()-interval '1 day' where rider_id=$1 and item_id='immortality-pact'",[id(709)]);
  await buy('immortality-pact'); await applyDose('immortality-pact');
  check(await scalar("select max(protection_expires_at)=halloween_pact_expires_at(now(),null) as value from halloween_rider_effects where rider_id=$1 and item_id='immortality-pact'",[id(709)]),true);
  for(const [start,previous,expected] of [
    ['2026-10-12 05:00Z',null,'2027-01-04T07:00:00.000Z'],
    ['2026-10-12 06:00Z',null,'2027-01-05T07:00:00.000Z'],
    ['2026-10-24 05:00Z',null,'2027-01-16T07:00:00.000Z'],
    ['2026-10-12 05:00Z','2027-01-04 07:00Z','2027-03-29T06:00:00.000Z'],
  ]) check((await scalar('select halloween_pact_expires_at($1,$2) as value',[start,previous])).toISOString(),expected);

  // Existing repeatable effects remain repeatable with their usual boundaries.
  for(let n=0;n<2;n++){await buy('pumpkin-juice');await applyDose('pumpkin-juice'); await buy('midnight-chocolate');await applyDose('midnight-chocolate');}
  check(Number(await scalar('select form as value from rider_condition_states where rider_id=$1',[id(709)])),90);
  check(await scalar('select fatigue as value from rider_condition_states where rider_id=$1',[id(709)]),9);
  check(await scalar('select career_race_days as value from riders where id=$1',[id(709)]),2);
  await buy('full-moon-elixir'); await applyDose('full-moon-elixir'); await buy('full-moon-elixir');
  await fail(()=>applyDose('full-moon-elixir'),/100/); check(await stock('full-moon-elixir'),1);
  await q('update rider_condition_states set form=90 where rider_id=$1',[id(709)]); await applyDose('full-moon-elixir');
  for(let n=0;n<2;n++){
    await q("insert into rider_injuries(id,rider_id,status,expected_recovery_at,diagnosis_code) values($1,$2,'active',now()+interval '2 days','fall')",[id(9200+n),id(709)]);
    await buy('mummy-resurrection'); await applyDose('mummy-resurrection');
  }
  check(await scalar("select count(*)::integer as value from rider_injuries where rider_id=$1 and status='recovered'",[id(709)]),2);
  await buy('scouts-candy'); await applyDose('scouts-candy'); await buy('scouts-candy'); await applyDose('scouts-candy');
  check(await scalar('select scouting_reports_revealed_until>now()+interval \'47 hours\' as value from team_seasons where id=$1',[id(309)]),true);
  // An extra gift is still available even after the fifth purchase of a non-star relic.
  for(let n=0;n<3;n++) await buy('full-moon-elixir');
  await fail(()=>buy('full-moon-elixir'),/Limite/);
  await q("select halloween_gift('halloween-2026',$1,'repeat-test-podium','{\"item\":\"full-moon-elixir\"}')",[id(9)]);
  check((await wallet(id(9))).obtained['full-moon-elixir'],6);
  const starMoney=(await wallet(id(9))).coins;
  await q("select halloween_gift('halloween-2026',$1,'repeat-test-star','{\"item\":\"witches-star\"}')",[id(9)]);
  check((await wallet(id(9))).coins,starMoney+15); check(await stock('witches-star'),2);
  // Direct clients cannot invoke the privileged application or change effect history.
  await db.exec('set role authenticated');
  await fail(()=>q('select halloween_use_item($1,$2,$3)',[id(9),'spectres-tea',id(709)]),/permission denied/);
  await fail(()=>q("insert into halloween_rider_effects(rider_id,item_id,user_id) values($1,'spectres-tea',$2)",[id(709),id(9)]),/permission denied/);
  await db.exec('reset role');
}
